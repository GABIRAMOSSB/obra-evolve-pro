import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
 getSignatureReport,
 type SignatureReportRow,
} from "@/lib/zapsign-report.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import {
 BarChart3,
 Loader2,
 Download,
 ArrowLeft,
 FileText,
 CheckCircle2,
 Clock,
 XCircle,
 Percent,
 Timer,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assinaturas/relatorio")({
 head: () => ({
 meta: [
 { title: "Relatório de assinaturas — Solv" },
 {
 name: "description",
 content: "Relatório e exportação de pedidos de assinatura eletrônica.",
 },
 ],
 }),
 component: RelatorioPage,
});

const STATUS_OPTS: Array<{ value: string; label: string }> = [
 { value: "all", label: "Todos os status" },
 { value: "awaiting_signature", label: "Aguardando assinatura" },
 { value: "partially_signed", label: "Parcialmente assinado" },
 { value: "signed", label: "Assinado" },
 { value: "refused", label: "Recusado" },
 { value: "expired", label: "Expirado" },
 { value: "canceled", label: "Cancelado" },
 { value: "error", label: "Erro" },
];

const STATUS_LABELS: Record<string, string> = {
 draft: "Rascunho",
 preparing: "Preparando",
 awaiting_placement: "Aguardando posicionamento",
 placement_done: "Posicionamento concluído",
 awaiting_signature: "Aguardando assinatura",
 partially_signed: "Parcialmente assinado",
 signed: "Assinado",
 refused: "Recusado",
 expired: "Expirado",
 canceled: "Cancelado",
 error: "Erro",
};

function todayISO() {
 return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n: number) {
 const d = new Date();
 d.setDate(d.getDate() - n);
 return d.toISOString().slice(0, 10);
}

