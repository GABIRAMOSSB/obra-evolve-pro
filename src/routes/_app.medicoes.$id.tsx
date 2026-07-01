/**
 * Boletim de Medição — detalhe institucional SOLV.
 * Sem grades: separação por espaçamento, fundos suaves e hierarquia tipográfica.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getMedicaoDetalhe,
  salvarRascunhoMedicao,
  aprovarMedicao,
} from "@/lib/boletim-medicao.functions";
import {
  fmtMoneyBR,
  fmtNumberBR,
  fmtPctBR,
  normalizeUnidade,
  sanitizeDescricao,
  computeItem,
  computeTotais,
  classifyHierarquia,
} from "@/lib/boletim-medicao.calc";
import { generateBoletimMedicaoPDF } from "@/lib/boletim-medicao.pdf";
import { generateBoletimMedicaoXLSX } from "@/lib/boletim-medicao.xlsx";
import { VisaoExecutivaMedicao } from "@/components/VisaoExecutivaMedicao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ArrowLeft, Save, CheckCircle2, FileDown, Printer, Search, Loader2, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/medicoes/$id")({
  component: BoletimDetalhePage,
});

interface ItemLocal {
  id: string | null;
  obra_atividade_id: string | null;
  item_codigo: string;
  descricao: string;
  unidade: string | null;
  is_etapa: boolean;
  qtd_contratada: number;
  valor_unitario: number;
  qtd_acum_anterior: number;
  valor_acum_anterior: number;
  qtd_periodo: number;
  ordem: number;
  justificativa?: string | null;
}

function parseBR(v: string): number {
  if (!v) return 0;
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    rascunho: { label: "Rascunho", cls: "bg-slate-100 text-slate-700" },
    enviada: { label: "Em conferência", cls: "bg-[#F5EEDD] text-[#8A6D2E]" },
    aprovada: { label: "Aprovada", cls: "bg-emerald-50 text-emerald-700" },
    paga: { label: "Paga", cls: "bg-emerald-100 text-emerald-800" },
    rejeitada: { label: "Rejeitada", cls: "bg-red-50 text-red-700" },
    cancelada: { label: "Cancelada", cls: "bg-slate-100 text-slate-500" },
  };
  const s2 = map[s] ?? { label: s, cls: "bg-slate-100 text-slate-700" };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s2.cls}`}>{s2.label}</span>;
}

function BoletimDetalhePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const get = useServerFn(getMedicaoDetalhe);
  const salvar = useServerFn(salvarRascunhoMedicao);
  const aprovar = useServerFn(aprovarMedicao);

  const { data, isLoading } = useQuery({
    queryKey: ["medicao-detalhe", id],
    queryFn: () => get({ data: { id } }),
  });

  const [numeroBM, setNumeroBM] = useState("");
  const [dataMedicao, setDataMedicao] = useState("");
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [initialSig, setInitialSig] = useState<string>("");
  const [q, setQ] = useState("");
  const [somentePeriodo, setSomentePeriodo] = useState(false);
  const [modo, setModo] = useState<"lancamento" | "oficial" | "executiva">("lancamento");
  const modoOficial = modo === "oficial";

  useEffect(() => {
    if (!data) return;
    setNumeroBM(data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`);
    setDataMedicao(data.medicao.data_medicao ?? new Date().toISOString().slice(0, 10));
    setPeriodoInicio(data.medicao.periodo_inicio ?? "");
    setPeriodoFim(data.medicao.periodo_fim ?? "");
    const arr = data.itens as ItemLocal[];
    setItens(arr);
    setInitialSig(JSON.stringify(arr.map((i) => [i.item_codigo, i.qtd_periodo])));
  }, [data]);

  const totais = useMemo(() => computeTotais(itens), [itens]);

  const readOnly = data?.medicao?.status === "aprovada" || data?.medicao?.status === "paga";

  const dirty = useMemo(
    () => initialSig !== "" && initialSig !== JSON.stringify(itens.map((i) => [i.item_codigo, i.qtd_periodo])),
    [initialSig, itens],
  );

  const updateQtdPeriodo = useCallback((codigo: string, valor: number) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.item_codigo !== codigo) return it;
        const saldo = it.qtd_contratada - it.qtd_acum_anterior;
        if (valor > saldo + 1e-6) {
          toast.error(`${it.item_codigo}: quantidade superior ao saldo disponível (${fmtNumberBR(saldo)})`);
          return { ...it, qtd_periodo: Math.max(0, saldo) };
        }
        return { ...it, qtd_periodo: Math.max(0, valor) };
      }),
    );
  }, []);

  /** Colar coluna do Excel → distribui nos próximos itens mensuráveis, pulando etapas. */
  const handlePasteSequence = useCallback((startCodigo: string, text: string): boolean => {
    const linhas = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
    if (linhas.length <= 1) return false;
    setItens((prev) => {
      const startIdx = prev.findIndex((i) => i.item_codigo === startCodigo);
      if (startIdx < 0) return prev;
      const next = [...prev];
      let cursor = startIdx;
      let usados = 0;
      for (const raw of linhas) {
        while (cursor < next.length && next[cursor].is_etapa) cursor++;
        if (cursor >= next.length) break;
        const it = next[cursor];
        const valor = parseBR(raw);
        const saldo = it.qtd_contratada - it.qtd_acum_anterior;
        if (valor > saldo + 1e-6) {
          toast.warning(`${it.item_codigo}: ${fmtNumberBR(valor)} ajustado ao saldo ${fmtNumberBR(saldo)}`);
        }
        next[cursor] = { ...it, qtd_periodo: Math.max(0, Math.min(valor, saldo)) };
        usados++;
        cursor++;
      }
      toast.success(`${usados} valores colados (etapas puladas)`);
      return next;
    });
    return true;
  }, []);

  /** Enter avança para o próximo input mensurável. */
  const handleCellKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const inputs = Array.from(
      e.currentTarget.closest("table")?.querySelectorAll<HTMLInputElement>('input[data-bm-cell="1"]') ?? [],
    );
    const i = inputs.indexOf(e.currentTarget);
    if (i >= 0 && i + 1 < inputs.length) inputs[i + 1].focus();
  }, []);

  const filtered = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return itens.filter((it) => {
      if (somentePeriodo && !it.is_etapa && it.qtd_periodo <= 0) return false;
      if (!termo) return true;
      return it.item_codigo.toLowerCase().includes(termo) || it.descricao.toLowerCase().includes(termo);
    });
  }, [itens, q, somentePeriodo]);

  const mutSalvar = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          medicao_id: id,
          numero_bm: numeroBM,
          data_medicao: dataMedicao,
          periodo_inicio: periodoInicio,
          periodo_fim: periodoFim,
          itens: itens.map((i) => ({
            obra_atividade_id: i.obra_atividade_id,
            item_codigo: i.item_codigo,
            descricao: i.descricao,
            unidade: i.unidade,
            is_etapa: i.is_etapa,
            qtd_contratada: i.qtd_contratada,
            valor_unitario: i.valor_unitario,
            qtd_acum_anterior: i.qtd_acum_anterior,
            valor_acum_anterior: i.valor_acum_anterior,
            qtd_periodo: i.qtd_periodo,
            ordem: i.ordem,
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Rascunho salvo");
      qc.invalidateQueries({ queryKey: ["medicao-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["medicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mutAprovar = useMutation({
    mutationFn: () => aprovar({ data: { id } }),
    onSuccess: () => {
      toast.success("Medição aprovada");
      qc.invalidateQueries({ queryKey: ["medicao-detalhe", id] });
      qc.invalidateQueries({ queryKey: ["medicoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Ctrl/Cmd+S salva rascunho quando há alterações.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!readOnly && dirty && !mutSalvar.isPending) mutSalvar.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readOnly, dirty, mutSalvar]);

  // Avisa antes de sair com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);



  const buildExportData = () => ({
    medicao: {
      numero_bm: numeroBM,
      numero: data!.medicao.numero,
      data_medicao: dataMedicao,
      periodo_inicio: periodoInicio,
      periodo_fim: periodoFim,
      observacoes: data!.medicao.observacoes ?? null,
    },
    contrato: data!.contrato
      ? {
          numero: data!.contrato.numero,
          objeto: data!.contrato.objeto ?? null,
          orgao_contratante: data!.contrato.orgao_contratante ?? null,
          processo_administrativo: data!.contrato.processo_administrativo ?? null,
        }
      : null,
    obra: data!.obra
      ? {
          nome: data!.obra.nome,
          endereco: data!.obra.endereco ?? null,
          cidade: data!.obra.cidade ?? null,
          uf: data!.obra.uf ?? null,
          cliente: data!.obra.cliente ?? null,
          cnpj_cliente: data!.obra.cnpj_cliente ?? null,
          data_inicio: data!.obra.data_inicio ?? null,
        }
      : null,
    company: data!.company ?? null,
    responsavelTecnico: data!.responsaveis?.[0]
      ? {
          nome: data!.responsaveis[0].nome,
          registro: data!.responsaveis[0].registro ?? null,
          cargo: data!.responsaveis[0].cargo ?? null,
        }
      : null,
    fiscal: null,
    itens: itens,
  });

  const handleExportPDF = () => {
    if (!data) return;
    const doc = generateBoletimMedicaoPDF(buildExportData());
    doc.save(`Boletim-${numeroBM || "BM"}.pdf`);
  };

  const handleExportXLSX = async () => {
    if (!data) return;
    const blob = await generateBoletimMedicaoXLSX(buildExportData());
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Boletim-${numeroBM || "BM"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  if (isLoading || !data) {
    return (
      <div className="p-8 text-sm text-[#69717D] flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando boletim…
      </div>
    );
  }

  const nomeObra = data.obra?.nome ?? "—";
  const executora = data.company?.razao_social ?? data.company?.nome ?? "SOLV Construtora";
  const contratante = data.obra?.cliente ?? data.contrato?.orgao_contratante ?? "—";
  const endereco = [data.obra?.endereco, data.obra?.cidade, data.obra?.uf].filter(Boolean).join(", ");

  const pendencias: string[] = [];
  if (!numeroBM) pendencias.push("Número do BM");
  if (!dataMedicao) pendencias.push("Data da medição");
  if (!periodoInicio || !periodoFim) pendencias.push("Período");

  return (
    <div className="min-h-screen bg-[#F6F7F8] print:bg-white">
      {/* ===== BARRA SUPERIOR (grafite) ===== */}
      <div className="bg-[#252A33] text-white print:hidden">
        <div className="border-b border-[#C8A66A]/40">
          <div className="max-w-[1400px] mx-auto px-6 py-4 flex flex-wrap items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/medicoes" })}
              className="text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="flex-1 min-w-[240px]">
              <div className="text-[10px] uppercase tracking-widest text-[#C8A66A] font-semibold">
                SOLV Construtora · Boletim de Medição
              </div>
              <div className="text-lg font-bold leading-tight truncate">{nomeObra}</div>
            </div>
            {statusBadge(data.medicao.status)}
            {dirty && !readOnly && (
              <span className="text-[10px] uppercase tracking-widest font-bold text-[#252A33] bg-[#C8A66A] px-2 py-1 rounded-full">
                Alterações não salvas
              </span>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-full bg-white/10 p-0.5 text-[11px] font-semibold">
                {([
                  ["lancamento", "Lançamento"],
                  ["oficial", "Boletim oficial"],
                  ["executiva", "Visão executiva"],
                ] as const).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setModo(k)}
                    className={`px-3 py-1 rounded-full transition ${modo === k ? "bg-[#C8A66A] text-[#252A33]" : "text-white/70 hover:text-white"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="bg-white text-[#252A33] border-white/20 hover:bg-white/90"
                onClick={handleExportPDF}
              >
                <FileDown className="w-4 h-4 mr-1" /> PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white text-[#252A33] border-white/20 hover:bg-white/90"
                onClick={handleExportXLSX}
              >
                <FileDown className="w-4 h-4 mr-1" /> Excel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white text-[#252A33] border-white/20 hover:bg-white/90"
                onClick={handlePrint}
              >
                <Printer className="w-4 h-4 mr-1" /> Imprimir
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-white text-[#252A33] border-white/20 hover:bg-white/90"
                onClick={() => mutSalvar.mutate()}
                disabled={readOnly || mutSalvar.isPending}
              >
                {mutSalvar.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Salvar rascunho
              </Button>
              <Button
                size="sm"
                className="bg-[#C8A66A] text-[#252A33] hover:bg-[#B69354] font-semibold"
                onClick={() => mutAprovar.mutate()}
                disabled={readOnly || mutAprovar.isPending || pendencias.length > 0}
              >
                <CheckCircle2 className="w-4 h-4 mr-1" /> Validar medição
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 space-y-6 print:p-4 print:max-w-none">
        {pendencias.length > 0 && (
          <div className="flex items-center gap-2 text-xs bg-[#F5EEDD] text-[#8A6D2E] px-4 py-2 rounded-lg print:hidden">
            <AlertTriangle className="w-4 h-4" /> Informação pendente: {pendencias.join(", ")}
          </div>
        )}

        {/* ===== DADOS CONTRATUAIS ===== */}
        <div className="bg-white rounded-xl shadow-sm p-6 grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5 print:shadow-none print:rounded-none">
          <Field label="Obra" value={nomeObra} className="col-span-2" />
          <Field label="Contratante" value={contratante} />
          <Field label="Executora" value={executora} />
          <Field label="Endereço" value={endereco || "—"} className="col-span-2" />
          <Field label="CNPJ contratante" value={data.obra?.cnpj_cliente ?? "—"} />
          <Field label="Contrato nº" value={data.contrato?.numero ?? "—"} />
          <Field label="Objeto" value={data.contrato?.objeto ?? "—"} className="col-span-4" />
          <Field label="Nº BM" pending={!numeroBM}>
            <Input
              value={numeroBM}
              onChange={(e) => setNumeroBM(e.target.value)}
              disabled={readOnly}
              className="h-8 border-0 border-b border-[#D9DDE3] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#C8A66A] font-semibold text-[#20242B]"
            />
          </Field>
          <Field label="Data da medição" pending={!dataMedicao}>
            <Input
              type="date"
              value={dataMedicao}
              onChange={(e) => setDataMedicao(e.target.value)}
              disabled={readOnly}
              className="h-8 border-0 border-b border-[#D9DDE3] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#C8A66A] font-semibold"
            />
          </Field>
          <Field label="Início do período" pending={!periodoInicio}>
            <Input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              disabled={readOnly}
              className="h-8 border-0 border-b border-[#D9DDE3] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#C8A66A] font-semibold"
            />
          </Field>
          <Field label="Final do período" pending={!periodoFim}>
            <Input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              disabled={readOnly}
              className="h-8 border-0 border-b border-[#D9DDE3] rounded-none px-0 focus-visible:ring-0 focus-visible:border-[#C8A66A] font-semibold"
            />
          </Field>
        </div>

        {/* ===== KPIs ===== */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Kpi label="Valor total contrato" value={fmtMoneyBR(totais.valor_total_contrato)} />
          <Kpi label="Medição do período" value={fmtMoneyBR(totais.valor_medicao_atual)} accent />
          <Kpi label="Acumulado" value={fmtMoneyBR(totais.valor_acumulado)} />
          <Kpi label="% Executado" value={fmtPctBR(totais.percentual_executado, 2)} />
          <Kpi label="Saldo contratual" value={fmtMoneyBR(totais.saldo_contratual)} />
        </div>
        {/* Barra de progresso dourada */}
        <div className="bg-white rounded-xl px-6 py-4 shadow-sm print:shadow-none">
          <div className="flex items-center justify-between text-xs text-[#69717D] mb-2">
            <span>Progresso contratual</span>
            <span className="font-semibold text-[#20242B]">{fmtPctBR(totais.percentual_executado, 2)}</span>
          </div>
          <div className="h-2 bg-[#EEF0F2] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#C8A66A] to-[#E4D2AE]"
              style={{ width: `${Math.min(100, totais.percentual_executado * 100)}%` }}
            />
          </div>
        </div>

        {modo === "executiva" ? (
          <VisaoExecutivaMedicao
            medicaoId={id}
            itens={itens}
            valorTotalContrato={totais.valor_total_contrato}
            valorMedicaoAtual={totais.valor_medicao_atual}
            valorAcumulado={totais.valor_acumulado}
            percentualExecutado={totais.percentual_executado}
          />
        ) : (
        <>
        {/* ===== FILTROS ===== */}
        <div className={`bg-white rounded-xl shadow-sm px-4 py-3 flex flex-wrap gap-3 items-center print:hidden ${modoOficial ? "hidden" : ""}`}>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#69717D]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por código ou descrição…"
              className="pl-9 h-9 border-[#EEF0F2]"
            />
          </div>
          <label className="text-xs text-[#69717D] flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={somentePeriodo}
              onChange={(e) => setSomentePeriodo(e.target.checked)}
              className="accent-[#C8A66A]"
            />
            Somente serviços medidos neste período
          </label>
        </div>

        {/* ===== TABELA ===== */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none print:rounded-none">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] border-separate border-spacing-0">
              <thead className="bg-[#252A33] text-white text-[10.5px] uppercase tracking-wide">
                <tr>
                  <th rowSpan={2} className="text-left px-3 py-2.5 font-semibold sticky left-0 bg-[#252A33] z-10">Item</th>
                  <th rowSpan={2} className="text-left px-3 py-2.5 font-semibold">Descrição</th>
                  <th rowSpan={2} className="text-center px-2 py-2.5 font-semibold">Un.</th>
                  <th rowSpan={2} className="text-right px-3 py-2.5 font-semibold">Qtd.</th>
                  <th rowSpan={2} className="text-right px-3 py-2.5 font-semibold">V. Unit.</th>
                  <th rowSpan={2} className="text-right px-3 py-2.5 font-semibold">Total</th>
                  <th colSpan={3} className="text-center px-3 py-1.5 font-semibold border-b border-[#C8A66A]/30">Executado Físico</th>
                  <th colSpan={3} className="text-center px-3 py-1.5 font-semibold border-b border-[#C8A66A]/30">Executado Financeiro</th>
                  <th rowSpan={2} className="text-right px-3 py-2.5 font-semibold">Executado %</th>
                </tr>
                <tr className="text-[10px] text-white/80">
                  <th className="text-right px-2 py-2 font-medium">Anterior</th>
                  <th className="text-right px-2 py-2 font-medium">Período</th>
                  <th className="text-right px-2 py-2 font-medium">Acum.</th>
                  <th className="text-right px-2 py-2 font-medium">Anterior</th>
                  <th className="text-right px-2 py-2 font-medium">Período</th>
                  <th className="text-right px-2 py-2 font-medium">Acum.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it, idx) => {
                  const c = computeItem(it);
                  const nivel = it.item_codigo.split(".").length;
                  const zebra = idx % 2 === 1 ? "bg-[#FAFBFC]" : "bg-white";
                  if (it.is_etapa) {
                    return (
                      <tr key={it.item_codigo} className="bg-[#EEF0F2]">
                        <td className="px-3 py-2.5 font-bold text-[#252A33] sticky left-0 bg-[#EEF0F2] z-10">{it.item_codigo}</td>
                        <td colSpan={12} className="px-3 py-2.5 font-bold text-[#252A33]" style={{ paddingLeft: 12 + nivel * 6 }}>
                          {sanitizeDescricao(it.descricao)}
                        </td>
                      </tr>
                    );
                  }
                  const statusColor: Record<string, string> = {
                    nao_iniciada: "bg-slate-100 text-slate-600",
                    em_andamento: "bg-[#F5EEDD] text-[#8A6D2E]",
                    concluida: "bg-emerald-50 text-emerald-700",
                    erro: "bg-red-50 text-red-700",
                  };
                  const statusLabel: Record<string, string> = {
                    nao_iniciada: "Não iniciada",
                    em_andamento: "Em andamento",
                    concluida: "Concluída",
                    erro: "Extrapolação",
                  };
                  return (
                    <tr key={it.item_codigo} className={`${zebra} hover:bg-[#F5EEDD]/40`}>
                      <td className={`px-3 py-2 text-center text-[#69717D] font-mono text-[11px] sticky left-0 z-10 ${zebra}`}>{it.item_codigo}</td>
                      <td className="px-3 py-2 text-[#20242B]" title={it.descricao}>
                        <div className="line-clamp-2">{sanitizeDescricao(it.descricao)}</div>
                        <div className="mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor[c.status_calc]}`}>
                            {statusLabel[c.status_calc]}
                          </span>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center text-[#69717D]">{normalizeUnidade(it.unidade)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{fmtNumberBR(it.qtd_contratada)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#69717D]">{fmtMoneyBR(it.valor_unitario)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtMoneyBR(c.total_contratual)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#69717D]">{fmtNumberBR(it.qtd_acum_anterior)}</td>
                      {modoOficial ? (
                        <td className="px-2 py-2 text-right tabular-nums font-semibold text-[#8A6D2E]">
                          {fmtNumberBR(it.qtd_periodo)}
                        </td>
                      ) : (
                        <>
                          <td className="px-1 py-1 text-right print:hidden">
                            <Input
                              value={it.qtd_periodo ? fmtNumberBR(it.qtd_periodo) : ""}
                              onChange={(e) => updateQtdPeriodo(it.item_codigo, parseBR(e.target.value))}
                              onKeyDown={handleCellKey}
                              onPaste={(e) => {
                                const txt = e.clipboardData.getData("text");
                                if (handlePasteSequence(it.item_codigo, txt)) e.preventDefault();
                              }}
                              data-bm-cell="1"
                              disabled={readOnly}
                              placeholder="0,00"
                              className="h-8 text-right tabular-nums bg-[#FBF5E6] border-transparent focus-visible:border-[#C8A66A] focus-visible:ring-1 focus-visible:ring-[#C8A66A]/40 rounded-md"
                            />
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums hidden print:table-cell">{fmtNumberBR(it.qtd_periodo)}</td>
                        </>
                      )}
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">{fmtNumberBR(c.qtd_acum_atual)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-[#69717D]">{fmtMoneyBR(it.valor_acum_anterior)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmtMoneyBR(c.valor_periodo)}</td>
                      <td className="px-2 py-2 text-right tabular-nums font-semibold">{fmtMoneyBR(c.valor_acum_atual)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtPctBR(c.pct_executado, 2)}</td>
                    </tr>
                  );
                })}
                {/* TOTAL GERAL */}
                <tr className="bg-[#252A33] text-white">
                  <td colSpan={5} className="px-3 py-3 font-bold sticky left-0 bg-[#252A33]">TOTAL GERAL</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums">{fmtMoneyBR(totais.valor_total_contrato)}</td>
                  <td colSpan={4}></td>
                  <td className="px-2 py-3 text-right font-bold tabular-nums text-[#C8A66A]">{fmtMoneyBR(totais.valor_medicao_atual)}</td>
                  <td className="px-2 py-3 text-right font-bold tabular-nums">{fmtMoneyBR(totais.valor_acumulado)}</td>
                  <td className="px-3 py-3 text-right font-bold tabular-nums text-[#C8A66A]">{fmtPctBR(totais.percentual_executado, 2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== CONFERÊNCIA ===== */}
        <div className="bg-white rounded-xl shadow-sm p-6 grid grid-cols-2 md:grid-cols-4 gap-5 print:shadow-none">
          <Field label="Itens medidos" value={String(totais.itens_medidos)} />
          <Field label="Itens concluídos" value={String(totais.itens_concluidos)} />
          <Field label="Total contratado" value={fmtMoneyBR(totais.valor_total_contrato)} />
          <Field label="Total do período" value={fmtMoneyBR(totais.valor_medicao_atual)} />
        </div>

        {/* ===== DECLARAÇÃO E ASSINATURAS (impressão) ===== */}
        <div className="hidden print:block mt-8 text-sm">
          <p className="italic text-[#20242B]">
            Os valores desta medição estão de acordo com o cronograma físico-financeiro e com as condições contratuais estabelecidas.
          </p>
          <div className="grid grid-cols-2 gap-12 mt-16">
            <SignBlock title="Responsável Técnico" nome={data.responsaveis?.[0]?.nome} registro={data.responsaveis?.[0]?.registro} />
            <SignBlock title="Fiscal da Obra" nome="—" registro={null} />
          </div>
        </div>
        </>
        )}



        <Badge variant="outline" className="text-[10px] print:hidden">
          Última atualização: {new Date(data.medicao.updated_at ?? data.medicao.created_at ?? Date.now()).toLocaleString("pt-BR")}
        </Badge>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  children,
  pending,
  className = "",
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  pending?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[10px] uppercase tracking-widest text-[#69717D] font-semibold mb-1 flex items-center gap-1">
        {label}
        {pending && <span className="text-[#C94B16] font-bold">•</span>}
      </div>
      {children ?? <div className="text-sm font-semibold text-[#20242B]">{value || "—"}</div>}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-4 shadow-sm ${accent ? "bg-gradient-to-br from-[#C8A66A] to-[#B69354] text-white" : "bg-white"}`}>
      <div className={`text-[10px] uppercase tracking-widest font-semibold ${accent ? "text-white/90" : "text-[#69717D]"}`}>
        {label}
      </div>
      <div className={`text-xl md:text-2xl font-bold mt-2 tabular-nums ${accent ? "text-white" : "text-[#252A33]"}`}>{value}</div>
    </div>
  );
}

function SignBlock({ title, nome, registro }: { title: string; nome?: string | null; registro?: string | null }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-widest text-[#C8A66A] font-bold mb-16">{title}</div>
      <div className="border-t border-[#252A33] pt-2">
        <div className="font-bold text-[#252A33]">{nome || "—"}</div>
        {registro && <div className="text-xs text-[#69717D]">{registro}</div>}
      </div>
    </div>
  );
}
