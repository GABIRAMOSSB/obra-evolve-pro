import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Download, Upload, Loader2, ShieldAlert, Image as ImageIcon } from "lucide-react";
import { useCompany } from "@/hooks/use-company";
import {
  downloadBlob,
  exportBackupZip,
  readBackup,
  restoreBackup,
  type ExportProgress,
  type LoadedBackup,
  type RestoreProgress,
  type RestoreReport,
} from "@/lib/backup";

export const Route = createFileRoute("/_app/backup")({
  component: BackupPage,
});

function BackupPage() {
  const { company, loading } = useCompany();
  const [busy, setBusy] = useState<"export" | "restore" | null>(null);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<RestoreProgress | null>(null);
  const [preview, setPreview] = useState<LoadedBackup | null>(null);
  const [report, setReport] = useState<RestoreReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!company) return;
    setBusy("export");
    setExportProgress({ stage: "data" });
    try {
      const { blob, filename, photoCount, recordCount } = await exportBackupZip(
        company.id,
        company.name,
        setExportProgress,
      );
      downloadBlob(blob, filename);
      toast.success("Backup gerado", {
        description: `${recordCount} registros + ${photoCount} fotos exportadas.`,
      });
    } catch (e) {
      toast.error("Erro ao exportar", { description: String((e as Error).message) });
    } finally {
      setBusy(null);
      setExportProgress(null);
    }
  };

  const handlePick = async (f: File | null) => {
    if (!f) return;
    try {
      const loaded = await readBackup(f);
      if (loaded.file?.format !== "obra-acompanhamento-backup") {
        toast.error("Arquivo inválido", {
          description: "Não é um backup deste sistema.",
        });
        return;
      }
      setPreview(loaded);
      setReport(null);
    } catch (e) {
      toast.error("Não foi possível ler o arquivo", {
        description: String((e as Error).message),
      });
    }
  };

  const handleRestore = async (mode: "merge" | "replace") => {
    if (!company || !preview) return;
    if (mode === "replace") {
      const ok = confirm(
        "ATENÇÃO: o modo Substituir apaga TODOS os dados atuais desta empresa antes de restaurar.\n\nDeseja continuar?",
      );
      if (!ok) return;
    }
    setBusy("restore");
    setReport(null);
    setRestoreProgress(null);
    try {
      const r = await restoreBackup(company.id, preview, { mode }, setRestoreProgress);
      setReport(r);
      toast.success("Restauração concluída", {
        description:
          (r.workspaceRestored ? "Workspace OK · " : "") +
          (r.photos ? `Fotos: ${r.photos.uploaded}/${r.photos.total} · ` : "") +
          Object.entries(r.perTable)
            .map(([t, v]) => `${t}: ${v.inserted}/${v.total}`)
            .filter((_, i) => i < 2)
            .join(", "),
      });
    } catch (e) {
      toast.error("Erro ao restaurar", {
        description: String((e as Error).message),
      });
    } finally {
      setBusy(null);
      setRestoreProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Você precisa estar em uma empresa para usar o backup.
      </div>
    );
  }

  const file = preview?.file;
  const totalRows = file
    ? Object.values(file.tables).reduce(
        (s, arr) => s + (arr as unknown[]).length,
        0,
      )
    : 0;
  const photoCount = preview?.photos.size ?? 0;

  const exportLabel = (() => {
    if (!exportProgress) return null;
    if (exportProgress.stage === "data") return "Lendo dados…";
    if (exportProgress.stage === "photos")
      return `Baixando fotos ${exportProgress.current}/${exportProgress.total}…`;
    if (exportProgress.stage === "zipping") return "Compactando ZIP…";
    return null;
  })();

  const restoreLabel = (() => {
    if (!restoreProgress) return null;
    if (restoreProgress.stage === "delete") return "Apagando dados atuais…";
    if (restoreProgress.stage === "photos")
      return `Enviando fotos ${restoreProgress.current}/${restoreProgress.total}…`;
    if (restoreProgress.stage === "workspace") return "Restaurando workspace…";
    if (restoreProgress.stage === "tables") return "Restaurando tabelas…";
    return null;
  })();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-2">
              <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
            </Button>
            <h1 className="text-2xl font-bold">Backup e Restauração</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Empresa: <strong>{company.name}</strong> · Permissão: {company.role}
            </p>
          </div>
        </div>

        {/* Exportar */}
        <Card className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold">Exportar backup completo (.zip)</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gera um arquivo <code>.zip</code> contendo todas as obras, etapas,
                evoluções, diários, apontamentos, NF-e (com XML embutido), estoque,
                cadastros, composições próprias e também os <strong>arquivos de fotos</strong>{" "}
                do diário. Permite restauração completa mesmo se o armazenamento
                em nuvem ficar indisponível.
              </p>
            </div>
          </div>
          {exportLabel && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" /> {exportLabel}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={handleExport} disabled={busy !== null}>
              {busy === "export" ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Baixar backup ZIP
            </Button>
          </div>
        </Card>

        {/* Restaurar */}
        <Card className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Upload className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold">Restaurar a partir de um backup</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Aceita arquivos <code>.zip</code> (com fotos) ou <code>.json</code> (legado, só dados).
                Escolha o modo:
              </p>
              <ul className="text-sm text-muted-foreground mt-2 list-disc pl-5 space-y-1">
                <li>
                  <strong>Mesclar:</strong> mantém o que existe e adiciona/atualiza
                  o que está no backup (recomendado).
                </li>
                <li>
                  <strong>Substituir:</strong> apaga TODOS os dados atuais da empresa
                  antes de restaurar. Use só para recuperação completa.
                </li>
              </ul>
            </div>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              className="hidden"
              onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={busy !== null}
            >
              <Upload className="w-4 h-4 mr-2" /> Selecionar arquivo (.zip ou .json)
            </Button>
          </div>

          {file && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3">
              <div className="text-sm">
                <strong>Backup carregado:</strong> {new Date(file.exportedAt).toLocaleString("pt-BR")}
                {file.companyName && <> · {file.companyName}</>}
              </div>
              <div className="text-xs text-muted-foreground grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {Object.entries(file.tables).map(([t, arr]) => (
                  <div key={t}>
                    {t}: <strong>{(arr as unknown[]).length}</strong>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                <span>Total: {totalRows} registros{file.workspace ? " + workspace" : ""}</span>
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> {photoCount} fotos no ZIP
                </span>
              </div>

              {file.companyId !== company.id && (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 p-2 rounded">
                  <ShieldAlert className="w-4 h-4 mt-0.5" />
                  <div>
                    Este backup é de outra empresa ({file.companyId.slice(0, 8)}…).
                    Os dados serão restaurados na empresa atual ({company.id.slice(0, 8)}…).
                  </div>
                </div>
              )}

              {restoreLabel && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> {restoreLabel}
                </div>
              )}

              <div className="flex flex-wrap gap-2 justify-end pt-1">
                <Button
                  variant="outline"
                  onClick={() => handleRestore("merge")}
                  disabled={busy !== null}
                >
                  {busy === "restore" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Mesclar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleRestore("replace")}
                  disabled={busy !== null}
                >
                  {busy === "restore" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Substituir tudo
                </Button>
              </div>
            </div>
          )}

          {report && (
            <div className="border rounded-lg p-4 text-sm space-y-2">
              <div className="font-medium">Resultado da restauração</div>
              <div>Workspace: {report.workspaceRestored ? "✅ restaurado" : "—"}</div>
              {report.photos && (
                <div>
                  Fotos: ✅ {report.photos.uploaded}/{report.photos.total}
                  {report.photos.failed > 0 && (
                    <span className="text-destructive"> · {report.photos.failed} falhas</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {Object.entries(report.perTable).map(([t, v]) => (
                  <div key={t} className={v.error ? "text-destructive" : ""}>
                    {t}: {v.inserted}/{v.total}
                    {v.error && ` — ${v.error}`}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
