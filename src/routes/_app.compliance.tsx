import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCertificates,
  listVersions,
  listAlerts,
  listChecks,
  listAuditLogs,
  getComplianceHealth,
  runComplianceHealthCheck,
  updateCertificate,
  updateAllCertificates,
  uploadManualCertificate,
  getSignedCertificateUrl,
  resolveAlert,
  requestProductionActivation,
  clearSandboxData,
  getCertificateDetails,
  listNotificationRules,
  listCertificateTypesForRules,
  upsertNotificationRule,
  deleteNotificationRule,
} from "@/lib/compliance.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ShieldCheck,
  RefreshCw,
  Upload,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Loader2,
  History,
  Bell,
  Settings,
  Activity,
  ScrollText,
  Eye,
  Plus,
  Pencil,
  Trash2,
  BellRing,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/compliance")({
  head: () => ({
    meta: [
      { title: "Governança e Compliance — Central de Certidões" },
      { name: "description", content: "Central de certidões e compliance regulatório." },
    ],
  }),
  component: ComplianceModule,
});

type CertRow = {
  id: string;
  status: string | null;
  status_message: string | null;
  expiration_date: string | null;
  issue_date: string | null;
  certificate_number: string | null;
  last_checked_at: string | null;
  current_version_id: string | null;
  certificate_types: {
    code: string;
    name: string;
    short_name: string | null;
    automatic_enabled: boolean;
    issuing_authority: string | null;
  };
};

const STATUS_META: Record<string, { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  valid: { label: "Válida", tone: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  expiring_soon: { label: "Vence em breve", tone: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Clock },
  expired: { label: "Vencida", tone: "bg-red-500/15 text-red-400 border-red-500/30", icon: XCircle },
  pending: { label: "Pendente", tone: "bg-muted/40 text-muted-foreground border-border", icon: Clock },
  error: { label: "Erro", tone: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertTriangle },
  sandbox: { label: "Sandbox", tone: "bg-primary/15 text-primary-glow border-primary/30", icon: ShieldCheck },
};

function StatusBadge({ status }: { status: string | null }) {
  const meta = STATUS_META[status ?? "pending"] ?? STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs font-medium ${meta.tone}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR"); } catch { return s; }
}
function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR"); } catch { return s; }
}

