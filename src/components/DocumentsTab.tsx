import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DOC_FOLDERS,
  type DocFolder,
  type DocumentItem,
  ALLOWED_EXTENSIONS,
  deleteDocument,
  formatBytes,
  getDocumentUrl,
  listDocuments,
  uploadDocument,
} from "@/lib/documents";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Folder,
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
  ArrowLeft,
  PenTool,
  Layers,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import SendForSignatureDialog from "@/components/SendForSignatureDialog";
import BatchSendForSignatureDialog, {
  type BatchDocument,
} from "@/components/BatchSendForSignatureDialog";

interface Props {
  obraId: string;
}

export default function DocumentsTab({ obraId }: Props) {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [active, setActive] = useState<DocFolder | null>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [signItem, setSignItem] = useState<DocumentItem | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [batchOpen, setBatchOpen] = useState(false);


  useEffect(() => {
    supabase.rpc("current_user_company").then(({ data }) => {
      if (data) setCompanyId(data as string);
    });
  }, []);

  // Carrega contagens das pastas
  useEffect(() => {
    if (!companyId) return;
    let cancel = false;
    (async () => {
      const result: Record<string, number> = {};
      await Promise.all(
        DOC_FOLDERS.map(async (f) => {
          try {
            const list = await listDocuments(companyId, obraId, f);
            result[f] = list.length;
          } catch {
            result[f] = 0;
          }
        }),
      );
      if (!cancel) setCounts(result);
    })();
    return () => {
      cancel = true;
    };
  }, [companyId, obraId, active]);

  const openFolder = async (folder: DocFolder) => {
    if (!companyId) return;
    setActive(folder);
    setSelected({});
    setLoading(true);
    try {
      setItems(await listDocuments(companyId, obraId, folder));
    } catch (e) {
      toast.error("Erro ao listar", { description: String((e as Error).message) });
    } finally {
      setLoading(false);
    }
  };

  const selectedDocs: BatchDocument[] = items
    .filter((it) => selected[it.path] && it.name.toLowerCase().endsWith(".pdf"))
    .map((it) => ({ path: it.path, name: it.name, folder: active ?? "" }));

  const onUpload = async (files: FileList | null) => {
    if (!files || !companyId || !active) return;
    setUploading(true);
    let ok = 0;
    let fail = 0;
    for (const file of Array.from(files)) {
      try {
        await uploadDocument(companyId, obraId, active, file);
        ok++;
      } catch (e) {
        fail++;
        toast.error(`Falha ao enviar ${file.name}`, {
          description: String((e as Error).message),
        });
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok)
      toast.success(`${ok} arquivo(s) enviado(s)`, {
        description: fail ? `${fail} falharam` : undefined,
      });
    await openFolder(active);
  };

  const onDownload = async (item: DocumentItem) => {
    try {
      const url = await getDocumentUrl(item.path);
      // window.open após await é bloqueado por popup-blocker em alguns
      // navegadores. Um <a download> injetado no DOM contorna o bloqueio.
      const a = document.createElement("a");
      a.href = url;
      a.download = item.name;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      toast.error("Erro", { description: String((e as Error).message) });
    }
  };

  const onView = async (item: DocumentItem) => {
    try {
      const url = await getDocumentUrl(item.path);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      toast.error("Erro", { description: String((e as Error).message) });
    }
  };


  const onDelete = async (item: DocumentItem) => {
    if (!confirm(`Excluir "${item.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteDocument(item.path);
      toast("Documento excluído");
      if (active) await openFolder(active);
    } catch (e) {
      toast.error("Erro ao excluir", { description: String((e as Error).message) + " (apenas administradores podem excluir)" });
    }
  };

  if (!companyId) {
    return (
      <Card className="p-8 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando…
      </Card>
    );
  }

  if (!active) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Documentos organizados por pasta. Armazenamento em nuvem segura, separado por empresa e por obra.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DOC_FOLDERS.map((f) => (
            <button
              key={f}
              onClick={() => openFolder(f)}
              className="text-left p-4 border rounded-lg hover:border-primary hover:bg-accent transition-colors"
            >
              <Folder className="h-6 w-6 mb-2 text-primary" />
              <div className="font-medium text-sm">{f}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {counts[f] ?? 0} arquivo(s)
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <FolderOpen className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">{active}</h3>
        </div>
        <div className="flex items-center gap-2">
          {selectedDocs.length > 0 ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setSelected({})}>
                <X className="h-4 w-4 mr-1" />
                Limpar ({selectedDocs.length})
              </Button>
              <Button size="sm" onClick={() => setBatchOpen(true)}>
                <Layers className="h-4 w-4 mr-1" />
                Enviar {selectedDocs.length} em lote
              </Button>
            </>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",")}
            className="hidden"
            onChange={(e) => onUpload(e.target.files)}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} size="sm">
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Enviar arquivos
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Formatos aceitos: {ALLOWED_EXTENSIONS.join(", ").toUpperCase()} · máx. 25 MB por arquivo · marque os PDFs para envio em lote
      </div>

      {loading ? (
        <Card className="p-8 flex items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando arquivos…
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Nenhum documento nesta pasta ainda.
        </Card>
      ) : (
        <Card className="divide-y">
          {items.map((item) => {
            const isPdf = item.name.toLowerCase().endsWith(".pdf");
            return (
              <div key={item.path} className="p-3 flex items-center gap-3">
                {isPdf ? (
                  <Checkbox
                    checked={!!selected[item.path]}
                    onCheckedChange={(v) =>
                      setSelected((p) => ({ ...p, [item.path]: !!v }))
                    }
                  />
                ) : (
                  <div className="w-4" />
                )}
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatBytes(item.size)}
                    {item.updatedAt && ` · ${new Date(item.updatedAt).toLocaleString("pt-BR")}`}
                  </div>
                </div>
                {isPdf ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Enviar para assinatura"
                    onClick={() => setSignItem(item)}
                  >
                    <PenTool className="h-4 w-4" />
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => onDownload(item)}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(item)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </Card>
      )}

      {signItem && active ? (
        <SendForSignatureDialog
          open={!!signItem}
          onOpenChange={(o) => !o && setSignItem(null)}
          obraId={obraId}
          documentPath={signItem.path}
          documentName={signItem.name}
          documentFolder={active}
        />
      ) : null}

      {batchOpen && selectedDocs.length > 0 ? (
        <BatchSendForSignatureDialog
          open={batchOpen}
          onOpenChange={(o) => {
            setBatchOpen(o);
            if (!o) setSelected({});
          }}
          obraId={obraId}
          documents={selectedDocs}
        />
      ) : null}
    </div>
  );
}

