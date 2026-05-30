import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
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
} from "lucide-react";
import type { BudgetRow, ProjectData } from "@/lib/types";


export const Route = createFileRoute("/realizado")({
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
  obra_id: string;
  item_codigo: string | null;
  item_descricao: string | null;
  horas_normais: number;
  horas_extras: number;
  custo_total: number;
  quantidade_executada: number | null;
}
interface NotaFiscalItem {
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
  obra_id: string;
  item_codigo: string;
  descricao_insumo: string;
  unidade: string | null;
  quantidade: number;
  valor_total: number;
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

  const [loading, setLoading] = useState(true);

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
            "obra_id, item_codigo, item_descricao, horas_normais, horas_extras, custo_total, quantidade_executada",
          )
          .eq("company_id", company.id),
        supabase
          .from("notas_fiscais")
          .select("id, obra_id, data_emissao, emitente_nome, numero, valor_total")
          .eq("company_id", company.id)
          .order("data_emissao", { ascending: false }),
        supabase
          .from("estoque_movimentos")
          .select("obra_id, tipo, item_codigo, item_descricao, quantidade, valor_total, valor_unitario")
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
      .select("nota_fiscal_id, descricao, quantidade, valor_total, obra_id, item_codigo, item_descricao")
      .eq("company_id", company.id)
      .then(({ data, error }) => {
        if (error) return console.error(error);
        setNfItens((data as NotaFiscalItem[]) ?? []);
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("nfe_item_apropriacoes")
      .select("obra_id, item_codigo, descricao_insumo, unidade, quantidade, valor_total")
      .eq("company_id", company.id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data, error }: any) => {
        if (error) return console.error(error);
        setApropriacoes((data as Apropriacao[]) ?? []);
      });
  }, [company]);


  // Itens da NF-e apropriados à obra atual (via item.obra_id ou via nota vinculada à obra)
  const nfItensObra = useMemo(() => {
    if (!obraId) return [];
    const notasIds = new Set(notas.filter((n) => n.obra_id === obraId).map((n) => n.id));
    return nfItens.filter((i) => i.obra_id === obraId || notasIds.has(i.nota_fiscal_id));
  }, [nfItens, notas, obraId]);


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

  // Material direto da NF-e apropriado à obra/composição (sem precisar passar pelo estoque)
  const custoMaterialNFeApropriado = useMemo(
    () => nfItensObra
      .filter((i) => i.item_codigo)
      .reduce((acc, i) => acc + Number(i.valor_total ?? 0), 0),
    [nfItensObra],
  );

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
    for (const i of nfItensObra) {
      const k = (i.item_codigo ?? "").trim();
      if (!k) continue;
      const c = get(k);
      c.material += Number(i.valor_total);
    }
    return map;
  }, [apontamentosObra, movsObra, nfItensObra]);

  // Comparativo por composição — espelho COMPLETO da planilha (mostra TODAS as linhas-folha)
  const comparativoItens = useMemo(() => {
    if (!obra) return [];
    const rows: Array<{
      row: BudgetRow;
      previsto: number;
      realizado: number;
      mo: number;
      material: number;
      horas: number;
      qtdExec: number;
      desvio: number;
      desvioPct: number;
    }> = [];
    for (const r of obra.rows) {
      if (r.isGroup) continue;
      const c = custoPorComposicao.get(r.codigo) ?? { mo: 0, material: 0, horas: 0, qtd: 0 };
      const previsto = r.total || 0;
      const realizado = c.mo + c.material;
      rows.push({
        row: r,
        previsto,
        realizado,
        mo: c.mo,
        material: c.material,
        horas: c.horas,
        qtdExec: c.qtd,
        desvio: realizado - previsto,
        desvioPct: previsto > 0 ? ((realizado - previsto) / previsto) * 100 : 0,
      });
    }
    return rows;
  }, [obra, custoPorComposicao]);

  // Rollup por etapa — espelho COMPLETO (todas as etapas do orçamento,
  // mesmo zeradas). Etapas são linhas isGroup de nível 1 (ex.: "1", "2"…)
  // e NÃO têm "codigo" — a hierarquia é feita pelo campo `item`.
  const comparativoEtapas = useMemo(() => {
    if (!obra) return [];
    const etapas = obra.rows.filter((r) => r.isGroup && r.level === 1);
    return etapas.map((et) => {
      const prefixo = `${et.item}.`;
      let previsto = 0;
      let mo = 0;
      let material = 0;
      for (const r of obra.rows) {
        if (r.isGroup) continue;
        if (!r.item.startsWith(prefixo)) continue;
        previsto += r.total || 0;
        const c = r.codigo ? custoPorComposicao.get(r.codigo) : undefined;
        if (c) { mo += c.mo; material += c.material; }
      }
      const realizado = mo + material;
      return {
        row: et,
        previsto,
        realizado,
        mo,
        material,
        desvio: realizado - previsto,
        desvioPct: previsto > 0 ? ((realizado - previsto) / previsto) * 100 : 0,
      };
    });
  }, [obra, custoPorComposicao]);


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
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
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

      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
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

            <Tabs defaultValue="etapas">
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
                          <TableHead className="text-right">MO</TableHead>
                          <TableHead className="text-right">Material</TableHead>
                          <TableHead className="text-right">Realizado</TableHead>
                          <TableHead className="text-right">Desvio</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativoEtapas.map((e, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{e.row.item}</TableCell>
                            <TableCell className="text-xs font-medium">{e.row.descricao}</TableCell>
                            <TableCell className="text-right">{fmtMoney(e.previsto)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(e.mo)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{fmtMoney(e.material)}</TableCell>
                            <TableCell className="text-right font-medium">{fmtMoney(e.realizado)}</TableCell>
                            <TableCell className="text-right"><DesvioCell value={e.desvio} /></TableCell>
                            <TableCell className="text-right"><DesvioCell value={e.desvioPct} suffix="%" /></TableCell>
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
                    Espelho da planilha original: todas as linhas-folha aparecem. Realizado = MO apontada + NF-e apropriada à composição + saída de estoque vinculada.
                  </p>
                  {comparativoItens.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Esta obra não tem composições no orçamento.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
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
                        {comparativoItens.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">{c.row.codigo}</TableCell>
                            <TableCell className="text-xs">{c.row.descricao}</TableCell>
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
                        ))}
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
