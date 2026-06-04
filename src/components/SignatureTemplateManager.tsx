import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSignatureTemplates,
  upsertSignatureTemplate,
  deleteSignatureTemplate,
} from "@/lib/zapsign-templates.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Loader2, Pencil, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: string;
  name: string;
  description: string | null;
  document_folder: string | null;
  expiration_days: number | null;
  custom_message: string | null;
  default_auth_mode: string | null;
  signers: Array<{ name?: string }>;
  placements: Array<unknown>;
  updated_at: string;
};

export default function SignatureTemplateManager() {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ["zapsign", "templates"],
    queryFn: () => listSignatureTemplates(),
  });

  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const saveMut = useMutation({
    mutationFn: (payload: any) =>
      upsertSignatureTemplate({ data: payload }),
    onSuccess: () => {
      toast.success("Template salvo.");
      qc.invalidateQueries({ queryKey: ["zapsign", "templates"] });
      setEditing(null);
    },
    onError: (e) =>
      toast.error("Erro ao salvar", { description: (e as Error).message }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSignatureTemplate({ data: { id } }),
    onSuccess: () => {
      toast.success("Template removido.");
      qc.invalidateQueries({ queryKey: ["zapsign", "templates"] });
    },
    onError: (e) =>
      toast.error("Erro ao remover", { description: (e as Error).message }),
  });

  const templates = (listQ.data?.templates ?? []) as Template[];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-display text-lg font-semibold">
            Templates de envio
          </h2>
          <p className="text-xs text-muted-foreground">
            Configurações reutilizáveis para assinaturas. Crie um template completo
            (signatários + posições) usando "Salvar como template" durante o envio.
          </p>
        </div>
      </div>

      {listQ.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Nenhum template ainda. Use{" "}
          <span className="font-medium">"Salvar como template"</span> ao enviar
          um documento.
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{t.name}</span>
                  <Badge variant="outline" className="text-[10px]">
                    <Users className="h-3 w-3 mr-1" />
                    {t.signers?.length ?? 0} sig.
                  </Badge>
                  {t.placements?.length ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t.placements.length} campo(s)
                    </Badge>
                  ) : null}
                </div>
                {t.description ? (
                  <div className="text-xs text-muted-foreground truncate">
                    {t.description}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => setEditing(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Remover "${t.name}"?`)) deleteMut.mutate(t.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar template</DialogTitle>
            <DialogDescription>
              Para alterar signatários ou posições, use "Salvar como template" no envio.
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea
                  rows={2}
                  value={editing.description ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Pasta padrão</Label>
                  <Input
                    value={editing.document_folder ?? ""}
                    onChange={(e) =>
                      setEditing({ ...editing, document_folder: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Validade (dias)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={editing.expiration_days ?? 30}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        expiration_days: Number(e.target.value) || 30,
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Mensagem padrão</Label>
                <Textarea
                  rows={3}
                  value={editing.custom_message ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, custom_message: e.target.value })
                  }
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!editing?.name || saveMut.isPending}
              onClick={() => {
                if (!editing?.name?.trim()) return;
                saveMut.mutate({
                  id: editing.id,
                  name: editing.name.trim(),
                  description: editing.description ?? undefined,
                  document_folder: editing.document_folder ?? undefined,
                  expiration_days: editing.expiration_days ?? 30,
                  custom_message: editing.custom_message ?? undefined,
                  signers: (editing.signers ?? []).map((s: any) => ({
                    name: s.name || "Signatário",
                    email: s.email,
                    cpf: s.cpf,
                    phone_country: s.phone_country,
                    phone_number: s.phone_number,
                    role: s.role,
                    auth_mode: s.auth_mode,
                  })),
                  placements: (editing.placements ?? []) as any,
                });
              }}
            >
              {saveMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
