import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  listSignatureRequests,
  getSignatureRequest,
  cancelSignatureRequest,
  getSignedDocumentUrl,
  type SignatureRequestListItem,
} from "@/lib/zapsign-dashboard.functions";
import { resendSignerLink } from "@/lib/zapsign-reminders.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  PenTool,
  Search,
  Loader2,
  Eye,
  Download,
  XCircle,
  Copy,
  CheckCircle2,
  Clock,
  AlertCircle,
  Ban,
  FileSignature,
  Send,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/_app/assinaturas")({
  head: () => ({
    meta: [
      { title: "Assinaturas — Solv" },
      {
        name: "description",
        content: "Documentos enviados para assinatura eletrônica via ZapSign.",
      },
    ],
  }),
  component: AssinaturasPage,
});

const STATUS_LABELS: Record<string, { label: string; tone: string; Icon: typeof Clock }> = {
  draft: { label: "Rascunho", tone: "bg-muted text-muted-foreground", Icon: Clock },
  preparing: { label: "Preparando", tone: "bg-muted text-muted-foreground", Icon: Loader2 },
  awaiting_placement: { label: "Aguardando posicionamento", tone: "bg-warning/20 text-warning-foreground", Icon: Clock },
  placement_done: { label: "Posicionamento concluído", tone: "bg-warning/20 text-warning-foreground", Icon: Clock },
  awaiting_signature: { label: "Aguardando assinatura", tone: "bg-primary/15 text-primary", Icon: Clock },
  partially_signed: { label: "Parcialmente assinado", tone: "bg-measure/15 text-measure", Icon: Clock },
  signed: { label: "Assinado", tone: "bg-success/15 text-success", Icon: CheckCircle2 },
  refused: { label: "Recusado", tone: "bg-destructive/15 text-destructive", Icon: Ban },
  expired: { label: "Expirado", tone: "bg-destructive/15 text-destructive", Icon: AlertCircle },
  canceled: { label: "Cancelado", tone: "bg-muted text-muted-foreground", Icon: XCircle },
  error: { label: "Erro", tone: "bg-destructive/15 text-destructive", Icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_LABELS[status] ?? { label: status, tone: "bg-muted text-muted-foreground", Icon: Clock };
  const Icon = cfg.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.tone}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function AssinaturasPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [obraFilter, setObraFilter] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["signature-requests", status, search, obraFilter],
    queryFn: () =>
      listSignatureRequests({
        data: {
          status: status === "all" ? undefined : status,
          search: search || undefined,
          obraId: obraFilter || undefined,
        },
      }),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Realtime: refletir webhook do ZapSign assim que o status muda.
  useEffect(() => {
    const channel = supabase
      .channel("signature-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "signature_requests" },
        () => {
          qc.invalidateQueries({ queryKey: ["signature-requests"] });
          qc.invalidateQueries({ queryKey: ["signature-request"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "signature_signers" },
        () => {
          qc.invalidateQueries({ queryKey: ["signature-request"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const counters = useMemo(() => {
    const c = { total: rows.length, signed: 0, pending: 0, refused: 0 };
    for (const r of rows) {
      if (r.status === "signed") c.signed++;
      else if (["refused", "expired", "error", "canceled"].includes(r.status)) c.refused++;
      else c.pending++;
    }
    return c;
  }, [rows]);

  const obras = useMemo(
    () => Array.from(new Set(rows.map((r) => r.obra_id))).filter(Boolean),
    [rows],
  );

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-primary" />
            Assinaturas eletrônicas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhe todos os documentos enviados para assinatura via ZapSign.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/assinaturas/relatorio">
            <BarChart3 className="h-4 w-4 mr-1" />
            Relatório
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-2xl font-semibold mt-1">{counters.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Em andamento</div>
          <div className="text-2xl font-semibold mt-1 text-primary">
            {counters.pending}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Assinados</div>
          <div className="text-2xl font-semibold mt-1 text-success">
            {counters.signed}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Recusados / falhas</div>
          <div className="text-2xl font-semibold mt-1 text-destructive">
            {counters.refused}
          </div>
        </Card>
      </div>

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do documento…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="awaiting_signature">Aguardando assinatura</SelectItem>
            <SelectItem value="partially_signed">Parcialmente assinado</SelectItem>
            <SelectItem value="signed">Assinado</SelectItem>
            <SelectItem value="refused">Recusado</SelectItem>
            <SelectItem value="expired">Expirado</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
          </SelectContent>
        </Select>
        {obras.length > 0 ? (
          <Select value={obraFilter || "all"} onValueChange={(v) => setObraFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Obra" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as obras</SelectItem>
              {obras.map((o) => (
                <SelectItem key={o} value={o}>
                  {o.slice(0, 8)}…
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Nenhum documento de assinatura encontrado.
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <RequestRow
                key={r.id}
                row={r}
                onView={() => setActiveId(r.id)}
              />
            ))}
          </div>
        )}
      </Card>

      {activeId ? (
        <RequestDetailDialog
          id={activeId}
          onClose={() => setActiveId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["signature-requests"] })}
        />
      ) : null}
    </div>
  );
}

function RequestRow({
  row,
  onView,
}: {
  row: SignatureRequestListItem;
  onView: () => void;
}) {
  return (
    <div className="p-4 flex items-center gap-3 hover:bg-accent/40 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{row.document_name}</span>
          <StatusBadge status={row.status} />
          {row.sandbox ? (
            <Badge variant="outline" className="text-[10px] uppercase">
              Sandbox
            </Badge>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>{row.document_folder}</span>
          <span>·</span>
          <span>
            {row.signers_signed}/{row.signers_total} assinaram
          </span>
          <span>·</span>
          <span>
            Enviado em {new Date(row.created_at).toLocaleString("pt-BR")}
          </span>
          {row.signed_at ? (
            <>
              <span>·</span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Concluído {new Date(row.signed_at).toLocaleDateString("pt-BR")}
              </span>
            </>
          ) : null}
        </div>
        {row.error_message ? (
          <div className="text-xs text-destructive mt-1 truncate">
            {row.error_message}
          </div>
        ) : null}
      </div>
      <Button variant="outline" size="sm" onClick={onView}>
        <Eye className="h-4 w-4 mr-1" />
        Detalhes
      </Button>
    </div>
  );
}

function RequestDetailDialog({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["signature-request", id],
    queryFn: () => getSignatureRequest({ data: { id } }),
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);


  const cancelMut = useMutation({
    mutationFn: () => cancelSignatureRequest({ data: { id } }),
    onSuccess: () => {
      toast.success("Pedido cancelado");
      onChanged();
      onClose();
    },
    onError: (e) =>
      toast.error("Falha ao cancelar", { description: (e as Error).message }),
  });

  const downloadMut = useMutation({
    mutationFn: () => getSignedDocumentUrl({ data: { id } }),
    onSuccess: ({ url }) => {
      if (!url) {
        toast.error("PDF assinado ainda não disponível");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    },
  });

  const previewMut = useMutation({
    mutationFn: () => getSignedDocumentUrl({ data: { id } }),
    onSuccess: ({ url }) => {
      if (!url) {
        toast.error("PDF assinado ainda não disponível");
        return;
      }
      setPreviewUrl(url);
    },
  });


  const resendMut = useMutation({
    mutationFn: (vars: { signerId: string; channel: "whatsapp" | "email" }) =>
      resendSignerLink({ data: vars }),
    onSuccess: (r) => {
      toast.success(`Lembrete enviado via ${r.channel}`);
      onChanged();
    },
    onError: (e) =>
      toast.error("Falha ao reenviar", { description: (e as Error).message }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            Detalhes do pedido
          </DialogTitle>
          <DialogDescription className="truncate">
            {data?.document_name ?? "Carregando…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data ? (
          <div className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              <StatusBadge status={data.status} />
              {data.sandbox ? <Badge variant="outline">Sandbox</Badge> : null}
              <span className="text-xs text-muted-foreground">
                Autenticação: {data.authentication_mode}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Pasta</div>
                <div>{data.document_folder}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Obra</div>
                <div className="font-mono text-xs">{data.obra_id}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Criado em</div>
                <div>{new Date(data.created_at).toLocaleString("pt-BR")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Atualizado</div>
                <div>{new Date(data.updated_at).toLocaleString("pt-BR")}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">
                Signatários ({data.signers_signed}/{data.signers_total})
              </h3>
              <Card className="divide-y">
                {data.signers.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    Nenhum signatário registrado.
                  </div>
                ) : (
                  data.signers.map((s) => (
                    <div key={s.id} className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {s.name}{" "}
                          {s.role ? (
                            <span className="text-xs text-muted-foreground">
                              · {s.role}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {s.email || s.phone_number || "—"}
                        </div>
                        {s.refusal_reason ? (
                          <div className="text-xs text-destructive">
                            Recusa: {s.refusal_reason}
                          </div>
                        ) : null}
                      </div>
                      <StatusBadge status={s.status} />
                      {s.status !== "signed" && s.status !== "refused" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Reenviar lembrete"
                          disabled={resendMut.isPending}
                          onClick={() =>
                            resendMut.mutate({
                              signerId: s.id,
                              channel: s.phone_number ? "whatsapp" : "email",
                            })
                          }
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {s.zapsign_sign_url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Copiar link"
                          onClick={() => {
                            navigator.clipboard.writeText(s.zapsign_sign_url!);
                            toast("Link copiado");
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))
                )}
              </Card>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Linha do tempo</h3>
              <Card className="p-4 max-h-72 overflow-y-auto">
                <SignatureTimeline
                  events={data.events}
                  signers={data.signers}
                  createdAt={data.created_at}
                  status={data.status}
                />
              </Card>
            </div>


            <div className="flex items-center justify-end gap-2 pt-2">
              {data.signed_file_path ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => previewMut.mutate()}
                    disabled={previewMut.isPending}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Visualizar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => downloadMut.mutate()}
                    disabled={downloadMut.isPending}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Baixar PDF assinado
                  </Button>
                </>
              ) : null}
              {!["signed", "canceled", "refused", "expired"].includes(
                data.status,
              ) ? (
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (confirm("Cancelar este pedido de assinatura?")) {
                      cancelMut.mutate();
                    }
                  }}
                  disabled={cancelMut.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Cancelar pedido
                </Button>
              ) : null}
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        )}
        {previewUrl ? (
          <Dialog open onOpenChange={(o) => !o && setPreviewUrl(null)}>
            <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col">
              <DialogHeader className="p-4 pb-2">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4" /> {data?.document_name}
                </DialogTitle>
              </DialogHeader>
              <iframe
                src={previewUrl}
                title="PDF assinado"
                className="flex-1 w-full border-0"
              />
            </DialogContent>
          </Dialog>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Timeline ----------

type TimelineKind =
  | "created"
  | "sent"
  | "viewed"
  | "signed"
  | "refused"
  | "expired"
  | "canceled"
  | "reminder"
  | "completed"
  | "error"
  | "other";

interface TimelineItem {
  id: string;
  kind: TimelineKind;
  title: string;
  description?: string | null;
  at: string;
}

const KIND_META: Record<
  TimelineKind,
  { label: string; icon: typeof CheckCircle2; color: string; ring: string }
> = {
  created: { label: "Pedido criado", icon: FileSignature, color: "text-blue-600", ring: "bg-blue-100 dark:bg-blue-950" },
  sent: { label: "Enviado ao signatário", icon: Send, color: "text-sky-600", ring: "bg-sky-100 dark:bg-sky-950" },
  viewed: { label: "Documento visualizado", icon: Eye, color: "text-indigo-600", ring: "bg-indigo-100 dark:bg-indigo-950" },
  signed: { label: "Assinado", icon: CheckCircle2, color: "text-emerald-600", ring: "bg-emerald-100 dark:bg-emerald-950" },
  refused: { label: "Recusado", icon: Ban, color: "text-destructive", ring: "bg-red-100 dark:bg-red-950" },
  expired: { label: "Expirado", icon: Clock, color: "text-amber-600", ring: "bg-amber-100 dark:bg-amber-950" },
  canceled: { label: "Cancelado", icon: XCircle, color: "text-muted-foreground", ring: "bg-muted" },
  reminder: { label: "Lembrete enviado", icon: Send, color: "text-purple-600", ring: "bg-purple-100 dark:bg-purple-950" },
  completed: { label: "Documento concluído", icon: CheckCircle2, color: "text-emerald-700", ring: "bg-emerald-100 dark:bg-emerald-950" },
  error: { label: "Erro", icon: AlertCircle, color: "text-destructive", ring: "bg-red-100 dark:bg-red-950" },
  other: { label: "Evento", icon: Clock, color: "text-muted-foreground", ring: "bg-muted" },
};

function classifyEvent(type: string): TimelineKind {
  const t = type.toLowerCase();
  if (t.includes("created") || t === "request_created") return "created";
  if (t.includes("sent") || t.includes("delivered")) return "sent";
  if (t.includes("view") || t.includes("opened")) return "viewed";
  if (t.includes("refus") || t.includes("reject")) return "refused";
  if (t.includes("expir")) return "expired";
  if (t.includes("cancel")) return "canceled";
  if (t.includes("reminder") || t.includes("resent")) return "reminder";
  if (t.includes("complet") || t === "doc_signed") return "completed";
  if (t.includes("sign")) return "signed";
  if (t.includes("fail") || t.includes("error")) return "error";
  return "other";
}

function humanizeType(t: string) {
  return t.replace(/_/g, " ");
}

function sameMinute(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60_000;
}

function SignatureTimeline({
  events,
  signers,
  createdAt,
  status,
}: {
  events: Array<{ id: string; event_type: string; event_description: string | null; created_at: string }>;
  signers: Array<{ id: string; name: string; status: string; signed_at: string | null; refused_at: string | null; refusal_reason: string | null }>;
  createdAt: string;
  status: string;
}) {
  const items: TimelineItem[] = [];

  const hasCreated = events.some((e) => classifyEvent(e.event_type) === "created");
  if (!hasCreated) {
    items.push({
      id: "synthetic-created",
      kind: "created",
      title: KIND_META.created.label,
      at: createdAt,
    });
  }

  for (const ev of events) {
    const kind = classifyEvent(ev.event_type);
    items.push({
      id: ev.id,
      kind,
      title: KIND_META[kind].label,
      description: ev.event_description ?? humanizeType(ev.event_type),
      at: ev.created_at,
    });
  }

  for (const s of signers) {
    if (
      s.signed_at &&
      !events.some(
        (e) => classifyEvent(e.event_type) === "signed" && sameMinute(e.created_at, s.signed_at!),
      )
    ) {
      items.push({
        id: `signer-${s.id}-signed`,
        kind: "signed",
        title: `Assinado por ${s.name}`,
        at: s.signed_at,
      });
    }
    if (
      s.refused_at &&
      !events.some(
        (e) => classifyEvent(e.event_type) === "refused" && sameMinute(e.created_at, s.refused_at!),
      )
    ) {
      items.push({
        id: `signer-${s.id}-refused`,
        kind: "refused",
        title: `Recusado por ${s.name}`,
        description: s.refusal_reason,
        at: s.refused_at,
      });
    }
  }

  if (status === "expired" && !items.some((i) => i.kind === "expired")) {
    items.push({
      id: "synthetic-expired",
      kind: "expired",
      title: KIND_META.expired.label,
      at: new Date().toISOString(),
    });
  }
  if (status === "canceled" && !items.some((i) => i.kind === "canceled")) {
    items.push({
      id: "synthetic-canceled",
      kind: "canceled",
      title: KIND_META.canceled.label,
      at: new Date().toISOString(),
    });
  }
  if (status === "signed" && !items.some((i) => i.kind === "completed")) {
    items.push({
      id: "synthetic-completed",
      kind: "completed",
      title: KIND_META.completed.label,
      at: new Date().toISOString(),
    });
  }

  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">Sem eventos registrados ainda.</div>;
  }

  return (
    <ol className="relative space-y-4 pl-2">
      <div className="absolute left-[14px] top-1 bottom-1 w-px bg-border" aria-hidden />
      {items.map((it) => {
        const meta = KIND_META[it.kind];
        const Icon = meta.icon;
        return (
          <li key={it.id} className="relative pl-8">
            <span
              className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-background ${meta.ring}`}
            >
              <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium">{it.title}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(it.at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {it.description ? (
              <div className="text-xs text-muted-foreground mt-0.5">{it.description}</div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

