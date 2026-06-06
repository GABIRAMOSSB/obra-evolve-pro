import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listContratos,
  createContrato,
  updateContrato,
  deleteContrato,
  listEventos,
  createEvento,
  deleteEvento,
  listObrasParaSelect,
  listSignaturesByContrato,
  listSignaturesDisponiveis,
  linkSignatureToContrato,
  type ContratoRow,
  type EventoRow,
  type EventoTipo,
  type ContratoSignatureRow,
} from "@/lib/contratos.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Plus,
  Trash2,
  ChevronLeft,
  CalendarClock,
  FileSignature,
  Loader2,
  AlertTriangle,
  PenTool,
  ExternalLink,
  Link2,
  Link2Off,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/contratos")({
  component: ContratosPage,
  head: () => ({ meta: [{ title: "Contratos — SOLV Gestão" }] }),
});

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(`${v}T00:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return v;
  }
}

function fmtBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_LABEL: Record<string, string> = {
  vigente: "Vigente",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
  rescindido: "Rescindido",
  em_elaboracao: "Em elaboração",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  vigente: "default",
  suspenso: "secondary",
  encerrado: "outline",
  rescindido: "destructive",
  em_elaboracao: "secondary",
};

const TIPO_LABEL: Record<EventoTipo, string> = {
  atraso: "Atraso",
  suspensao: "Suspensão",
  paralisacao: "Paralisação",
  prorrogacao: "Prorrogação",
  aditivo_prazo: "Aditivo de prazo",
  aditivo_valor: "Aditivo de valor",
  aditivo_qualitativo: "Aditivo qualitativo",
  reprogramacao: "Reprogramação",
  supressao: "Supressão",
  acrescimo: "Acréscimo",
  ordem_servico: "Ordem de serviço",
  apostilamento: "Apostilamento",
  notificacao: "Notificação",
  resposta_orgao: "Resposta do órgão",
  outro: "Outro",
};

function ContratosPage() {
  const [selected, setSelected] = useState<string | null>(null);
  return selected ? (
    <ContratoDetail id={selected} onBack={() => setSelected(null)} />
  ) : (
    <ContratoList onOpen={(id) => setSelected(id)} />
  );
}

function ContratoList({ onOpen }: { onOpen: (id: string) => void }) {
  const list = useServerFn(listContratos);
  const remove = useServerFn(deleteContrato);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contratos"],
    queryFn: () => list(),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Contrato removido");
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const rows = data ?? [];
  const expirando = useMemo(() => {
    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + 60);
    return rows.filter((c) => {
      if (!c.data_fim_vigencia || c.status !== "vigente") return false;
      const d = new Date(`${c.data_fim_vigencia}T00:00:00`);
      return d >= hoje && d <= limite;
    }).length;
  }, [rows]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ciclo de vida dos contratos administrativos — vigência, aditivos e eventos.
          </p>
        </div>
        <NovoContratoDialog />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-bold mt-1">{rows.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Vigentes</div>
          <div className="text-2xl font-bold mt-1">
            {rows.filter((c) => c.status === "vigente").length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Vencendo em 60 dias
          </div>
          <div className="text-2xl font-bold mt-1">{expirando}</div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            Nenhum contrato cadastrado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Nº / Órgão</th>
                <th className="text-left px-4 py-3">Obra</th>
                <th className="text-left px-4 py-3">Vigência</th>
                <th className="text-right px-4 py-3">Valor</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                  onClick={() => onOpen(c.id)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.numero}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                      {c.orgao_contratante ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.obra_nome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{fmtDate(c.data_inicio_vigencia)}</div>
                    <div className="text-muted-foreground">
                      até {fmtDate(c.data_fim_vigencia)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div>{fmtBRL(c.valor_atualizado ?? c.valor_original)}</div>
                    {c.eventos_count > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        {c.eventos_count} evento(s)
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                      {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remover contrato ${c.numero}?`)) del.mutate(c.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function NovoContratoDialog() {
  const create = useServerFn(createContrato);
  const listObras = useServerFn(listObrasParaSelect);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [orgao, setOrgao] = useState("");
  const [obraId, setObraId] = useState<string>("none");
  const [objeto, setObjeto] = useState("");
  const [modalidade, setModalidade] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [valor, setValor] = useState("");

  const { data: obras } = useQuery({
    queryKey: ["contratos-obras-select"],
    queryFn: () => listObras(),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          numero: numero.trim(),
          orgao_contratante: orgao.trim() || null,
          obra_id: obraId === "none" ? null : obraId,
          objeto: objeto.trim() || null,
          modalidade: modalidade.trim() || null,
          data_inicio_vigencia: dataInicio || null,
          data_fim_vigencia: dataFim || null,
          valor_original: valor ? Number(valor.replace(/\./g, "").replace(",", ".")) : null,
          status: "vigente",
        },
      }),
    onSuccess: () => {
      toast.success("Contrato criado");
      qc.invalidateQueries({ queryKey: ["contratos"] });
      setOpen(false);
      setNumero("");
      setOrgao("");
      setObraId("none");
      setObjeto("");
      setModalidade("");
      setDataInicio("");
      setDataFim("");
      setValor("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> Novo contrato
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Número *</Label>
            <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="000/2026" />
          </div>
          <div className="col-span-2">
            <Label>Órgão contratante</Label>
            <Input value={orgao} onChange={(e) => setOrgao(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Obra vinculada</Label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Nenhuma —</SelectItem>
                {(obras ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modalidade</Label>
            <Input value={modalidade} onChange={(e) => setModalidade(e.target.value)} placeholder="Pregão, Concorrência…" />
          </div>
          <div>
            <Label>Valor original (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </div>
          <div>
            <Label>Início da vigência</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Fim da vigência</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Objeto</Label>
            <Textarea value={objeto} onChange={(e) => setObjeto(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!numero.trim() || mut.isPending}>
            {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContratoDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const list = useServerFn(listContratos);
  const listEv = useServerFn(listEventos);
  const update = useServerFn(updateContrato);
  const qc = useQueryClient();

  const { data: contratos } = useQuery({
    queryKey: ["contratos"],
    queryFn: () => list(),
  });
  const contrato = contratos?.find((c: ContratoRow) => c.id === id);

  const { data: eventos } = useQuery({
    queryKey: ["contrato-eventos", id],
    queryFn: () => listEv({ data: { contrato_id: id } }),
  });

  const upd = useMutation({
    mutationFn: (status: string) =>
      update({ data: { id, status: status as "vigente" } }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!contrato) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="text-muted-foreground mt-6">Carregando…</div>
      </div>
    );
  }

  const valorOriginal = contrato.valor_original ?? 0;
  const valorAtual = contrato.valor_atualizado ?? valorOriginal;
  const delta = valorAtual - valorOriginal;
  const deltaPct = valorOriginal > 0 ? (delta / valorOriginal) * 100 : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex items-center gap-2">
          <Select value={contrato.status} onValueChange={(v) => upd.mutate(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <FileSignature className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Contrato {contrato.numero}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {contrato.orgao_contratante ?? "Sem órgão informado"}
              {contrato.obra_nome && (
                <>
                  {" · "}
                  <Building2 className="inline w-3.5 h-3.5 mr-1" />
                  {contrato.obra_nome}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor original</div>
          <div className="text-lg font-bold mt-1 tabular-nums">{fmtBRL(contrato.valor_original)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Valor atualizado</div>
          <div className="text-lg font-bold mt-1 tabular-nums">{fmtBRL(contrato.valor_atualizado)}</div>
          {delta !== 0 && (
            <div className={`text-xs mt-0.5 ${delta > 0 ? "text-emerald-600" : "text-amber-600"}`}>
              {delta > 0 ? "+" : ""}
              {fmtBRL(delta)} ({deltaPct.toFixed(1)}%)
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Início vigência</div>
          <div className="text-lg font-bold mt-1">{fmtDate(contrato.data_inicio_vigencia)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Fim vigência</div>
          <div className="text-lg font-bold mt-1">{fmtDate(contrato.data_fim_vigencia)}</div>
        </Card>
      </div>

      {contrato.objeto && (
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Objeto</div>
          <p className="text-sm whitespace-pre-wrap">{contrato.objeto}</p>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarClock className="w-4 h-4" /> Eventos do contrato
            </h2>
            <p className="text-xs text-muted-foreground">
              Aditivos, prorrogações, suspensões, ordens de serviço e demais ocorrências.
              Impactos de valor/prazo recalculam o contrato automaticamente.
            </p>
          </div>
          <NovoEventoDialog contratoId={id} />
        </div>

        <Card className="overflow-hidden">
          {!eventos || eventos.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Nenhum evento registrado.
            </div>
          ) : (
            <ul className="divide-y">
              {eventos.map((e: EventoRow) => (
                <EventoItem key={e.id} evento={e} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <AssinaturasContrato contratoId={id} />
    </div>
  );
}

const SIG_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  preparing: "Preparando",
  pending: "Aguardando",
  signed: "Assinada",
  canceled: "Cancelada",
  expired: "Expirada",
  error: "Erro",
};

const SIG_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  preparing: "secondary",
  pending: "secondary",
  signed: "default",
  canceled: "destructive",
  expired: "destructive",
  error: "destructive",
};

function AssinaturasContrato({ contratoId }: { contratoId: string }) {
  const listSig = useServerFn(listSignaturesByContrato);
  const { data: sigs } = useQuery({
    queryKey: ["contrato-signatures", contratoId],
    queryFn: () => listSig({ data: { contrato_id: contratoId } }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PenTool className="w-4 h-4" /> Assinaturas eletrônicas
          </h2>
          <p className="text-xs text-muted-foreground">
            Solicitações de assinatura vinculadas a este contrato. Envie novos
            documentos a partir do módulo Assinaturas ou vincule um já existente.
          </p>
        </div>
        <div className="flex gap-2">
          <VincularAssinaturaDialog contratoId={contratoId} />
          <Button asChild size="sm" variant="outline">
            <Link to="/assinaturas">
              <Plus className="w-4 h-4 mr-1" /> Nova solicitação
            </Link>
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {!sigs || sigs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nenhuma assinatura vinculada a este contrato.
          </div>
        ) : (
          <ul className="divide-y">
            {sigs.map((s: ContratoSignatureRow) => (
              <AssinaturaItem key={s.id} sig={s} contratoId={contratoId} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AssinaturaItem({
  sig,
  contratoId,
}: {
  sig: ContratoSignatureRow;
  contratoId: string;
}) {
  const unlink = useServerFn(linkSignatureToContrato);
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: () =>
      unlink({ data: { signature_request_id: sig.id, contrato_id: null } }),
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["contrato-signatures", contratoId] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  const progresso =
    sig.signers_total > 0
      ? `${sig.signers_signed}/${sig.signers_total} assinantes`
      : "—";
  return (
    <li className="p-4 flex items-start gap-3 hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{sig.document_name}</span>
          <Badge variant={SIG_STATUS_VARIANT[sig.status] ?? "outline"}>
            {SIG_STATUS_LABEL[sig.status] ?? sig.status}
          </Badge>
          {sig.sandbox && (
            <Badge variant="outline" className="text-[10px]">Sandbox</Badge>
          )}
          {sig.signed_at && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {fmtDate(sig.signed_at.slice(0, 10))}
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
          <span>{progresso}</span>
          <span>· {sig.document_folder}</span>
          <span>· criada em {fmtDate(sig.created_at.slice(0, 10))}</span>
        </div>
      </div>
      <Button asChild variant="ghost" size="icon" title="Abrir no módulo de assinaturas">
        <Link to="/assinaturas">
          <ExternalLink className="w-4 h-4" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="Remover vínculo com o contrato"
        onClick={() => {
          if (confirm("Remover o vínculo desta assinatura com o contrato?")) mut.mutate();
        }}
      >
        <Link2Off className="w-4 h-4" />
      </Button>
    </li>
  );
}

function VincularAssinaturaDialog({ contratoId }: { contratoId: string }) {
  const listAvail = useServerFn(listSignaturesDisponiveis);
  const link = useServerFn(linkSignatureToContrato);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: avail } = useQuery({
    queryKey: ["signatures-disponiveis"],
    queryFn: () => listAvail(),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () =>
      link({
        data: { signature_request_id: selectedId, contrato_id: contratoId },
      }),
    onSuccess: () => {
      toast.success("Assinatura vinculada");
      qc.invalidateQueries({ queryKey: ["contrato-signatures", contratoId] });
      qc.invalidateQueries({ queryKey: ["signatures-disponiveis"] });
      setOpen(false);
      setSelectedId("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Link2 className="w-4 h-4 mr-1" /> Vincular existente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular assinatura ao contrato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecione uma solicitação de assinatura sem contrato vinculado.
          </p>
          {!avail || avail.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground border rounded-md">
              Nenhuma assinatura disponível para vínculo.
            </div>
          ) : (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma solicitação…" />
              </SelectTrigger>
              <SelectContent>
                {avail.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.document_name} — {SIG_STATUS_LABEL[s.status] ?? s.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!selectedId || mut.isPending}>
            {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EventoItem({ evento }: { evento: EventoRow }) {
  const remove = useServerFn(deleteEvento);
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: () => remove({ data: { id: evento.id } }),
    onSuccess: () => {
      toast.success("Evento removido");
      qc.invalidateQueries({ queryKey: ["contrato-eventos", evento.contrato_id] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <li className="p-4 flex items-start gap-3 hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{TIPO_LABEL[evento.tipo]}</Badge>
          <span className="text-xs text-muted-foreground">{fmtDate(evento.data_evento)}</span>
          {evento.data_fim && (
            <span className="text-xs text-muted-foreground">→ {fmtDate(evento.data_fim)}</span>
          )}
          {evento.responsabilidade && (
            <Badge variant="secondary" className="text-[10px]">
              {evento.responsabilidade}
            </Badge>
          )}
        </div>
        <p className="text-sm mt-1.5 whitespace-pre-wrap">{evento.descricao}</p>
        <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
          {evento.impacto_prazo_dias != null && evento.impacto_prazo_dias !== 0 && (
            <span>
              Prazo: {evento.impacto_prazo_dias > 0 ? "+" : ""}
              {evento.impacto_prazo_dias} dias
            </span>
          )}
          {evento.impacto_valor != null && evento.impacto_valor !== 0 && (
            <span>
              Valor: {evento.impacto_valor > 0 ? "+" : ""}
              {fmtBRL(evento.impacto_valor)}
            </span>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          if (confirm("Remover este evento?")) del.mutate();
        }}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </li>
  );
}

const TIPOS: EventoTipo[] = [
  "aditivo_prazo",
  "aditivo_valor",
  "aditivo_qualitativo",
  "prorrogacao",
  "suspensao",
  "paralisacao",
  "atraso",
  "reprogramacao",
  "supressao",
  "acrescimo",
  "ordem_servico",
  "apostilamento",
  "notificacao",
  "resposta_orgao",
  "outro",
];

function NovoEventoDialog({ contratoId }: { contratoId: string }) {
  const create = useServerFn(createEvento);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<EventoTipo>("aditivo_prazo");
  const [dataEvento, setDataEvento] = useState(() => new Date().toISOString().slice(0, 10));
  const [dataFim, setDataFim] = useState("");
  const [descricao, setDescricao] = useState("");
  const [resp, setResp] = useState<string>("indefinida");
  const [prazo, setPrazo] = useState("");
  const [valor, setValor] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          contrato_id: contratoId,
          tipo,
          data_evento: dataEvento,
          data_fim: dataFim || null,
          descricao: descricao.trim(),
          responsabilidade: resp as "orgao",
          impacto_prazo_dias: prazo ? Number(prazo) : null,
          impacto_valor: valor
            ? Number(valor.replace(/\./g, "").replace(",", "."))
            : null,
        },
      }),
    onSuccess: () => {
      toast.success("Evento registrado");
      qc.invalidateQueries({ queryKey: ["contrato-eventos", contratoId] });
      qc.invalidateQueries({ queryKey: ["contratos"] });
      setOpen(false);
      setDescricao("");
      setPrazo("");
      setValor("");
      setDataFim("");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" /> Novo evento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar evento do contrato</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo *</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as EventoTipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Responsabilidade</Label>
            <Select value={resp} onValueChange={setResp}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="indefinida">Indefinida</SelectItem>
                <SelectItem value="orgao">Órgão</SelectItem>
                <SelectItem value="contratada">Contratada</SelectItem>
                <SelectItem value="compartilhada">Compartilhada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Data do evento *</Label>
            <Input type="date" value={dataEvento} onChange={(e) => setDataEvento(e.target.value)} />
          </div>
          <div>
            <Label>Data fim (se aplicável)</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <Label>Impacto prazo (dias)</Label>
            <Input
              type="number"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              placeholder="ex.: 60"
            />
          </div>
          <div>
            <Label>Impacto valor (R$)</Label>
            <Input
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="negativo p/ supressão"
            />
          </div>
          <div className="col-span-2">
            <Label>Descrição *</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Resumo do aditivo/evento, número do termo, justificativa…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={!descricao.trim() || mut.isPending}
          >
            {mut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
