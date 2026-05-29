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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    try {
      const [w, a, nf] = await Promise.all([
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
      ]);
      if (w.error) throw w.error;
      if (a.error) throw a.error;
      if (nf.error) throw nf.error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ws = (w.data as any)?.workspace;
      const list = (ws?.obras ?? []) as ProjectData[];
      setObras(list);
      setApontamentos((a.data as Apontamento[]) ?? []);
      setNotas((nf.data as NotaFiscal[]) ?? []);
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

  // Carrega itens das notas vinculadas à obra atual
  useEffect(() => {
    if (!company || !obraId) return;
    const notasObra = notas.filter((n) => n.obra_id === obraId).map((n) => n.id);
    if (notasObra.length === 0) {
      setNfItens([]);
      return;
    }
    supabase
      .from("nota_fiscal_itens")
      .select("nota_fiscal_id, descricao, quantidade, valor_total")
      .eq("company_id", company.id)
      .in("nota_fiscal_id", notasObra)
      .then(({ data, error }) => {
        if (error) return console.error(error);
        setNfItens((data as NotaFiscalItem[]) ?? []);
      });
  }, [company, obraId, notas]);

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

  const custoMaterial = useMemo(
    () => notasObra.reduce((acc, n) => acc + Number(n.valor_total ?? 0), 0),
    [notasObra],
  );

  const realizadoTotal = custoMaoObra + custoMaterial;
  const desvio = realizadoTotal - previstoTotal;
  const desvioPct = previstoTotal > 0 ? (desvio / previstoTotal) * 100 : 0;

  // Comparativo por item (cruza item_codigo do apontamento ↔ orçamento)
  const comparativoItens = useMemo(() => {
    if (!obra) return [];
    const apontPorCod = new Map<string, { horas: number; custo: number; qtd: number }>();
    for (const ap of apontamentosObra) {
      const k = (ap.item_codigo ?? "").trim();
      if (!k) continue;
      const cur = apontPorCod.get(k) ?? { horas: 0, custo: 0, qtd: 0 };
      cur.horas += Number(ap.horas_normais) + Number(ap.horas_extras);
      cur.custo += Number(ap.custo_total);
      cur.qtd += Number(ap.quantidade_executada ?? 0);
      apontPorCod.set(k, cur);
    }
    const rows: Array<{
      row: BudgetRow;
      previsto: number;
      realizado: number;
      horas: number;
      qtdExec: number;
      desvio: number;
      desvioPct: number;
    }> = [];
    for (const r of obra.rows) {
      if (r.isGroup) continue;
      const ap = apontPorCod.get(r.codigo);
      if (!ap) continue;
      const previsto = r.total || 0;
      const realizado = ap.custo;
      rows.push({
        row: r,
        previsto,
        realizado,
        horas: ap.horas,
        qtdExec: ap.qtd,
        desvio: realizado - previsto,
        desvioPct: previsto > 0 ? ((realizado - previsto) / previsto) * 100 : 0,
      });
    }
    return rows.sort((a, b) => b.realizado - a.realizado);
  }, [obra, apontamentosObra]);

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
                label="Realizado Total"
                value={fmtMoney(realizadoTotal)}
                sub={`MO ${fmtMoney(custoMaoObra)} • Mat ${fmtMoney(custoMaterial)}`}
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

            <Tabs defaultValue="itens">
              <TabsList>
                <TabsTrigger value="itens">Por Item / Atividade</TabsTrigger>
                <TabsTrigger value="materiais">Materiais (NF-e)</TabsTrigger>
                <TabsTrigger value="mao-obra">Mão de Obra</TabsTrigger>
              </TabsList>

              <TabsContent value="itens" className="mt-4">
                <Card className="p-4">
                  <h2 className="font-semibold mb-1">
                    Comparativo por Item do Orçamento
                  </h2>
                  <p className="text-xs text-muted-foreground mb-3">
                    Cruzamento por código do item entre orçamento e apontamentos
                    de mão de obra. Itens sem apontamento não aparecem.
                  </p>
                  {comparativoItens.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      Nenhum apontamento vinculado a itens do orçamento desta
                      obra.
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
                          <TableHead className="text-right">Realizado</TableHead>
                          <TableHead className="text-right">Desvio</TableHead>
                          <TableHead className="text-right">%</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativoItens.map((c, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono text-xs">
                              {c.row.codigo}
                            </TableCell>
                            <TableCell className="text-xs">
                              {c.row.descricao}
                            </TableCell>
                            <TableCell className="text-right">
                              {c.row.quantidade.toFixed(2)} {c.row.und}
                            </TableCell>
                            <TableCell className="text-right">
                              {c.qtdExec.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {c.horas.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtMoney(c.previsto)}
                            </TableCell>
                            <TableCell className="text-right">
                              {fmtMoney(c.realizado)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DesvioCell value={c.desvio} />
                            </TableCell>
                            <TableCell className="text-right">
                              <DesvioCell value={c.desvioPct} suffix="%" />
                            </TableCell>
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
