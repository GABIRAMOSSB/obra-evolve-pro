import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, CheckCircle2, XCircle, FilePlus2, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  listAditivos,
  criarAditivo,
  atualizarStatusAditivo,
  excluirAditivo,
} from "@/lib/aditivos.functions";

export const Route = createFileRoute("/_app/aditivos")({
  component: AditivosPage,
});

const ADITIVOS_PAGE_SIZE = 20;

const brl = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AditivosPagination({ total, shown, page, totalPages, onPrev, onNext }: { total: number; shown: number; page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
      <span>Mostrando {shown} de {total} aditivos</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrev} disabled={page === 1}><ChevronLeft className="w-4 h-4 mr-1" /> Anterior</Button>
        <span className="min-w-20 text-center">Pagina {page} de {totalPages}</span>
        <Button variant="outline" size="sm" onClick={onNext} disabled={page >= totalPages}>Proxima <ChevronRight className="w-4 h-4 ml-1" /></Button>
      </div>
    </div>
  );
}

function statusBadge(s: string) {
  if (s === "vigente") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">vigente</Badge>;
  if (s === "cancelado") return <Badge variant="secondary">cancelado</Badge>;
  return <Badge variant="outline">rascunho</Badge>;
}

function AditivosPage() {
  const listFn = useServerFn(listAditivos);
  const createFn = useServerFn(criarAditivo);
  const statusFn = useServerFn(atualizarStatusAditivo);
  const deleteFn = useServerFn(excluirAditivo);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["aditivos"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    contrato_id: "",
    tipo: "valor" as "valor" | "prazo" | "escopo" | "misto",
    valor_delta: "0",
    prazo_dias_delta: "0",
    data_assinatura: "",
    justificativa: "",
    status: "rascunho" as "rascunho" | "vigente" | "cancelado",
  });

  const createMut = useMutation({
    mutationFn: async () => {
      if (!form.contrato_id) throw new Error("Selecione o contrato.");
      return createFn({
        data: {
          contrato_id: form.contrato_id,
          tipo: form.tipo,
          valor_delta: Number(form.valor_delta || 0),
          prazo_dias_delta: Number(form.prazo_dias_delta || 0),
          data_assinatura: form.data_assinatura || null,
          justificativa: form.justificativa || null,
          status: form.status,
        },
      });
    },
    onSuccess: () => {
      toast.success("Aditivo registrado.");
      setOpen(false);
      setForm({ contrato_id: "", tipo: "valor", valor_delta: "0", prazo_dias_delta: "0", data_assinatura: "", justificativa: "", status: "rascunho" });
      qc.invalidateQueries({ queryKey: ["aditivos"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: "rascunho" | "vigente" | "cancelado" }) =>
      statusFn({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      qc.invalidateQueries({ queryKey: ["aditivos"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Aditivo excluído.");
      qc.invalidateQueries({ queryKey: ["aditivos"] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contratos = data?.contratos ?? [];
  const aditivos = data?.aditivos ?? [];
  const contratoMap = new Map(contratos.map((c) => [c.id, c]));
  const totalPages = Math.max(1, Math.ceil(aditivos.length / ADITIVOS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedAditivos = aditivos.slice((safePage - 1) * ADITIVOS_PAGE_SIZE, safePage * ADITIVOS_PAGE_SIZE);

  const totalValorVigente = aditivos
    .filter((a) => a.status === "vigente")
    .reduce((s, a) => s + Number(a.valor_delta || 0), 0);
  const totalPrazoVigente = aditivos
    .filter((a) => a.status === "vigente")
    .reduce((s, a) => s + Number(a.prazo_dias_delta || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Aditivos contratuais</h1>
          <p className="text-muted-foreground">
            Termos aditivos de valor, prazo e escopo. Quando marcados como vigentes,
            atualizam automaticamente o valor e a vigência do contrato.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Novo aditivo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo termo aditivo</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Contrato</Label>
                <Select value={form.contrato_id} onValueChange={(v) => setForm((f) => ({ ...f, contrato_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    {contratos.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.numero} — {c.objeto?.slice(0, 50) ?? "(sem objeto)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as typeof form.tipo }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="valor">Valor</SelectItem>
                      <SelectItem value="prazo">Prazo</SelectItem>
                      <SelectItem value="escopo">Escopo</SelectItem>
                      <SelectItem value="misto">Misto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status inicial</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as typeof form.status }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="vigente">Vigente (aplica já)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Δ Valor (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor_delta}
                    onChange={(e) => setForm((f) => ({ ...f, valor_delta: e.target.value }))} />
                </div>
                <div>
                  <Label>Δ Prazo (dias)</Label>
                  <Input type="number" value={form.prazo_dias_delta}
                    onChange={(e) => setForm((f) => ({ ...f, prazo_dias_delta: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Data de assinatura</Label>
                <Input type="date" value={form.data_assinatura}
                  onChange={(e) => setForm((f) => ({ ...f, data_assinatura: e.target.value }))} />
              </div>
              <div>
                <Label>Justificativa</Label>
                <Textarea rows={3} value={form.justificativa}
                  onChange={(e) => setForm((f) => ({ ...f, justificativa: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                <FilePlus2 className="w-4 h-4 mr-2" /> Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Aditivos cadastrados</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{aditivos.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Δ Valor aplicado (vigentes)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{brl(totalValorVigente)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Δ Prazo aplicado (vigentes)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalPrazoVigente} dias</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Termos aditivos</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : aditivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum aditivo cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-2 px-2">Contrato</th>
                    <th className="py-2 px-2">Nº</th>
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2 text-right">Δ Valor</th>
                    <th className="py-2 px-2 text-right">Δ Prazo</th>
                    <th className="py-2 px-2">Assinatura</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAditivos.map((a) => {
                    const c = contratoMap.get(a.contrato_id);
                    return (
                      <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/40">
                        <td className="py-2 px-2">
                          <div className="font-medium">{c?.numero ?? "—"}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">{c?.objeto ?? ""}</div>
                        </td>
                        <td className="py-2 px-2">#{a.numero}</td>
                        <td className="py-2 px-2 capitalize">{a.tipo}</td>
                        <td className="py-2 px-2 text-right">{brl(a.valor_delta)}</td>
                        <td className="py-2 px-2 text-right">{a.prazo_dias_delta} d</td>
                        <td className="py-2 px-2">{a.data_assinatura ?? "—"}</td>
                        <td className="py-2 px-2">{statusBadge(a.status)}</td>
                        <td className="py-2 px-2">
                          <div className="flex items-center justify-end gap-1">
                            {a.status !== "vigente" && (
                              <Button size="icon" variant="ghost" title="Tornar vigente"
                                onClick={() => statusMut.mutate({ id: a.id, status: "vigente" })}>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              </Button>
                            )}
                            {a.status === "vigente" && (
                              <Button size="icon" variant="ghost" title="Cancelar"
                                onClick={() => statusMut.mutate({ id: a.id, status: "cancelado" })}>
                                <XCircle className="w-4 h-4 text-amber-600" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" title="Excluir"
                              onClick={() => { if (confirm("Excluir este aditivo?")) deleteMut.mutate(a.id); }}>
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
          {aditivos.length > ADITIVOS_PAGE_SIZE && (
            <AditivosPagination total={aditivos.length} shown={paginatedAditivos.length} page={safePage} totalPages={totalPages} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
