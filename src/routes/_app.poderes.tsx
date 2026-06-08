import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ShieldCheck, ShieldOff, Edit, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  listPoderes,
  upsertSignatario,
  excluirSignatario,
  upsertProcuracao,
  revogarProcuracao,
  excluirProcuracao,
  ESCOPO_PADRAO,
  type SignatarioRow,
  type ProcuracaoRow,
} from "@/lib/poderes.functions";

export const Route = createFileRoute("/_app/poderes")({
  component: PoderesPage,
});

const PODERES_PAGE_SIZE = 20;

const TIPO_SIGNATARIO = [
  { v: "socio", l: "Sócio" },
  { v: "administrador", l: "Administrador" },
  { v: "procurador", l: "Procurador" },
  { v: "representante", l: "Representante" },
  { v: "outro", l: "Outro" },
] as const;

function tipoBadge(t: SignatarioRow["tipo"]) {
  const map: Record<SignatarioRow["tipo"], string> = {
    socio: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    administrador: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    procurador: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    representante: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    outro: "",
  };
  return <Badge variant="outline" className={map[t]}>{t}</Badge>;
}

function statusBadge(s: ProcuracaoRow["status"]) {
  if (s === "vigente") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">vigente</Badge>;
  if (s === "expirada") return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">expirada</Badge>;
  if (s === "suspensa") return <Badge variant="secondary">suspensa</Badge>;
  return <Badge variant="destructive">revogada</Badge>;
}

const EMPTY_SIG = {
  id: undefined as string | undefined,
  nome: "",
  cpf: "",
  email: "",
  telefone: "",
  cargo: "",
  tipo: "procurador" as SignatarioRow["tipo"],
  ativo: true,
  observacoes: "",
};

const EMPTY_PROC = {
  id: undefined as string | undefined,
  signatario_id: "",
  tipo: "particular" as ProcuracaoRow["tipo"],
  numero: "",
  cartorio: "",
  data_outorga: "",
  data_validade: "",
  poderes_gerais: false,
  escopo: {} as Record<string, boolean>,
  poderes_especificos: "",
  substabelecimento: false,
  arquivo_path: "",
  status: "vigente" as ProcuracaoRow["status"],
  observacoes: "",
};

