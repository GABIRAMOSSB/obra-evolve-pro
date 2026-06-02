import { useEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode } from "react";
import type { ProjectData, BudgetRow, Evolution, Measurement, DiaryEntry, Workspace, ObraInfo, DiaryPhoto } from "@/lib/types";
import { loadWorkspaceCloud, saveWorkspaceCloud, newObraId, detectMigration, markMigrated, type MigrationPlan } from "@/lib/storage";
import { useAuth } from "@/hooks/use-auth";
import { useCompany } from "@/hooks/use-company";
import { usePersistedTab } from "@/hooks/use-persisted-tab";
import { useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { ObraInfoDialog } from "@/components/ObraInfoDialog";
import { PhotoUploader } from "@/components/PhotoUploader";
import type { ParseResult } from "@/lib/excel";
import {
  activityMetrics,
  fmtBRL,
  fmtDate,
  fmtNum,
  getMeasurements,
  groupMetrics,
  isChildOf,
  projectMetrics,
  calcularResumoCabecalhoBM,
  getSavedMeasurements,
  formatarDataBR,
} from "@/lib/calc";

// Lazy loaders — mantêm xlsx/jspdf fora do bundle inicial.
const loadExcel = () => import("@/lib/excel");
const loadPdf = () => import("@/lib/pdf");
const parseExcel: (file: File) => ReturnType<typeof import("@/lib/excel").parseExcel> =
  async (file) => (await loadExcel()).parseExcel(file);
const exportAcompanhamentoXlsx = async (
  ...args: Parameters<typeof import("@/lib/pdf").exportAcompanhamentoXlsx>
) => (await loadPdf()).exportAcompanhamentoXlsx(...args);
const exportDiarioPdf = async (
  ...args: Parameters<typeof import("@/lib/pdf").exportDiarioPdf>
) => (await loadPdf()).exportDiarioPdf(...args);
const exportRelatorioPdf = async (
  ...args: Parameters<typeof import("@/lib/pdf").exportRelatorioPdf>
) => (await loadPdf()).exportRelatorioPdf(...args);
const buildMeasurementPdfBlob = async (
  ...args: Parameters<typeof import("@/lib/pdf").buildMeasurementPdfBlob>
): Promise<Blob> => (await loadPdf()).buildMeasurementPdfBlob(...args);
const gerarTextoDiario = async (
  ...args: Parameters<typeof import("@/lib/pdf").gerarTextoDiario>
): Promise<string> => (await loadPdf()).gerarTextoDiario(...args);
import { uploadDocumentBlob } from "@/lib/documents";
import { syncDiaryApontamentos, deleteDiaryApontamentos } from "@/lib/apontamentos";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
const DocumentsTab = lazy(() => import("@/components/DocumentsTab"));
import { MeasurementClosure } from "@/components/MeasurementClosure";
import {
  LogOut,
  CloudUpload,
  CheckCircle2,
  Upload,
  HardHat,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Trash2,
  Pencil,
  BookOpen,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Building2,
  CloudSun,
  Users,
  Wrench,
  Calendar,
  StickyNote,
  X,
  Package,
  Database,


} from "lucide-react";


function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Concluída") return "default";
  if (status === "Em andamento") return "secondary";
  return "outline";
}

/** Normaliza para o novo formato com `measurements`. */
function normalizeEvolution(evo?: Evolution): Evolution {
  const list = getMeasurements(evo);
  return { measurements: list };
}

/**
 * Garante que exista uma medição aberta com o número da medição GLOBAL atual.
 * Se já existir uma medição com esse número, devolve-a (mesmo já fechada — nesse
 * caso o chamador deve verificar e bloquear edição).
 */
function ensureOpenMeasurement(
  evo: Evolution | undefined,
  currentNumber: number,
): { evo: Evolution; open: Measurement } {
  const base = normalizeEvolution(evo);
  const list = base.measurements ?? [];
  const existing = list.find((m) => m.number === currentNumber);
  if (existing) return { evo: base, open: existing };
  const novo: Measurement = {
    id: crypto.randomUUID(),
    number: currentNumber,
    quantExec: 0,
    dataExec: new Date().toISOString().slice(0, 10),
    observacoes: "",
    closed: false,
  };
  return { evo: { measurements: [...list, novo] }, open: novo };
}

/** Atualiza o acumulado ajustando a medição aberta (número global). */
function setAccumulatedQty(
  evo: Evolution | undefined,
  row: BudgetRow,
  newAcc: number,
  currentNumber: number,
): { evo: Evolution; clamped: boolean } {
  const { evo: ev, open } = ensureOpenMeasurement(evo, currentNumber);
  const list = ev.measurements ?? [];
  const closedSum = list
    .filter((m) => m.number !== currentNumber)
    .reduce((s, m) => s + (m.quantExec || 0), 0);
  const max = row.quantidade > 0 ? row.quantidade : Number.POSITIVE_INFINITY;
  const target = Math.max(closedSum, Math.min(newAcc, max));
  const clamped = newAcc > max || newAcc < closedSum;
  const periodo = Math.max(0, target - closedSum);
  const next = list.map((m) =>
    m.id === open.id
      ? { ...m, quantExec: periodo, dataExec: m.dataExec || new Date().toISOString().slice(0, 10) }
      : m,
  );
  return { evo: { measurements: next }, clamped };
}

/** Número da medição atualmente aberta (global). */
function getCurrentMeasurement(p: ProjectData): number {
  if (p.currentMeasurement && p.currentMeasurement > 0) return p.currentMeasurement;
  // Compatibilidade: deduz a partir do maior número já registrado nas evolutions.
  let maxClosed = 0;
  for (const evo of Object.values(p.evolutions || {})) {
    for (const m of evo?.measurements ?? []) {
      if (m.closed && m.number > maxClosed) maxClosed = m.number;
    }
  }
  return maxClosed + 1;
}

export function ObraApp() {
  const { user, signOut } = useAuth();
  const { company, loading: companyLoading } = useCompany();
  const navigate = useNavigate();
  const [ws, setWs] = useState<Workspace>({ obras: [], activeId: null });
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ result: ParseResult; fileName: string; elapsedMs?: number } | null>(null);
  const [uploadModel, setUploadModel] = useState<import("@/lib/excel").ForcedModel>("auto");
  const [migration, setMigration] = useState<
    | { stage: "prompt"; plan: MigrationPlan }
    | { stage: "running"; plan: MigrationPlan }
    | { stage: "done"; plan: MigrationPlan }
    | null
  >(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (!user || !company) return;
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadWorkspaceCloud(company.id);
        if (cancelled) return;
        const plan = detectMigration();
        const shouldPrompt = plan.needed && remote.obras.length === 0;
        skipNextSave.current = true;
        setWs(remote);
        setLoaded(true);
        if (shouldPrompt) setMigration({ stage: "prompt", plan });
      } catch (e) {
        console.error(e);
        toast.error("Falha ao carregar dados da nuvem");
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, company]);

  async function runMigration() {
    if (!company || !migration || !migration.plan.local) return;
    if (company.role !== "admin") {
      toast.error("Apenas administradores podem migrar dados");
      return;
    }
    const plan = migration.plan;
    const local = migration.plan.local!;
    setMigration({ stage: "running", plan });
    try {
      await saveWorkspaceCloud(company.id, local);
      markMigrated();
      skipNextSave.current = true;
      setWs(local);
      toast.success(
        `Migração concluída: ${plan.obrasCount} obra(s), ${plan.diariesCount} diário(s), ${plan.fotosCount} foto(s).`,
      );
      setMigration({ stage: "done", plan });
    } catch (e) {
      console.error(e);
      toast.error("Falha ao migrar dados. Tente novamente.");
      setMigration({ stage: "prompt", plan });
    }
  }

  function skipMigration() {
    markMigrated();
    setMigration(null);
  }

  function checkLocalMigration() {
    const plan = detectMigration({ force: true });
    if (!plan.needed) {
      toast.message("Nenhum dado local encontrado neste aparelho.");
      return;
    }
    setMigration({ stage: "prompt", plan });
  }

  useEffect(() => {
    if (!loaded || !company) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (company.role !== "admin" && company.role !== "editor") return; // somente leitura para membros
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveWorkspaceCloud(company.id, ws);
      } catch {
        toast.error("Falha ao salvar na nuvem");
      } finally {
        setSaving(false);
      }
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [ws, loaded, company]);

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/login" });
  }

  const activeObra = ws.obras.find((o) => o.id === ws.activeId) ?? null;

  function updateActive(updater: (o: ProjectData) => ProjectData) {
    setWs((prev) => ({
      ...prev,
      obras: prev.obras.map((o) => (o.id === prev.activeId ? updater(o) : o)),
    }));
  }

  function setActiveObra(data: ProjectData) {
    updateActive(() => data);
  }

  async function handleFile(file: File) {
    try {
      const t0 = performance.now();
      const result = await parseExcel(file, uploadModel);
      const elapsedMs = Math.round(performance.now() - t0);
      setPreview({ result, fileName: file.name, elapsedMs });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function confirmImport() {
    if (!preview) return;
    const baseName = preview.fileName.replace(/\.[^.]+$/, "");
    const nome = baseName || `Obra ${ws.obras.length + 1}`;
    const obra: ProjectData = {
      id: newObraId(),
      nome,
      fileName: preview.fileName,
      importedAt: new Date().toISOString(),
      rows: preview.result.rows,
      evolutions: {},
      diaries: [],
      modelo: preview.result.modelo,
      nomeAba: preview.result.sheetName,
    };
    setWs((prev) => ({ obras: [...prev.obras, obra], activeId: obra.id }));
    toast.success(`Obra "${nome}" criada com ${preview.result.rows.length} linhas`);
    setPreview(null);
  }

  function selectObra(id: string) {
    setWs((prev) => ({ ...prev, activeId: id }));
  }

  function renameObra(id: string, nome: string) {
    setWs((prev) => ({
      ...prev,
      obras: prev.obras.map((o) => (o.id === id ? { ...o, nome } : o)),
    }));
  }

  function deleteObra(id: string) {
    setWs((prev) => {
      const obras = prev.obras.filter((o) => o.id !== id);
      const activeId = prev.activeId === id ? (obras[0]?.id ?? null) : prev.activeId;
      return { obras, activeId };
    });
    toast.success("Obra removida");
  }

  if (companyLoading || !loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-hero">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center animate-pulse-glow">
              <HardHat className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <div className="text-sm text-muted-foreground tracking-wide">Carregando seu workspace…</div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <h2 className="text-lg font-bold">Nenhuma empresa encontrada</h2>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não está vinculada a nenhuma empresa. Tente sair e entrar novamente.
          </p>
          <Button onClick={handleSignOut} variant="outline" className="w-full">
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </Card>
      </div>
    );
  }

  if (migration && migration.stage !== "done") {
    const { plan, stage } = migration;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-lg w-full p-8 space-y-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
            <CloudUpload className="w-7 h-7" />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold">Encontramos dados salvos neste dispositivo</h2>
            <p className="text-sm text-muted-foreground">
              Podemos enviá-los para a nuvem agora, assim você acessa tudo de qualquer aparelho.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-center">
            <div className="rounded-md border p-3">
              <div className="text-2xl font-bold text-primary">{plan.obrasCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Obras</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-2xl font-bold">{plan.diariesCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Diários</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-2xl font-bold">{plan.fotosCount}</div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Fotos</div>
            </div>
          </div>
          {stage === "running" ? (
            <div className="space-y-2">
              <Progress value={70} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">Enviando dados para a nuvem...</p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={skipMigration}>
                Ignorar
              </Button>
              <Button className="flex-1" onClick={runMigration}>
                <CloudUpload className="w-4 h-4 mr-1" /> Enviar para a nuvem
              </Button>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground text-center">
            Logado como {user?.email}
          </p>
        </Card>
      </div>
    );
  }

  if (!activeObra) {
    return (
      <>
        <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
          <Card className="max-w-xl w-full p-10 text-center space-y-6 shadow-elevated animate-slide-up relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
              <HardHat className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold font-display tracking-tight">
                Acompanhamento de <span className="text-gradient-primary">Obras</span>
              </h1>
              <p className="text-muted-foreground mt-3">
                <span className="font-semibold text-foreground">{company.name}</span> — importe sua primeira planilha orçamentária para começar.
              </p>
            </div>
            <label className="block">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                  e.target.value = "";
                }}
              />
              <Button asChild size="lg" className="w-full">
                <span>
                  <Upload className="mr-2 w-4 h-4" />
                  Importar planilha Excel
                </span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground">
              Seus dados ficam sincronizados na nuvem e visíveis para toda a sua equipe.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" onClick={checkLocalMigration}>
                <CloudUpload className="mr-2 w-4 h-4" /> Migrar local
              </Button>
              <Button asChild variant="outline">
                <Link to="/equipe"><Users className="mr-2 w-4 h-4" /> Equipe</Link>
              </Button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-4">
              <span className="truncate">{user?.email} • {company.role === "admin" ? "Admin" : company.role === "editor" ? "Editor" : "Membro"}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="w-3.5 h-3.5 mr-1" /> Sair
              </Button>
            </div>
          </Card>
        </div>
        <ImportPreviewDialog
          preview={preview}
          onCancel={() => setPreview(null)}
          onConfirm={confirmImport}
        />
      </>
    );
  }

  return (
    <>
      <Dashboard
        data={activeObra}
        setData={setActiveObra}
        obras={ws.obras}
        activeId={ws.activeId!}
        onSelectObra={selectObra}
        onRenameObra={renameObra}
        onDeleteObra={deleteObra}
        onImportFile={handleFile}
        saving={saving}
        userEmail={user?.email ?? ""}
        userId={user?.id ?? ""}
        companyId={company.id}
        companyName={company.name}
        isAdmin={company.role === "admin" || company.role === "editor"}
        onSignOut={handleSignOut}
      />
      <ImportPreviewDialog
        preview={preview}
        onCancel={() => setPreview(null)}
        onConfirm={confirmImport}
      />
    </>
  );
}


