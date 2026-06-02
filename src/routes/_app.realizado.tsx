import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { usePersistedTab } from "@/hooks/use-persisted-tab";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { BudgetRow, ProjectData } from "@/lib/types";


export const Route = createFileRoute("/_app/realizado")({
  component: RealizadoPage,
  head: () => ({
    meta: [
      { title: "Previsto x Realizado" },
      {
        name: "description",
        content:
          "Comparativo entre orçamento previsto e custo realizado (mão de obra + materiais via NF-e).",
      },
    ],
  }),
});

interface Apontamento {
  id: string;
  obra_id: string;
  item_codigo: string | null;
  item_descricao: string | null;
  recurso_tipo: string | null;
  recurso_nome: string | null;
  horas_normais: number;
  horas_extras: number;
  custo_total: number;
  quantidade_executada: number | null;
}
interface NotaFiscalItem {
  id: string;
  nota_fiscal_id: string;
  descricao: string;
  quantidade: number;
  valor_total: number;
  obra_id: string | null;
  item_codigo: string | null;
  item_descricao: string | null;
}
interface NotaFiscal {
  id: string;
  obra_id: string | null;
  data_emissao: string | null;
  emitente_nome: string | null;
  numero: string;
  valor_total: number | null;
}
interface MovEstoque {
  id: string;
  obra_id: string | null;
  tipo: string;
  item_codigo: string | null;
  item_descricao: string | null;
  quantidade: number;
  valor_total: number;
  valor_unitario: number;
  insumo_descricao?: string | null;
  unidade?: string | null;
}
interface Apropriacao {
  id: string;
  obra_id: string;
  item_codigo: string;
  descricao_insumo: string;
  unidade: string | null;
  quantidade: number;
  valor_total: number;
  nota_fiscal_item_id: string | null;
}

type InsumoOrigem = "apontamento" | "apropriacao" | "movimento" | "nfe_item";
interface InsumoLinha {
  id: string;
  origem: InsumoOrigem;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  valor: number;
  fonte: "NF-e" | "Estoque" | "MO";
}