function ComplianceModule() {
  const qc = useQueryClient();
  const listCerts = useServerFn(listCertificates);
  const listVers = useServerFn(listVersions);
  const listAls = useServerFn(listAlerts);
  const listChks = useServerFn(listChecks);
  const listLogs = useServerFn(listAuditLogs);
  const getHealth = useServerFn(getComplianceHealth);
  const runHealth = useServerFn(runComplianceHealthCheck);
  const updateOne = useServerFn(updateCertificate);
  const updateAll = useServerFn(updateAllCertificates);
  const uploadFn = useServerFn(uploadManualCertificate);
  const getSigned = useServerFn(getSignedCertificateUrl);
  const resolveAl = useServerFn(resolveAlert);
  const reqProd = useServerFn(requestProductionActivation);
  const clearSb = useServerFn(clearSandboxData);
  const getDetails = useServerFn(getCertificateDetails);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const certsQ = useQuery({ queryKey: ["compliance", "certs"], queryFn: () => listCerts() });
  const healthQ = useQuery({ queryKey: ["compliance", "health"], queryFn: () => getHealth() });
  const alertsQ = useQuery({ queryKey: ["compliance", "alerts"], queryFn: () => listAls() });
  const versionsQ = useQuery({ queryKey: ["compliance", "versions"], queryFn: () => listVers() });
  const checksQ = useQuery({ queryKey: ["compliance", "checks"], queryFn: () => listChks() });
  const logsQ = useQuery({ queryKey: ["compliance", "logs"], queryFn: () => listLogs() });

  const certs = (certsQ.data ?? []) as unknown as CertRow[];

  const stats = useMemo(() => {
    const s = { total: certs.length, valid: 0, expiring: 0, expired: 0, pending: 0 };
    certs.forEach((c) => {
      if (c.status === "valid") s.valid++;
      else if (c.status === "expiring_soon") s.expiring++;
      else if (c.status === "expired") s.expired++;
      else s.pending++;
    });
    return s;
  }, [certs]);

  const invalidateAll = () =>
    qc.invalidateQueries({ queryKey: ["compliance"] });

  const updateOneMut = useMutation({
    mutationFn: (id: string) => updateOne({ data: { company_certificate_id: id, trigger_type: "manual" } }),
    onSuccess: (r) => { toast.success(r.message ?? "Certidão atualizada"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAllMut = useMutation({
    mutationFn: () => updateAll({}),
    onSuccess: (r) => { toast.success(`Lote: ${r.updated} atualizadas, ${r.unchanged} ok, ${r.failed} falhas, ${r.manualNeeded} manuais.`); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const runHealthMut = useMutation({
    mutationFn: () => runHealth({}),
    onSuccess: () => { toast.success("Verificação concluída"); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Governança e Compliance</div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 mt-1">
            <ShieldCheck className="w-6 h-6 text-primary-glow" />
            Central de Certidões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoramento e renovação de certidões regulatórias da empresa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {healthQ.data?.sandbox_mode && (
            <Badge variant="outline" className="border-primary/40 text-primary-glow bg-primary/10">
              <ShieldCheck className="w-3 h-3 mr-1" />
              Modo Sandbox
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={() => updateAllMut.mutate()}
            disabled={updateAllMut.isPending}
          >
            {updateAllMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar todas
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card/40 border border-border">
          <TabsTrigger value="overview"><Activity className="w-4 h-4 mr-1.5" />Visão Geral</TabsTrigger>
          <TabsTrigger value="certs"><FileText className="w-4 h-4 mr-1.5" />Certidões</TabsTrigger>
          <TabsTrigger value="history"><History className="w-4 h-4 mr-1.5" />Histórico</TabsTrigger>
          <TabsTrigger value="alerts"><Bell className="w-4 h-4 mr-1.5" />Alertas</TabsTrigger>
          <TabsTrigger value="rules"><BellRing className="w-4 h-4 mr-1.5" />Regras</TabsTrigger>
          <TabsTrigger value="logs"><ScrollText className="w-4 h-4 mr-1.5" />Logs</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="w-4 h-4 mr-1.5" />Configurações</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total" value={stats.total} tone="text-foreground" />
            <StatCard label="Válidas" value={stats.valid} tone="text-emerald-400" />
            <StatCard label="Vencendo" value={stats.expiring} tone="text-amber-400" />
            <StatCard label="Vencidas" value={stats.expired} tone="text-red-400" />
            <StatCard label="Pendentes" value={stats.pending} tone="text-muted-foreground" />
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Próximos vencimentos</h3>
            <div className="space-y-2">
              {certs
                .filter((c) => c.expiration_date)
                .sort((a, b) => (a.expiration_date ?? "").localeCompare(b.expiration_date ?? ""))
                .slice(0, 8)
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <div>
                      <div className="text-sm font-medium">{c.certificate_types.short_name ?? c.certificate_types.name}</div>
                      <div className="text-xs text-muted-foreground">{c.certificate_types.issuing_authority}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{fmtDate(c.expiration_date)}</span>
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                ))}
              {certs.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma certidão cadastrada.</div>}
            </div>
          </Card>
        </TabsContent>

        {/* CERTS */}
        <TabsContent value="certs">
          <CertList
            certs={certs}
            loading={certsQ.isLoading}
            onUpdate={(id) => updateOneMut.mutate(id)}
            updating={updateOneMut.isPending ? updateOneMut.variables : null}
            uploadFn={uploadFn}
            getSigned={getSigned}
            onChanged={invalidateAll}
            onOpenDetails={(id) => setDetailsId(id)}
          />
        </TabsContent>

        {/* HISTORY */}
        <TabsContent value="history">
          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Versões emitidas</h3>
            <div className="divide-y divide-border/40">
              {(versionsQ.data ?? []).map((v: any) => (
                <div key={v.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">
                      {v.company_certificates?.certificate_types?.short_name ?? v.company_certificates?.certificate_types?.name} — v{v.version_number}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Emissão: {fmtDate(v.issue_date)} · Validade: {fmtDate(v.expiration_date)} · Fonte: {v.source_type}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={v.status} />
                    {v.storage_path && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          const r = await getSigned({ data: { version_id: v.id } });
                          window.open(r.url, "_blank");
                        } catch (e) { toast.error((e as Error).message); }
                      }}>
                        <Download className="w-3.5 h-3.5 mr-1" />PDF
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {(versionsQ.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma versão registrada ainda.</div>
              )}
            </div>
          </Card>

          <Card className="p-4 mt-4">
            <h3 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Verificações executadas</h3>
            <div className="divide-y divide-border/40">
              {(checksQ.data ?? []).slice(0, 50).map((c: any) => (
                <div key={c.id} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.certificate_types?.short_name ?? c.certificate_types?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{fmtDateTime(c.started_at)} · {c.execution_mode} · {c.trigger_type}</div>
                  </div>
                  <Badge variant={c.status === "success" ? "default" : "destructive"}>{c.status}</Badge>
                </div>
              ))}
              {(checksQ.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">Nenhuma verificação ainda.</div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ALERTS */}
        <TabsContent value="alerts">
          <Card className="p-4">
            <div className="divide-y divide-border/40">
              {(alertsQ.data ?? []).map((a: any) => (
                <div key={a.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertTriangle className={`w-4 h-4 mt-0.5 ${a.severity === "critical" ? "text-red-400" : a.severity === "high" ? "text-amber-400" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{a.title}</div>
                      <div className="text-xs text-muted-foreground">{a.message}</div>
                      <div className="text-[10px] text-muted-foreground/70 mt-1">{fmtDateTime(a.created_at)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.resolved ? (
                      <Badge variant="outline">Resolvido</Badge>
                    ) : (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try { await resolveAl({ data: { alert_id: a.id } }); invalidateAll(); toast.success("Alerta resolvido"); }
                        catch (e) { toast.error((e as Error).message); }
                      }}>Resolver</Button>
                    )}
                  </div>
                </div>
              ))}
              {(alertsQ.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">Nenhum alerta ativo. Tudo certo!</div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* RULES */}
        <TabsContent value="rules">
          <NotificationRulesPanel />
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs">
          <Card className="p-4">
            <div className="divide-y divide-border/40">
              {(logsQ.data ?? []).map((l: any) => (
                <div key={l.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{l.action}</span>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(l.created_at)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{l.description}</div>
                </div>
              ))}
              {(logsQ.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground py-6 text-center">Nenhum evento registrado.</div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* SETTINGS */}
        <TabsContent value="settings">
          <Card className="p-5 space-y-4">
            <div>
              <h3 className="font-semibold">Integração InfoSimples</h3>
              <p className="text-xs text-muted-foreground">Estado atual da conexão com o provedor de certidões.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoCell label="Modo" value={healthQ.data?.sandbox_mode ? "Sandbox (simulado)" : "Produção"} />
              <InfoCell label="Produção habilitada" value={healthQ.data?.production_enabled ? "Sim" : "Não"} />
              <InfoCell label="Token configurado" value={healthQ.data?.token_configured ? "Sim" : "Não"} />
              <InfoCell label="Último health-check" value={fmtDateTime(healthQ.data?.last_health_check_at)} />
              <InfoCell label="Último status" value={healthQ.data?.last_health_check_status ?? "—"} />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={() => runHealthMut.mutate()} disabled={runHealthMut.isPending}>
                {runHealthMut.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
                Executar health-check
              </Button>
              {healthQ.data?.sandbox_mode && (
                <Button variant="outline" onClick={async () => {
                  if (!confirm("Remover todos os dados simulados de sandbox?")) return;
                  try { const r = await clearSb({ data: { confirm: true } }); toast.success(`Limpas ${r.deleted} certidões.`); invalidateAll(); }
                  catch (e) { toast.error((e as Error).message); }
                }}>Limpar dados sandbox</Button>
              )}
              <Button
                variant="default"
                disabled={!healthQ.data?.token_configured}
                onClick={async () => {
                  if (!confirm("Ativar produção? Isto desliga o modo sandbox.")) return;
                  try { await reqProd({ data: { confirm: true } }); toast.success("Produção ativada"); invalidateAll(); }
                  catch (e) { toast.error((e as Error).message); }
                }}
              >Ativar produção</Button>
            </div>

            {!healthQ.data?.token_configured && (
              <div className="text-xs text-muted-foreground bg-muted/20 border border-border rounded-md p-3">
                Para ativar produção, cadastre o secret <code className="font-mono">INFOSIMPLES_TOKEN</code> nas configurações de secrets do projeto.
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <CertDetailsDrawer
        certId={detailsId}
        onClose={() => setDetailsId(null)}
        getDetails={getDetails}
        getSigned={getSigned}
      />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-display font-bold mt-1 ${tone}`}>{value}</div>
    </Card>
  );
}

function InfoCell({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value ?? "—"}</div>
    </div>
  );
}

function CertList({
  certs, loading, onUpdate, updating, uploadFn, getSigned, onChanged, onOpenDetails,
}: {
  certs: CertRow[];
  loading: boolean;
  onUpdate: (id: string) => void;
  updating: string | null | undefined;
  uploadFn: ReturnType<typeof useServerFn<typeof uploadManualCertificate>>;
  getSigned: ReturnType<typeof useServerFn<typeof getSignedCertificateUrl>>;
  onChanged: () => void;
  onOpenDetails: (id: string) => void;
}) {
  const [uploadFor, setUploadFor] = useState<CertRow | null>(null);

  if (loading) return <Card className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></Card>;

  return (
    <>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/20 border-b border-border">
            <tr className="text-left text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <th className="px-4 py-2.5">Certidão</th>
              <th className="px-4 py-2.5">Emissor</th>
              <th className="px-4 py-2.5">Validade</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Última verificação</th>
              <th className="px-4 py-2.5 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {certs.map((c) => (
              <tr key={c.id} className="hover:bg-muted/10">
                <td className="px-4 py-3">
                  <div className="font-medium">{c.certificate_types.name}</div>
                  <div className="text-xs text-muted-foreground">{c.certificate_types.code}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.certificate_types.issuing_authority ?? "—"}</td>
                <td className="px-4 py-3">{fmtDate(c.expiration_date)}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDateTime(c.last_checked_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => onOpenDetails(c.id)} title="Ver detalhes">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    {c.certificate_types.automatic_enabled ? (
                      <Button size="sm" variant="outline" disabled={updating === c.id} onClick={() => onUpdate(c.id)}>
                        {updating === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => setUploadFor(c)}>
                      <Upload className="w-3.5 h-3.5" />
                    </Button>
                    {c.current_version_id && (
                      <Button size="sm" variant="outline" onClick={async () => {
                        try {
                          const r = await getSigned({ data: { version_id: c.current_version_id! } });
                          window.open(r.url, "_blank");
                        } catch (e) { toast.error((e as Error).message); }
                      }}><Download className="w-3.5 h-3.5" /></Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {certs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">Nenhuma certidão cadastrada.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <UploadDialog
        cert={uploadFor}
        onClose={() => setUploadFor(null)}
        uploadFn={uploadFn}
        onDone={() => { setUploadFor(null); onChanged(); }}
      />
    </>
  );
}

function UploadDialog({
  cert, onClose, uploadFn, onDone,
}: {
  cert: CertRow | null;
  onClose: () => void;
  uploadFn: ReturnType<typeof useServerFn<typeof uploadManualCertificate>>;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [issue, setIssue] = useState("");
  const [exp, setExp] = useState("");
  const [num, setNum] = useState("");
  const [busy, setBusy] = useState(false);

  if (!cert) return null;

  const submit = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { toast.error("Selecione um arquivo PDF."); return; }
    if (f.type !== "application/pdf") { toast.error("Apenas PDF."); return; }
    setBusy(true);
    try {
      const buf = await f.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const r = await uploadFn({
        data: {
          company_certificate_id: cert.id,
          file_name: f.name,
          file_base64: b64,
          mime_type: "application/pdf",
          issue_date: issue || null,
          expiration_date: exp || null,
          certificate_number: num || null,
        },
      });
      if (r.deduped) toast.info("PDF já existia — registrado como mesma versão.");
      else toast.success("Upload concluído.");
      onDone();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={!!cert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload manual — {cert.certificate_types.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Arquivo PDF</Label>
            <Input ref={fileRef} type="file" accept="application/pdf" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Emissão</Label><Input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} /></div>
            <div><Label>Validade</Label><Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} /></div>
          </div>
          <div><Label>Número da certidão</Label><Input value={num} onChange={(e) => setNum(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CertDetailsDrawer({
  certId, onClose, getDetails, getSigned,
}: {
  certId: string | null;
  onClose: () => void;
  getDetails: (opts: { data: { company_certificate_id: string } }) => Promise<any>;
  getSigned: (opts: { data: { version_id: string } }) => Promise<any>;
}) {
  const detailsQ = useQuery({
    queryKey: ["compliance", "details", certId],
    queryFn: () => getDetails({ data: { company_certificate_id: certId! } }),
    enabled: !!certId,
  });

  const data = detailsQ.data as
    | { cert: any; versions: any[]; checks: any[] }
    | undefined;
  const cert = data?.cert;
  const t = cert?.certificate_types;

  return (
    <Sheet open={!!certId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-glow" />
            {t?.name ?? "Detalhes da certidão"}
          </SheetTitle>
          <SheetDescription>
            {t?.issuing_authority ?? ""} {t?.code ? `· ${t.code}` : ""}
          </SheetDescription>
        </SheetHeader>

        {detailsQ.isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {detailsQ.error && (
          <div className="text-sm text-red-400 p-3">
            {(detailsQ.error as Error).message}
          </div>
        )}

        {cert && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 py-2">
              {/* Status */}
              <div className="flex items-center justify-between">
                <StatusBadge status={cert.status} />
                <span className="text-xs text-muted-foreground">
                  Última verificação: {fmtDateTime(cert.last_checked_at)}
                </span>
              </div>

              {/* Main data */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCell label="Emissão" value={fmtDate(cert.issue_date)} />
                <InfoCell label="Validade" value={fmtDate(cert.expiration_date)} />
                <InfoCell label="Nº da certidão" value={cert.certificate_number} />
                <InfoCell label="Cód. autenticação" value={cert.authentication_code} />
                <InfoCell label="Fonte" value={cert.source_type} />
                <InfoCell label="Próxima verificação" value={fmtDateTime(cert.next_check_at)} />
              </div>

              {cert.status_message && (
                <div className="text-xs text-muted-foreground bg-muted/20 border border-border rounded-md p-3">
                  {cert.status_message}
                </div>
              )}

              {cert.last_error_message && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-md p-3">
                  <strong>Último erro:</strong> {cert.last_error_message}
                </div>
              )}

              {/* Versions */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Histórico de versões ({data?.versions.length ?? 0})
                </h4>
                <div className="space-y-2">
                  {(data?.versions ?? []).map((v) => (
                    <div
                      key={v.id}
                      className="border border-border/60 rounded-md p-3 bg-card/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium">
                          v{v.version_number}
                          {v.id === cert.current_version_id && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              atual
                            </Badge>
                          )}
                        </div>
                        <StatusBadge status={v.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                        <span>Emissão: {fmtDate(v.issue_date)}</span>
                        <span>Validade: {fmtDate(v.expiration_date)}</span>
                        <span>Fonte: {v.source_type}</span>
                        <span>Criada: {fmtDateTime(v.created_at)}</span>
                      </div>
                      {v.storage_path && (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={async () => {
                              try {
                                const r = await getSigned({ data: { version_id: v.id } });
                                window.open(r.url, "_blank");
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Download className="w-3.5 h-3.5 mr-1" />
                            Baixar PDF
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  {(data?.versions ?? []).length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-3">
                      Nenhuma versão registrada.
                    </div>
                  )}
                </div>
              </div>

              {/* Checks */}
              <div>
                <h4 className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                  Verificações recentes
                </h4>
                <div className="space-y-1.5">
                  {(data?.checks ?? []).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {c.trigger_type} · {c.execution_mode}
                        </div>
                        <div className="text-muted-foreground">
                          {fmtDateTime(c.started_at)}
                          {c.duration_ms ? ` · ${c.duration_ms}ms` : ""}
                        </div>
                      </div>
                      <Badge variant={c.status === "success" ? "default" : "destructive"}>
                        {c.status}
                      </Badge>
                    </div>
                  ))}
                  {(data?.checks ?? []).length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-3">
                      Nenhuma verificação executada.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
