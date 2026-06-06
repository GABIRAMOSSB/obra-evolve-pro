import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, FileText, ClipboardList, Image as ImageIcon } from "lucide-react";
import { RDOFotosDialog } from "@/components/RDOFotosDialog";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import {
  listRDOs,
  upsertRDO,
  atualizarStatusRDO,
  excluirRDO,
} from "@/lib/rdo.functions";

export const Route = createFileRoute("/_app/rdo")({
  component: RDOPage,
});

type Equipe = { funcao: string; quantidade: number; horas_trabalhadas: number; observacao?: string | null };
type Equipamento = { equipamento: string; horas_operadas: number; horas_paradas: number; observacao?: string | null };
type Ocorrencia = { tipo: "atraso" | "acidente" | "seguranca" | "qualidade" | "visita" | "outro"; descricao: string; severidade?: "baixa" | "media" | "alta" | "critica" | null };

const CLIMAS = ["Bom", "Nublado", "Chuva fraca", "Chuva forte", "Praticável", "Impraticável"];

function statusBadge(s: string) {
  if (s === "aprovado") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">aprovado</Badge>;
  if (s === "fechado") return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">fechado</Badge>;
  return <Badge variant="outline">rascunho</Badge>;
}

function RDOPage() {
  const listFn = useServerFn(listRDOs);
  const upsertFn = useServerFn(upsertRDO);
  const statusFn = useServerFn(atualizarStatusRDO);
  const delFn = useServerFn(excluirRDO);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["rdos"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const [open, setOpen] = useState(false);
  const [fotosRdoId, setFotosRdoId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const empty = {
    obra_id: "",
    data: today,
    clima_manha: "Bom",
    clima_tarde: "Bom",
    clima_noite: "Bom",
    condicao_trabalho: "praticavel" as "praticavel" | "impraticavel" | "parcial",
    observacoes: "",
    atividades_executadas: "",
    status: "rascunho" as "rascunho" | "fechado" | "aprovado",
    equipes: [] as Equipe[],
    equipamentos: [] as Equipamento[],
    ocorrencias: [] as Ocorrencia[],
  };
  const [form, setForm] = useState(empty);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!form.obra_id) throw new Error("Selecione a obra.");
      if (!form.data) throw new Error("Informe a data.");
      return upsertFn({ data: form });
    },
    onSuccess: () => {
      toast.success("RDO salvo.");
      setOpen(false);
      setForm(empty);
      qc.invalidateQueries({ queryKey: ["rdos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: "rascunho" | "fechado" | "aprovado" }) => statusFn({ data: vars }),
    onSuccess: () => { toast.success("Status atualizado."); qc.invalidateQueries({ queryKey: ["rdos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("RDO excluído."); qc.invalidateQueries({ queryKey: ["rdos"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const obras = data?.obras ?? [];
  const rdos = data?.rdos ?? [];
  const obraMap = new Map(obras.map((o) => [o.id, o]));

  const rdosUltimos7 = rdos.filter((r) => {
    const d = new Date(r.data);
    const lim = new Date(); lim.setDate(lim.getDate() - 7);
    return d >= lim;
  });
  const efetivoMedio = rdosUltimos7.length
    ? Math.round(rdosUltimos7.reduce((s, r) => s + r.efetivo_total, 0) / rdosUltimos7.length)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="w-7 h-7" /> Relatório Diário de Obra
          </h1>
          <p className="text-muted-foreground">Registre clima, efetivo, equipamentos e ocorrências do dia.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Novo RDO</Button></DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Novo Relatório Diário de Obra</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Obra</Label>
                  <Select value={form.obra_id} onValueChange={(v) => setForm((f) => ({ ...f, obra_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {obras.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {(["clima_manha", "clima_tarde", "clima_noite"] as const).map((k) => (
                  <div key={k}>
                    <Label>{k === "clima_manha" ? "Manhã" : k === "clima_tarde" ? "Tarde" : "Noite"}</Label>
                    <Select value={form[k] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, [k]: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CLIMAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
                <div>
                  <Label>Condição</Label>
                  <Select value={form.condicao_trabalho} onValueChange={(v) => setForm((f) => ({ ...f, condicao_trabalho: v as typeof form.condicao_trabalho }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="praticavel">Praticável</SelectItem>
                      <SelectItem value="parcial">Parcial</SelectItem>
                      <SelectItem value="impraticavel">Impraticável</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Atividades executadas</Label>
                <Textarea rows={3} value={form.atividades_executadas}
                  onChange={(e) => setForm((f) => ({ ...f, atividades_executadas: e.target.value }))} />
              </div>

              {/* Equipes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Equipe</Label>
                  <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, equipes: [...f.equipes, { funcao: "", quantidade: 0, horas_trabalhadas: 8 }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {form.equipes.map((e, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5"><Label className="text-xs">Função</Label><Input value={e.funcao} onChange={(v) => setForm((f) => { const a = [...f.equipes]; a[i] = { ...a[i], funcao: v.target.value }; return { ...f, equipes: a }; })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Qtd</Label><Input type="number" value={e.quantidade} onChange={(v) => setForm((f) => { const a = [...f.equipes]; a[i] = { ...a[i], quantidade: Number(v.target.value || 0) }; return { ...f, equipes: a }; })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Horas</Label><Input type="number" step="0.5" value={e.horas_trabalhadas} onChange={(v) => setForm((f) => { const a = [...f.equipes]; a[i] = { ...a[i], horas_trabalhadas: Number(v.target.value || 0) }; return { ...f, equipes: a }; })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Obs</Label><Input value={e.observacao ?? ""} onChange={(v) => setForm((f) => { const a = [...f.equipes]; a[i] = { ...a[i], observacao: v.target.value }; return { ...f, equipes: a }; })} /></div>
                    <Button size="icon" variant="ghost" onClick={() => setForm((f) => ({ ...f, equipes: f.equipes.filter((_, j) => j !== i) }))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              {/* Equipamentos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Equipamentos</Label>
                  <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, equipamentos: [...f.equipamentos, { equipamento: "", horas_operadas: 0, horas_paradas: 0 }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {form.equipamentos.map((e, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5"><Label className="text-xs">Equipamento</Label><Input value={e.equipamento} onChange={(v) => setForm((f) => { const a = [...f.equipamentos]; a[i] = { ...a[i], equipamento: v.target.value }; return { ...f, equipamentos: a }; })} /></div>
                    <div className="col-span-2"><Label className="text-xs">H. operadas</Label><Input type="number" step="0.5" value={e.horas_operadas} onChange={(v) => setForm((f) => { const a = [...f.equipamentos]; a[i] = { ...a[i], horas_operadas: Number(v.target.value || 0) }; return { ...f, equipamentos: a }; })} /></div>
                    <div className="col-span-2"><Label className="text-xs">H. paradas</Label><Input type="number" step="0.5" value={e.horas_paradas} onChange={(v) => setForm((f) => { const a = [...f.equipamentos]; a[i] = { ...a[i], horas_paradas: Number(v.target.value || 0) }; return { ...f, equipamentos: a }; })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Obs</Label><Input value={e.observacao ?? ""} onChange={(v) => setForm((f) => { const a = [...f.equipamentos]; a[i] = { ...a[i], observacao: v.target.value }; return { ...f, equipamentos: a }; })} /></div>
                    <Button size="icon" variant="ghost" onClick={() => setForm((f) => ({ ...f, equipamentos: f.equipamentos.filter((_, j) => j !== i) }))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              {/* Ocorrências */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base">Ocorrências</Label>
                  <Button size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, ocorrencias: [...f.ocorrencias, { tipo: "outro", descricao: "", severidade: "baixa" }] }))}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                {form.ocorrencias.map((o, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-3"><Label className="text-xs">Tipo</Label>
                      <Select value={o.tipo} onValueChange={(v) => setForm((f) => { const a = [...f.ocorrencias]; a[i] = { ...a[i], tipo: v as Ocorrencia["tipo"] }; return { ...f, ocorrencias: a }; })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["atraso", "acidente", "seguranca", "qualidade", "visita", "outro"] as const).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label className="text-xs">Severidade</Label>
                      <Select value={o.severidade ?? "baixa"} onValueChange={(v) => setForm((f) => { const a = [...f.ocorrencias]; a[i] = { ...a[i], severidade: v as Ocorrencia["severidade"] }; return { ...f, ocorrencias: a }; })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(["baixa", "media", "alta", "critica"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-6"><Label className="text-xs">Descrição</Label><Input value={o.descricao} onChange={(v) => setForm((f) => { const a = [...f.ocorrencias]; a[i] = { ...a[i], descricao: v.target.value }; return { ...f, ocorrencias: a }; })} /></div>
                    <Button size="icon" variant="ghost" onClick={() => setForm((f) => ({ ...f, ocorrencias: f.ocorrencias.filter((_, j) => j !== i) }))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>

              <div>
                <Label>Observações gerais</Label>
                <Textarea rows={2} value={form.observacoes}
                  onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as typeof form.status }))}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="fechado">Fechado</SelectItem>
                    <SelectItem value="aprovado">Aprovado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                <FileText className="w-4 h-4 mr-2" /> Salvar RDO
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">RDOs registrados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rdos.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Últimos 7 dias</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rdosUltimos7.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Efetivo médio (7d)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{efetivoMedio} pessoas</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Diários recentes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rdos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum RDO registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 px-2">Data</th>
                    <th className="py-2 px-2">Obra</th>
                    <th className="py-2 px-2">Clima</th>
                    <th className="py-2 px-2">Condição</th>
                    <th className="py-2 px-2 text-right">Efetivo</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rdos.map((r) => {
                    const o = obraMap.get(r.obra_id);
                    return (
                      <tr key={r.id} className="border-b last:border-b-0 hover:bg-muted/40">
                        <td className="py-2 px-2 font-mono">{r.data}</td>
                        <td className="py-2 px-2">{o?.nome ?? "—"}</td>
                        <td className="py-2 px-2 text-xs">{[r.clima_manha, r.clima_tarde, r.clima_noite].filter(Boolean).join(" / ") || "—"}</td>
                        <td className="py-2 px-2 capitalize">{r.condicao_trabalho ?? "—"}</td>
                        <td className="py-2 px-2 text-right">{r.efetivo_total}</td>
                        <td className="py-2 px-2">{statusBadge(r.status)}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Fotos"
                              onClick={() => setFotosRdoId(r.id)}>
                              <ImageIcon className="w-4 h-4" />
                            </Button>
                            {r.status === "rascunho" && (
                              <Button size="icon" variant="ghost" title="Fechar"
                                onClick={() => statusMut.mutate({ id: r.id, status: "fechado" })}>
                                <CheckCircle2 className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}
                            {r.status === "fechado" && (
                              <Button size="icon" variant="ghost" title="Aprovar"
                                onClick={() => statusMut.mutate({ id: r.id, status: "aprovado" })}>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Excluir"
                              onClick={() => { if (confirm("Excluir este RDO?")) delMut.mutate(r.id); }}>
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
        </CardContent>
      </Card>

      <RDOFotosDialog
        rdoId={fotosRdoId}
        open={!!fotosRdoId}
        onOpenChange={(o) => { if (!o) setFotosRdoId(null); }}
      />
    </div>
  );
}
