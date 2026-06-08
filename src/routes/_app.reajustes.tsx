import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, XCircle, Calculator, TrendingUp, Sparkles, FileText, Printer, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  listReajustes,
  upsertIndice,
  excluirIndice,
  calcularReajuste,
  atualizarStatusReajuste,
  excluirReajuste,
  extrairClausulaReajusteIA,
  gerarOficioReajuste,
  type ClausulaReajusteExtraida,
  type OficioReajuste,
} from "@/lib/reajustes.functions";



export const Route = createFileRoute("/_app/reajustes")({
  component: ReajustesPage,
});

const brl = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toFixed(4)}%`;

const REAJUSTES_PAGE_SIZE = 20;

const INDICES_PADRAO = ["IPCA", "INCC", "IGP-M", "INPC", "ICC"];

function ReajustesPagination({ total, shown, page, totalPages, onPrev, onNext, label }: { total: number; shown: number; page: number; totalPages: number; onPrev: () => void; onNext: () => void; label: string }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
      <span>Mostrando {shown} de {total} {label}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 1}><ChevronLeft className="w-4 h-4 mr-1" /> Anterior</Button>
        <span className="min-w-20 text-center">Pagina {page} de {totalPages}</span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>Proxima <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}

function statusBadge(s: string) {
  if (s === "aplicado") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">aplicado</Badge>;
  if (s === "cancelado") return <Badge variant="secondary">cancelado</Badge>;
  return <Badge variant="outline">rascunho</Badge>;
}

function ReajustesPage() {
  const listFn = useServerFn(listReajustes);
  const upsertFn = useServerFn(upsertIndice);
  const delIndiceFn = useServerFn(excluirIndice);
  const calcFn = useServerFn(calcularReajuste);
  const statusFn = useServerFn(atualizarStatusReajuste);
  const delReajusteFn = useServerFn(excluirReajuste);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["reajustes"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  // ---- formulários ----
  const [reajustesPage, setReajustesPage] = useState(1);
  const [indicesPage, setIndicesPage] = useState(1);
  const [openIndice, setOpenIndice] = useState(false);
  const [iForm, setIForm] = useState({ indice: "IPCA", mes_referencia: "", valor_percentual: "", fonte: "" });

  const [openCalc, setOpenCalc] = useState(false);
  const [cForm, setCForm] = useState({
    contrato_id: "",
    indice: "IPCA",
    periodo_inicio: "",
    periodo_fim: "",
    status: "rascunho" as "rascunho" | "aplicado",
    observacoes: "",
    base_modo: "contrato" as "contrato" | "medicoes",
  });

  const upsertMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          indice: iForm.indice,
          mes_referencia: iForm.mes_referencia,
          valor_percentual: Number(iForm.valor_percentual),
          fonte: iForm.fonte || null,
        },
      }),
    onSuccess: () => {
      toast.success("Índice salvo.");
      setOpenIndice(false);
      setIForm({ indice: "IPCA", mes_referencia: "", valor_percentual: "", fonte: "" });
      qc.invalidateQueries({ queryKey: ["reajustes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const calcMut = useMutation({
    mutationFn: () => {
      if (!cForm.contrato_id) throw new Error("Selecione o contrato.");
      if (!cForm.periodo_inicio || !cForm.periodo_fim) throw new Error("Informe o período.");
      return calcFn({
        data: {
          contrato_id: cForm.contrato_id,
          indice: cForm.indice,
          periodo_inicio: cForm.periodo_inicio,
          periodo_fim: cForm.periodo_fim,
          status: cForm.status,
          observacoes: cForm.observacoes || null,
          base_modo: cForm.base_modo,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Reajuste #${res.numero}: ${pct(res.percentual_acumulado)} = ${brl(res.valor_reajuste)}`);
      setOpenCalc(false);
      setCForm({ contrato_id: "", indice: "IPCA", periodo_inicio: "", periodo_fim: "", status: "rascunho", observacoes: "", base_modo: "contrato" });
      qc.invalidateQueries({ queryKey: ["reajustes"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: "rascunho" | "aplicado" | "cancelado" }) => statusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["reajustes"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delReajusteMut = useMutation({
    mutationFn: (id: string) => delReajusteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Reajuste excluído.");
      qc.invalidateQueries({ queryKey: ["reajustes"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delIndiceMut = useMutation({
    mutationFn: (id: string) => delIndiceFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Índice removido.");
      qc.invalidateQueries({ queryKey: ["reajustes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- F12.x: extração de cláusula por IA ---
  const extrairFn = useServerFn(extrairClausulaReajusteIA);
  const [openIA, setOpenIA] = useState(false);
  const [iaForm, setIaForm] = useState({ contrato_id: "", texto: "" });
  const [iaResult, setIaResult] = useState<ClausulaReajusteExtraida | null>(null);
  const extrairMut = useMutation({
    mutationFn: (aplicar: boolean) => {
      if (!iaForm.contrato_id) throw new Error("Selecione o contrato.");
      if (iaForm.texto.trim().length < 50) throw new Error("Cole pelo menos 50 caracteres da cláusula.");
      return extrairFn({ data: { contrato_id: iaForm.contrato_id, texto: iaForm.texto, aplicar } });
    },
    onSuccess: (r) => {
      setIaResult(r.extraido);
      if (r.aplicado) {
        toast.success("Cláusula extraída e aplicada ao contrato.");
        qc.invalidateQueries({ queryKey: ["reajustes"] });
        qc.invalidateQueries({ queryKey: ["contratos"] });
      } else {
        toast.success(`Cláusula extraída (confiança ${Math.round((r.extraido.confianca ?? 0) * 100)}%).`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- F12.x: ofício de reajuste ---
  const oficioFn = useServerFn(gerarOficioReajuste);
  const [oficio, setOficio] = useState<OficioReajuste | null>(null);
  const [oficioTexto, setOficioTexto] = useState("");
  const oficioMut = useMutation({
    mutationFn: (reajuste_id: string) => oficioFn({ data: { reajuste_id } }),
    onSuccess: (r) => { setOficio(r); setOficioTexto(r.texto); },
    onError: (e: Error) => toast.error(e.message),
  });
  const imprimirOficio = () => {
    if (!oficio) return;
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) { toast.error("Pop-up bloqueado pelo navegador."); return; }
    const titulo = `Oficio_Reajuste_${oficio.numero_reajuste}_${oficio.contrato_numero}`;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
      <style>body{font-family:Georgia,serif;padding:48px;max-width:780px;margin:0 auto;line-height:1.6;color:#111;white-space:pre-wrap;font-size:13pt}</style>
      </head><body>${oficioTexto.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c))}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };



  const indices = data?.indices ?? [];
  const reajustes = data?.reajustes ?? [];
  const contratos = data?.contratos ?? [];
  const contratoMap = new Map(contratos.map((c) => [c.id, c]));
  const reajustesTotalPages = Math.max(1, Math.ceil(reajustes.length / REAJUSTES_PAGE_SIZE));
  const safeReajustesPage = Math.min(reajustesPage, reajustesTotalPages);
  const paginatedReajustes = reajustes.slice((safeReajustesPage - 1) * REAJUSTES_PAGE_SIZE, safeReajustesPage * REAJUSTES_PAGE_SIZE);
  const indicesTotalPages = Math.max(1, Math.ceil(indices.length / REAJUSTES_PAGE_SIZE));
  const safeIndicesPage = Math.min(indicesPage, indicesTotalPages);
  const paginatedIndices = indices.slice((safeIndicesPage - 1) * REAJUSTES_PAGE_SIZE, safeIndicesPage * REAJUSTES_PAGE_SIZE);

  const indicesUnicos = Array.from(new Set([...INDICES_PADRAO, ...indices.map((i) => i.indice)]));

  const totalReajusteAplicado = reajustes
    .filter((r) => r.status === "aplicado")
    .reduce((s, r) => s + Number(r.valor_reajuste || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reajustes contratuais</h1>
        <p className="text-muted-foreground">
          Cadastre índices mensais (IPCA, INCC…) e calcule reajustes acumulados aplicáveis aos contratos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Reajustes aplicados</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reajustes.filter((r) => r.status === "aplicado").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Δ Valor acumulado</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{brl(totalReajusteAplicado)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Meses de índice cadastrados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{indices.length}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="reajustes">
        <TabsList>
          <TabsTrigger value="reajustes">Reajustes</TabsTrigger>
          <TabsTrigger value="indices">Tabela de índices</TabsTrigger>
        </TabsList>

        <TabsContent value="reajustes" className="space-y-4">
          <div className="flex justify-end gap-2">
            <Dialog open={openIA} onOpenChange={(o) => { setOpenIA(o); if (!o) setIaResult(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Sparkles className="w-4 h-4 mr-2" /> Extrair cláusula com IA
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Extrair cláusula de reajuste com IA</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Contrato</Label>
                    <Select value={iaForm.contrato_id} onValueChange={(v) => setIaForm((f) => ({ ...f, contrato_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        {contratos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.numero} — {c.objeto?.slice(0, 50) ?? ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Texto do contrato (cole a cláusula ou trecho relevante)</Label>
                    <Textarea rows={10} value={iaForm.texto}
                      placeholder="Cole aqui o trecho contendo a cláusula de reajuste / reequilíbrio econômico-financeiro…"
                      onChange={(e) => setIaForm((f) => ({ ...f, texto: e.target.value }))} />
                    <p className="text-xs text-muted-foreground mt-1">{iaForm.texto.length} caracteres</p>
                  </div>
                  {iaResult && (
                    <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">Resultado da extração</span>
                        <Badge variant="outline">confiança {Math.round((iaResult.confianca ?? 0) * 100)}%</Badge>
                      </div>
                      <div><span className="text-muted-foreground">Índice:</span> <span className="font-mono">{iaResult.indice ?? "—"}</span></div>
                      <div><span className="text-muted-foreground">Periodicidade:</span> {iaResult.periodicidade ?? "—"}</div>
                      <div><span className="text-muted-foreground">Data-base:</span> {iaResult.data_base ?? "—"}</div>
                      {iaResult.formula && <div><span className="text-muted-foreground">Fórmula:</span> <span className="font-mono">{iaResult.formula}</span></div>}
                      {iaResult.trecho_citado && (
                        <div className="text-xs text-muted-foreground border-l-2 pl-2 mt-2 italic">
                          “{iaResult.trecho_citado}”
                        </div>
                      )}
                      {iaResult.observacoes && <div className="text-xs"><span className="text-muted-foreground">Notas:</span> {iaResult.observacoes}</div>}
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setOpenIA(false)}>Fechar</Button>
                  <Button variant="secondary" onClick={() => extrairMut.mutate(false)} disabled={extrairMut.isPending}>
                    <Sparkles className="w-4 h-4 mr-2" /> Extrair (preview)
                  </Button>
                  <Button onClick={() => extrairMut.mutate(true)} disabled={extrairMut.isPending}>
                    Extrair e aplicar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>


            <Dialog open={openCalc} onOpenChange={setOpenCalc}>
              <DialogTrigger asChild>
                <Button><Calculator className="w-4 h-4 mr-2" /> Calcular reajuste</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Calcular reajuste</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Contrato</Label>
                    <Select value={cForm.contrato_id} onValueChange={(v) => setCForm((f) => ({ ...f, contrato_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                      <SelectContent>
                        {contratos.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.numero} — {c.objeto?.slice(0, 50) ?? ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Índice</Label>
                      <Select value={cForm.indice} onValueChange={(v) => setCForm((f) => ({ ...f, indice: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {indicesUnicos.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Início (mês)</Label>
                      <Input type="month" value={cForm.periodo_inicio}
                        onChange={(e) => setCForm((f) => ({ ...f, periodo_inicio: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Fim (mês)</Label>
                      <Input type="month" value={cForm.periodo_fim}
                        onChange={(e) => setCForm((f) => ({ ...f, periodo_fim: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Base do cálculo</Label>
                      <Select value={cForm.base_modo} onValueChange={(v) => setCForm((f) => ({ ...f, base_modo: v as typeof cForm.base_modo }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contrato">Valor atualizado do contrato</SelectItem>
                          <SelectItem value="medicoes">Soma das medições aprovadas/pagas no período</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {cForm.base_modo === "medicoes"
                          ? "Considera apenas BMs com status aprovada ou paga dentro do período informado."
                          : "Usa o valor_atualizado do contrato (ou original, se nulo)."}
                      </p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={cForm.status} onValueChange={(v) => setCForm((f) => ({ ...f, status: v as typeof cForm.status }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rascunho">Rascunho</SelectItem>
                          <SelectItem value="aplicado">Aplicar imediatamente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea rows={2} value={cForm.observacoes}
                      onChange={(e) => setCForm((f) => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenCalc(false)}>Cancelar</Button>
                  <Button onClick={() => calcMut.mutate()} disabled={calcMut.isPending}>
                    <TrendingUp className="w-4 h-4 mr-2" /> Calcular
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader><CardTitle>Reajustes</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : reajustes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum reajuste calculado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 px-2">Contrato</th>
                        <th className="py-2 px-2">Nº</th>
                        <th className="py-2 px-2">Índice</th>
                        <th className="py-2 px-2">Período</th>
                        <th className="py-2 px-2 text-right">% Acum.</th>
                        <th className="py-2 px-2 text-right">Base</th>
                        <th className="py-2 px-2 text-right">Reajuste</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedReajustes.map((r) => {
                        const c = contratoMap.get(r.contrato_id);
                        return (
                          <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                            <td className="py-2 px-2">
                              <div className="font-medium">{c?.numero ?? "—"}</div>
                              <div className="text-xs text-muted-foreground truncate max-w-[220px]">{c?.objeto ?? ""}</div>
                            </td>
                            <td className="py-2 px-2">#{r.numero}</td>
                            <td className="py-2 px-2 font-mono">{r.indice}</td>
                            <td className="py-2 px-2 text-xs">{r.periodo_inicio} → {r.periodo_fim}</td>
                            <td className="py-2 px-2 text-right">{pct(r.percentual_acumulado)}</td>
                            <td className="py-2 px-2 text-right">{brl(r.valor_base)}</td>
                            <td className="py-2 px-2 text-right font-semibold">{brl(r.valor_reajuste)}</td>
                            <td className="py-2 px-2">{statusBadge(r.status)}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" title="Gerar ofício"
                                  onClick={() => oficioMut.mutate(r.id)} disabled={oficioMut.isPending}>
                                  <FileText className="w-4 h-4 text-blue-600" />
                                </Button>
                                {r.status !== "aplicado" && (
                                  <Button size="icon" variant="ghost" title="Aplicar"
                                    onClick={() => statusMut.mutate({ id: r.id, status: "aplicado" })}>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  </Button>
                                )}
                                {r.status === "aplicado" && (
                                  <Button size="icon" variant="ghost" title="Cancelar"
                                    onClick={() => statusMut.mutate({ id: r.id, status: "cancelado" })}>
                                    <XCircle className="w-4 h-4 text-amber-600" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" title="Excluir"
                                  onClick={() => { if (confirm("Excluir este reajuste?")) delReajusteMut.mutate(r.id); }}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {reajustes.length > REAJUSTES_PAGE_SIZE && (
                <ReajustesPagination total={reajustes.length} shown={paginatedReajustes.length} page={safeReajustesPage} totalPages={reajustesTotalPages} onPrev={() => setReajustesPage((p) => Math.max(1, p - 1))} onNext={() => setReajustesPage((p) => Math.min(reajustesTotalPages, p + 1))} label="reajustes" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="indices" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openIndice} onOpenChange={setOpenIndice}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Novo índice mensal</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Novo valor de índice</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Índice</Label>
                    <Select value={iForm.indice} onValueChange={(v) => setIForm((f) => ({ ...f, indice: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {indicesUnicos.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Mês de referência</Label>
                      <Input type="month" value={iForm.mes_referencia}
                        onChange={(e) => setIForm((f) => ({ ...f, mes_referencia: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Valor (%)</Label>
                      <Input type="number" step="0.0001" value={iForm.valor_percentual}
                        onChange={(e) => setIForm((f) => ({ ...f, valor_percentual: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Fonte (opcional)</Label>
                    <Input value={iForm.fonte}
                      onChange={(e) => setIForm((f) => ({ ...f, fonte: e.target.value }))}
                      placeholder="IBGE, FGV…" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenIndice(false)}>Cancelar</Button>
                  <Button onClick={() => upsertMut.mutate()} disabled={upsertMut.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader><CardTitle>Séries de índices</CardTitle></CardHeader>
            <CardContent>
              {indices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum índice cadastrado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 px-2">Índice</th>
                        <th className="py-2 px-2">Mês</th>
                        <th className="py-2 px-2 text-right">Valor (%)</th>
                        <th className="py-2 px-2">Fonte</th>
                        <th className="py-2 px-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedIndices.map((i) => (
                        <tr key={i.id} className="border-b last:border-b-0 hover:bg-muted/40">
                          <td className="py-2 px-2 font-mono">{i.indice}</td>
                          <td className="py-2 px-2">{i.mes_referencia.slice(0, 7)}</td>
                          <td className="py-2 px-2 text-right">{Number(i.valor_percentual).toFixed(4)}%</td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">{i.fonte ?? "—"}</td>
                          <td className="py-2 px-2 text-right">
                            <Button size="icon" variant="ghost" title="Remover"
                              onClick={() => { if (confirm("Remover este valor?")) delIndiceMut.mutate(i.id); }}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {indices.length > REAJUSTES_PAGE_SIZE && (
                <ReajustesPagination total={indices.length} shown={paginatedIndices.length} page={safeIndicesPage} totalPages={indicesTotalPages} onPrev={() => setIndicesPage((p) => Math.max(1, p - 1))} onNext={() => setIndicesPage((p) => Math.min(indicesTotalPages, p + 1))} label="indices" />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!oficio} onOpenChange={(o) => { if (!o) { setOficio(null); setOficioTexto(""); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ofício de Reajuste {oficio ? `#${oficio.numero_reajuste} — Contrato ${oficio.contrato_numero}` : ""}
            </DialogTitle>
          </DialogHeader>
          {oficio && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded border p-2"><div className="text-muted-foreground">Índice</div><div className="font-semibold">{oficio.indice}</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground">% Acumulado</div><div className="font-semibold">{Number(oficio.percentual_acumulado).toFixed(4)}%</div></div>
                <div className="rounded border p-2"><div className="text-muted-foreground">Reajuste</div><div className="font-semibold">{brl(oficio.valor_reajuste)}</div></div>
              </div>
              <Textarea rows={22} value={oficioTexto} onChange={(e) => setOficioTexto(e.target.value)}
                className="font-mono text-sm leading-relaxed" />
              <p className="text-xs text-muted-foreground">
                Edite livremente o texto antes de imprimir. Base usada: <strong>{oficio.base_modo === "medicoes" ? "soma das medições do período" : "valor atualizado do contrato"}</strong>.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setOficio(null); setOficioTexto(""); }}>Fechar</Button>
            <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(oficioTexto); toast.success("Ofício copiado."); }}>
              Copiar texto
            </Button>
            <Button onClick={imprimirOficio}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