function PoderesPage() {
  const listFn = useServerFn(listPoderes);
  const upSigFn = useServerFn(upsertSignatario);
  const delSigFn = useServerFn(excluirSignatario);
  const upProcFn = useServerFn(upsertProcuracao);
  const revProcFn = useServerFn(revogarProcuracao);
  const delProcFn = useServerFn(excluirProcuracao);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["poderes"],
    queryFn: () => listFn({ data: undefined as never }),
  });

  const signatarios = data?.signatarios ?? [];
  const procuracoes = data?.procuracoes ?? [];
  const sigMap = new Map(signatarios.map((s) => [s.id, s]));
  const [procPage, setProcPage] = useState(1);
  const [sigPage, setSigPage] = useState(1);
  const procTotalPages = Math.max(1, Math.ceil(procuracoes.length / PODERES_PAGE_SIZE));
  const safeProcPage = Math.min(procPage, procTotalPages);
  const paginatedProcuracoes = procuracoes.slice(
    (safeProcPage - 1) * PODERES_PAGE_SIZE,
    safeProcPage * PODERES_PAGE_SIZE,
  );
  const sigTotalPages = Math.max(1, Math.ceil(signatarios.length / PODERES_PAGE_SIZE));
  const safeSigPage = Math.min(sigPage, sigTotalPages);
  const paginatedSignatarios = signatarios.slice(
    (safeSigPage - 1) * PODERES_PAGE_SIZE,
    safeSigPage * PODERES_PAGE_SIZE,
  );

  // ---- Signatário ----
  const [openSig, setOpenSig] = useState(false);
  const [sigForm, setSigForm] = useState(EMPTY_SIG);
  const sigMut = useMutation({
    mutationFn: () => upSigFn({ data: sigForm }),
    onSuccess: () => {
      toast.success(sigForm.id ? "Signatário atualizado." : "Signatário criado.");
      setOpenSig(false);
      setSigForm(EMPTY_SIG);
      qc.invalidateQueries({ queryKey: ["poderes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delSigMut = useMutation({
    mutationFn: (id: string) => delSigFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Signatário removido.");
      qc.invalidateQueries({ queryKey: ["poderes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Procuração ----
  const [openProc, setOpenProc] = useState(false);
  const [procForm, setProcForm] = useState(EMPTY_PROC);
  const procMut = useMutation({
    mutationFn: () => {
      if (!procForm.signatario_id) throw new Error("Selecione o outorgado.");
      if (!procForm.data_outorga) throw new Error("Informe a data de outorga.");
      return upProcFn({ data: procForm });
    },
    onSuccess: () => {
      toast.success(procForm.id ? "Procuração atualizada." : "Procuração registrada.");
      setOpenProc(false);
      setProcForm(EMPTY_PROC);
      qc.invalidateQueries({ queryKey: ["poderes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const revProcMut = useMutation({
    mutationFn: (vars: { id: string; motivo?: string }) => revProcFn({ data: vars }),
    onSuccess: () => {
      toast.success("Procuração revogada.");
      qc.invalidateQueries({ queryKey: ["poderes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delProcMut = useMutation({
    mutationFn: (id: string) => delProcFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Procuração excluída.");
      qc.invalidateQueries({ queryKey: ["poderes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vigentes = procuracoes.filter((p) => p.status === "vigente").length;
  const expirando = procuracoes.filter((p) => {
    if (p.status !== "vigente" || !p.data_validade) return false;
    const dias = (new Date(p.data_validade).getTime() - Date.now()) / 86_400_000;
    return dias >= 0 && dias <= 30;
  }).length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Matriz de Poderes</h1>
        <p className="text-muted-foreground">
          Cadastro de signatários autorizados e procurações com prazo, escopo e poderes específicos.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Signatários ativos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{signatarios.filter((s) => s.ativo).length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Procurações vigentes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{vigentes}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Expirando em 30 dias</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold flex items-center gap-2">{expirando}{expirando > 0 && <AlertTriangle className="w-5 h-5 text-amber-500" />}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="procuracoes">
        <TabsList>
          <TabsTrigger value="procuracoes">Procurações</TabsTrigger>
          <TabsTrigger value="signatarios">Signatários</TabsTrigger>
        </TabsList>

        {/* ============ Procurações ============ */}
        <TabsContent value="procuracoes" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openProc} onOpenChange={(o) => { setOpenProc(o); if (!o) setProcForm(EMPTY_PROC); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Nova procuração</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{procForm.id ? "Editar procuração" : "Nova procuração"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Outorgado (signatário)</Label>
                      <Select value={procForm.signatario_id} onValueChange={(v) => setProcForm((f) => ({ ...f, signatario_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                        <SelectContent>
                          {signatarios.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.nome} {s.cargo ? `— ${s.cargo}` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={procForm.tipo} onValueChange={(v) => setProcForm((f) => ({ ...f, tipo: v as ProcuracaoRow["tipo"] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="particular">Particular</SelectItem>
                          <SelectItem value="publica">Pública</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Número</Label>
                      <Input value={procForm.numero} onChange={(e) => setProcForm((f) => ({ ...f, numero: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Cartório / Livro</Label>
                      <Input value={procForm.cartorio} onChange={(e) => setProcForm((f) => ({ ...f, cartorio: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data de outorga</Label>
                      <Input type="date" value={procForm.data_outorga}
                        onChange={(e) => setProcForm((f) => ({ ...f, data_outorga: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Validade (opcional)</Label>
                      <Input type="date" value={procForm.data_validade}
                        onChange={(e) => setProcForm((f) => ({ ...f, data_validade: e.target.value }))} />
                    </div>
                  </div>

                  <div className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold">Poderes gerais</Label>
                      <Switch checked={procForm.poderes_gerais}
                        onCheckedChange={(v) => setProcForm((f) => ({ ...f, poderes_gerais: !!v }))} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Quando ativo, presume amplos poderes de administração. Ainda assim, restrinja por escopo abaixo.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      {ESCOPO_PADRAO.map((e) => (
                        <label key={e.key} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={!!procForm.escopo[e.key]}
                            onCheckedChange={(v) =>
                              setProcForm((f) => ({ ...f, escopo: { ...f.escopo, [e.key]: !!v } }))} />
                          {e.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Poderes específicos / restrições</Label>
                    <Textarea rows={3} value={procForm.poderes_especificos}
                      onChange={(e) => setProcForm((f) => ({ ...f, poderes_especificos: e.target.value }))}
                      placeholder="Ex.: limite de R$ 500.000 por contrato, vedado substabelecer…" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={procForm.substabelecimento}
                        onCheckedChange={(v) => setProcForm((f) => ({ ...f, substabelecimento: !!v }))} />
                      <Label>Permite substabelecimento</Label>
                    </div>
                    <div>
                      <Label>Caminho do arquivo (storage)</Label>
                      <Input value={procForm.arquivo_path}
                        onChange={(e) => setProcForm((f) => ({ ...f, arquivo_path: e.target.value }))}
                        placeholder="biblioteca/…/procuracao.pdf" />
                    </div>
                  </div>

                  <div>
                    <Label>Observações</Label>
                    <Textarea rows={2} value={procForm.observacoes}
                      onChange={(e) => setProcForm((f) => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenProc(false)}>Cancelar</Button>
                  <Button onClick={() => procMut.mutate()} disabled={procMut.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader><CardTitle>Procurações</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : procuracoes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma procuração cadastrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 px-2">Outorgado</th>
                        <th className="py-2 px-2">Tipo</th>
                        <th className="py-2 px-2">Outorga</th>
                        <th className="py-2 px-2">Validade</th>
                        <th className="py-2 px-2">Escopo</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProcuracoes.map((p) => {
                        const sig = sigMap.get(p.signatario_id);
                        const escopos = Object.entries(p.escopo ?? {})
                          .filter(([, v]) => v)
                          .map(([k]) => ESCOPO_PADRAO.find((e) => e.key === k)?.label ?? k);
                        return (
                          <tr key={p.id} className="border-b last:border-b-0 hover:bg-muted/40 align-top">
                            <td className="py-2 px-2">
                              <div className="font-medium">{sig?.nome ?? "—"}</div>
                              <div className="text-xs text-muted-foreground">{sig?.cargo ?? ""}</div>
                            </td>
                            <td className="py-2 px-2">
                              <div>{p.tipo}</div>
                              {p.numero && <div className="text-xs text-muted-foreground">{p.numero}</div>}
                            </td>
                            <td className="py-2 px-2 text-xs">{p.data_outorga}</td>
                            <td className="py-2 px-2 text-xs">{p.data_validade ?? "—"}</td>
                            <td className="py-2 px-2">
                              <div className="flex flex-wrap gap-1 max-w-[260px]">
                                {p.poderes_gerais && <Badge variant="outline">gerais</Badge>}
                                {escopos.slice(0, 4).map((e) => (
                                  <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>
                                ))}
                                {escopos.length > 4 && <Badge variant="secondary" className="text-xs">+{escopos.length - 4}</Badge>}
                              </div>
                            </td>
                            <td className="py-2 px-2">{statusBadge(p.status)}</td>
                            <td className="py-2 px-2">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" title="Editar"
                                  onClick={() => {
                                    setProcForm({
                                      id: p.id,
                                      signatario_id: p.signatario_id,
                                      tipo: p.tipo,
                                      numero: p.numero ?? "",
                                      cartorio: p.cartorio ?? "",
                                      data_outorga: p.data_outorga,
                                      data_validade: p.data_validade ?? "",
                                      poderes_gerais: p.poderes_gerais,
                                      escopo: p.escopo ?? {},
                                      poderes_especificos: p.poderes_especificos ?? "",
                                      substabelecimento: p.substabelecimento,
                                      arquivo_path: p.arquivo_path ?? "",
                                      status: p.status === "expirada" ? "vigente" : p.status,
                                      observacoes: p.observacoes ?? "",
                                    });
                                    setOpenProc(true);
                                  }}>
                                  <Edit className="w-4 h-4" />
                                </Button>
                                {p.status === "vigente" && (
                                  <Button size="icon" variant="ghost" title="Revogar"
                                    onClick={() => {
                                      const motivo = prompt("Motivo da revogação (opcional):") || undefined;
                                      revProcMut.mutate({ id: p.id, motivo });
                                    }}>
                                    <ShieldOff className="w-4 h-4 text-amber-600" />
                                  </Button>
                                )}
                                <Button size="icon" variant="ghost" title="Excluir"
                                  onClick={() => { if (confirm("Excluir esta procuração?")) delProcMut.mutate(p.id); }}>
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
              {procuracoes.length > PODERES_PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
                  <span>Mostrando {paginatedProcuracoes.length} de {procuracoes.length} procuracoes</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setProcPage((p) => Math.max(1, p - 1))} disabled={safeProcPage === 1}>
                      <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                    </Button>
                    <span className="min-w-20 text-center">Pagina {safeProcPage} de {procTotalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setProcPage((p) => Math.min(procTotalPages, p + 1))} disabled={safeProcPage >= procTotalPages}>
                      Proxima <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Signatários ============ */}
        <TabsContent value="signatarios" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={openSig} onOpenChange={(o) => { setOpenSig(o); if (!o) setSigForm(EMPTY_SIG); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Novo signatário</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{sigForm.id ? "Editar signatário" : "Novo signatário"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nome completo</Label>
                    <Input value={sigForm.nome} onChange={(e) => setSigForm((f) => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>CPF</Label>
                      <Input value={sigForm.cpf} onChange={(e) => setSigForm((f) => ({ ...f, cpf: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Cargo</Label>
                      <Input value={sigForm.cargo} onChange={(e) => setSigForm((f) => ({ ...f, cargo: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>E-mail</Label>
                      <Input type="email" value={sigForm.email}
                        onChange={(e) => setSigForm((f) => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Telefone</Label>
                      <Input value={sigForm.telefone}
                        onChange={(e) => setSigForm((f) => ({ ...f, telefone: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={sigForm.tipo} onValueChange={(v) => setSigForm((f) => ({ ...f, tipo: v as SignatarioRow["tipo"] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPO_SIGNATARIO.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pb-2">
                      <Switch checked={sigForm.ativo} onCheckedChange={(v) => setSigForm((f) => ({ ...f, ativo: !!v }))} />
                      <Label>Ativo</Label>
                    </div>
                  </div>
                  <div>
                    <Label>Observações</Label>
                    <Textarea rows={2} value={sigForm.observacoes}
                      onChange={(e) => setSigForm((f) => ({ ...f, observacoes: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenSig(false)}>Cancelar</Button>
                  <Button onClick={() => sigMut.mutate()} disabled={sigMut.isPending}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader><CardTitle>Signatários autorizados</CardTitle></CardHeader>
            <CardContent>
              {signatarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum signatário cadastrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-muted-foreground border-b">
                      <tr>
                        <th className="py-2 px-2">Nome</th>
                        <th className="py-2 px-2">Cargo</th>
                        <th className="py-2 px-2">Tipo</th>
                        <th className="py-2 px-2">Contato</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSignatarios.map((s) => (
                        <tr key={s.id} className="border-b last:border-b-0 hover:bg-muted/40">
                          <td className="py-2 px-2">
                            <div className="font-medium">{s.nome}</div>
                            {s.cpf && <div className="text-xs text-muted-foreground font-mono">{s.cpf}</div>}
                          </td>
                          <td className="py-2 px-2">{s.cargo ?? "—"}</td>
                          <td className="py-2 px-2">{tipoBadge(s.tipo)}</td>
                          <td className="py-2 px-2 text-xs">
                            {s.email && <div>{s.email}</div>}
                            {s.telefone && <div className="text-muted-foreground">{s.telefone}</div>}
                          </td>
                          <td className="py-2 px-2">
                            {s.ativo
                              ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"><ShieldCheck className="w-3 h-3 mr-1" />ativo</Badge>
                              : <Badge variant="secondary">inativo</Badge>}
                          </td>
                          <td className="py-2 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="icon" variant="ghost" title="Editar"
                                onClick={() => {
                                  setSigForm({
                                    id: s.id,
                                    nome: s.nome,
                                    cpf: s.cpf ?? "",
                                    email: s.email ?? "",
                                    telefone: s.telefone ?? "",
                                    cargo: s.cargo ?? "",
                                    tipo: s.tipo,
                                    ativo: s.ativo,
                                    observacoes: s.observacoes ?? "",
                                  });
                                  setOpenSig(true);
                                }}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" title="Excluir"
                                onClick={() => { if (confirm("Excluir este signatário? Procurações vinculadas serão removidas.")) delSigMut.mutate(s.id); }}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {signatarios.length > PODERES_PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3 mt-3 text-sm text-muted-foreground">
                  <span>Mostrando {paginatedSignatarios.length} de {signatarios.length} signatarios</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSigPage((p) => Math.max(1, p - 1))} disabled={safeSigPage === 1}>
                      <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
                    </Button>
                    <span className="min-w-20 text-center">Pagina {safeSigPage} de {sigTotalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setSigPage((p) => Math.min(sigTotalPages, p + 1))} disabled={safeSigPage >= sigTotalPages}>
                      Proxima <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
