import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Calendar, Trash2, Lock, Wand2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  listCronogramas, createCronograma, gerarCronogramaDaProposta, getCronograma,
  upsertPeriodos, congelarBaseline, deleteCronograma, listPropostasParaCronograma,
} from "@/lib/cronogramas.functions";

export const Route = createFileRoute("/_app/cronogramas")({ component: CronogramasPage });

function CronogramasPage() {
  const list = useServerFn(listCronogramas);
  const propostas = useServerFn(listPropostasParaCronograma);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["cronogramas"], queryFn: () => list() });
  const { data: props } = useQuery({ queryKey: ["cron_propostas"], queryFn: () => propostas() });

  const del = useMutation({
    mutationFn: useServerFn(deleteCronograma),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cronogramas"] }); toast.success("Excluído"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calendar className="w-6 h-6" /> Cronograma físico-financeiro</h1>
          <p className="text-sm text-muted-foreground">Etapas, períodos, Curva S e previsto × realizado.</p>
        </div>
        <div className="flex gap-2">
          <NovoCronogramaDialog />
          <GerarDaPropostaDialog propostas={props ?? []} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Cronogramas</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Proposta / Obra</TableHead>
                  <TableHead>Períodos</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-sm">{c.proposta_titulo ?? c.obra_nome ?? "—"}</TableCell>
                    <TableCell>{c.numero_periodos} {c.unidade_periodo}</TableCell>
                    <TableCell className="text-right tabular-nums">R$ {Number(c.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      {c.is_baseline ? <Badge variant="default"><Lock className="w-3 h-3 mr-1" />Baseline</Badge> : <Badge variant="secondary">{c.status}</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => setSelected(c.id)}><Eye className="w-4 h-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir cronograma?")) del.mutate({ data: { id: c.id } }); }}><Trash2 className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(data ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cronograma cadastrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && <DetalheCronograma id={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function NovoCronogramaDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nome: "", numero_periodos: 6, unidade_periodo: "mes" as "dia" | "semana" | "mes", prazo_dias: 180 });
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: useServerFn(createCronograma),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cronogramas"] }); toast.success("Criado"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4 mr-2" />Novo</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo cronograma</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Períodos</Label><Input type="number" value={form.numero_periodos} onChange={(e) => setForm({ ...form, numero_periodos: Number(e.target.value) })} /></div>
            <div>
              <Label>Unidade</Label>
              <Select value={form.unidade_periodo} onValueChange={(v) => setForm({ ...form, unidade_periodo: v as typeof form.unidade_periodo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dia">Dia</SelectItem><SelectItem value="semana">Semana</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Prazo (dias)</Label><Input type="number" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: Number(e.target.value) })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => create.mutate({ data: form })} disabled={!form.nome}>Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GerarDaPropostaDialog({ propostas }: { propostas: Array<{ id: string; titulo: string; valor_total: number | null }> }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ proposta_id: "", nome: "", numero_periodos: 6, unidade_periodo: "mes" as "dia" | "semana" | "mes", distribuicao: "curva_s" as "uniforme" | "curva_s" });
  const qc = useQueryClient();
  const gerar = useMutation({
    mutationFn: useServerFn(gerarCronogramaDaProposta),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cronogramas"] }); toast.success("Cronograma gerado"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Wand2 className="w-4 h-4 mr-2" />Gerar da proposta</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Gerar a partir de proposta</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Proposta</Label>
            <Select value={form.proposta_id} onValueChange={(v) => {
              const p = propostas.find((x) => x.id === v);
              setForm({ ...form, proposta_id: v, nome: form.nome || `Cronograma — ${p?.titulo ?? ""}` });
            }}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{propostas.map((p) => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Nome</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Períodos</Label><Input type="number" value={form.numero_periodos} onChange={(e) => setForm({ ...form, numero_periodos: Number(e.target.value) })} /></div>
            <div>
              <Label>Unidade</Label>
              <Select value={form.unidade_periodo} onValueChange={(v) => setForm({ ...form, unidade_periodo: v as typeof form.unidade_periodo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="dia">Dia</SelectItem><SelectItem value="semana">Semana</SelectItem><SelectItem value="mes">Mês</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>Distribuição</Label>
              <Select value={form.distribuicao} onValueChange={(v) => setForm({ ...form, distribuicao: v as typeof form.distribuicao })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="uniforme">Uniforme</SelectItem><SelectItem value="curva_s">Curva S</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={() => gerar.mutate({ data: form })} disabled={!form.proposta_id || !form.nome}>Gerar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetalheCronograma({ id, onClose }: { id: string; onClose: () => void }) {
  const get = useServerFn(getCronograma);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["cronograma", id], queryFn: () => get({ data: { id } }) });

  const upsert = useMutation({
    mutationFn: useServerFn(upsertPeriodos),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cronograma", id] }); void qc.invalidateQueries({ queryKey: ["cronogramas"] }); toast.success("Salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const baseline = useMutation({
    mutationFn: useServerFn(congelarBaseline),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["cronograma", id] }); void qc.invalidateQueries({ queryKey: ["cronogramas"] }); toast.success("Baseline congelado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [edits, setEdits] = useState<Record<string, { percent_fisico?: number; percent_realizado?: number | null }>>({});

  const curvaS = useMemo(() => {
    if (!data) return { previsto: [] as number[], realizado: [] as number[] };
    const n = data.cronograma.numero_periodos;
    const total = Number(data.cronograma.valor_total) || 0;
    const prev: number[] = Array(n).fill(0);
    const real: number[] = Array(n).fill(0);
    for (const p of data.periodos) {
      prev[p.periodo_idx] += Number(p.valor_financeiro || 0);
      real[p.periodo_idx] += Number(p.valor_realizado || 0);
    }
    let ap = 0, ar = 0;
    const accP = prev.map((v) => { ap += v; return total ? (ap / total) * 100 : 0; });
    const accR = real.map((v) => { ar += v; return total ? (ar / total) * 100 : 0; });
    return { previsto: accP, realizado: accR };
  }, [data]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>{data?.cronograma.nome ?? "Cronograma"}</span>
            {data && !data.cronograma.is_baseline && (
              <Button size="sm" variant="outline" onClick={() => baseline.mutate({ data: { cronograma_id: id } })}>
                <Lock className="w-4 h-4 mr-2" />Congelar baseline
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !data ? <p>Carregando…</p> : (
          <div className="space-y-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[240px]">Etapa</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {Array.from({ length: data.cronograma.numero_periodos }, (_, i) => (
                      <TableHead key={i} className="text-center min-w-[110px]">P{i + 1}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.etapas.map((e) => (
                    <>
                      <TableRow key={`${e.id}-prev`}>
                        <TableCell rowSpan={2} className="align-top">
                          <div className="font-medium">{e.descricao}</div>
                          {e.codigo && <div className="text-xs text-muted-foreground">{e.codigo}</div>}
                        </TableCell>
                        <TableCell rowSpan={2} className="text-right tabular-nums align-top">R$ {Number(e.valor_etapa).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        {Array.from({ length: data.cronograma.numero_periodos }, (_, i) => {
                          const per = data.periodos.find((p) => p.etapa_id === e.id && p.periodo_idx === i);
                          const key = `${e.id}_${i}`;
                          const curr = edits[key]?.percent_fisico ?? Number(per?.percent_fisico ?? 0);
                          return (
                            <TableCell key={i} className="p-1">
                              <Input
                                disabled={data.cronograma.is_baseline}
                                type="number" step="0.01" min={0} max={100} value={curr}
                                onChange={(ev) => setEdits({ ...edits, [key]: { ...edits[key], percent_fisico: Number(ev.target.value) } })}
                                className="h-8 text-xs"
                              />
                              <div className="text-[10px] text-muted-foreground text-center">prev</div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      <TableRow key={`${e.id}-real`}>
                        {Array.from({ length: data.cronograma.numero_periodos }, (_, i) => {
                          const per = data.periodos.find((p) => p.etapa_id === e.id && p.periodo_idx === i);
                          const key = `${e.id}_${i}`;
                          const curr = edits[key]?.percent_realizado ?? per?.percent_realizado ?? "";
                          return (
                            <TableCell key={i} className="p-1">
                              <Input
                                type="number" step="0.01" min={0} max={100}
                                value={curr ?? ""}
                                onChange={(ev) => setEdits({ ...edits, [key]: { ...edits[key], percent_realizado: ev.target.value === "" ? null : Number(ev.target.value) } })}
                                className="h-8 text-xs bg-muted/30"
                              />
                              <div className="text-[10px] text-muted-foreground text-center">real</div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  const itens = Object.entries(edits).map(([k, v]) => {
                    const [etapa_id, idx] = k.split("_");
                    return { etapa_id, periodo_idx: Number(idx), ...v };
                  });
                  if (!itens.length) { toast.info("Nada para salvar"); return; }
                  upsert.mutate({ data: { cronograma_id: id, itens } });
                  setEdits({});
                }}
                disabled={data.cronograma.is_baseline || Object.keys(edits).length === 0}
              >Salvar alterações</Button>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-sm">Curva S (% acumulado)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        {curvaS.previsto.map((_, i) => <TableHead key={i} className="text-center text-xs">P{i + 1}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Previsto</TableCell>
                        {curvaS.previsto.map((v, i) => <TableCell key={i} className="text-center tabular-nums text-xs">{v.toFixed(1)}%</TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Realizado</TableCell>
                        {curvaS.realizado.map((v, i) => <TableCell key={i} className="text-center tabular-nums text-xs">{v.toFixed(1)}%</TableCell>)}
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Desvio</TableCell>
                        {curvaS.previsto.map((v, i) => {
                          const d = (curvaS.realizado[i] ?? 0) - v;
                          return <TableCell key={i} className={`text-center tabular-nums text-xs ${d < 0 ? "text-destructive" : "text-emerald-600"}`}>{d.toFixed(1)}%</TableCell>;
                        })}
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
