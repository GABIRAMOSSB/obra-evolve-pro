import { useEffect, useMemo, useState } from "react";
import type { ProjectData, BudgetRow, Evolution, DiaryEntry, Workspace } from "@/lib/types";
import { loadWorkspace, saveWorkspace, newObraId } from "@/lib/storage";
import { parseExcel, type ParseResult } from "@/lib/excel";
import {
  activityMetrics,
  fmtBRL,
  fmtNum,
  groupMetrics,
  isChildOf,
  projectMetrics,
} from "@/lib/calc";
import {
  exportAcompanhamentoXlsx,
  exportDiarioPdf,
  exportRelatorioPdf,
  gerarTextoDiario,
} from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import {
  Upload,
  HardHat,
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
} from "lucide-react";


function statusVariant(status: string): "default" | "secondary" | "outline" {
  if (status === "Concluída") return "default";
  if (status === "Em andamento") return "secondary";
  return "outline";
}

export function ObraApp() {
  const [ws, setWs] = useState<Workspace>({ obras: [], activeId: null });
  const [loaded, setLoaded] = useState(false);
  const [preview, setPreview] = useState<{ result: ParseResult; fileName: string } | null>(null);

  useEffect(() => {
    setWs(loadWorkspace());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveWorkspace(ws);
  }, [ws, loaded]);

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
      const result = await parseExcel(file);
      setPreview({ result, fileName: file.name });
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

  if (!loaded) return null;

  if (!activeObra) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <Card className="max-w-xl w-full p-10 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
              <HardHat className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Acompanhamento de Obras</h1>
              <p className="text-muted-foreground mt-2">
                Importe sua primeira planilha orçamentária para começar. Cada planilha vira uma obra. Você pode adicionar quantas quiser.
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
              Os dados ficam salvos localmente no seu computador.
            </p>
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
  preview: { result: ParseResult; fileName: string } | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!preview) return null;
  const { result, fileName } = preview;
  const groupCount = result.rows.filter((r) => r.isGroup).length;
  const activityCount = result.rows.length - groupCount;
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
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PreviewStat label="Linhas válidas" value={result.rows.length} tone="success" />
          <PreviewStat label="Etapas" value={groupCount} />
          <PreviewStat label="Atividades" value={activityCount} />
          <PreviewStat label="Linhas ignoradas" value={result.skipped.length} tone="warn" />
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
  value: number;
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
}: {
  data: ProjectData;
  setData: (d: ProjectData) => void;
  obras: ProjectData[];
  activeId: string;
  onSelectObra: (id: string) => void;
  onRenameObra: (id: string, nome: string) => void;
  onDeleteObra: (id: string) => void;
  onImportFile: (file: File) => void;
}) {
  const m = useMemo(() => projectMetrics(data.rows, data.evolutions), [data]);

  const etapas = useMemo(() => data.rows.filter((r) => r.isGroup && r.level === 1), [data.rows]);

  const [filterEtapa, setFilterEtapa] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterItem, setFilterItem] = useState("");
  const [filterDesc, setFilterDesc] = useState("");
  const [filterPercMin, setFilterPercMin] = useState("");
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

  const visibleRows = useMemo(() => {
    return data.rows.filter((r) => {
      if (filterEtapa !== "all") {
        if (r.item !== filterEtapa && !isChildOf(r.item, filterEtapa)) return false;
      }
      if (filterItem && !r.item.includes(filterItem)) return false;
      if (filterDesc && !r.descricao.toLowerCase().includes(filterDesc.toLowerCase()))
        return false;
      if (!r.isGroup) {
        const a = activityMetrics(r, data.evolutions[r.item]);
        if (filterStatus !== "all" && a.status !== filterStatus) return false;
        if (filterPercMin && a.percent < parseFloat(filterPercMin)) return false;
      } else if (filterStatus !== "all" || filterPercMin) {
        return false;
      }
      // Hide rows whose ancestor group is collapsed
      for (const ancestor of Object.keys(collapsed)) {
        if (collapsed[ancestor] && isChildOf(r.item, ancestor)) return false;
      }
      return true;
    });
  }, [data, filterEtapa, filterItem, filterDesc, filterStatus, filterPercMin, collapsed]);

  const updateEvolution = (item: string, evo: Evolution) => {
    const next = { ...data.evolutions, [item]: evo };
    if (!evo.quantExec && !evo.dataExec && !evo.observacoes) delete next[item];
    setData({ ...data, evolutions: next });
  };

  const addDiary = (entry: DiaryEntry) => {
    setData({ ...data, diaries: [entry, ...data.diaries] });
  };

  const updateDiary = (entry: DiaryEntry) => {
    setData({
      ...data,
      diaries: data.diaries.map((d) => (d.id === entry.id ? entry : d)),
    });
  };

  const removeDiary = (id: string) => {
    setData({ ...data, diaries: data.diaries.filter((d) => d.id !== id) });
  };

  function removeObra() {
    if (confirm(`Excluir a obra "${data.nome}"? Esta ação não pode ser desfeita.`)) {
      onDeleteObra(data.id);
    }
  }

  function handleRename() {
    const novo = prompt("Novo nome da obra:", data.nome);
    if (novo && novo.trim()) onRenameObra(data.id, novo.trim());
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

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <HardHat className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-foreground leading-tight">
                Acompanhamento de Obras
              </h1>
              <p className="text-xs text-muted-foreground">{data.fileName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <Select value={activeId} onValueChange={onSelectObra}>
                <SelectTrigger className="h-8 min-w-[200px] border-0 bg-transparent focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={handleRename} title="Renomear obra">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>

            <label>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onImportFile(f);
                }}
              />
              <Button asChild variant="default" size="sm">
                <span className="cursor-pointer">
                  <Plus className="w-4 h-4 mr-1" /> Nova obra
                </span>
              </Button>
            </label>

            <label>
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
                      if (validKeys.has(k)) {
                        keptEvolutions[k] = v;
                        kept++;
                      } else dropped++;
                    }
                    setData({
                      ...data,
                      fileName: f.name,
                      importedAt: new Date().toISOString(),
                      rows: result.rows,
                      evolutions: keptEvolutions,
                    });
                    toast.success(
                      `Planilha atualizada: ${result.rows.length} linhas. ${kept} evolução(ões) preservada(s)${dropped ? `, ${dropped} descartada(s)` : ""}.`,
                    );
                  } catch (err) {
                    toast.error((err as Error).message);
                  }
                }}
              />
              <Button asChild variant="outline" size="sm">
                <span className="cursor-pointer">
                  <Upload className="w-4 h-4 mr-1" /> Reimportar
                </span>
              </Button>
            </label>

            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAcompanhamentoXlsx(data.rows, data.evolutions)}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportRelatorioPdf(data.rows, data.evolutions, data.fileName)}
            >
              <FileText className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="ghost" size="sm" onClick={removeObra} title="Excluir esta obra">
              <Trash2 className="w-4 h-4 mr-1 text-destructive" /> Excluir
            </Button>
          </div>
        </div>
      </header>


      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Valor total" value={fmtBRL(m.total)} />
          <SummaryCard label="Valor executado" value={fmtBRL(m.exec)} tone="success" />
          <SummaryCard label="Valor restante" value={fmtBRL(m.restante)} />
          <SummaryCard label="% Geral executado" value={`${fmtNum(m.percent)}%`} tone="primary" />
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progresso geral da obra</span>
            <span className="text-sm text-muted-foreground">{fmtNum(m.percent)}%</span>
          </div>
          <Progress value={m.percent} className="h-3" />
          <div className="flex gap-4 mt-4 text-sm">
            <span className="text-foreground">
              ✅ Concluídas: <strong>{m.concluidas}</strong>
            </span>
            <span className="text-foreground">
              🔧 Em andamento: <strong>{m.andamento}</strong>
            </span>
            <span className="text-muted-foreground">
              ⏳ Não iniciadas: <strong>{m.naoIniciadas}</strong>
            </span>
          </div>
        </Card>

        <Tabs defaultValue="atividades">
          <TabsList>
            <TabsTrigger value="atividades">Atividades</TabsTrigger>
            <TabsTrigger value="diario">
              Diário de obra ({data.diaries.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="atividades" className="space-y-4">
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Etapa</Label>
                  <Select value={filterEtapa} onValueChange={setFilterEtapa}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as etapas</SelectItem>
                      {etapas.map((e) => (
                        <SelectItem key={e.item} value={e.item}>
                          {e.item} — {e.descricao}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Não iniciada">Não iniciada</SelectItem>
                      <SelectItem value="Em andamento">Em andamento</SelectItem>
                      <SelectItem value="Concluída">Concluída</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Item</Label>
                  <Input value={filterItem} onChange={(e) => setFilterItem(e.target.value)} placeholder="1.1" />
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
              </div>
            </Card>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
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
            />
          </TabsContent>

          <TabsContent value="diario">
            <DiaryPanel diaries={data.diaries} onUpdate={updateDiary} onRemove={removeDiary} />
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
}: {
  label: string;
  value: string;
  tone?: "primary" | "success";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-[var(--success)]"
        : "text-foreground";
  return (
    <Card className="p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-2 ${toneClass}`}>{value}</div>
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
}: {
  rows: BudgetRow[];
  allRows: BudgetRow[];
  evolutions: Record<string, Evolution>;
  onUpdate: (item: string, evo: Evolution) => void;
  onAddDiary: (e: DiaryEntry) => void;
  onRemove: (item: string) => void;
  collapsed?: Record<string, boolean>;
  onToggleCollapse?: (item: string) => void;
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
  const pesoOf = (r: BudgetRow, computedTotal?: number) => {
    if (r.peso) return r.peso;
    if (!projectTotal) return 0;
    const t = computedTotal ?? r.total ?? 0;
    return (t / projectTotal) * 100;
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 1500 }}>
          <thead className="bg-muted text-muted-foreground uppercase sticky top-0 z-10">
            <tr className="text-[10px]">
              <th colSpan={10} className="px-3 py-1 text-center border-b bg-muted/80 font-semibold tracking-wider">
                Planejamento (planilha orçamentária)
              </th>
              <th colSpan={5} className="px-3 py-1 text-center border-b bg-primary/10 text-primary font-semibold tracking-wider">
                Execução
              </th>
            </tr>
            <tr>
              <th className="px-2 py-2 text-left w-24 border-b">Item</th>
              <th className="px-2 py-2 text-left w-20 border-b">Código</th>
              <th className="px-2 py-2 text-left w-20 border-b">Banco</th>
              <th className="px-2 py-2 text-left border-b min-w-[280px]">Descrição</th>
              <th className="px-2 py-2 text-left w-14 border-b">Und</th>
              <th className="px-2 py-2 text-right w-20 border-b">Quant.</th>
              <th className="px-2 py-2 text-right w-24 border-b">Valor Unit</th>
              <th className="px-2 py-2 text-right w-28 border-b">V. Unit c/ BDI</th>
              <th className="px-2 py-2 text-right w-28 border-b">Total</th>
              <th className="px-2 py-2 text-right w-20 border-b">Peso (%)</th>
              <th className="px-2 py-2 text-right w-28 border-b bg-primary/5">Qtd exec.</th>
              <th className="px-2 py-2 text-right w-24 border-b bg-primary/5">% Exec.</th>
              <th className="px-2 py-2 text-right w-28 border-b bg-primary/5">V. executado</th>
              <th className="px-2 py-2 text-center w-28 border-b bg-primary/5">Status</th>
              <th className="px-2 py-2 text-center w-24 border-b bg-primary/5">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              if (r.isGroup) {
                const g = groupMetrics(r, allRows, evolutions);
                const isEtapa = r.level === 1;
                const indent = Math.max(0, r.level - 1) * 14;
                const peso = pesoOf(r, g.total);
                return (
                  <tr
                    key={r.item}
                    className={
                      isEtapa
                        ? "bg-primary/15 border-y-2 border-primary/30 font-bold"
                        : "bg-primary/5 border-t font-semibold"
                    }
                  >
                    <td
                      className={`px-2 py-1.5 font-mono ${isEtapa ? "text-primary" : ""}`}
                      style={{ paddingLeft: 8 + indent }}
                    >
                      <button
                        type="button"
                        onClick={() => onToggleCollapse?.(r.item)}
                        className="inline-flex items-center gap-1 hover:opacity-70 transition"
                        title={collapsed[r.item] ? "Expandir" : "Colapsar"}
                      >
                        {collapsed[r.item] ? (
                          <ChevronRight className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                        <span>{r.item}</span>
                      </button>
                    </td>
                    <td className="px-2 py-1.5">{r.codigo}</td>
                    <td className="px-2 py-1.5">{r.banco}</td>
                    <td
                      className={`px-2 py-1.5 ${isEtapa ? "uppercase tracking-wide" : ""}`}
                      style={{ paddingLeft: 8 + indent }}
                    >
                      {r.descricao}
                    </td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 text-right">{fmtBRL(g.total)}</td>
                    <td className="px-2 py-1.5 text-right">{fmtNum(peso)} %</td>
                    <td className="px-2 py-1.5"></td>
                    <td className="px-2 py-1.5 text-right">{fmtNum(g.percent)}%</td>
                    <td className="px-2 py-1.5 text-right text-[var(--success)]">
                      {fmtBRL(g.exec)}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <Badge variant={r.banco === "MANUAL" ? "secondary" : "outline"} className="text-[10px]">
                        {r.banco === "MANUAL" ? "MANUAL" : isEtapa ? "ETAPA" : "SUB"}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {r.banco === "MANUAL" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRemove(r.item)}
                          title="Remover"
                        >
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
                  peso={pesoOf(r)}
                />
              );
            })}
          </tbody>
        </table>
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
  peso = 0,
}: {
  row: BudgetRow;
  allRows: BudgetRow[];
  evolution?: Evolution;
  onUpdate: (item: string, evo: Evolution) => void;
  onAddDiary: (e: DiaryEntry) => void;
  onRemove?: (item: string) => void;
  indent?: number;
  peso?: number;
}) {
  const a = activityMetrics(row, evolution);
  const [qty, setQty] = useState(evolution?.quantExec ? String(evolution.quantExec) : "");
  const [pct, setPct] = useState(a.percent ? a.percent.toFixed(2) : "");

  useEffect(() => {
    setQty(evolution?.quantExec ? String(evolution.quantExec) : "");
    setPct(evolution?.quantExec && row.quantidade > 0
      ? ((evolution.quantExec / row.quantidade) * 100).toFixed(2)
      : "");
  }, [evolution, row.quantidade]);

  function commit(q: number) {
    const clamped = Math.max(0, q);
    const prev = evolution?.quantExec ?? 0;
    if (Math.abs(clamped - prev) < 1e-6) return;
    onUpdate(row.item, {
      quantExec: clamped,
      dataExec: evolution?.dataExec ?? new Date().toISOString().slice(0, 10),
      observacoes: evolution?.observacoes ?? "",
    });
  }

  function onQtyBlur() {
    const n = parseFloat(qty.replace(",", ".")) || 0;
    commit(n);
  }
  function onPctBlur() {
    const n = parseFloat(pct.replace(",", ".")) || 0;
    commit((n / 100) * row.quantidade);
  }
  function syncFromQty(v: string) {
    setQty(v);
    const n = parseFloat(v.replace(",", "."));
    if (!isNaN(n) && row.quantidade > 0) setPct(((n / row.quantidade) * 100).toFixed(2));
  }
  function syncFromPct(v: string) {
    setPct(v);
    const n = parseFloat(v.replace(",", "."));
    if (!isNaN(n)) setQty(((n / 100) * row.quantidade).toFixed(4));
  }

  return (
    <tr className="border-t hover:bg-muted/30">
      <td
        className="px-2 py-1.5 font-mono whitespace-nowrap"
        style={{ paddingLeft: 8 + indent }}
      >
        {row.item}
      </td>
      <td className="px-2 py-1.5 text-muted-foreground">{row.codigo}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{row.banco}</td>
      <td className="px-2 py-1.5 max-w-md" style={{ paddingLeft: 8 + indent }}>
        {row.descricao}
      </td>
      <td className="px-2 py-1.5">{row.und}</td>
      <td className="px-2 py-1.5 text-right">{row.quantidade ? fmtNum(row.quantidade) : ""}</td>
      <td className="px-2 py-1.5 text-right">{row.valorUnit ? fmtBRL(row.valorUnit) : ""}</td>
      <td className="px-2 py-1.5 text-right">
        {row.valorUnitBDI ? fmtBRL(row.valorUnitBDI) : ""}
      </td>
      <td className="px-2 py-1.5 text-right font-medium">{fmtBRL(row.total)}</td>
      <td className="px-2 py-1.5 text-right text-muted-foreground">
        {peso ? `${fmtNum(peso)} %` : ""}
      </td>
      <td className="px-2 py-1 text-right bg-primary/5">
        <Input
          value={qty}
          onChange={(e) => syncFromQty(e.target.value)}
          onBlur={onQtyBlur}
          inputMode="decimal"
          className="h-7 text-right text-xs"
          placeholder="0"
        />
      </td>
      <td className="px-2 py-1 text-right bg-primary/5">
        <Input
          value={pct}
          onChange={(e) => syncFromPct(e.target.value)}
          onBlur={onPctBlur}
          inputMode="decimal"
          className="h-7 text-right text-xs"
          placeholder="0"
        />
      </td>
      <td className="px-2 py-1.5 text-right bg-primary/5">{fmtBRL(a.valorExec)}</td>
      <td className="px-2 py-1.5 text-center bg-primary/5">
        <Badge variant={statusVariant(a.status)} className="text-[10px]">
          {a.status}
        </Badge>
      </td>
      <td className="px-2 py-1.5 text-center bg-primary/5">
        <div className="flex items-center justify-center gap-1">
          <EvolutionDialog
            row={row}
            allRows={allRows}
            evolution={evolution}
            onSave={(e) => onUpdate(row.item, e)}
            onAddDiary={onAddDiary}
          />
          {row.banco === "MANUAL" && onRemove && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(row.item)}
              title="Remover serviço"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function EvolutionDialog({
  row,
  allRows,
  evolution,
  onSave,
  onAddDiary,
}: {
  row: BudgetRow;
  allRows: BudgetRow[];
  evolution?: Evolution;
  onSave: (e: Evolution) => void;
  onAddDiary: (e: DiaryEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [quantExec, setQuantExec] = useState<string>(evolution?.quantExec?.toString() ?? "");
  const [percentInput, setPercentInput] = useState<string>("");
  const [dataExec, setDataExec] = useState(
    evolution?.dataExec ?? new Date().toISOString().slice(0, 10),
  );
  const [obs, setObs] = useState(evolution?.observacoes ?? "");

  // diary
  const [criarDiario, setCriarDiario] = useState(true);
  const [clima, setClima] = useState("Bom");
  const [equipe, setEquipe] = useState("");
  const [equipamentos, setEquipamentos] = useState("");
  const [diarioObs, setDiarioObs] = useState("");

  useEffect(() => {
    if (open) {
      const q = evolution?.quantExec ?? 0;
      setQuantExec(q ? String(q) : "");
      setPercentInput(
        q && row.quantidade > 0 ? ((q / row.quantidade) * 100).toFixed(2) : "",
      );
      setDataExec(evolution?.dataExec ?? new Date().toISOString().slice(0, 10));
      setObs(evolution?.observacoes ?? "");
    }
  }, [open, evolution, row.quantidade]);

  function handleQuant(v: string) {
    setQuantExec(v);
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
      setQuantExec("");
    } else {
      setQuantExec(((n / 100) * row.quantidade).toFixed(4));
    }
  }

  function save() {
    const q = parseFloat(quantExec.replace(",", ".")) || 0;
    onSave({ quantExec: q, dataExec, observacoes: obs });

    if (criarDiario && q > 0) {
      const etapa = (() => {
        const top = row.item.split(".")[0];
        const g = allRows.find((r) => r.item === top && r.isGroup);
        return g ? `${g.item} — ${g.descricao}` : row.item;
      })();
      const texto = gerarTextoDiario({
        etapa,
        descricao: row.descricao,
        quantExec: q,
        unidade: row.und,
        quantTotal: row.quantidade,
      });
      onAddDiary({
        id: crypto.randomUUID(),
        itemKey: row.item,
        data: dataExec,
        clima,
        equipe,
        equipamentos,
        observacoes: diarioObs,
        quantExec: q,
        etapa,
        atividade: row.descricao,
        texto,
        createdAt: new Date().toISOString(),
      });
      toast.success("Evolução e diário registrados");
    } else {
      toast.success("Evolução registrada");
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil className="w-3 h-3 mr-1" /> Lançar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {row.item} — {row.descricao}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 text-sm bg-muted/50 p-3 rounded-md">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade executada</Label>
              <Input value={quantExec} onChange={(e) => handleQuant(e.target.value)} />
            </div>
            <div>
              <Label>% Executado</Label>
              <Input value={percentInput} onChange={(e) => handlePercent(e.target.value)} />
            </div>
            <div>
              <Label>Data da execução</Label>
              <Input type="date" value={dataExec} onChange={(e) => setDataExec(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} />
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
                <div className="grid grid-cols-2 gap-3">
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

                <ChipMultiSelect
                  label="Equipe presente"
                  value={equipe}
                  onChange={setEquipe}
                  options={[
                    "Mestre de obras",
                    "Encarregado",
                    "Engenheiro",
                    "Pedreiro",
                    "Servente",
                    "Carpinteiro",
                    "Armador",
                    "Eletricista",
                    "Encanador",
                    "Pintor",
                    "Soldador",
                    "Operador de máquina",
                  ]}
                  placeholder="Ex: 2 pedreiros, 3 serventes"
                />

                <ChipMultiSelect
                  label="Equipamentos utilizados"
                  value={equipamentos}
                  onChange={setEquipamentos}
                  options={[
                    "Betoneira",
                    "Bomba de concreto",
                    "Caminhão basculante",
                    "Retroescavadeira",
                    "Escavadeira",
                    "Compactador",
                    "Serra mármore",
                    "Furadeira",
                    "Andaime",
                    "Vibrador de concreto",
                    "Caçamba",
                    "Carrinho de mão",
                  ]}
                  placeholder="Ex: 1 betoneira, 2 andaimes"
                />

                <div>
                  <Label className="text-xs">Observações do diário</Label>
                  <Textarea
                    value={diarioObs}
                    onChange={(e) => setDiarioObs(e.target.value)}
                    placeholder="Ocorrências, paralisações, visitas, entregas..."
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiaryPanel({
  diaries,
  onUpdate,
  onRemove,
}: {
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
            <DiaryCard key={d.id} entry={d} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiaryCard({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: DiaryEntry;
  onUpdate: (e: DiaryEntry) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [e, setE] = useState(entry);

  function save() {
    onUpdate(e);
    setEditing(false);
    toast.success("Diário atualizado");
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-semibold text-foreground">{entry.etapa}</div>
          <div className="text-xs text-muted-foreground">
            {fmtDate(entry.data)} · Item {entry.itemKey} · {entry.atividade}
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
          <div className="grid grid-cols-2 gap-3">
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
            <Label>Observações</Label>
            <Textarea
              value={e.observacoes}
              onChange={(ev) => setE({ ...e, observacoes: ev.target.value })}
            />
          </div>
          <Button onClick={save}>Salvar alterações</Button>
        </div>
      ) : (
        <>
          <div className="text-xs text-muted-foreground mb-2">
            Clima: {entry.clima || "-"} · Equipe: {entry.equipe || "-"} · Equipamentos:{" "}
            {entry.equipamentos || "-"}
          </div>
          <p className="text-sm text-foreground leading-relaxed">{entry.texto}</p>
          {entry.observacoes && (
            <p className="text-sm italic text-muted-foreground mt-2">Obs: {entry.observacoes}</p>
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
            <div className="grid grid-cols-3 gap-3">
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
