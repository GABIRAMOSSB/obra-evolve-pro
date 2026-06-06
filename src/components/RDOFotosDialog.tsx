import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Trash2, ImageIcon, Loader2 } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

import {
  listarFotosRDO,
  registrarFotoRDO,
  excluirFotoRDO,
  getCompanyIdAtual,
} from "@/lib/rdo-fotos.functions";

type Props = {
  rdoId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
};

const CATEGORIAS = ["geral", "antes", "depois", "seguranca", "qualidade", "ocorrencia"] as const;
type Categoria = (typeof CATEGORIAS)[number];

export function RDOFotosDialog({ rdoId, open, onOpenChange }: Props) {
  const listFn = useServerFn(listarFotosRDO);
  const regFn = useServerFn(registrarFotoRDO);
  const delFn = useServerFn(excluirFotoRDO);
  const companyFn = useServerFn(getCompanyIdAtual);
  const qc = useQueryClient();

  const [categoria, setCategoria] = useState<Categoria>("geral");
  const [legenda, setLegenda] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["rdo-fotos", rdoId],
    queryFn: () => listFn({ data: { rdo_id: rdoId as string } }),
    enabled: !!rdoId && open,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Foto excluída.");
      qc.invalidateQueries({ queryKey: ["rdo-fotos", rdoId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleUpload(files: FileList | null) {
    if (!files || !rdoId) return;
    setUploading(true);
    try {
      const { company_id } = await companyFn({ data: undefined as never });
      for (const file of Array.from(files)) {
        if (file.size > 15 * 1024 * 1024) {
          toast.error(`${file.name} excede 15MB.`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "jpg";
        const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const path = `${company_id}/${rdoId}/${safe}`;
        const { error: upErr } = await supabase.storage
          .from("rdo-fotos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) {
          toast.error(`${file.name}: ${upErr.message}`);
          continue;
        }
        await regFn({
          data: {
            rdo_id: rdoId,
            storage_path: path,
            file_name: file.name,
            mime_type: file.type || null,
            size_bytes: file.size,
            legenda: legenda || null,
            categoria,
          },
        });
      }
      toast.success("Upload concluído.");
      setLegenda("");
      qc.invalidateQueries({ queryKey: ["rdo-fotos", rdoId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const fotos = data?.fotos ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" /> Fotos do RDO
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-12 gap-3 items-end border rounded-lg p-3 bg-muted/30">
          <div className="col-span-3">
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as Categoria)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-5">
            <Label className="text-xs">Legenda (opcional)</Label>
            <Input value={legenda} onChange={(e) => setLegenda(e.target.value)} placeholder="Ex.: Concretagem laje 3º pav." />
          </div>
          <div className="col-span-4">
            <Label className="text-xs">Arquivos</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*"
                multiple
                disabled={uploading}
                onChange={(e) => handleUpload(e.target.files)}
              />
              {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            </div>
          </div>
          <div className="col-span-12 text-xs text-muted-foreground flex items-center gap-1">
            <Upload className="w-3 h-3" /> Até 15MB por foto. Formatos: JPG, PNG, WEBP.
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
        ) : fotos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Nenhuma foto anexada ainda.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {fotos.map((f) => (
              <div key={f.id} className="group relative border rounded-lg overflow-hidden bg-muted/30">
                {f.signed_url ? (
                  <a href={f.signed_url} target="_blank" rel="noreferrer">
                    <img
                      src={f.signed_url}
                      alt={f.legenda ?? f.file_name}
                      className="w-full h-40 object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <div className="w-full h-40 flex items-center justify-center text-xs text-muted-foreground">
                    sem prévia
                  </div>
                )}
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {f.categoria}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Excluir"
                      onClick={() => { if (confirm("Excluir foto?")) delMut.mutate(f.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                  {f.legenda && <p className="text-xs line-clamp-2">{f.legenda}</p>}
                  <p className="text-[10px] text-muted-foreground truncate">{f.file_name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