function fmtMoney(v: number | null | undefined) {
  return (v ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function fmtPct(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

function RealizadoPage() {
  const { user, loading: authLoading } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();

  const [obras, setObras] = useState<ProjectData[]>([]);
  const [obraId, setObraId] = useState<string>("");
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [nfItens, setNfItens] = useState<NotaFiscalItem[]>([]);
  const [movsEstoque, setMovsEstoque] = useState<MovEstoque[]>([]);
  const [apropriacoes, setApropriacoes] = useState<Apropriacao[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Parâmetros financeiros (tributos, lucro, encargos MO) — Lucro Presumido
  const [params, setParams] = useState({
    iss: 5.0,
    pis: 0.65,
    cofins: 3.0,
    irpj: 4.8,
    csll: 2.88,
    lucro: 25.0,
    encargosMO: 100.0,
  });

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = usePersistedTab("realizado", "etapas");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [w, a, nf, mv] = await Promise.all([
        supabase
          .from("company_workspaces")
          .select("workspace")
          .eq("company_id", company.id)
          .maybeSingle(),
        supabase
          .from("apontamentos_mao_obra")
          .select(
            "id, obra_id, item_codigo, item_descricao, recurso_tipo, recurso_nome, horas_normais, horas_extras, custo_total, quantidade_executada",
          )
          .eq("company_id", company.id),
        supabase
          .from("notas_fiscais")
          .select("id, obra_id, data_emissao, emitente_nome, numero, valor_total")
          .eq("company_id", company.id)
          .order("data_emissao", { ascending: false }),
        supabase
          .from("estoque_movimentos")
          .select("id, obra_id, tipo, item_codigo, item_descricao, quantidade, valor_total, valor_unitario")
          .eq("company_id", company.id),

      ]);
      if (w.error) throw w.error;
      if (a.error) throw a.error;
      if (nf.error) throw nf.error;
      if (mv.error) throw mv.error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (w.data as any)?.workspace;
      const list = (ws?.obras ?? []) as ProjectData[];
      setObras(list);
      setApontamentos((a.data as Apontamento[]) ?? []);
      setNotas((nf.data as NotaFiscal[]) ?? []);
      setMovsEstoque((mv.data as MovEstoque[]) ?? []);
      if (!obraId && list.length > 0) setObraId(list[0].id);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao carregar dados de realizado");
    } finally {
      setLoading(false);
    }
  }, [company, obraId]);

  useEffect(() => {
    if (company) load();
  }, [company, load]);

  // Carrega TODOS os itens de NF-e da company + apropriações (rateio).
  useEffect(() => {
    if (!company) return;
    supabase
      .from("nota_fiscal_itens")
      .select("id, nota_fiscal_id, descricao, quantidade, valor_total, obra_id, item_codigo, item_descricao")
      .eq("company_id", company.id)
      .then(({ data, error }) => {
        if (error) return console.error(error);
        setNfItens((data as NotaFiscalItem[]) ?? []);
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("nfe_item_apropriacoes")
      .select("id, obra_id, item_codigo, descricao_insumo, unidade, quantidade, valor_total, nota_fiscal_item_id")
      .eq("company_id", company.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data, error }: any) => {
        if (error) return console.error(error);
        setApropriacoes((data as Apropriacao[]) ?? []);
      });

  }, [company]);

  // Carrega parâmetros financeiros (tributos, lucro, encargos MO)
  useEffect(() => {
    if (!company) return;
    supabase
      .from("parametros_financeiros")
      .select(
        "iss_percent, pis_percent, cofins_percent, irpj_percent, csll_percent, lucro_pretendido_percent, encargos_mao_obra_percent",
      )
      .eq("company_id", company.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return console.error(error);
        if (!data) return;
        setParams({
          iss: Number(data.iss_percent),
          pis: Number(data.pis_percent),
          cofins: Number(data.cofins_percent),
          irpj: Number(data.irpj_percent),
          csll: Number(data.csll_percent),
          lucro: Number(data.lucro_pretendido_percent),
          encargosMO: Number(data.encargos_mao_obra_percent),
        });
      });
  }, [company]);





  // IDs de itens de NF-e que já têm rateio (apropriação) — evitam duplicidade
  // entre o caminho NOVO (nfe_item_apropriacoes) e o LEGADO (item.item_codigo).
  const itensComApropriacao = useMemo(
    () => new Set(apropriacoes.map((a) => a.nota_fiscal_item_id).filter(Boolean) as string[]),
    [apropriacoes],
  );

  // Itens da NF-e apropriados à obra atual (via item.obra_id ou via nota vinculada à obra)
  // — exclui os que já estão rateados via nfe_item_apropriacoes para não somar duas vezes.
  const nfItensObra = useMemo(() => {
    if (!obraId) return [];
    const notasIds = new Set(notas.filter((n) => n.obra_id === obraId).map((n) => n.id));
    return nfItens.filter(
      (i) =>
        (i.obra_id === obraId || notasIds.has(i.nota_fiscal_id)) &&
        !itensComApropriacao.has(i.id),
    );
  }, [nfItens, notas, obraId, itensComApropriacao]);



  const obra = useMemo(() => obras.find((o) => o.id === obraId), [obras, obraId]);

  // Custo previsto total (do orçamento)
  const previstoTotal = useMemo(() => {
    if (!obra) return 0;
    return obra.rows
      .filter((r) => !r.isGroup)
      .reduce((acc, r) => acc + (r.total || 0), 0);
  }, [obra]);

  // Apontamentos da obra
  const apontamentosObra = useMemo(
    () => apontamentos.filter((a) => a.obra_id === obraId),
    [apontamentos, obraId],
  );

  const custoMaoObra = useMemo(
    () => apontamentosObra.reduce((acc, a) => acc + Number(a.custo_total), 0),
    [apontamentosObra],
  );

  const notasObra = useMemo(
    () => notas.filter((n) => n.obra_id === obraId),
    [notas, obraId],
  );

  // Movimentos de estoque da obra (saídas = consumo apropriado)
  const movsObra = useMemo(
    () => movsEstoque.filter((m) => m.obra_id === obraId && m.tipo === "saida"),
    [movsEstoque, obraId],
  );

  // Material consumido = saídas de estoque vinculadas à composição
  const custoMaterialEstoque = useMemo(
    () => movsObra.reduce((acc, m) => acc + Number(m.valor_total ?? 0), 0),
    [movsObra],
  );

  // Apropriações de NF-e da obra (rateio item × composição)
  const apropObra = useMemo(
    () => apropriacoes.filter((a) => a.obra_id === obraId),
    [apropriacoes, obraId],
  );

  // Material direto da NF-e apropriado à obra/composição (rateio + legado)
  const custoMaterialNFeApropriado = useMemo(() => {
    // Soma rateios novos
    const novo = apropObra.reduce((acc, a) => acc + Number(a.valor_total ?? 0), 0);
    // Soma legado (item.obra_id+item_codigo) — somente itens SEM apropriações na nova tabela
    // (heurística: identifica itens que ainda usam o vínculo direto)
    const legado = nfItensObra
      .filter((i) => i.item_codigo)
      .reduce((acc, i) => acc + Number(i.valor_total ?? 0), 0);
    return novo + legado;
  }, [apropObra, nfItensObra]);

  const custoMaterialConsumido = custoMaterialEstoque + custoMaterialNFeApropriado;

  // Total comprado (NF-e) — referência de compras, não necessariamente apropriado
  const custoMaterialComprado = useMemo(
    () => notasObra.reduce((acc, n) => acc + Number(n.valor_total ?? 0), 0),
    [notasObra],
  );

  const realizadoTotal = custoMaoObra + custoMaterialConsumido;
  const desvio = realizadoTotal - previstoTotal;
  const desvioPct = previstoTotal > 0 ? (desvio / previstoTotal) * 100 : 0;

  // Custo MO + Material por código de composição
  const custoPorComposicao = useMemo(() => {
    const map = new Map<string, { mo: number; material: number; horas: number; qtd: number }>();
    const get = (k: string) => {
      const cur = map.get(k) ?? { mo: 0, material: 0, horas: 0, qtd: 0 };
      map.set(k, cur);
      return cur;
    };
    for (const ap of apontamentosObra) {
      const k = (ap.item_codigo ?? "").trim();
      if (!k) continue;
      const c = get(k);
      c.mo += Number(ap.custo_total);
      c.horas += Number(ap.horas_normais) + Number(ap.horas_extras);
      c.qtd += Number(ap.quantidade_executada ?? 0);
    }
    for (const m of movsObra) {
      const k = (m.item_codigo ?? "").trim();
      if (!k) continue;
      const c = get(k);
      c.material += Number(m.valor_total);
    }
    for (const a of apropObra) {
      const k = (a.item_codigo ?? "").trim();
      if (!k) continue;
      const c = get(k);
      c.material += Number(a.valor_total);
    }
    // Legado: itens de NF-e ainda vinculados diretamente
    for (const i of nfItensObra) {
      const k = (i.item_codigo ?? "").trim();
      if (!k) continue;
      const c = get(k);
      c.material += Number(i.valor_total);
    }
    return map;
  }, [apontamentosObra, movsObra, apropObra, nfItensObra]);

  // Helper: resolve custo de uma linha do orçamento aceitando que o
  // apontamento possa ter sido gravado por `codigo` da composição OU pelo
  // caminho `item` (ex.: "1.5.1.0.1") quando o usuário lança via Diário.
  const getCusto = useCallback(
    (row: BudgetRow) => {
      const empty = { mo: 0, material: 0, horas: 0, qtd: 0 };
      const a = row.codigo ? custoPorComposicao.get(row.codigo) : undefined;
      const b = row.item ? custoPorComposicao.get(row.item) : undefined;
      if (!a && !b) return empty;
      return {
        mo: (a?.mo ?? 0) + (b?.mo ?? 0),
        material: (a?.material ?? 0) + (b?.material ?? 0),
        horas: (a?.horas ?? 0) + (b?.horas ?? 0),
        qtd: (a?.qtd ?? 0) + (b?.qtd ?? 0),
      };
    },
    [custoPorComposicao],
  );


  // Composição REAL: lista de insumos consumidos por código de composição.
  // Fonte: apropriações de NF-e (rateio) + saídas de estoque + legado item_codigo.
  // Inclui também a mão-de-obra como "insumo" virtual.
  const insumosPorComposicao = useMemo(() => {
    const map = new Map<string, InsumoLinha[]>();
    const push = (k: string, item: InsumoLinha) => {
      const arr = map.get(k) ?? [];
      arr.push(item);
      map.set(k, arr);
    };
    for (const a of apropObra) {
      const k = (a.item_codigo ?? "").trim();
      if (!k) continue;
      push(k, {
        id: a.id,
        origem: "apropriacao",
        descricao: a.descricao_insumo,
        unidade: a.unidade,
        quantidade: Number(a.quantidade ?? 0),
        valor: Number(a.valor_total ?? 0),
        fonte: "NF-e",
      });
    }
    for (const m of movsObra) {
      const k = (m.item_codigo ?? "").trim();
      if (!k) continue;
      push(k, {
        id: m.id,
        origem: "movimento",
        descricao: m.item_descricao ?? "Saída de estoque",
        unidade: null,
        quantidade: Number(m.quantidade ?? 0),
        valor: Number(m.valor_total ?? 0),
        fonte: "Estoque",
      });
    }
    for (const i of nfItensObra) {
      const k = (i.item_codigo ?? "").trim();
      if (!k) continue;
      push(k, {
        id: i.id,
        origem: "nfe_item",
        descricao: i.descricao,
        unidade: null,
        quantidade: Number(i.quantidade ?? 0),
        valor: Number(i.valor_total ?? 0),
        fonte: "NF-e",
      });
    }
    for (const ap of apontamentosObra) {
      const k = (ap.item_codigo ?? "").trim();
      if (!k) continue;
      const horas = Number(ap.horas_normais ?? 0) + Number(ap.horas_extras ?? 0);
      if (horas <= 0 && Number(ap.custo_total ?? 0) <= 0) continue;
      const nome = (ap.recurso_nome ?? "").trim();
      const isEquip = ap.recurso_tipo === "equipamento";
      const descricao = nome
        ? (isEquip ? `Equipamento: ${nome}` : nome)
        : (isEquip ? "Equipamento apontado" : "Mão de obra apontada");
      push(k, {
        id: ap.id,
        origem: "apontamento",
        descricao,
        unidade: "h",
        quantidade: horas,
        valor: Number(ap.custo_total ?? 0),
        fonte: "MO",
      });
    }
    return map;
  }, [apropObra, movsObra, nfItensObra, apontamentosObra]);


  const getInsumos = useCallback(
    (row: BudgetRow) => {
      const a = row.codigo ? insumosPorComposicao.get(row.codigo) ?? [] : [];
      const b = row.item ? insumosPorComposicao.get(row.item) ?? [] : [];
      return [...a, ...b];
    },
    [insumosPorComposicao],
  );

  // ---- Editar/apagar por linha de insumo ----
  const [editing, setEditing] = useState<InsumoLinha | null>(null);
  const [editDescricao, setEditDescricao] = useState("");
  const [editQtd, setEditQtd] = useState("0");
  const [editValor, setEditValor] = useState("0");

  const refetchSources = useCallback(async () => {
    if (!company) return;
    await load();
    // Re-busca itens NF-e e apropriações
    const [nf, ap] = await Promise.all([
      supabase
        .from("nota_fiscal_itens")
        .select("id, nota_fiscal_id, descricao, quantidade, valor_total, obra_id, item_codigo, item_descricao")
        .eq("company_id", company.id),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("nfe_item_apropriacoes")
        .select("id, obra_id, item_codigo, descricao_insumo, unidade, quantidade, valor_total, nota_fiscal_item_id")
        .eq("company_id", company.id),
    ]);
    if (!nf.error) setNfItens((nf.data as NotaFiscalItem[]) ?? []);
    if (!ap.error) setApropriacoes((ap.data as Apropriacao[]) ?? []);
  }, [company, load]);

  const handleDeleteInsumo = useCallback(
    async (ins: InsumoLinha) => {
      if (!window.confirm(`Apagar este lançamento?\n\n${ins.descricao}\nValor: ${fmtMoney(ins.valor)}`)) return;
      try {
        if (ins.origem === "apontamento") {
          const { error } = await supabase.from("apontamentos_mao_obra").delete().eq("id", ins.id);
          if (error) throw error;
        } else if (ins.origem === "apropriacao") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from("nfe_item_apropriacoes").delete().eq("id", ins.id);
          if (error) throw error;
        } else if (ins.origem === "movimento") {
          const { error } = await supabase.from("estoque_movimentos").delete().eq("id", ins.id);
          if (error) throw error;
        } else if (ins.origem === "nfe_item") {
          // Não apaga a NF — só desvincula da obra/composição
          const { error } = await supabase
            .from("nota_fiscal_itens")
            .update({ obra_id: null, item_codigo: null, item_descricao: null })
            .eq("id", ins.id);
          if (error) throw error;
        }
        toast.success("Lançamento removido");
        await refetchSources();
      } catch (err) {
        console.error(err);
        toast.error("Falha ao apagar lançamento");
      }
    },
    [refetchSources],
  );

  const openEdit = useCallback((ins: InsumoLinha) => {
    setEditing(ins);
    setEditDescricao(ins.descricao);
    setEditQtd(String(ins.quantidade));
    setEditValor(String(ins.valor));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editing) return;
    const parseBR = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
    const qtd = parseBR(editQtd);
    const valor = parseBR(editValor);
    try {
      if (editing.origem === "apontamento") {
        // Para MO: ajusta horas_normais (zera extras) e custo_total
        const { error } = await supabase
          .from("apontamentos_mao_obra")
          .update({
            horas_normais: qtd,
            horas_extras: 0,
            custo_total: valor,
            custo_hora: qtd > 0 ? valor / qtd : 0,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else if (editing.origem === "apropriacao") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from("nfe_item_apropriacoes")
          .update({
            descricao_insumo: editDescricao,
            quantidade: qtd,
            valor_total: valor,
            valor_unitario: qtd > 0 ? valor / qtd : 0,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else if (editing.origem === "movimento") {
        const { error } = await supabase
          .from("estoque_movimentos")
          .update({
            item_descricao: editDescricao,
            quantidade: qtd,
            valor_total: valor,
            valor_unitario: qtd > 0 ? valor / qtd : 0,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else if (editing.origem === "nfe_item") {
        const { error } = await supabase
          .from("nota_fiscal_itens")
          .update({ item_descricao: editDescricao })
          .eq("id", editing.id);
        if (error) throw error;
      }
      toast.success("Lançamento atualizado");
      setEditing(null);
      await refetchSources();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar alteração");
    }
  }, [editing, editDescricao, editQtd, editValor, refetchSources]);



  // Percentual total de tributos sobre nota
  const tribTotalPct =
    params.iss + params.pis + params.cofins + params.irpj + params.csll;

  // Helper: aplica encargos sobre MO e calcula metas (custo meta, saldo, status)
  type Calc = {
    previsto: number;
    impNota: number;
    lucro: number;
    custoMeta: number;
    moBase: number;
    mo: number; // MO com encargos
    material: number;
    realizado: number;
    saldoMeta: number;
    saldoPct: number;
    status: "dentro" | "atencao" | "acima" | "vazio";
  };

  const computeCalc = (
    previsto: number,
    moBase: number,
    material: number,
  ): Calc => {
    const impNota = previsto * (tribTotalPct / 100);
    const lucroV = previsto * (params.lucro / 100);
    const custoMeta = previsto - impNota - lucroV;
    const mo = moBase * (1 + params.encargosMO / 100);
    const realizado = mo + material;
    const saldoMeta = custoMeta - realizado;
    const saldoPct = custoMeta > 0 ? (saldoMeta / custoMeta) * 100 : 0;
    let status: Calc["status"] = "vazio";
    if (previsto > 0) {
      if (saldoMeta < 0) status = "acima";
      else if (custoMeta > 0 && saldoMeta < custoMeta * 0.2) status = "atencao";
      else status = "dentro";
    }
    return {
      previsto,
      impNota,
      lucro: lucroV,
      custoMeta,
      moBase,
      mo,
      material,
      realizado,
      saldoMeta,
      saldoPct,
      status,
    };
  };

  // Comparativo por composição — espelho COMPLETO da planilha:
  // mantém a ordem original (etapas/subetapas como cabeçalhos + composições-folha),
  // permitindo enxergar a hierarquia da planilha de orçamento.
  const comparativoItens = useMemo(() => {
    if (!obra) return [];
    type Row = Calc & {
      row: BudgetRow;
      isGroup: boolean;
      horas: number;
      qtdExec: number;
    };
    const rows: Row[] = [];
    for (const r of obra.rows) {
      if (r.isGroup) {
        const prefixo = `${r.item}.`;
        let previsto = 0, moBase = 0, material = 0, horas = 0, qtdExec = 0;
        for (const child of obra.rows) {
          if (child.isGroup) continue;
          if (!child.item.startsWith(prefixo)) continue;
          previsto += child.total || 0;
          const c = getCusto(child);
          moBase += c.mo; material += c.material; horas += c.horas; qtdExec += c.qtd;
        }
        rows.push({ row: r, isGroup: true, horas, qtdExec, ...computeCalc(previsto, moBase, material) });
      } else {
        const c = getCusto(r);
        rows.push({
          row: r,
          isGroup: false,
          horas: c.horas,
          qtdExec: c.qtd,
          ...computeCalc(r.total || 0, c.mo, c.material),
        });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obra, getCusto, params]);


  // Rollup por etapa
  const comparativoEtapas = useMemo(() => {
    if (!obra) return [];
    const etapas = obra.rows.filter((r) => r.isGroup && r.level === 1);
    return etapas.map((et) => {
      const prefixo = `${et.item}.`;
      let previsto = 0;
      let moBase = 0;
      let material = 0;
      for (const r of obra.rows) {
        if (r.isGroup) continue;
        if (!r.item.startsWith(prefixo)) continue;
        previsto += r.total || 0;
        const c = getCusto(r);
        moBase += c.mo; material += c.material;
      }
      return { row: et, ...computeCalc(previsto, moBase, material) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obra, getCusto, params]);


  if (authLoading || companyLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Você precisa estar vinculado a uma empresa.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-1" /> Obras
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Previsto × Realizado</h1>
            </div>
          </div>
          <div className="w-72">
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a obra..." />
              </SelectTrigger>
              <SelectContent>
                {obras.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {!obra ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {obras.length === 0
              ? "Nenhuma obra cadastrada ainda."
              : "Selecione uma obra para visualizar o comparativo."}
          </Card>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KpiCard label="Previsto (Orçamento)" value={fmtMoney(previstoTotal)} />
              <KpiCard
                label="Realizado (MO + Material apropriado)"
                value={fmtMoney(realizadoTotal)}
                sub={`MO ${fmtMoney(custoMaoObra)} • NF-e apropriada ${fmtMoney(custoMaterialNFeApropriado)} • Estoque ${fmtMoney(custoMaterialEstoque)} • Comprado ${fmtMoney(custoMaterialComprado)}`}
              />
              <KpiCard
                label="Desvio R$"
                value={fmtMoney(desvio)}
                tone={desvio > 0 ? "danger" : desvio < 0 ? "success" : "neutral"}
              />
              <KpiCard
                label="Desvio %"
                value={fmtPct(desvioPct)}
                tone={desvioPct > 0 ? "danger" : desvioPct < 0 ? "success" : "neutral"}
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="etapas">Por Etapa</TabsTrigger>
                <TabsTrigger value="itens">Por Composição</TabsTrigger>
                <TabsTrigger value="materiais">Materiais (NF-e)</TabsTrigger>
                <TabsTrigger value="mao-obra">Mão de Obra</TabsTrigger>
              </TabsList>

              <TabsContent value="etapas" className="mt-4">
                <Card className="p-4">
                  <h2 className="font-semibold mb-1">Comparativo por Etapa (rollup)</h2>
                  <p className="text-xs text-muted-foreground mb-3">
                    Espelho completo da planilha — soma de todas as composições filhas (MO apontada + NF-e apropriada + saída de estoque vinculada).
                  </p>
                  {comparativoEtapas.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhuma etapa com orçamento ou realizado.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Etapa</TableHead>
                          <TableHead className="text-right">Previsto</TableHead>
                          <TableHead className="text-right">Imp. Nota</TableHead>
                          <TableHead className="text-right">Lucro</TableHead>
                          <TableHead className="text-right">Custo Meta</TableHead>
                          <TableHead className="text-right">MO</TableHead>
                          <TableHead className="text-right">Material</TableHead>
                          <TableHead className="text-right">Realizado</TableHead>
                          <TableHead className="text-right">Saldo Meta</TableHead>
                          <TableHead className="text-right">%</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativoEtapas.map((e, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{e.row.item}</TableCell>
                            <TableCell className="text-xs font-medium">{e.row.descricao}</TableCell>
                            <TableCell className="text-right">{fmtMoney(e.previsto)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(e.impNota)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(e.lucro)}</TableCell>
                            <TableCell className="text-right font-medium">{fmtMoney(e.custoMeta)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(e.mo)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(e.material)}</TableCell>
                            <TableCell className="text-right font-medium">{fmtMoney(e.realizado)}</TableCell>
                            <TableCell className="text-right"><SaldoCell value={e.saldoMeta} status={e.status} /></TableCell>
                            <TableCell className="text-right"><SaldoCell value={e.saldoPct} status={e.status} suffix="%" /></TableCell>
                            <TableCell><StatusBadge status={e.status} /></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="itens" className="mt-4">
                <Card className="p-4">
                  <h2 className="font-semibold mb-1">
                    Comparativo por Composição
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3">
                    Espelho da planilha original: todas as linhas-folha aparecem.
                    Clique em uma linha para ver a <strong>composição real</strong> levantada em campo
                    (insumos + MO consumidos + coeficiente real = qtd / qtd executada).
                  </p>
                  {comparativoItens.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Esta obra não tem composições no orçamento.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Código</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Qtd Orç.</TableHead>
                          <TableHead className="text-right">Qtd Exec.</TableHead>
                          <TableHead className="text-right">Horas</TableHead>
                          <TableHead className="text-right">Previsto</TableHead>
                          <TableHead className="text-right">MO</TableHead>
                          <TableHead className="text-right">Material</TableHead>
                          <TableHead className="text-right">Realizado</TableHead>
                          <TableHead className="text-right">Desvio</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativoItens.map((c, idx) => {
                          if (c.isGroup) {
                            const indent = Math.max(0, (c.row.level ?? 1) - 1) * 12;
                            return (
                              <TableRow key={idx} className="bg-muted/50 hover:bg-muted/50 font-semibold">
                                <TableCell></TableCell>
                                <TableCell className="font-mono text-xs">{c.row.item}</TableCell>
                                <TableCell className="text-xs" colSpan={4}>
                                  <span style={{ paddingLeft: indent }}>{c.row.descricao}</span>
                                </TableCell>
                                <TableCell className="text-right text-xs">{fmtMoney(c.previsto)}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(c.mo)}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(c.material)}</TableCell>
                                <TableCell className="text-right text-xs">{fmtMoney(c.realizado)}</TableCell>
                                <TableCell className="text-right"><DesvioCell value={c.desvio} /></TableCell>
                                <TableCell className="text-right"><DesvioCell value={c.desvioPct} suffix="%" /></TableCell>
                              </TableRow>
                            );
                          }
                          const insumos = getInsumos(c.row);
                          const hasInsumos = insumos.length > 0;
                          const isOpen = expanded.has(c.row.codigo);
                          const toggle = () => {
                            if (!hasInsumos) return;
                            setExpanded((prev) => {
                              const next = new Set(prev);
                              if (next.has(c.row.codigo)) next.delete(c.row.codigo);
                              else next.add(c.row.codigo);
                              return next;
                            });
                          };
                          const indent = Math.max(0, (c.row.level ?? 1) - 1) * 12;
                          return (
                            <Fragment key={idx}>

                              <TableRow
                                key={idx}
                                onClick={toggle}
                                className={hasInsumos ? "cursor-pointer hover:bg-muted/40" : ""}
                              >
                                <TableCell className="w-8">
                                  {hasInsumos ? (
                                    isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                                  ) : null}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{c.row.codigo}</TableCell>
                                <TableCell className="text-xs">
                                  <span style={{ paddingLeft: indent }}>{c.row.descricao}</span>
                                </TableCell>
                                <TableCell className="text-right">{c.row.quantidade.toFixed(2)} {c.row.und}</TableCell>
                                <TableCell className="text-right">{c.qtdExec.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{c.horas.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{fmtMoney(c.previsto)}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(c.mo)}</TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(c.material)}</TableCell>
                                <TableCell className="text-right font-medium">{fmtMoney(c.realizado)}</TableCell>
                                <TableCell className="text-right"><DesvioCell value={c.desvio} /></TableCell>
                                <TableCell className="text-right"><DesvioCell value={c.desvioPct} suffix="%" /></TableCell>
                              </TableRow>
                              {isOpen && hasInsumos && (
                                <TableRow key={`${idx}-exp`} className="bg-muted/20 hover:bg-muted/20">
                                  <TableCell></TableCell>
                                  <TableCell colSpan={11} className="p-3">
                                    <div className="space-y-2">
                                      <div className="text-xs font-semibold text-muted-foreground uppercase">
                                        Composição real — {c.row.descricao}
                                      </div>
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead className="text-xs">Insumo / Recurso</TableHead>
                                            <TableHead className="text-xs">Fonte</TableHead>
                                            <TableHead className="text-xs text-right">Qtd</TableHead>
                                            <TableHead className="text-xs">Und</TableHead>
                                            <TableHead className="text-xs text-right">Valor unit.</TableHead>
                                            <TableHead className="text-xs text-right">Valor</TableHead>
                                            <TableHead className="text-xs text-right">Coef. real</TableHead>
                                            <TableHead className="text-xs text-right">Custo unit.</TableHead>
                                            <TableHead className="text-xs text-right w-24">Ações</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {insumos.map((ins, ix) => {
                                            const coef = c.qtdExec > 0 ? ins.quantidade / c.qtdExec : 0;
                                            const custoUnit = c.qtdExec > 0 ? ins.valor / c.qtdExec : 0;
                                            const valorUnit = ins.quantidade > 0 ? ins.valor / ins.quantidade : 0;
                                            return (
                                              <TableRow key={`${ins.origem}-${ins.id}-${ix}`}>
                                                <TableCell className="text-xs">{ins.descricao}</TableCell>
                                                <TableCell><Badge variant={ins.fonte === "MO" ? "default" : ins.fonte === "Estoque" ? "secondary" : "outline"} className="text-[10px]">{ins.fonte}</Badge></TableCell>
                                                <TableCell className="text-right text-xs">{ins.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</TableCell>
                                                <TableCell className="text-xs">{ins.unidade ?? "—"}</TableCell>
                                                <TableCell className="text-right text-xs font-mono">
                                                  {ins.quantidade > 0 ? `${fmtMoney(valorUnit)}${ins.unidade ? `/${ins.unidade}` : ""}` : "—"}
                                                </TableCell>
                                                <TableCell className="text-right text-xs">{fmtMoney(ins.valor)}</TableCell>
                                                <TableCell className="text-right text-xs font-mono">
                                                  {c.qtdExec > 0 ? `${coef.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${ins.unidade ?? ""}/${c.row.und}` : "—"}
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-mono">
                                                  {c.qtdExec > 0 ? fmtMoney(custoUnit) : "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                  <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => openEdit(ins)}>
                                                      <Pencil className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Apagar" onClick={() => handleDeleteInsumo(ins)}>
                                                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                    </Button>
                                                  </div>
                                                </TableCell>

                                              </TableRow>
                                            );
                                          })}
                                        </TableBody>
                                      </Table>
                                      {c.qtdExec === 0 && (
                                        <p className="text-xs text-amber-600">
                                          ⚠ Sem quantidade executada apontada. Aponte execução na tela de Mão de Obra para que o coeficiente real seja calculado.
                                        </p>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>

                          );
                        })}

                      </TableBody>
                    </Table>
                  )}

                </Card>
              </TabsContent>

              <TabsContent value="materiais" className="mt-4">
                <Card className="p-4">
                  <h2 className="font-semibold mb-3">
                    Notas Fiscais vinculadas à obra
                  </h2>
                  {notasObra.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhuma NF-e vinculada a esta obra.
                    </p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Nº</TableHead>
                            <TableHead>Fornecedor</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {notasObra.map((n) => (
                            <TableRow key={n.id}>
                              <TableCell className="text-xs">
                                {n.data_emissao
                                  ? new Date(n.data_emissao).toLocaleDateString("pt-BR")
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-xs">{n.numero}</TableCell>
                              <TableCell className="text-xs">
                                {n.emitente_nome ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtMoney(n.valor_total)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {nfItens.length > 0 && (
                        <>
                          <h3 className="font-semibold mt-6 mb-2 text-sm">
                            Itens consolidados ({nfItens.length})
                          </h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Descrição</TableHead>
                                <TableHead className="text-right">Qtd</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {nfItens.slice(0, 50).map((i, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="text-xs">
                                    {i.descricao}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {Number(i.quantidade).toFixed(2)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {fmtMoney(i.valor_total)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                          {nfItens.length > 50 && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Exibindo 50 de {nfItens.length} itens.
                            </p>
                          )}
                        </>
                      )}
                    </>
                  )}
                </Card>
              </TabsContent>

              <TabsContent value="mao-obra" className="mt-4">
                <Card className="p-4">
                  <h2 className="font-semibold mb-3">
                    Apontamentos de Mão de Obra (todos)
                  </h2>
                  {apontamentosObra.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhum apontamento para esta obra.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Atividade</TableHead>
                          <TableHead className="text-right">Horas</TableHead>
                          <TableHead className="text-right">Qtd Exec.</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                          <TableHead>Vínculo Orçamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {apontamentosObra.map((a, idx) => {
                          const orcMatch =
                            a.item_codigo &&
                            obra.rows.find((r) => r.codigo === a.item_codigo);
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-xs">
                                {a.item_codigo ?? "—"}
                              </TableCell>
                              <TableCell className="text-xs">
                                {a.item_descricao ?? "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                {(
                                  Number(a.horas_normais) + Number(a.horas_extras)
                                ).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {Number(a.quantidade_executada ?? 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="text-right">
                                {fmtMoney(a.custo_total)}
                              </TableCell>
                              <TableCell>
                                {orcMatch ? (
                                  <Badge variant="secondary">Vinculado</Badge>
                                ) : (
                                  <Badge variant="outline">Sem vínculo</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar lançamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={editDescricao} onChange={(e) => setEditDescricao(e.target.value)} disabled={editing?.origem === "apontamento"} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quantidade {editing?.origem === "apontamento" ? "(horas)" : ""}</Label>
                <Input inputMode="decimal" value={editQtd} onChange={(e) => setEditQtd(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label className="text-xs">Valor total (R$)</Label>
                <Input inputMode="decimal" value={editValor} onChange={(e) => setEditValor(e.target.value)} disabled={editing?.origem === "nfe_item"} placeholder="0,00" />
              </div>
            </div>
            {editing?.origem === "apontamento" && (
              <p className="text-xs text-muted-foreground">⚠️ Este lançamento vem do Diário de Obra. Se você editar a entrada do diário depois, este valor será sobrescrito.</p>
            )}
            {editing?.origem === "nfe_item" && (
              <p className="text-xs text-muted-foreground">Itens de NF-e não podem ter valor/quantidade alterados (vêm do XML). Para corrigir, use rateio na tela de NF-e.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


function KpiCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "success" | "danger";
}) {
  const colorClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-foreground";
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold ${colorClass}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </Card>
  );
}

function DesvioCell({ value, suffix = "" }: { value: number; suffix?: string }) {
  if (!Number.isFinite(value)) return <span>—</span>;
  const isPos = value > 0.001;
  const isNeg = value < -0.001;
  const Icon = isPos ? TrendingUp : isNeg ? TrendingDown : Minus;
  const color = isPos
    ? "text-destructive"
    : isNeg
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-muted-foreground";
  const formatted = suffix === "%" ? `${value.toFixed(1)}%` : fmtMoney(value);
  return (
    <span className={`inline-flex items-center gap-1 ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      {formatted}
    </span>
  );
}