function RelatorioPage() {
 const [from, setFrom] = useState(daysAgoISO(30));
 const [to, setTo] = useState(todayISO());
 const [status, setStatus] = useState("all");
 const [obraFilter, setObraFilter] = useState("");

 const fromIso = useMemo(() => new Date(`${from}T00:00:00`).toISOString(), [from]);
 const toIso = useMemo(() => new Date(`${to}T23:59:59`).toISOString(), [to]);

 const { data, isLoading } = useQuery({
 queryKey: ["signature-report", fromIso, toIso, status, obraFilter],
 queryFn: () =>
 getSignatureReport({
 data: {
 from: fromIso,
 to: toIso,
 status: status === "all" ? undefined : status,
 obraId: obraFilter || undefined,
 },
 }),
 });

 const obras = useMemo(
 () => (data ? Array.from(new Set(data.rows.map((r) => r.obra_id))).filter(Boolean) : []),
 [data],
 );

 const setQuickRange = (days: number) => {
 setFrom(daysAgoISO(days));
 setTo(todayISO());
 };

 const exportCSV = () => {
 if (!data || data.rows.length === 0) {
 toast.error("Nenhum dado para exportar");
 return;
 }
 downloadCSV(data.rows, `assinaturas_${from}_a_${to}.csv`);
 toast.success(`${data.rows.length} linhas exportadas`);
 };

 const printReport = () => window.print();

 return (
 <div className="space-y-5 p-4 lg:p-6 print:p-0">
 <div className="flex items-start justify-between gap-4 flex-wrap print:hidden">
 <div>
 <h1 className="text-2xl font-bold flex items-center gap-2">
 <BarChart3 className="h-6 w-6 text-primary" />
 Relatório de assinaturas
 </h1>
 <p className="text-sm text-muted-foreground mt-1">
 Análise consolidada por período, obra e status.
 </p>
 </div>
 <Button variant="outline" size="sm" asChild>
 <Link to="/assinaturas">
 <ArrowLeft className="h-4 w-4 mr-1" />
 Voltar
 </Link>
 </Button>
 </div>

 <Card className="p-4 print:hidden">
 <div className="grid gap-3 md:grid-cols-5">
 <div>
 <Label className="text-xs">De</Label>
 <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
 </div>
 <div>
 <Label className="text-xs">Até</Label>
 <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
 </div>
 <div>
 <Label className="text-xs">Status</Label>
 <Select value={status} onValueChange={setStatus}>
 <SelectTrigger><SelectValue /></SelectTrigger>
 <SelectContent>
 {STATUS_OPTS.map((o) => (
 <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div>
 <Label className="text-xs">Obra</Label>
 <Select value={obraFilter || "all"} onValueChange={(v) => setObraFilter(v === "all" ? "" : v)}>
 <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
 <SelectContent>
 <SelectItem value="all">Todas as obras</SelectItem>
 {obras.map((o) => (
 <SelectItem key={o} value={o}>{o.slice(0, 12)}…</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 <div className="flex items-end gap-2">
 <Button variant="outline" size="sm" onClick={exportCSV}>
 <Download className="h-4 w-4 mr-1" /> CSV
 </Button>
 <Button variant="outline" size="sm" onClick={printReport}>
 <FileText className="h-4 w-4 mr-1" /> PDF
 </Button>
 </div>
 </div>
 <div className="flex gap-2 mt-3 flex-wrap">
 <Button variant="ghost" size="sm" onClick={() => setQuickRange(7)}>Últimos 7 dias</Button>
 <Button variant="ghost" size="sm" onClick={() => setQuickRange(30)}>Últimos 30 dias</Button>
 <Button variant="ghost" size="sm" onClick={() => setQuickRange(90)}>Últimos 90 dias</Button>
 <Button variant="ghost" size="sm" onClick={() => setQuickRange(365)}>Último ano</Button>
 </div>
 </Card>

 {isLoading || !data ? (
 <Card className="p-12 flex items-center justify-center text-muted-foreground">
 <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
 </Card>
 ) : (
 <>
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
 <Stat icon={FileText} label="Total" value={data.totals.total} />
 <Stat icon={CheckCircle2} label="Assinados" value={data.totals.signed} tone="text-success " />
 <Stat icon={Clock} label="Em andamento" value={data.totals.pending} tone="text-primary " />
 <Stat icon={XCircle} label="Recusados/Exp." value={data.totals.refused + data.totals.expired + data.totals.canceled} tone="text-destructive" />
 <Stat icon={Percent} label="Taxa de conclusão" value={`${data.totals.completionRate}%`} />
 <Stat
 icon={Timer}
 label="Tempo médio"
 value={data.totals.avgSignDurationHours !== null ? formatHours(data.totals.avgSignDurationHours) : "—"}
 />
 </div>

 <div className="grid gap-4 lg:grid-cols-2">
 <Card className="p-4">
 <h3 className="text-sm font-semibold mb-3">Por status</h3>
 {data.byStatus.length === 0 ? (
 <p className="text-sm text-muted-foreground">Sem dados.</p>
 ) : (
 <div className="space-y-2">
 {data.byStatus.map((s) => {
 const pct = data.totals.total > 0 ? (s.count / data.totals.total) * 100 : 0;
 return (
 <div key={s.status}>
 <div className="flex justify-between text-xs mb-1">
 <span>{STATUS_LABELS[s.status] ?? s.status}</span>
 <span className="text-muted-foreground">{s.count} ({pct.toFixed(1)}%)</span>
 </div>
 <div className="h-2 rounded-full bg-muted overflow-hidden">
 <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
 })}
 </div>
 )}
 </Card>

 <Card className="p-4">
 <h3 className="text-sm font-semibold mb-3">Top obras</h3>
 {data.byObra.length === 0 ? (
 <p className="text-sm text-muted-foreground">Sem dados.</p>
 ) : (
 <div className="space-y-2">
 {data.byObra.map((o) => {
 const pct = o.total > 0 ? (o.signed / o.total) * 100 : 0;
 return (
 <div key={o.obra_id} className="flex items-center gap-3 text-xs">
 <span className="font-mono truncate flex-1">{o.obra_id.slice(0, 16)}…</span>
 <span className="text-muted-foreground">{o.signed}/{o.total}</span>
 <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
 <div className="h-full bg-success" style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
 })}
 </div>
 )}
 </Card>
 </div>

 <Card className="overflow-hidden">
 <div className="p-3 border-b flex items-center justify-between">
 <h3 className="text-sm font-semibold">Documentos ({data.rows.length})</h3>
 <Button variant="ghost" size="sm" onClick={exportCSV}>
 <Download className="h-4 w-4 mr-1" /> Exportar
 </Button>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
 <tr>
 <th className="text-left p-2">Documento</th>
 <th className="text-left p-2">Pasta</th>
 <th className="text-left p-2">Status</th>
 <th className="text-right p-2">Signatários</th>
 <th className="text-left p-2">Criado</th>
 <th className="text-left p-2">Assinado</th>
 <th className="text-right p-2">Duração</th>
 </tr>
 </thead>
 <tbody>
 {data.rows.length === 0 ? (
 <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nenhum registro no período.</td></tr>
 ) : data.rows.map((r) => (
 <tr key={r.id} className="border-t hover:bg-accent/30">
 <td className="p-2 max-w-[260px] truncate">{r.document_name}</td>
 <td className="p-2 text-xs text-muted-foreground">{r.document_folder}</td>
 <td className="p-2 text-xs">{STATUS_LABELS[r.status] ?? r.status}</td>
 <td className="p-2 text-right tabular-nums">{r.signers_signed}/{r.signers_total}</td>
 <td className="p-2 text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
 <td className="p-2 text-xs whitespace-nowrap">{r.signed_at ? new Date(r.signed_at).toLocaleString("pt-BR") : "—"}</td>
 <td className="p-2 text-right text-xs tabular-nums">{r.sign_duration_hours !== null ? formatHours(r.sign_duration_hours) : "—"}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </Card>
 </>
 )}
 </div>
 );
}

function Stat({
 icon: Icon,
 label,
 value,
 tone,
}: {
 icon: typeof FileText;
 label: string;
 value: number | string;
 tone?: string;
}) {
 return (
 <Card className="p-3">
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <Icon className="h-3.5 w-3.5" /> {label}
 </div>
 <div className={`text-2xl font-semibold mt-1 ${tone ?? ""}`}>{value}</div>
 </Card>
 );
}

function formatHours(h: number): string {
 if (h < 1) return `${Math.round(h * 60)}min`;
 if (h < 48) return `${h.toFixed(1)}h`;
 return `${Math.round(h / 24)}d`;
}

function downloadCSV(rows: SignatureReportRow[], filename: string) {
 const headers = [
 "id", "documento", "pasta", "obra_id", "status", "sandbox",
 "criado_em", "assinado_em", "expira_em",
 "signatarios_total", "signatarios_assinaram", "duracao_horas",
 ];
 const escape = (v: unknown) => {
 if (v === null || v === undefined) return "";
 const s = String(v);
 return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
 };
 const lines = [headers.join(";")];
 for (const r of rows) {
 lines.push([
 r.id, r.document_name, r.document_folder, r.obra_id, r.status, r.sandbox,
 r.created_at, r.signed_at ?? "", r.expiration_date ?? "",
 r.signers_total, r.signers_signed, r.sign_duration_hours ?? "",
 ].map(escape).join(";"));
 }
 const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = filename;
 a.click();
 URL.revokeObjectURL(url);
}