function ImportPreviewDialog({
  preview,
  onCancel,
  onConfirm,
}: {
  preview: { result: ParseResult; fileName: string; elapsedMs?: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!preview) return null;
  const { result, fileName, elapsedMs } = preview;
  const groupCount = result.rows.filter((r) => r.isGroup).length;
  const activityCount = result.rows.length - groupCount;
  const valorTotalImportado = result.rows
    .filter((r) => !r.isGroup)
    .reduce((acc, r) => acc + (r.total || 0), 0);
  const previewLimit = 100;
  const skippedLimit = 50;

  // ordered header columns
  const headerCols = Object.entries(result.headerMap).sort((a, b) => a[1] - b[1]);

  return (
    <Dialog open={!!preview} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pré-visualização da importação</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {fileName} — aba <strong>{result.sheetName}</strong> • cabeçalho na linha{" "}
            <strong>{result.headerRowIndex}</strong>
          </p>
          <div className="pt-1">
            <Badge
              variant={result.modelo === "modelo_orcamento_sintetico" ? "default" : "secondary"}
              className="text-[10px] uppercase tracking-wider"
            >
              {result.modelo === "modelo_orcamento_sintetico"
                ? "Modelo: Orçamento Sintético"
                : "Modelo: Padrão"}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <PreviewStat label="Linhas válidas" value={result.rows.length} tone="success" />
          <PreviewStat label="Etapas" value={groupCount} />
          <PreviewStat label="Composições" value={activityCount} />
          <PreviewStat label="Ignoradas" value={result.skipped.length} tone="warn" />
          <PreviewStat label="Valor total" value={fmtBRL(valorTotalImportado)} />
          <PreviewStat
            label="Tempo"
            value={elapsedMs != null ? `${(elapsedMs / 1000).toFixed(2)}s` : "—"}
          />
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Cabeçalhos detectados</div>
          <div className="flex flex-wrap gap-2">
            {headerCols.map(([key, idx]) => (
              <Badge key={key} variant="secondary" className="font-mono text-xs">
                {key}: col {idx + 1} ({result.headerLabels[headerCols.findIndex(([k]) => k === key)] || "—"})
              </Badge>
            ))}
          </div>
        </div>

        <Tabs defaultValue="incluidas" className="flex-1 min-h-0 flex flex-col">
          <TabsList>
            <TabsTrigger value="incluidas">
              Incluídas ({result.rows.length})
            </TabsTrigger>
            <TabsTrigger value="ignoradas">
              Ignoradas ({result.skipped.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incluidas" className="flex-1 min-h-0 overflow-auto border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-2 py-1.5 text-left w-14">Linha</th>
                  <th className="px-2 py-1.5 text-left w-20">Item</th>
                  <th className="px-2 py-1.5 text-left">Descrição do serviço</th>
                  <th className="px-2 py-1.5 text-left w-16">Und</th>
                  <th className="px-2 py-1.5 text-right w-28">Qtd. planejada</th>
                  <th className="px-2 py-1.5 text-right w-32">Valor total</th>
                </tr>
              </thead>
              <tbody>
                {result.parsed.slice(0, previewLimit).map(({ rowIndex, row }) => {
                  if (row.isGroup) {
                    return (
                      <tr key={rowIndex} className="border-t bg-primary/10">
                        <td className="px-2 py-1.5 text-muted-foreground font-mono">{rowIndex}</td>
                        <td className="px-2 py-1.5 font-mono font-bold text-primary">{row.item}</td>
                        <td
                          colSpan={4}
                          className="px-2 py-1.5 font-bold uppercase text-primary tracking-wide"
                        >
                          <Badge className="mr-2 text-[10px]">ETAPA</Badge>
                          {row.descricao}
                        </td>
                      </tr>
                    );
                  }
                  const indent = Math.max(0, row.level - 2) * 12;
                  return (
                    <tr key={rowIndex} className="border-t hover:bg-muted/30">
                      <td className="px-2 py-1 text-muted-foreground font-mono">{rowIndex}</td>
                      <td className="px-2 py-1 font-mono" style={{ paddingLeft: 8 + indent }}>
                        {row.item}
                      </td>
                      <td className="px-2 py-1 max-w-md truncate" title={row.descricao}>
                        {row.descricao}
                      </td>
                      <td className="px-2 py-1">{row.und}</td>
                      <td className="px-2 py-1 text-right font-medium">
                        {row.quantidade ? fmtNum(row.quantidade) : "—"}
                      </td>
                      <td className="px-2 py-1 text-right">
                        {row.total ? fmtBRL(row.total) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {result.parsed.length > previewLimit && (
              <div className="text-xs text-muted-foreground p-2 text-center border-t">
                Exibindo {previewLimit} de {result.parsed.length} linhas. Todas serão importadas.
              </div>
            )}
          </TabsContent>

          <TabsContent value="ignoradas" className="flex-1 min-h-0 overflow-auto border rounded-md">
            {result.skipped.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhuma linha foi ignorada.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-muted text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Linha</th>
                    <th className="px-2 py-1.5 text-left">Motivo</th>
                    <th className="px-2 py-1.5 text-left">Conteúdo</th>
                  </tr>
                </thead>
                <tbody>
                  {result.skipped.slice(0, skippedLimit).map((s) => (
                    <tr key={s.rowIndex} className="border-t bg-amber-50/40 dark:bg-amber-950/10">
                      <td className="px-2 py-1 text-muted-foreground font-mono align-top">
                        {s.rowIndex}
                      </td>
                      <td className="px-2 py-1 align-top">
                        <Badge variant="outline" className="text-[10px]">
                          {s.reason}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground truncate max-w-xl">
                        {s.cells.filter(Boolean).join(" | ") || <em>(linha vazia)</em>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {result.skipped.length > skippedLimit && (
              <div className="text-xs text-muted-foreground p-2 text-center border-t">
                Exibindo {skippedLimit} de {result.skipped.length} linhas ignoradas.
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>
            Confirmar importação ({result.rows.length} linhas)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "success" | "warn";
}) {
  const cls =
    tone === "success"
      ? "text-[var(--success)]"
      : tone === "warn"
        ? "text-amber-600"
        : "text-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}

function Dashboard({
  data,
  setData,
  obras,
  activeId,
  onSelectObra,
  onRenameObra,
  onDeleteObra,
  onImportFile,
  saving,
  userEmail,
  userId,
  companyId,
  companyName,
  isAdmin,
  onSignOut,
}: {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  obras: ProjectData[];
  activeId: string;
  onSelectObra: (id: string) => void;
  onRenameObra: (id: string, nome: string) => void;
  onDeleteObra: (id: string) => void;
  onImportFile: (file: File) => void;
  saving: boolean;
  userEmail: string;
  userId: string;
  companyId: string;
  companyName: string;
  isAdmin: boolean;
  onSignOut: () => void;
}) {

  const [activeTab, setActiveTab] = usePersistedTab("dashboard", "atividades");
  const etapas = useMemo(() => data.rows.filter((r) => r.isGroup && r.level === 1), [data.rows]);

  const [filterEtapas, setFilterEtapas] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterExec, setFilterExec] = useState<string[]>([]); // "executado" | "nao"
  const [filterItem, setFilterItem] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [filterPercMin, setFilterPercMin] = useState("");
  const [filterMeasurement, setFilterMeasurement] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = (item: string) =>
    setCollapsed((c) => ({ ...c, [item]: !c[item] }));
  const expandAll = () => setCollapsed({});
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    data.rows.forEach((r) => {
      if (r.isGroup) next[r.item] = true;
    });
    setCollapsed(next);
  };

  // Tokens (case-insensitive substrings) for the Item filter, comma-separated.
  const itemTokens = useMemo(
    () =>
      filterItem
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    [filterItem],
  );

  const hasRowFilters =
    filterStatuses.length > 0 || !!filterPercMin || filterExec.length > 0 || !!filterMeasurement;

  // Rows that match filters (ignoring collapse) — used for metrics & exports.
  const filteredRows = useMemo(() => {
    const measNum = filterMeasurement ? parseInt(filterMeasurement, 10) : NaN;
    return data.rows.filter((r) => {
      if (filterEtapas.length > 0) {
        const inEtapa = filterEtapas.some(
          (e) => r.item === e || isChildOf(r.item, e),
        );
        if (!inEtapa) return false;
      }
      if (itemTokens.length > 0) {
        const itemLower = r.item.toLowerCase();
        if (!itemTokens.some((t) => itemLower.includes(t))) return false;
      }
      if (filterDesc && !r.descricao.toLowerCase().includes(filterDesc.toLowerCase()))
        return false;
      if (!r.isGroup) {
        const a = activityMetrics(r, data.evolutions[r.item]);
        if (filterStatuses.length > 0 && !filterStatuses.includes(a.status)) return false;
        if (filterPercMin && a.percent < parseFloat(filterPercMin)) return false;
        if (filterExec.length > 0) {
          const executado = a.quantExec > 0;
          const matches =
            (filterExec.includes("executado") && executado) ||
            (filterExec.includes("nao") && !executado);
          if (!matches) return false;
        }
        if (!isNaN(measNum)) {
          const ms = a.measurements ?? [];
          const hit = ms.some((m) => m.number === measNum && (m.quantExec || 0) > 0);
          if (!hit) return false;
        }
      } else if (hasRowFilters) {
        return false;
      }
      return true;
    });
  }, [data, filterEtapas, itemTokens, filterDesc, filterStatuses, filterPercMin, filterExec, filterMeasurement, hasRowFilters]);

  // Visible rows additionally hide descendants of collapsed groups.
  const visibleRows = useMemo(() => {
    return filteredRows.filter((r) => {
      for (const ancestor of Object.keys(collapsed)) {
        if (collapsed[ancestor] && isChildOf(r.item, ancestor)) return false;
      }
      return true;
    });
  }, [filteredRows, collapsed]);

  const m = useMemo(
    () => projectMetrics(filteredRows, data.evolutions),
    [filteredRows, data.evolutions],
  );

  const updateEvolution = (item: string, evo: Evolution) => {
    const next = { ...data.evolutions, [item]: evo };
    const list = evo.measurements ?? [];
    const empty =
      list.length === 0 ||
      (list.length === 1 && !list[0].closed && !list[0].quantExec && !list[0].observacoes);
    if (empty) delete next[item];
    setData({ ...data, evolutions: next });
  };

  const addDiary = (entry: DiaryEntry) => {
    setData({ ...data, diaries: [entry, ...data.diaries] });
    if (companyId) {
      syncDiaryApontamentos(companyId, data.id, entry).catch((err: unknown) => {
        console.error("syncDiaryApontamentos", err);
        toast.error("Falha ao registrar custo no Realizado");
      });
    }
  };

  const updateDiary = (entry: DiaryEntry) => {
    setData({
      ...data,
      diaries: data.diaries.map((d) => (d.id === entry.id ? entry : d)),
    });
    if (companyId) {
      syncDiaryApontamentos(companyId, data.id, entry).catch((err: unknown) => {
        console.error("syncDiaryApontamentos", err);
        toast.error("Falha ao atualizar custo no Realizado");
      });
    }
  };

  const removeDiary = (id: string) => {
    setData({ ...data, diaries: data.diaries.filter((d) => d.id !== id) });
    deleteDiaryApontamentos(id).catch((err: unknown) => {
      console.error("deleteDiaryApontamentos", err);
    });
  };

  function removeObra() {
    if (confirm(`Excluir a obra "${data.nome}"? Esta ação não pode ser desfeita.`)) {
      onDeleteObra(data.id);
    }
  }

  function handleSaveInfo(nome: string, info: ObraInfo) {
    if (nome !== data.nome) onRenameObra(data.id, nome);
    setData({ ...data, nome, info });
  }

  function addCustomItem(parentItem: string | null, descricao: string, opts: {
    und?: string;
    quantidade?: number;
    valorUnit?: number;
  }) {
    let item: string;
    let level: number;
    let insertAfter: number;
    const rowsCopy = [...data.rows];

    if (!parentItem) {
      // New etapa: max top-level + 1
      const tops = rowsCopy
        .map((r) => parseInt(r.item.split(".")[0], 10))
        .filter((n) => !isNaN(n));
      const next = (tops.length ? Math.max(...tops) : 0) + 1;
      item = String(next);
      level = 1;
      insertAfter = rowsCopy.length - 1;
      const newRow: BudgetRow = {
        item,
        codigo: "",
        banco: "MANUAL",
        descricao,
        und: "",
        quantidade: 0,
        valorUnit: 0,
        valorUnitBDI: 0,
        total: 0,
        peso: 0,
        isGroup: true,
        level,
      };
      rowsCopy.splice(insertAfter + 1, 0, newRow);
    } else {
      // New service under parent etapa: next immediate sub-number
      const prefix = parentItem + ".";
      const directChildren = rowsCopy
        .filter((r) => r.item.startsWith(prefix))
        .map((r) => {
          const rest = r.item.slice(prefix.length);
          return parseInt(rest.split(".")[0], 10);
        })
        .filter((n) => !isNaN(n));
      const next = (directChildren.length ? Math.max(...directChildren) : 0) + 1;
      item = `${parentItem}.${next}`;
      level = item.split(".").length;
      // insert after last descendant of parent (or after parent itself)
      let lastIdx = rowsCopy.findIndex((r) => r.item === parentItem);
      for (let i = 0; i < rowsCopy.length; i++) {
        if (rowsCopy[i].item === parentItem || rowsCopy[i].item.startsWith(prefix)) {
          lastIdx = i;
        }
      }
      const qty = opts.quantidade ?? 0;
      const vu = opts.valorUnit ?? 0;
      const newRow: BudgetRow = {
        item,
        codigo: "",
        banco: "MANUAL",
        descricao,
        und: opts.und ?? "un",
        quantidade: qty,
        valorUnit: vu,
        valorUnitBDI: vu,
        total: qty * vu,
        peso: 0,
        isGroup: false,
        level,
      };
      rowsCopy.splice(lastIdx + 1, 0, newRow);
    }
    setData({ ...data, rows: rowsCopy });
    toast.success(`${parentItem ? "Serviço" : "Etapa"} ${item} adicionado(a)`);
  }

  function removeCustomItem(item: string) {
    if (!confirm(`Remover ${item} e seus filhos? Esta ação não pode ser desfeita.`)) return;
    const prefix = item + ".";
    const nextRows = data.rows.filter((r) => r.item !== item && !r.item.startsWith(prefix));
    const nextEvo = { ...data.evolutions };
    for (const k of Object.keys(nextEvo)) {
      if (k === item || k.startsWith(prefix)) delete nextEvo[k];
    }
    setData({ ...data, rows: nextRows, evolutions: nextEvo });
    toast.success(`${item} removido`);
  }

  // BM selecionado: se o filtro de medição estiver ativo, usa o número
  // selecionado; caso contrário, fica sem BM (resumo geral).
  const currentMeasNumber = getCurrentMeasurement(data);
  const savedMeasurements = useMemo(() => getSavedMeasurements(data.evolutions), [data.evolutions]);
  const selectedBM = useMemo<number | null>(() => {
    const n = filterMeasurement ? parseInt(filterMeasurement, 10) : NaN;
    if (isNaN(n)) return null;
    return savedMeasurements.some((s) => s.number === n) ? n : null;
  }, [filterMeasurement, savedMeasurements]);

  // Resumo do cabeçalho — sempre com TODAS as linhas (data.rows), nunca com
  // filteredRows: os totais globais não podem mudar com filtros de tela.
  const resumoBM = useMemo(
    () => calcularResumoCabecalhoBM(data.rows, data.evolutions, selectedBM, data.info ?? {}),
    [data.rows, data.evolutions, data.info, selectedBM],
  );

  const info = data.info ?? {};
  const periodoInicio = resumoBM.periodoInicio ? new Date(resumoBM.periodoInicio + "T00:00:00") : null;



  return (
    <div className="flex-1 min-w-0 flex flex-col">


        {!isAdmin && (
          <div className="bg-warning/20 border-b border-warning text-foreground text-xs text-center py-1.5 px-4">
            Modo somente leitura — peça a um administrador para alterar seu papel.
          </div>
        )}

        {/* Top bar enxuta (glass) */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-xl">
          <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
            {/* Selector de obra mobile-only brand */}
            <div className="lg:hidden w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow shrink-0">
              <HardHat className="w-4 h-4 text-primary-foreground" />
            </div>

            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <Select value={activeId} onValueChange={onSelectObra}>
                <SelectTrigger className="h-9 w-full sm:min-w-[12rem] sm:max-w-[20rem] border-0 bg-muted/50 hover:bg-muted focus:ring-1 focus:ring-primary/40 text-sm font-medium rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ObraInfoDialog nome={data.nome} info={data.info} onSave={handleSaveInfo} />
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-success/10 border border-success/20 text-success text-[11px] font-medium">
              <span className={`w-1.5 h-1.5 rounded-full bg-success ${saving ? "animate-pulse" : ""}`} />
              {saving ? "Sincronizando…" : "Sincronizado"}
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-8 px-2.5" onClick={() => exportAcompanhamentoXlsx(filteredRows, data.evolutions, info, data.nome, selectedBM ?? currentMeasNumber, undefined, data.rows)}>
                <FileSpreadsheet className="w-4 h-4 text-success" />
                <span className="hidden xl:inline ml-1">Excel</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2.5" onClick={() => exportRelatorioPdf(filteredRows, data.evolutions, data.fileName)}>
                <FileText className="w-4 h-4 text-destructive" />
                <span className="hidden xl:inline ml-1">PDF</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5"
                onClick={async () => {
                  const blob = await buildMeasurementPdfBlob(filteredRows, data.evolutions, selectedBM ?? currentMeasNumber, data.nome, new Date(), info, periodoInicio ?? undefined, data.rows);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${resumoBM.codigoBM}-${data.nome.replace(/[^a-z0-9-_]+/gi, "_")}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success(`Boletim ${resumoBM.codigoBM} exportado`);
                }}
              >
                <FileText className="w-4 h-4 text-primary" />
                <span className="hidden xl:inline ml-1">Boletim</span>
              </Button>
              <MeasurementClosure data={data} setData={setData} companyId={companyId} userId={userId} userEmail={userEmail} isAdmin={isAdmin} variant="inline" />
            </div>

            <div className="h-6 w-px bg-border/70 hidden md:block" />

            <label>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onImportFile(f); }} />
              <Button asChild size="sm" className="h-8">
                <span className="cursor-pointer"><Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nova obra</span></span>
              </Button>
            </label>

            <label className="hidden md:block">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const result = await parseExcel(f);
                    const validKeys = new Set(result.rows.map((r) => r.item));
                    const keptEvolutions: Record<string, Evolution> = {};
                    let kept = 0;
                    let dropped = 0;
                    for (const [k, v] of Object.entries(data.evolutions)) {
                      if (validKeys.has(k)) { keptEvolutions[k] = v; kept++; } else dropped++;
                    }
                    setData({ ...data, fileName: f.name, importedAt: new Date().toISOString(), rows: result.rows, evolutions: keptEvolutions, modelo: result.modelo, nomeAba: result.sheetName });
                    toast.success(`Planilha atualizada: ${result.rows.length} linhas. ${kept} evolução(ões) preservada(s)${dropped ? `, ${dropped} descartada(s)` : ""}.`);
                  } catch (err) { toast.error((err as Error).message); }
                }}
              />
              <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0" title="Reimportar planilha">
                <span className="cursor-pointer"><Upload className="w-4 h-4" /></span>
              </Button>
            </label>

            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={removeObra} title="Excluir obra">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </header>

        {/* Hero strip — nome da obra */}
        <div className="relative border-b border-border/60 bg-gradient-hero overflow-hidden">
          <div className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{ backgroundImage: "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="relative px-4 sm:px-6 py-6">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
              <span>Obra ativa</span>
              <span className="text-border">/</span>
              <span className="text-foreground/70">{resumoBM.codigoBM}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
              {data.nome}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 truncate">{data.fileName}</p>
          </div>
        </div>

        <main className="flex-1 w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
          {/* 5 Cards de resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <SummaryCard label="Valor total da obra" value={fmtBRL(resumoBM.valorTotalObra)} icon="total" />
            <SummaryCard label="Valor medido nesta medição" value={fmtBRL(resumoBM.valorDestaMedicao)} icon="measure" tone="measure" />
            <SummaryCard label="Acumulado executado" value={fmtBRL(resumoBM.valorAcumulado)} icon="trend" tone="success" />
            <SummaryCard label="Saldo restante" value={fmtBRL(resumoBM.saldoRestante)} icon="balance" tone="warning" />
            <SummaryCard label="Percentual acumulado" value={`${fmtNum(resumoBM.percentualAcumulado)}%`} icon="percent" tone="primary" progress={resumoBM.percentualAcumulado} />
          </div>


        {/* Alerta — campos obrigatórios da obra ausentes */}
        {(() => {
          const required: Array<[keyof typeof info, string]> = [
            ["cliente", "Licitador"],
            ["contratante", "Contratante"],
            ["empresaExecutora", "Empresa executora"],
            ["cnpj", "CNPJ"],
            ["endereco", "Endereço"],
            ["municipio", "Município"],
            ["estado", "UF"],
            ["numeroContrato", "Nº contrato"],
            ["responsavelTecnico", "Responsável técnico"],
            ["crea", "CREA/CAU"],
            ["dataInicioObra", "Data de início"],
          ];
          const missing = required.filter(([k]) => !info[k] || String(info[k]).trim() === "");
          if (missing.length === 0) return null;
          return (
            <div className="rounded-md border border-warning bg-warning/10 text-foreground px-3 py-2 text-xs flex items-start gap-2">
              <span className="font-bold text-warning-foreground bg-warning rounded px-1.5 py-0.5 uppercase tracking-wider text-[10px]">Atenção</span>
              <span>
                Campos obrigatórios da obra pendentes para liberar o fechamento da medição:{" "}
                <strong>{missing.map(([, label]) => label).join(", ")}</strong>. Acesse <em>Dados da obra</em> para preencher.
              </span>
            </div>
          );
        })()}

        {/* BOLETIM DE MEDIÇÃO */}
        <Card className="overflow-hidden border-border shadow-[var(--shadow-card)] p-0">
          <div className="bg-primary text-primary-foreground flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="font-mono text-[11px] tracking-[0.2em] opacity-80">{resumoBM.hasMeasurement ? resumoBM.codigoBM : ""}</div>
            <div className="font-bold tracking-[0.25em] text-sm text-center flex-1">BOLETIM DE MEDIÇÃO</div>
            <div className="font-mono text-[11px] tracking-[0.15em] opacity-80 text-right">
              {resumoBM.hasMeasurement ? `Período: ${resumoBM.periodoLabel}` : ""}
            </div>
          </div>
          {/* Linha 1 — Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y divide-border border-b border-border text-xs">
            <BMField label="Licitador" value={info.cliente || "—"} />
            <BMField label="Contratante" value={info.contratante || "—"} />
            <BMField label="Empresa Executora" value={info.empresaExecutora || "—"} />
            <BMField label="CNPJ" value={info.cnpj || "—"} />
            <BMField label="Nº Contrato" value={info.numeroContrato || "—"} />
            <BMField label="Nº Licitação" value={info.numeroLicitacao || "—"} />
          </div>
          {/* Linha 2 — Obra e localização */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y divide-border border-b border-border text-xs">
            <BMField label="Obra" value={data.nome} wide />
            <BMField label="Endereço" value={info.endereco || "—"} wide />
            <BMField label="Município" value={info.municipio || "—"} />
            <BMField label="UF" value={info.estado || "—"} />
          </div>
          {/* Linha 3 — Responsabilidade técnica */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y divide-border border-b border-border text-xs">
            <BMField label="Responsável Técnico" value={info.responsavelTecnico || "—"} />
            <BMField label="CREA / CAU" value={info.crea || "—"} />
            <BMField label="Cargo / Função (Resp.)" value={info.cargoResponsavel || "—"} />
            <BMField label="ART / RRT" value={info.artRrt || "—"} />
            <BMField label="Início da Obra" value={formatarDataBR(info.dataInicioObra) || "—"} />
            <BMField label="Prazo (dias)" value={info.prazoContratualDias ? String(info.prazoContratualDias) : "—"} />
          </div>
          {/* Linha 3b — Fiscalização */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 divide-x divide-y divide-border border-b border-border text-xs">
            <BMField label="Fiscal da Obra" value={info.fiscal || "—"} wide />
            <BMField label="CPF do Fiscal" value={info.cpfFiscal || "—"} />
            <BMField label="Cargo / Função (Fiscal)" value={info.cargoFiscal || "—"} wide />
          </div>
          {/* Linha 4 — Resumo financeiro da medição */}
          {resumoBM.hasMeasurement ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-x divide-y divide-border text-xs">
              <BMField label="Nº do BM" value={resumoBM.descricaoBM} strong tone="primary" />
              <BMField label="Data da Medição" value={resumoBM.dataMedicao} />
              <BMField label="Período da Medição" value={resumoBM.periodoLabel} wide />
              <BMField label="Valor desta medição" value={fmtBRL(resumoBM.valorDestaMedicao)} strong tone="measure" />
              <BMField label="Valor acumulado" value={fmtBRL(resumoBM.valorAcumulado)} strong tone="success" />
              <BMField label="% Acumulado" value={`${fmtNum(resumoBM.percentualAcumulado)}%`} strong tone="primary" progress={resumoBM.percentualAcumulado} />
              <BMField label="Saldo restante" value={fmtBRL(resumoBM.saldoRestante)} strong />
              <BMField label="Dias decorridos" value={`${resumoBM.diasDecorridos} dias`} />
              <BMField label="Dias restantes" value={info.prazoContratualDias ? `${resumoBM.diasRestantes} dias` : "—"} />
              <BMField label="Valor total da obra" value={fmtBRL(resumoBM.valorTotalObra)} strong />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-x divide-y divide-border text-xs">
              <BMField label="Valor total da obra" value={fmtBRL(resumoBM.valorTotalObra)} strong />
              <BMField label="Acumulado executado" value={fmtBRL(resumoBM.valorAcumulado)} strong tone="success" />
              <BMField label="% Acumulado" value={`${fmtNum(resumoBM.percentualAcumulado)}%`} strong tone="primary" progress={resumoBM.percentualAcumulado} />
              <BMField label="Saldo restante" value={fmtBRL(resumoBM.saldoRestante)} strong />
            </div>
          )}
        </Card>



        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="diario">
              Diário de obra ({data.diaries.length})
            </TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="atividades" className="space-y-4">
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
                <div>
                  <Label className="text-xs">Etapa</Label>
                  <MultiSelect
                    options={etapas.map((e) => ({
                      value: e.item,
                      label: `${e.item} — ${e.descricao}`,
                    }))}
                    value={filterEtapas}
                    onChange={setFilterEtapas}
                    placeholder="Todas as etapas"
                    searchable
                  />
                </div>
                <div>
                  <Label className="text-xs">Medição</Label>
                  <Select
                    value={filterMeasurement || "__all__"}
                    onValueChange={(v) => setFilterMeasurement(v === "__all__" ? "" : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Todas as medições" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as medições</SelectItem>
                      {savedMeasurements.length === 0 && (
                        <div className="px-2 py-1.5 text-xs text-muted-foreground">
                          Nenhuma medição salva
                        </div>
                      )}
                      {savedMeasurements.map((s) => (
                        <SelectItem key={s.number} value={String(s.number)}>
                          {`BM-${String(s.number).padStart(2, "0")}`}
                          {s.date ? ` — ${formatarDataBR(s.date)}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <MultiSelect
                    options={[
                      { value: "Não iniciada", label: "Não iniciada" },
                      { value: "Em andamento", label: "Em andamento" },
                      { value: "Concluída", label: "Concluída" },
                    ]}
                    value={filterStatuses}
                    onChange={setFilterStatuses}
                    placeholder="Todos os status"
                  />
                </div>
                <div>
                  <Label className="text-xs">Item</Label>
                  <Input
                    value={filterItem}
                    onChange={(e) => setFilterItem(e.target.value)}
                    placeholder="1.1, 2.3"
                  />
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={filterDesc}
                      onChange={(e) => setFilterDesc(e.target.value)}
                      placeholder="Buscar..."
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">% Executado mín.</Label>
                  <Input
                    type="number"
                    value={filterPercMin}
                    onChange={(e) => setFilterPercMin(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">Execução</Label>
                  <MultiSelect
                    options={[
                      { value: "executado", label: "Executado" },
                      { value: "nao", label: "Não executado" },
                    ]}
                    value={filterExec}
                    onChange={setFilterExec}
                    placeholder="Todos"
                  />
                </div>
              </div>
            </Card>

            {(() => {
              const chips: { label: string; onRemove: () => void }[] = [];
              filterEtapas.forEach((e) => {
                const et = etapas.find((x) => x.item === e);
                chips.push({
                  label: `Etapa: ${et ? `${et.item} — ${et.descricao}` : e}`,
                  onRemove: () => setFilterEtapas(filterEtapas.filter((x) => x !== e)),
                });
              });
              filterStatuses.forEach((s) =>
                chips.push({
                  label: `Status: ${s}`,
                  onRemove: () => setFilterStatuses(filterStatuses.filter((x) => x !== s)),
                }),
              );
              filterExec.forEach((e) =>
                chips.push({
                  label: `Execução: ${e === "executado" ? "Executado" : "Não executado"}`,
                  onRemove: () => setFilterExec(filterExec.filter((x) => x !== e)),
                }),
              );
              if (filterMeasurement) {
                chips.push({
                  label: `Medição: BM-${String(filterMeasurement).padStart(2, "0")}`,
                  onRemove: () => setFilterMeasurement(""),
                });
              }
              if (filterItem.trim())
                chips.push({ label: `Item: ${filterItem}`, onRemove: () => setFilterItem("") });
              if (filterDesc.trim())
                chips.push({ label: `Descrição: ${filterDesc}`, onRemove: () => setFilterDesc("") });
              if (filterPercMin)
                chips.push({
                  label: `% mín: ${filterPercMin}`,
                  onRemove: () => setFilterPercMin(""),
                });
              if (chips.length === 0) return null;
              return (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                  {chips.map((c, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs"
                    >
                      {c.label}
                      <button
                        type="button"
                        onClick={c.onRemove}
                        className="hover:text-foreground opacity-70 hover:opacity-100"
                        aria-label="Remover filtro"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      setFilterEtapas([]);
                      setFilterStatuses([]);
                      setFilterExec([]);
                      setFilterItem("");
                      setFilterDesc("");
                      setFilterPercMin("");
                      setFilterMeasurement("");
                    }}
                  >
                    Limpar todos
                  </Button>
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                Exibindo <strong>{filteredRows.filter((r) => !r.isGroup).length}</strong> de{" "}
                {data.rows.filter((r) => !r.isGroup).length} serviços ·{" "}
                {data.rows.filter((r) => r.isGroup && r.level === 1).length} etapas
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={expandAll}>
                  <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expandir tudo
                </Button>
                <Button size="sm" variant="outline" onClick={collapseAll}>
                  <ChevronRight className="w-3.5 h-3.5 mr-1" /> Colapsar tudo
                </Button>
                <AddItemDialog etapas={etapas} onAdd={addCustomItem} />
              </div>
            </div>

            <ActivitiesTable
              rows={visibleRows}
              allRows={data.rows}
              evolutions={data.evolutions}
              onUpdate={updateEvolution}
              onAddDiary={addDiary}
              onRemove={removeCustomItem}
              collapsed={collapsed}
              onToggleCollapse={toggleCollapse}
              obraId={data.id}
              currentMeasurement={getCurrentMeasurement(data)}
              viewMeasurement={selectedBM ?? getCurrentMeasurement(data)}
            />

            <SignatureBlock info={info} municipio={info.municipio} />
          </TabsContent>


          <TabsContent value="diario">
            <DiaryPanel obraId={data.id} companyId={companyId} diaries={data.diaries} onUpdate={updateDiary} onRemove={removeDiary} />
          </TabsContent>


          <TabsContent value="documentos">
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando documentos…</div>}>
              <DocumentsTab obraId={data.id} />
            </Suspense>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
  icon,
  progress,
}: {
  label: string;
  value: string;
  tone?: "primary" | "success" | "measure" | "warning";
  icon?: "total" | "measure" | "trend" | "balance" | "percent";
  progress?: number;
}) {
  const toneClass =
    tone === "primary" ? "text-primary"
    : tone === "success" ? "text-success"
    : tone === "measure" ? "text-[var(--measure)]"
    : tone === "warning" ? "text-foreground"
    : "text-foreground";
  const iconBg =
    tone === "primary" ? "bg-primary/10 text-primary"
    : tone === "success" ? "bg-success/10 text-success"
    : tone === "measure" ? "bg-[var(--measure)]/10 text-[var(--measure)]"
    : tone === "warning" ? "bg-warning/20 text-foreground"
    : "bg-primary/10 text-primary";
  const Icon =
    icon === "measure" ? FileText
    : icon === "trend" ? CloudUpload
    : icon === "balance" ? Wrench
    : icon === "percent" ? CheckCircle2
    : Building2;
  return (
    <Card className="p-4 border-border shadow-[var(--shadow-card)] hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground font-medium leading-tight">{label}</div>
          <div className={`text-xl font-bold mt-1 leading-tight truncate ${toneClass}`}>{value}</div>
          {typeof progress === "number" && (
            <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-success transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function BMField({
  label,
  value,
  strong,
  wide,
  tone,
  progress,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  wide?: boolean;
  tone?: "primary" | "success" | "measure";
  progress?: number;
}) {
  const valueClass =
    tone === "primary" ? "text-primary"
    : tone === "success" ? "text-success"
    : tone === "measure" ? "text-[var(--measure)]"
    : "text-foreground";
  return (
    <div className={`px-3 py-2 ${wide ? "md:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`mt-1 ${strong ? "font-bold text-sm" : "text-sm font-medium"} ${valueClass} break-words whitespace-normal`} style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>{value}</div>
      {typeof progress === "number" && (
        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-success" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </div>
  );
}

function SignatureBlock({ info, municipio }: { info: ObraInfo; municipio?: string }) {
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const local = municipio ? `${municipio}${info.estado ? "/" + info.estado : ""}` : "____________________";
  return (
    <Card className="overflow-hidden border-border shadow-[var(--shadow-card)] p-0 print:break-inside-avoid">
      <div className="bg-primary text-primary-foreground px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em]">
        Assinaturas
      </div>
      <div className="px-6 py-6 space-y-8">
        <div className="text-xs text-foreground">
          {local}, {hoje}.
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10">
          <div className="text-center">
            <div className="border-t border-foreground/70 mx-6 mb-2" />
            <div className="text-sm font-bold uppercase">{info.responsavelTecnico || "____________________"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {info.cargoResponsavel || "Responsável Técnico"} {info.crea ? `• CREA/CAU ${info.crea}` : ""}
            </div>
            {info.artRrt ? <div className="text-[10px] text-muted-foreground">ART/RRT: {info.artRrt}</div> : null}
          </div>
          <div className="text-center">
            <div className="border-t border-foreground/70 mx-6 mb-2" />
            <div className="text-sm font-bold uppercase">{info.fiscal || "____________________"}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {info.cargoFiscal || "Fiscal da Obra"} {info.cpfFiscal ? `• CPF ${info.cpfFiscal}` : ""}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}



function ActivitiesTable({
  rows,
  allRows,
  evolutions,
  onUpdate,
  onAddDiary,
  onRemove,
  collapsed = {},
  onToggleCollapse,
  obraId,
  currentMeasurement,
  viewMeasurement,
}: {
  rows: BudgetRow[];
  allRows: BudgetRow[];
  evolutions: Record<string, Evolution>;
  onUpdate: (item: string, evo: Evolution) => void;
  onAddDiary: (e: DiaryEntry) => void;
  onRemove: (item: string) => void;
  collapsed?: Record<string, boolean>;
  onToggleCollapse?: (item: string) => void;
  obraId: string;
  currentMeasurement: number;
  viewMeasurement: number;
}) {
  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Nenhum item encontrado com os filtros aplicados.
      </Card>
    );
  }

  const projectTotal = allRows
    .filter((r) => !r.isGroup)
    .reduce((s, r) => s + (r.total || 0), 0);
  void allRows; // pesoOf removido — colunas peso/histórico não mais usadas


  // Total geral do contrato (usado em "Desvio %")
  const contratoTotal = projectTotal;
  // Acumulado financeiro do projeto até período anterior (medições fechadas) e total
  const tFinAnterior = allRows
    .filter((r) => !r.isGroup)
    .reduce((s, r) => {
      const list = evolutions[r.item]?.measurements ?? [];
      const qtdAnt = list
        .filter((m) => m.number < viewMeasurement)
        .reduce((a, m) => a + (m.quantExec || 0), 0);
      return s + qtdAnt * (r.valorUnitBDI || 0);
    }, 0);
  const tFinPeriodo = allRows
    .filter((r) => !r.isGroup)
    .reduce((s, r) => {
      const meas = evolutions[r.item]?.measurements?.find(
        (m) => m.number === viewMeasurement,
      );
      return s + (meas ? (meas.quantExec || 0) * (r.valorUnitBDI || 0) : 0);
    }, 0);
  const tFinAtual = tFinAnterior + tFinPeriodo;

  return (
    <Card className="overflow-hidden border-border shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 1400 }}>
          <colgroup>
            <col style={{ width: 70 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 70 }} />
            <col style={{ minWidth: 280 }} />
            <col style={{ width: 50 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 90 }} />
          </colgroup>
          <thead className="uppercase sticky top-0 z-10">
            <tr className="text-[10px] tracking-[0.15em]">
              <th colSpan={7} className="px-3 py-2 text-center border-b border-r border-border bg-primary text-primary-foreground font-bold">
                PLANEJAMENTO — ORÇAMENTO CONTRATADO
              </th>
              <th colSpan={3} className="px-3 py-2 text-center border-b border-r border-border bg-primary/80 text-primary-foreground font-bold">
                Valor Unit com BDI
              </th>
              <th colSpan={3} className="px-3 py-2 text-center border-b border-r border-border bg-primary/80 text-primary-foreground font-bold">
                Total
              </th>
              <th colSpan={3} className="px-3 py-2 text-center border-b border-r border-border bg-[var(--measure)] text-[var(--measure-foreground)] font-bold">
                EXECUTADO FÍSICO (Quantidade)
              </th>
              <th colSpan={3} className="px-3 py-2 text-center border-b border-r border-border bg-[var(--primary-soft)] text-primary-foreground font-bold">
                EXECUTADO FINANCEIRO (R$)
              </th>
              <th className="px-3 py-2 text-center border-b border-r border-border bg-success text-success-foreground font-bold">
                DESVIO
              </th>
              <th className="px-3 py-2 text-center border-b border-border bg-primary text-primary-foreground font-bold">
                AÇÕES
              </th>
            </tr>
            <tr className="bg-muted text-foreground text-[10px]">
              <th className="px-2 py-2 text-left border-b border-border">Item</th>
              <th className="px-2 py-2 text-left border-b border-border">Código</th>
              <th className="px-2 py-2 text-left border-b border-border">Banco</th>
              <th className="px-2 py-2 text-left border-b border-border sticky left-0 bg-muted z-[5]">Descrição</th>
              <th className="px-2 py-2 text-left border-b border-border">Und</th>
              <th className="px-2 py-2 text-right border-b border-border">Quant.</th>
              <th className="px-2 py-2 text-right border-b border-r border-border">Valor Unit</th>
              <th className="px-2 py-2 text-right border-b border-border">M.O.</th>
              <th className="px-2 py-2 text-right border-b border-border">MAT.</th>
              <th className="px-2 py-2 text-right border-b border-r border-border">Total</th>
              <th className="px-2 py-2 text-right border-b border-border">M.O.</th>
              <th className="px-2 py-2 text-right border-b border-border">MAT.</th>
              <th className="px-2 py-2 text-right border-r border-b border-border">Total</th>
              <th className="px-2 py-2 text-right border-b border-border bg-[var(--measure)]/10">Acum. anterior</th>
              <th className="px-2 py-2 text-right border-b border-border bg-[var(--measure)]/20">Período</th>
              <th className="px-2 py-2 text-right border-r border-b border-border bg-[var(--measure)]/10">Acum. atual</th>
              <th className="px-2 py-2 text-right border-b border-border bg-[var(--primary-soft)]/10">Acum. anterior</th>
              <th className="px-2 py-2 text-right border-b border-border bg-[var(--primary-soft)]/20">Período</th>
              <th className="px-2 py-2 text-right border-r border-b border-border bg-[var(--primary-soft)]/10">Acum. atual</th>
              <th className="px-2 py-2 text-right border-r border-b border-border bg-success/10">%</th>
              <th className="px-2 py-2 text-center border-b border-border">Ações</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => {
              if (r.isGroup) {
                const g = groupMetrics(r, allRows, evolutions);
                const isEtapa = r.level === 1;
                const isSub = r.level === 2;
                const indent = Math.max(0, r.level - 1) * 14;
                // Agregar acumulado anterior + período do grupo
                let gFinAnt = 0;
                let gFinPer = 0;
                let gMO = 0;
                let gMat = 0;
                for (const child of allRows) {
                  if (child.isGroup) continue;
                  if (child.item !== r.item && !child.item.startsWith(r.item + ".")) continue;
                  const list = evolutions[child.item]?.measurements ?? [];
                  const qAnt = list
                    .filter((m) => m.number < viewMeasurement)
                    .reduce((a, m) => a + (m.quantExec || 0), 0);
                  const meas = list.find((m) => m.number === viewMeasurement);
                  gFinAnt += qAnt * (child.valorUnitBDI || 0);
                  if (meas) gFinPer += (meas.quantExec || 0) * (child.valorUnitBDI || 0);
                  gMO += child.totalMO || 0;
                  gMat += child.totalMaterial || 0;
                }
                const gFinAtual = gFinAnt + gFinPer;
                const gDesvio = contratoTotal > 0 ? (gFinAtual / contratoTotal) * 100 : 0;
                const rowCls = isEtapa
                  ? "bg-primary/15 border-y-2 border-primary/30 font-bold text-primary"
                  : isSub
                    ? "bg-primary/8 border-t border-primary/20 font-semibold"
                    : "bg-muted/50 border-t font-medium";
                return (
                  <tr key={r.item} className={rowCls}>
                    <td
                      className="px-2 py-1.5 font-mono"
                      style={{ paddingLeft: 8 + indent }}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleCollapse?.(r.item)}
                        className="inline-flex items-center gap-1 hover:opacity-70 transition"
                        title={collapsed[r.item] ? "Expandir" : "Colapsar"}
                      >
                        {collapsed[r.item] ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{r.item}</span>
                      </button>
                    </td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5"></td>
                    <td
                      className={`px-2 py-1.5 sticky left-0 z-[4] ${rowCls} ${isEtapa ? "uppercase tracking-wide" : isSub ? "uppercase tracking-wide" : ""}`}
                      style={{ paddingLeft: 8 + indent }}
                    >
                      {r.descricao}
                    </td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 border-r border-border"></td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 border-r border-border"></td>
                    <td className="px-2 py-1.5 text-right">{gMO ? fmtBRL(gMO) : ""}</td>
                    <td className="px-2 py-1.5 text-right">{gMat ? fmtBRL(gMat) : ""}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border">{fmtBRL(g.total)}</td>
                    <td className="px-2 py-1.5 bg-[var(--measure)]/5"></td>
                    <td className="px-2 py-1.5 bg-[var(--measure)]/10"></td>
                    <td className="px-2 py-1.5 border-r border-border bg-[var(--measure)]/5"></td>
                    <td className="px-2 py-1.5 text-right bg-[var(--primary-soft)]/5">{fmtBRL(gFinAnt)}</td>
                    <td className="px-2 py-1.5 text-right bg-[var(--primary-soft)]/10 text-[var(--measure)] font-medium">{fmtBRL(gFinPer)}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border bg-[var(--primary-soft)]/5 text-[var(--success)] font-semibold">{fmtBRL(gFinAtual)}</td>
                    <td className="px-2 py-1.5 text-right border-r border-border bg-success/5 font-medium">{fmtNum(gDesvio)}%</td>
                    <td className="px-2 py-1.5 text-center">
                      {r.banco === "MANUAL" && (
                        <Button size="sm" variant="ghost" onClick={() => onRemove(r.item)} title="Remover">
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              }
              const indent = Math.max(0, r.level - 1) * 14;
              return (
                <ServiceRow
                  key={r.item}
                  row={r}
                  allRows={allRows}
                  evolution={evolutions[r.item]}
                  onUpdate={onUpdate}
                  onAddDiary={onAddDiary}
                  onRemove={onRemove}
                  indent={indent}
                  obraId={obraId}
                  currentMeasurement={currentMeasurement}
                  viewMeasurement={viewMeasurement}
                  contratoTotal={contratoTotal}
                />
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-primary text-primary-foreground font-bold uppercase tracking-wider text-[11px]">
              <td className="px-3 py-2.5" colSpan={12}>TOTAL GERAL</td>
              <td className="px-2 py-2.5 text-right border-r border-primary-foreground/20">{fmtBRL(contratoTotal)}</td>
              <td className="px-2 py-2.5 bg-[var(--measure)] text-[var(--measure-foreground)]" colSpan={3}></td>
              <td className="px-2 py-2.5 text-right bg-[var(--primary-soft)]">{fmtBRL(tFinAnterior)}</td>
              <td className="px-2 py-2.5 text-right bg-[var(--primary-soft)]">{fmtBRL(tFinPeriodo)}</td>
              <td className="px-2 py-2.5 text-right border-r border-primary-foreground/20 bg-[var(--primary-soft)]">{fmtBRL(tFinAtual)}</td>
              <td className="px-2 py-2.5 text-right border-r border-primary-foreground/20 bg-success text-success-foreground">
                {fmtNum(contratoTotal > 0 ? (tFinAtual / contratoTotal) * 100 : 0)}%
              </td>
              <td className="px-2 py-2.5" />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="border-t border-border bg-muted/40 px-4 py-3 flex items-start gap-2 text-[11px] text-muted-foreground">
        <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
        <span>
          Os valores desta medição estão de acordo com o cronograma físico-financeiro e com as condições contratuais estabelecidas.
        </span>
      </div>
    </Card>
  );
}




function ServiceRow({
  row,
  allRows,
  evolution,
  onUpdate,
  onAddDiary,
  onRemove,
  indent = 0,
  obraId,
  currentMeasurement,
  viewMeasurement,
  contratoTotal,
}: {
  row: BudgetRow;
  allRows: BudgetRow[];
  evolution?: Evolution;
  onUpdate: (item: string, evo: Evolution) => void;
  onAddDiary: (e: DiaryEntry) => void;
  onRemove?: (item: string) => void;
  indent?: number;
  obraId: string;
  currentMeasurement: number;
  viewMeasurement: number;
  contratoTotal: number;
}) {
  const a = activityMetrics(row, evolution);
  const allMeasurements = a.measurements;
  // Acumulado de medições com número < viewMeasurement (igual à lógica do PDF/Excel).
  const qtdAnterior = allMeasurements
    .filter((m) => m.number < viewMeasurement)
    .reduce((s, m) => s + (m.quantExec || 0), 0);
  // Medição exibida (pode ser histórica fechada ou a em aberto).
  const viewedMeas = allMeasurements.find((m) => m.number === viewMeasurement);
  const periodoQty = viewedMeas?.quantExec || 0;
  // Edição liberada somente quando a medição em visualização é a aberta atual.
  const isEditable = viewMeasurement === currentMeasurement && (!viewedMeas || !viewedMeas.closed);
  const closedSumForCommit = allMeasurements
    .filter((m) => m.closed)
    .reduce((s, m) => s + (m.quantExec || 0), 0);
  const [qty, setQty] = useState(periodoQty ? String(periodoQty) : "");

  useEffect(() => {
    setQty(periodoQty ? String(periodoQty) : "");
  }, [periodoQty]);

  function commit(periodo: number) {
    const p = Math.max(0, periodo);
    const newAcc = closedSumForCommit + p;
    if (Math.abs(p - periodoQty) < 1e-6) return;
    if (row.quantidade > 0 && newAcc > row.quantidade + 1e-6) {
      toast.warning(`Acumulado limitado ao total previsto: ${fmtNum(row.quantidade)} ${row.und}.`);
    }
    const { evo } = setAccumulatedQty(evolution, row, newAcc, currentMeasurement);
    onUpdate(row.item, evo);
  }
  function onQtyBlur() {
    const trimmed = qty.trim();
    if (trimmed === "") { commit(0); return; }
    commit(parseFloat(trimmed.replace(",", ".")) || 0);
  }

  const vu = row.valorUnitBDI || 0;
  const qtdAtual = qtdAnterior + periodoQty;
  const finAnterior = qtdAnterior * vu;
  const finPeriodo = periodoQty * vu;
  const finAtual = qtdAtual * vu;
  const desvio = contratoTotal > 0 ? (finAtual / contratoTotal) * 100 : 0;

  const excesso = a.quantExec - row.quantidade;
  const temExcesso = row.quantidade > 0 && excesso > 0.0001;

  return (
    <>
      <tr className="border-t hover:bg-muted/30">
        <td className="px-2 py-1.5 font-mono whitespace-nowrap" style={{ paddingLeft: 8 + indent }}>
          {row.item}
        </td>
        <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{row.codigo || ""}</td>
        <td className="px-2 py-1.5 text-[11px]">{row.banco && row.banco !== "MANUAL" ? row.banco : ""}</td>
        <td className="px-2 py-1.5 sticky left-0 bg-card z-[4]" style={{ paddingLeft: 8 + indent }}>
          {row.descricao}
        </td>
        <td className="px-2 py-1.5">{row.und}</td>
        <td className="px-2 py-1.5 text-right">{row.quantidade ? fmtNum(row.quantidade) : ""}</td>
        <td className="px-2 py-1.5 text-right border-r border-border">{row.valorUnit ? fmtBRL(row.valorUnit) : ""}</td>
        <td className="px-2 py-1.5 text-right">{row.valorUnitMO ? fmtBRL(row.valorUnitMO) : ""}</td>
        <td className="px-2 py-1.5 text-right">{row.valorUnitMaterial ? fmtBRL(row.valorUnitMaterial) : ""}</td>
        <td className="px-2 py-1.5 text-right border-r border-border">{vu ? fmtBRL(vu) : ""}</td>
        <td className="px-2 py-1.5 text-right">{row.totalMO ? fmtBRL(row.totalMO) : ""}</td>
        <td className="px-2 py-1.5 text-right">{row.totalMaterial ? fmtBRL(row.totalMaterial) : ""}</td>
        <td className="px-2 py-1.5 text-right font-medium border-r border-border">{fmtBRL(row.total)}</td>
        <td className="px-2 py-1.5 text-right bg-[var(--measure)]/5 text-muted-foreground">
          {qtdAnterior > 0 ? fmtNum(qtdAnterior) : "—"}
        </td>
        <td className="px-1 py-1 bg-[var(--measure)]/10">
          {!isEditable ? (
            <div
              className="h-7 flex items-center justify-end px-2 text-right text-xs rounded bg-muted text-muted-foreground cursor-not-allowed select-none"
              title={viewedMeas?.closed ? "Medição bloqueada (fechada)" : "Selecione a medição em aberto para editar"}
            >
              {periodoQty > 0 ? fmtNum(periodoQty) : "—"}
            </div>
          ) : row.quantidade > 0 && qtdAnterior >= row.quantidade - 1e-6 ? (
            <div
              className="h-7 flex items-center justify-end px-2 text-right text-xs rounded bg-muted text-muted-foreground cursor-not-allowed select-none"
              title="Item concluído — campo bloqueado"
            >
              —
            </div>
          ) : (
            <Input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onBlur={onQtyBlur}
              inputMode="decimal"
              className="h-7 text-right text-xs bg-card"
              placeholder="0"
            />
          )}
        </td>

        <td className="px-2 py-1.5 text-right font-semibold border-r border-border bg-[var(--measure)]/5">
          {qtdAtual > 0 ? fmtNum(qtdAtual) : "—"}
        </td>
        <td className="px-2 py-1.5 text-right bg-[var(--primary-soft)]/5 text-muted-foreground">{fmtBRL(finAnterior)}</td>
        <td className="px-2 py-1.5 text-right bg-[var(--primary-soft)]/10 text-[var(--measure)] font-medium">{fmtBRL(finPeriodo)}</td>
        <td className="px-2 py-1.5 text-right font-semibold border-r border-border bg-[var(--primary-soft)]/5 text-[var(--success)]">{fmtBRL(finAtual)}</td>
        <td className="px-2 py-1.5 text-right font-medium border-r border-border bg-success/5">{fmtNum(desvio)}%</td>
        <td className="px-2 py-1.5 text-center">
          <div className="flex items-center justify-center gap-1">
            <Badge variant={statusVariant(a.status)} className="text-[9px] hidden xl:inline-flex">
              {a.status}
            </Badge>
            <EvolutionDialog
              row={row}
              allRows={allRows}
              evolution={evolution}
              onSave={(e) => onUpdate(row.item, e)}
              onAddDiary={onAddDiary}
              obraId={obraId}
            />
            {row.banco === "MANUAL" && onRemove && (
              <Button size="sm" variant="ghost" onClick={() => onRemove(row.item)} title="Remover serviço">
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {temExcesso && (
        <tr className="border-t bg-destructive/10 text-destructive text-[11px]">
          <td className="px-2 py-1 font-mono" style={{ paddingLeft: 8 + indent }}>{row.item}</td>
          <td className="px-2 py-1"></td>
          <td className="px-2 py-1"></td>
          <td className="px-2 py-1 sticky left-0 bg-destructive/10 z-[4] font-medium" style={{ paddingLeft: 8 + indent }}>
            ⚠ EXCESSO ({row.quantidade > 0 ? fmtNum((excesso / row.quantidade) * 100) : "0,00"}% acima do previsto)
          </td>
          <td className="px-2 py-1">{row.und}</td>
          <td className="px-2 py-1 text-right font-semibold">{fmtNum(excesso)}</td>
          <td className="px-2 py-1 text-right border-r border-border">{vu ? fmtBRL(vu) : ""}</td>
          <td className="px-2 py-1" colSpan={3}></td>
          <td className="px-2 py-1" colSpan={2}></td>
          <td className="px-2 py-1 text-right font-semibold border-r border-border">{fmtBRL(excesso * vu)}</td>
          <td colSpan={8} className="px-2 py-1 text-right">
            <Badge variant="destructive" className="text-[10px]">EXCEDIDO</Badge>
          </td>
        </tr>
      )}
    </>
  );
}


function EvolutionDialog({
  row,
  allRows,
  evolution,
  onSave,
  onAddDiary,
  obraId,
}: {
  row: BudgetRow;
  allRows: BudgetRow[];
  evolution?: Evolution;
  onSave: (e: Evolution) => void;
  onAddDiary: (e: DiaryEntry) => void;
  obraId: string;
}) {
  const [open, setOpen] = useState(false);
  const { company: dialogCompany } = useCompany();
  const metrics = activityMetrics(row, evolution);
  const measurements = metrics.measurements;
  const closedMeasurements = measurements.filter((m) => m.closed);
  const openMeasurement = metrics.openMeasurement;
  const nextNumber = (measurements.reduce((max, m) => Math.max(max, m.number), 0) || 0) + (openMeasurement ? 0 : 1);
  const closedAccum = closedMeasurements.reduce((s, m) => s + (m.quantExec || 0), 0);
  const maxPeriodo = Math.max(0, row.quantidade - closedAccum);

  // Estado local da medição em aberto (editável).
  const [periodo, setPeriodo] = useState<string>("");
  const [percentInput, setPercentInput] = useState<string>("");
  const [dataExec, setDataExec] = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState("");

  // diary
  const [criarDiario, setCriarDiario] = useState(true);
  const [clima, setClima] = useState("Bom");
  const [equipe, setEquipe] = useState("");
  const [equipamentos, setEquipamentos] = useState("");
  const [diarioObs, setDiarioObs] = useState("");
  const [horaInicio, setHoraInicio] = useState("07:00");
  const [horaFim, setHoraFim] = useState("17:00");
  const [statusDia, setStatusDia] = useState<DiaryEntry["statusDia"]>("Normal");
  const [pendencias, setPendencias] = useState("");
  const [fotos, setFotos] = useState<DiaryPhoto[]>([]);
  const [maoObraLinhas, setMaoObraLinhas] = useState<import("@/lib/types").MaoObraLinha[]>([]);
  const [equipamentoLinhas, setEquipamentoLinhas] = useState<import("@/lib/types").EquipamentoLinha[]>([]);
  const [funcoesDb, setFuncoesDb] = useState<Array<{ id: string; nome: string; custo_hora_base: number }>>([]);
  const [equipamentosDb, setEquipamentosDb] = useState<Array<{ id: string; nome: string; custo_hora: number }>>([]);
  const itensOrcamento = useMemo(
    () => allRows.filter((r) => !r.isGroup).map((r) => ({ codigo: r.item, descricao: r.descricao })),
    [allRows],
  );

  useEffect(() => {
    if (open) {
      const q = openMeasurement?.quantExec ?? 0;
      setPeriodo(q ? String(q) : "");
      setPercentInput(
        q && row.quantidade > 0 ? ((q / row.quantidade) * 100).toFixed(2) : "",
      );
      setDataExec(openMeasurement?.dataExec ?? new Date().toISOString().slice(0, 10));
      setObs(openMeasurement?.observacoes ?? "");
      setFotos([]);
      setPendencias("");
      setStatusDia("Normal");
      setMaoObraLinhas([]);
      setEquipamentoLinhas([]);
      if (dialogCompany) {
        const loadFuncoes = async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any;
          let { data } = await sb
            .from("funcoes_mao_obra")
            .select("id, nome, custo_hora_base")
            .eq("company_id", dialogCompany.id)
            .eq("ativo", true)
            .order("nome");
          if (!data || data.length === 0) {
            await sb.rpc("seed_funcoes_base", { _company: dialogCompany.id });
            ({ data } = await sb
              .from("funcoes_mao_obra")
              .select("id, nome, custo_hora_base")
              .eq("company_id", dialogCompany.id)
              .eq("ativo", true)
              .order("nome"));
          }
          setFuncoesDb(data ?? []);
        };
        const loadEquip = async () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sb = supabase as any;
          let { data } = await sb
            .from("equipamentos")
            .select("id, nome, custo_hora")
            .eq("company_id", dialogCompany.id)
            .eq("ativo", true)
            .order("nome");
          if (!data || data.length === 0) {
            await sb.rpc("seed_equipamentos_base", { _company: dialogCompany.id });
            ({ data } = await sb
              .from("equipamentos")
              .select("id, nome, custo_hora")
              .eq("company_id", dialogCompany.id)
              .eq("ativo", true)
              .order("nome"));
          }
          setEquipamentosDb(data ?? []);
        };
        loadFuncoes();
        loadEquip();
      }

    }
  }, [open, openMeasurement, row.quantidade, dialogCompany]);

  function handleQuant(v: string) {
    setPeriodo(v);
    const n = parseFloat(v.replace(",", "."));
    if (isNaN(n) || !v.trim()) {
      setPercentInput("");
    } else if (row.quantidade > 0) {
      setPercentInput(((n / row.quantidade) * 100).toFixed(2));
    }
  }
  function handlePercent(v: string) {
    setPercentInput(v);
    const n = parseFloat(v.replace(",", "."));
    if (isNaN(n) || !v.trim()) {
      setPeriodo("");
    } else {
      setPeriodo(((n / 100) * row.quantidade).toFixed(4));
    }
  }

  /** Constrói o novo Evolution com a medição aberta atualizada. */
  function buildEvolution(closeIt: boolean): { evo: Evolution; periodo: number } {
    let q = parseFloat(periodo.replace(",", ".")) || 0;
    if (q < 0) q = 0;
    if (row.quantidade > 0 && q > maxPeriodo + 1e-6) {
      q = maxPeriodo;
      toast.warning(
        `Limitado a ${fmtNum(maxPeriodo)} ${row.und} (acumulado não pode exceder ${fmtNum(row.quantidade)}).`,
      );
    }
    const nowIso = new Date().toISOString();
    let novaLista: Measurement[];
    if (openMeasurement) {
      novaLista = measurements.map((m) =>
        m.id === openMeasurement.id
          ? {
              ...m,
              quantExec: q,
              dataExec,
              observacoes: obs,
              closed: closeIt,
              closedAt: closeIt ? nowIso : undefined,
            }
          : m,
      );
    } else {
      novaLista = [
        ...measurements,
        {
          id: crypto.randomUUID(),
          number: nextNumber,
          quantExec: q,
          dataExec,
          observacoes: obs,
          closed: closeIt,
          closedAt: closeIt ? nowIso : undefined,
        },
      ];
    }
    // Ao fechar, cria automaticamente a próxima medição em aberto (se ainda houver saldo).
    if (closeIt) {
      const totalAcumulado = novaLista.reduce((s, m) => s + (m.quantExec || 0), 0);
      const saldo = row.quantidade > 0 ? row.quantidade - totalAcumulado : 1;
      if (saldo > 1e-6) {
        novaLista = [
          ...novaLista,
          {
            id: crypto.randomUUID(),
            number: novaLista.reduce((max, m) => Math.max(max, m.number), 0) + 1,
            quantExec: 0,
            dataExec: new Date().toISOString().slice(0, 10),
            observacoes: "",
            closed: false,
          },
        ];
      }
    }
    return { evo: { measurements: novaLista }, periodo: q };
  }

  async function gerarDiario(q: number) {
    if (!criarDiario || q <= 0) return;
    const etapa = (() => {
      const top = row.item.split(".")[0];
      const g = allRows.find((r) => r.item === top && r.isGroup);
      return g ? `${g.item} — ${g.descricao}` : row.item;
    })();
    const texto = await gerarTextoDiario({
      etapa,
      descricao: row.descricao,
      quantExec: q,
      unidade: row.und,
      quantTotal: row.quantidade,
    });
    const equipeAuto = maoObraLinhas.length > 0
      ? maoObraLinhas.map((l) => `${l.quantidade} ${l.funcaoNome}`).join(", ")
      : equipe;
    const equipAuto = equipamentoLinhas.length > 0
      ? equipamentoLinhas.map((l) => `${l.quantidade} ${l.equipamentoNome}`).join(", ")
      : equipamentos;
    onAddDiary({
      id: crypto.randomUUID(),
      itemKey: row.item,
      data: dataExec,
      horaInicio,
      horaFim,
      statusDia,
      clima,
      equipe: equipeAuto,
      equipamentos: equipAuto,
      pendencias,
      observacoes: diarioObs,
      quantExec: q,
      etapa,
      atividade: row.descricao,
      texto,
      fotos,
      maoObraLinhas,
      equipamentoLinhas,
      createdAt: new Date().toISOString(),
    });
  }

  function salvarParcial() {
    const qPrev = parseFloat(periodo.replace(",", ".")) || 0;
    if (qPrev <= 0) {
      const ok = confirm(
        "A quantidade executada está em 0. Nenhum avanço será registrado nesta medição. Deseja continuar mesmo assim?",
      );
      if (!ok) return;
    }
    const { evo, periodo: q } = buildEvolution(false);
    onSave(evo);
    gerarDiario(q);
    toast.success(criarDiario && q > 0 ? "Medição e diário registrados" : "Medição registrada");
    setOpen(false);
  }

  function fecharMedicao() {
    const numero = openMeasurement?.number ?? nextNumber;
    const ok = confirm(
      `Fechar a Medição ${numero}? Após o fechamento, os dados não poderão mais ser alterados.`,
    );
    if (!ok) return;
    const { evo, periodo: q } = buildEvolution(true);
    onSave(evo);
    gerarDiario(q);
    toast.success(`Medição ${numero} fechada. Próxima medição criada automaticamente.`);
    setOpen(false);
  }

  const periodoNum = parseFloat(periodo.replace(",", ".")) || 0;
  const acumuladoPrev = closedAccum + Math.max(0, Math.min(periodoNum, maxPeriodo));
  const percentPrev = row.quantidade > 0 ? (acumuladoPrev / row.quantidade) * 100 : 0;
  const valorPrev = (percentPrev / 100) * (row.total || 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="w-3 h-3 mr-1" /> Lançar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {row.item} — {row.descricao}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm bg-muted/50 p-3 rounded-md">
            <div>
              <div className="text-muted-foreground text-xs">Quant. total</div>
              <div className="font-medium">
                {fmtNum(row.quantidade)} {row.und}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Valor total</div>
              <div className="font-medium">{fmtBRL(row.total)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">V. Unit. c/ BDI</div>
              <div className="font-medium">{fmtBRL(row.valorUnitBDI || row.valorUnit)}</div>
            </div>
          </div>

          {/* Histórico de medições */}
          {measurements.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Medição</th>
                    <th className="px-2 py-1.5 text-right" title="Calculado automaticamente">
                      Acum. Anterior 🔒
                    </th>
                    <th className="px-2 py-1.5 text-right bg-[var(--measure)]/10">Período</th>
                    <th className="px-2 py-1.5 text-right" title="Calculado automaticamente">
                      Acum. Atual 🔒
                    </th>
                    <th className="px-2 py-1.5 text-right">% Acum.</th>
                    <th className="px-2 py-1.5 text-right">Valor Acum.</th>
                    <th className="px-2 py-1.5 text-center">Status</th>
                    <th className="px-2 py-1.5 text-left">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let running = 0;
                    return [...measurements]
                      .sort((a, b) => a.number - b.number)
                      .map((m) => {
                        const acumAnt = running;
                        const periodo = m.quantExec || 0;
                        const acumAtual = acumAnt + periodo;
                        running = acumAtual;
                        const pct = row.quantidade > 0 ? (acumAtual / row.quantidade) * 100 : 0;
                        const val = (pct / 100) * (row.total || 0);
                        return (
                          <tr key={m.id} className="border-t">
                            <td className="px-2 py-1.5 font-medium">BM-{String(m.number).padStart(2, "0")}</td>
                            <td className="px-2 py-1.5 text-right text-muted-foreground">
                              {m.number === 1 ? "—" : `${fmtNum(acumAnt)} ${row.und}`}
                            </td>
                            <td className="px-2 py-1.5 text-right bg-[var(--measure)]/5">
                              {fmtNum(periodo)} {row.und}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold">
                              {fmtNum(acumAtual)} {row.und}
                            </td>
                            <td className="px-2 py-1.5 text-right">{fmtNum(pct)}%</td>
                            <td className="px-2 py-1.5 text-right">{fmtBRL(val)}</td>
                            <td className="px-2 py-1.5 text-center">
                              {m.closed ? (
                                <Badge variant="outline" className="text-[10px]">🔒 Bloqueada</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Em aberto</Badge>
                              )}
                            </td>
                            <td className="px-2 py-1.5">{m.dataExec ? fmtDate(m.dataExec) : "—"}</td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
              <div className="px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/30 border-t">
                Apenas <strong>Período</strong> é editável. <strong>Acum. Anterior</strong> e <strong>Acum. Atual</strong> são calculados automaticamente
                (BM-01: Acum. Anterior = 0, Acum. Atual = Período; BM-02+: Acum. Anterior = Acum. Atual da medição anterior, Acum. Atual = Acum. Anterior + Período).
              </div>
            </div>
          )}

          {/* Editor da medição em aberto */}
          <div className="border rounded-md p-3 bg-primary/5">
            <div className="text-sm font-semibold mb-2">
              {openMeasurement ? `Editando Medição M${openMeasurement.number}` : `Nova Medição M${nextNumber}`}
              <span className="ml-2 text-xs text-muted-foreground">
                · Saldo disponível: {fmtNum(maxPeriodo)} {row.und}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Quantidade desta medição</Label>
                <Input value={periodo} onChange={(e) => handleQuant(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label>% Executado nesta medição</Label>
                <Input value={percentInput} onChange={(e) => handlePercent(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label>Data da execução</Label>
                <Input type="date" value={dataExec} onChange={(e) => setDataExec(e.target.value)} />
              </div>
            </div>
            <div className="mt-3">
              <Label>Observações desta medição</Label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
            </div>
          </div>

          {/* Acumulado previsto após salvar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-sm bg-muted/40 p-3 rounded-md">
            <div>
              <div className="text-muted-foreground text-xs">Qtd. Acumulada</div>
              <div className="font-medium">{fmtNum(acumuladoPrev)} {row.und}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">% Acumulado</div>
              <div className="font-medium">{fmtNum(percentPrev)}%</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Valor Acumulado</div>
              <div className="font-medium">{fmtBRL(valorPrev)}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Qtd. Restante</div>
              <div className="font-medium">{fmtNum(Math.max(0, row.quantidade - acumuladoPrev))} {row.und}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Valor Restante</div>
              <div className="font-medium">{fmtBRL(Math.max(0, (row.total || 0) - valorPrev))}</div>
            </div>
          </div>


          <div className="border-t pt-4">
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={criarDiario}
                onChange={(e) => setCriarDiario(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="font-semibold">Registrar entrada no diário de obra</span>
            </label>
            {criarDiario && (
              <div className="space-y-4 bg-muted/30 rounded-lg p-4 border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Clima</Label>
                    <Select value={clima} onValueChange={setClima}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Ensolarado">☀️ Ensolarado</SelectItem>
                        <SelectItem value="Bom">🌤️ Bom</SelectItem>
                        <SelectItem value="Nublado">☁️ Nublado</SelectItem>
                        <SelectItem value="Chuvoso">🌧️ Chuvoso</SelectItem>
                        <SelectItem value="Chuva forte">⛈️ Chuva forte</SelectItem>
                        <SelectItem value="Garoa">🌦️ Garoa</SelectItem>
                        <SelectItem value="Impraticável">🚫 Impraticável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Período trabalhado</Label>
                    <Select
                      value={
                        (diarioObs.match(/Período: (Manhã|Tarde|Dia todo|Noite)/)?.[1] as string) ??
                        "Dia todo"
                      }
                      onValueChange={(v) => {
                        const cleaned = diarioObs.replace(/Período: [^\n]*\n?/g, "");
                        setDiarioObs(`Período: ${v}\n${cleaned}`.trim());
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Manhã">🌅 Manhã</SelectItem>
                        <SelectItem value="Tarde">🌇 Tarde</SelectItem>
                        <SelectItem value="Dia todo">🌞 Dia todo</SelectItem>
                        <SelectItem value="Noite">🌙 Noite</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <ResourceLinesEditor
                  titulo="Equipe presente (custo lançado no Realizado)"
                  tipo="mao_obra"
                  linhas={maoObraLinhas}
                  onChange={setMaoObraLinhas}
                  opcoes={funcoesDb.map((f) => ({ id: f.id, nome: f.nome, custoHora: Number(f.custo_hora_base) || 0 }))}
                  itens={itensOrcamento}
                  itemPadrao={row.item}
                />

                <ResourceLinesEditor
                  titulo="Equipamentos utilizados"
                  tipo="equipamento"
                  linhas={equipamentoLinhas}
                  onChange={setEquipamentoLinhas}
                  opcoes={equipamentosDb.map((e) => ({ id: e.id, nome: e.nome, custoHora: Number(e.custo_hora) || 0 }))}
                  itens={itensOrcamento}
                  itemPadrao={row.item}
                />


                {/* Texto livre adicional (opcional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Equipe (texto livre)</Label>
                    <Input value={equipe} onChange={(e) => setEquipe(e.target.value)} placeholder="Observações da equipe" />
                  </div>
                  <div>
                    <Label className="text-xs">Equipamentos (texto livre)</Label>
                    <Input value={equipamentos} onChange={(e) => setEquipamentos(e.target.value)} placeholder="Observações dos equipamentos" />
                  </div>
                </div>


                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Hora início</Label>
                    <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Hora término</Label>
                    <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Status do dia</Label>
                    <Select value={statusDia} onValueChange={(v) => setStatusDia(v as DiaryEntry["statusDia"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Chuva">Chuva</SelectItem>
                        <SelectItem value="Paralisação">Paralisação</SelectItem>
                        <SelectItem value="Atraso">Atraso</SelectItem>
                        <SelectItem value="Feriado">Feriado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Observações do diário</Label>
                  <Textarea
                    value={diarioObs}
                    onChange={(e) => setDiarioObs(e.target.value)}
                    placeholder="Ocorrências, paralisações, visitas, entregas..."
                    rows={3}
                  />
                </div>
                <div>
                  <Label className="text-xs">Pendências</Label>
                  <Textarea
                    value={pendencias}
                    onChange={(e) => setPendencias(e.target.value)}
                    placeholder="Pendências para o próximo dia..."
                    rows={2}
                  />
                </div>

                <div className="border-t pt-3">
                  <Label className="text-xs mb-2 block">Fotos e vídeos do serviço</Label>
                  <PhotoUploader obraId={obraId} companyId={dialogCompany?.id ?? ""} photos={fotos} onChange={setFotos} compact />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={salvarParcial}>
            Salvar lançamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiaryPanel({
  obraId,
  companyId,
  diaries,
  onUpdate,
  onRemove,
}: {
  obraId: string;
  companyId: string;
  diaries: DiaryEntry[];
  onUpdate: (e: DiaryEntry) => void;
  onRemove: (id: string) => void;
}) {

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return diaries.filter((d) => {
      if (from && d.data < from) return false;
      if (to && d.data > to) return false;
      return true;
    });
  }, [diaries, from, to]);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button
          variant="outline"
          onClick={() => exportDiarioPdf(filtered, "Relatório de Diário de Obra")}
          disabled={filtered.length === 0}
        >
          <FileText className="w-4 h-4 mr-1" /> Exportar PDF do período
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} registro(s)
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
          Nenhum registro de diário ainda. Lance evolução em uma atividade para gerar.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DiaryCard key={d.id} obraId={obraId} companyId={companyId} entry={d} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>

      )}
    </div>
  );
}

function DiaryCard({
  obraId,
  companyId,
  entry,
  onUpdate,
  onRemove,
}: {
  obraId: string;
  companyId: string;
  entry: DiaryEntry;
  onUpdate: (e: DiaryEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [e, setE] = useState(entry);
  const [funcoesDb, setFuncoesDb] = useState<Array<{ id: string; nome: string; custo_hora_base: number }>>([]);
  const [equipDb, setEquipDb] = useState<Array<{ id: string; nome: string; custo_hora: number }>>([]);

  useEffect(() => {
    if (!editing || !companyId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabase as any;
    sb.from("funcoes_mao_obra").select("id, nome, custo_hora_base").eq("company_id", companyId).eq("ativo", true).order("nome")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setFuncoesDb(data ?? []));
    sb.from("equipamentos").select("id, nome, custo_hora").eq("company_id", companyId).eq("ativo", true).order("nome")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setEquipDb(data ?? []));
  }, [editing, companyId]);

  function save() {
    onUpdate(e);
    setEditing(false);
    toast.success("Diário atualizado");
  }

  const fotos = entry.fotos ?? [];


  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold text-foreground">{entry.etapa}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>{fmtDate(entry.data)}</span>
            <span>· Item {entry.itemKey} · {entry.atividade}</span>
            {entry.statusDia && <span>· {entry.statusDia}</span>}
            {(entry.horaInicio || entry.horaFim) && (
              <span>· {entry.horaInicio || "--"} às {entry.horaFim || "--"}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setEditing(!editing)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => exportDiarioPdf([entry], `Diário ${entry.data}`)}
          >
            <FileText className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Excluir este diário?")) onRemove(entry.id);
            }}
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={e.data} onChange={(ev) => setE({ ...e, data: ev.target.value })} />
            </div>
            <div>
              <Label>Clima</Label>
              <Input value={e.clima} onChange={(ev) => setE({ ...e, clima: ev.target.value })} />
            </div>
            <div>
              <Label>Equipe</Label>
              <Input value={e.equipe} onChange={(ev) => setE({ ...e, equipe: ev.target.value })} />
            </div>
            <div>
              <Label>Equipamentos</Label>
              <Input
                value={e.equipamentos}
                onChange={(ev) => setE({ ...e, equipamentos: ev.target.value })}
              />
            </div>
            <div>
              <Label>Hora início</Label>
              <Input type="time" value={e.horaInicio ?? ""} onChange={(ev) => setE({ ...e, horaInicio: ev.target.value })} />
            </div>
            <div>
              <Label>Hora fim</Label>
              <Input type="time" value={e.horaFim ?? ""} onChange={(ev) => setE({ ...e, horaFim: ev.target.value })} />
            </div>
          </div>
          <div>
            <Label>Texto do diário</Label>
            <Textarea
              rows={5}
              value={e.texto}
              onChange={(ev) => setE({ ...e, texto: ev.target.value })}
            />
          </div>
          <div>
            <Label>Pendências</Label>
            <Textarea
              value={e.pendencias ?? ""}
              onChange={(ev) => setE({ ...e, pendencias: ev.target.value })}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              value={e.observacoes}
              onChange={(ev) => setE({ ...e, observacoes: ev.target.value })}
            />
          </div>
          <div>
            <Label>Fotos / vídeos</Label>
            <PhotoUploader
              obraId={obraId}
              companyId={companyId}
              photos={e.fotos ?? []}
              onChange={(photos) => setE({ ...e, fotos: photos })}
            />
          </div>
          <ResourceLinesEditor
            titulo="Equipe presente (custo lançado no Realizado)"
            tipo="mao_obra"
            linhas={e.maoObraLinhas ?? []}
            onChange={(linhas) => setE({ ...e, maoObraLinhas: linhas })}
            opcoes={funcoesDb.map((f) => ({ id: f.id, nome: f.nome, custoHora: Number(f.custo_hora_base) || 0 }))}
            itens={[]}
            itemPadrao={e.itemKey}
          />
          <ResourceLinesEditor
            titulo="Equipamentos utilizados"
            tipo="equipamento"
            linhas={e.equipamentoLinhas ?? []}
            onChange={(linhas) => setE({ ...e, equipamentoLinhas: linhas })}
            opcoes={equipDb.map((eq) => ({ id: eq.id, nome: eq.nome, custoHora: Number(eq.custo_hora) || 0 }))}
            itens={[]}
            itemPadrao={e.itemKey}
          />
          <Button onClick={save}>Salvar alterações</Button>

        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5 mb-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <CloudSun className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground">Clima:</span>
              <span>{entry.clima || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground">Equipe:</span>
              <span>{entry.equipe || "-"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wrench className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium text-foreground">Equipamentos:</span>
              <span>{entry.equipamentos || "-"}</span>
            </div>
          </div>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{entry.texto}</p>
          {entry.pendencias && (
            <div className="flex items-start gap-2 mt-3 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
              <StickyNote className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-foreground"><span className="font-medium">Pendências:</span> {entry.pendencias}</p>
            </div>
          )}
          {entry.observacoes && (
            <div className="flex items-start gap-2 mt-3 p-2 rounded-md bg-muted/40 border border-border/50">
              <StickyNote className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm italic text-muted-foreground">{entry.observacoes}</p>
            </div>
          )}
          {fotos.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Registro fotográfico ({fotos.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {fotos.map((f) => (
                  <a
                    key={f.id}
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group block rounded-md overflow-hidden border border-border/60 bg-muted/30"
                  >
                    {f.tipo === "video" ? (
                      <video src={f.url} className="w-full h-28 object-cover" />
                    ) : (
                      <img
                        src={f.url}
                        alt={f.legenda || "foto"}
                        loading="lazy"
                        className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                    <div className="px-1.5 py-1 text-[10px] text-muted-foreground truncate">
                      {f.hora}{f.legenda ? ` · ${f.legenda}` : ""}
                      {f.tipo && f.tipo !== "geral" && f.tipo !== "video" ? ` · ${f.tipo}` : ""}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function AddItemDialog({
  etapas,
  onAdd,
}: {
  etapas: BudgetRow[];
  onAdd: (
    parentItem: string | null,
    descricao: string,
    opts: { und?: string; quantidade?: number; valorUnit?: number },
  ) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"etapa" | "servico">("servico");
  const [parent, setParent] = useState<string>(etapas[0]?.item ?? "");
  const [descricao, setDescricao] = useState("");
  const [und, setUnd] = useState("un");
  const [quant, setQuant] = useState("");
  const [vu, setVu] = useState("");

  useEffect(() => {
    if (open) {
      setTipo("servico");
      setParent(etapas[0]?.item ?? "");
      setDescricao("");
      setUnd("un");
      setQuant("");
      setVu("");
    }
  }, [open, etapas]);

  function save() {
    if (!descricao.trim()) {
      toast.error("Informe a descrição.");
      return;
    }
    if (tipo === "servico" && !parent) {
      toast.error("Selecione a etapa.");
      return;
    }
    onAdd(tipo === "etapa" ? null : parent, descricao.trim(), {
      und: und.trim() || "un",
      quantidade: parseFloat(quant.replace(",", ".")) || 0,
      valorUnit: parseFloat(vu.replace(",", ".")) || 0,
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-1" /> Adicionar etapa/serviço
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar item manual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as "etapa" | "servico")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="etapa">Nova etapa</SelectItem>
                <SelectItem value="servico">Novo serviço (em uma etapa)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "servico" && (
            <div>
              <Label>Etapa</Label>
              <Select value={parent} onValueChange={setParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {etapas.map((e) => (
                    <SelectItem key={e.item} value={e.item}>
                      {e.item} — {e.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder={tipo === "etapa" ? "Ex: SERVIÇOS COMPLEMENTARES" : "Ex: Pintura externa"}
            />
          </div>

          {tipo === "servico" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label>Unidade</Label>
                <Input value={und} onChange={(e) => setUnd(e.target.value)} placeholder="m², un, kg..." />
              </div>
              <div>
                <Label>Qtd. planejada</Label>
                <Input
                  value={quant}
                  onChange={(e) => setQuant(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
              <div>
                <Label>V. unit. (R$)</Label>
                <Input
                  value={vu}
                  onChange={(e) => setVu(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChipMultiSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  const selected = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const isSelected = (opt: string) =>
    selected.some((s) => s.toLowerCase() === opt.toLowerCase());

  function toggle(opt: string) {
    if (isSelected(opt)) {
      const next = selected.filter((s) => s.toLowerCase() !== opt.toLowerCase());
      onChange(next.join(", "));
    } else {
      onChange([...selected, opt].join(", "));
    }
  }

  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mb-2 mt-1">
        {options.map((opt) => {
          const active = isSelected(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:border-primary/50 text-foreground"
              }`}
            >
              {active ? "✓ " : "+ "}
              {opt}
            </button>
          );
        })}
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="text-xs"
      />
    </div>
  );
}

interface ResourceOpcao { id: string; nome: string; custoHora: number; }
interface ResourceLinhaBase {
  id: string;
  quantidade: number;
  horas: number;
  custoHora: number;
  itemCodigo?: string;
  itemDescricao?: string;
  funcaoId?: string;
  funcaoNome?: string;
  equipamentoId?: string;
  equipamentoNome?: string;
}

function ResourceLinesEditor<T extends ResourceLinhaBase>({
  titulo, tipo, linhas, onChange, opcoes, itens, itemPadrao,
}: {
  titulo: string;
  tipo: "mao_obra" | "equipamento";
  linhas: T[];
  onChange: (v: T[]) => void;
  opcoes: ResourceOpcao[];
  itens: { codigo: string; descricao: string }[];
  itemPadrao: string;
}) {
  const JORNADA = 8;
  function addLinha(opcaoId?: string) {
    const op = opcoes.find((o) => o.id === opcaoId);
    const base: ResourceLinhaBase = {
      id: crypto.randomUUID(),
      quantidade: 1,
      horas: 8,
      custoHora: op?.custoHora ?? 0,
      itemCodigo: itemPadrao,
      itemDescricao: itens.find((i) => i.codigo === itemPadrao)?.descricao,
    };
    if (tipo === "mao_obra") {
      base.funcaoId = op?.id;
      base.funcaoNome = op?.nome ?? "Função";
    } else {
      base.equipamentoId = op?.id;
      base.equipamentoNome = op?.nome ?? "Equipamento";
    }
    onChange([...(linhas as ResourceLinhaBase[]), base] as T[]);
  }
  function updateLinha(id: string, patch: Partial<ResourceLinhaBase>) {
    onChange(linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)) as T[]);
  }
  function removeLinha(id: string) {
    onChange(linhas.filter((l) => l.id !== id) as T[]);
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{titulo}</Label>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => addLinha()}>
          + Acrescentar
        </Button>
      </div>

      {linhas.length > 0 && (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-1 text-left">{tipo === "mao_obra" ? "Função" : "Equipamento"}</th>
                <th className="p-1 w-16">Qtd</th>
                <th className="p-1 w-20">Horas</th>
                <th className="p-1 w-16">% 8h</th>
                <th className="p-1 w-16">HE</th>
                <th className="p-1 w-24">R$/h</th>
                <th className="p-1">Atividade</th>
                <th className="p-1 w-24 text-right">Custo</th>
                <th className="p-1 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const horasTotais = (l.horas || 0) * (l.quantidade || 0);
                const horasNormais = Math.min(l.horas || 0, JORNADA) * (l.quantidade || 0);
                const horasExtras = Math.max(0, (l.horas || 0) - JORNADA) * (l.quantidade || 0);
                const custo = horasNormais * l.custoHora + horasExtras * l.custoHora * 1.5;
                const pct = ((l.horas || 0) / JORNADA) * 100;
                const nome = tipo === "mao_obra" ? l.funcaoNome : l.equipamentoNome;
                return (
                  <tr key={l.id} className="border-t">
                    <td className="p-1">
                      <select
                        className="h-7 text-xs w-full border rounded bg-background px-1"
                        value={
                          (tipo === "mao_obra" ? l.funcaoId : l.equipamentoId) ??
                          (opcoes.some((o) => o.nome === nome) ? "" : "__custom__")
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "__custom__") {
                            updateLinha(l.id, tipo === "mao_obra"
                              ? { funcaoId: undefined, funcaoNome: "" }
                              : { equipamentoId: undefined, equipamentoNome: "" });
                            return;
                          }
                          const op = opcoes.find((o) => o.id === v);
                          updateLinha(l.id, tipo === "mao_obra"
                            ? { funcaoId: op?.id, funcaoNome: op?.nome ?? "", custoHora: op?.custoHora ?? l.custoHora }
                            : { equipamentoId: op?.id, equipamentoNome: op?.nome ?? "", custoHora: op?.custoHora ?? l.custoHora });
                        }}
                      >
                        <option value="">— selecione —</option>
                        {opcoes.map((o) => (
                          <option key={o.id} value={o.id}>{o.nome}</option>
                        ))}
                        <option value="__custom__">Outro (digitar)…</option>
                      </select>
                      {!((tipo === "mao_obra" ? l.funcaoId : l.equipamentoId)) && (
                        <Input className="h-7 text-xs mt-1" placeholder="Nome livre" value={nome ?? ""}
                          onChange={(e) => updateLinha(l.id, tipo === "mao_obra"
                            ? { funcaoNome: e.target.value }
                            : { equipamentoNome: e.target.value })} />
                      )}
                    </td>

                    <td className="p-1">
                      <Input className="h-7 text-xs" type="number" min={1} value={l.quantidade}
                        onChange={(e) => updateLinha(l.id, { quantidade: parseInt(e.target.value) || 0 })} />
                    </td>
                    <td className="p-1">
                      <Input className="h-7 text-xs" type="number" step="0.5" value={l.horas}
                        onChange={(e) => updateLinha(l.id, { horas: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="p-1 text-center text-muted-foreground">{pct.toFixed(0)}%</td>
                    <td className="p-1 text-center text-muted-foreground">{horasExtras.toFixed(1)}h</td>
                    <td className="p-1">
                      <Input className="h-7 text-xs" type="number" step="0.01" value={l.custoHora}
                        onChange={(e) => updateLinha(l.id, { custoHora: parseFloat(e.target.value) || 0 })} />
                    </td>
                    <td className="p-1">
                      <select className="h-7 text-xs w-full border rounded bg-background px-1"
                        value={l.itemCodigo ?? ""}
                        onChange={(e) => {
                          const it = itens.find((i) => i.codigo === e.target.value);
                          updateLinha(l.id, { itemCodigo: e.target.value, itemDescricao: it?.descricao });
                        }}>
                        <option value="">—</option>
                        {itens.map((i) => (
                          <option key={i.codigo} value={i.codigo}>{i.codigo} — {i.descricao.slice(0, 40)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1 text-right font-medium">
                      {custo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      <div className="text-[10px] text-muted-foreground">{horasTotais.toFixed(1)}h tot</div>
                    </td>
                    <td className="p-1">
                      <Button type="button" size="sm" variant="ghost" className="h-6 w-6 p-0"
                        onClick={() => removeLinha(l.id)}>×</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================
 *  SidebarLink — item de navegação da sidebar premium
 * ============================================================ */
function SidebarLink({
  to,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  icon: typeof HardHat;
  label: string;
  exact?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
  return (
    <Link
      to={to}
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 ${
        active
          ? "bg-sidebar-accent/40 text-sidebar-foreground shadow-[inset_0_1px_0_oklch(1_0_0_/_0.06)]"
          : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/20"
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-primary-glow to-primary shadow-[0_0_12px_oklch(0.65_0.22_285_/_0.6)]" />
      )}
      <Icon
        className={`w-4 h-4 shrink-0 transition-colors ${
          active ? "text-primary-glow" : "text-sidebar-foreground/50 group-hover:text-sidebar-foreground/80"
        }`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}
