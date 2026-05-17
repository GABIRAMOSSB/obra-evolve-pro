import { useRef, useState } from "react";
import type { DiaryPhoto } from "@/lib/types";
import { uploadDiaryPhoto, deleteDiaryPhoto } from "@/lib/photos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Trash2, Loader2, Play } from "lucide-react";
import { toast } from "sonner";

interface Props {
  obraId: string;
  photos: DiaryPhoto[];
  onChange: (photos: DiaryPhoto[]) => void;
  compact?: boolean;
}

export function PhotoUploader({ obraId, photos, onChange, compact }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: DiaryPhoto[] = [];
      for (const f of Array.from(files)) {
        try {
          const p = await uploadDiaryPhoto(obraId, f);
          uploaded.push(p);
        } catch (e) {
          toast.error(`Falha ao enviar ${f.name}: ${(e as Error).message}`);
        }
      }
      if (uploaded.length) {
        onChange([...photos, ...uploaded]);
        toast.success(`${uploaded.length} arquivo(s) enviado(s)`);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    }
  }

  async function removePhoto(p: DiaryPhoto) {
    if (!confirm("Remover esta mídia?")) return;
    try {
      await deleteDiaryPhoto(p.path);
    } catch {
      /* ignore */
    }
    onChange(photos.filter((x) => x.id !== p.id));
  }

  function updatePhoto(id: string, patch: Partial<DiaryPhoto>) {
    onChange(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size={compact ? "sm" : "default"}
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Camera className="w-4 h-4 mr-1" />}
          {uploading ? "Enviando..." : "Adicionar fotos / vídeo"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {photos.length} arquivo(s)
        </span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="border rounded-md overflow-hidden bg-card">
              <div className="relative aspect-video bg-muted">
                {p.tipo === "video" ? (
                  <video src={p.url} controls className="w-full h-full object-cover" />
                ) : (
                  <a href={p.url} target="_blank" rel="noreferrer">
                    <img src={p.url} alt={p.legenda || "foto"} className="w-full h-full object-cover" />
                  </a>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute top-1 right-1 h-7 w-7"
                  onClick={() => removePhoto(p)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {p.tipo === "video" && (
                  <div className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Play className="w-3 h-3" /> vídeo
                  </div>
                )}
              </div>
              <div className="p-2 space-y-1.5">
                <Input
                  className="h-7 text-xs"
                  placeholder="Legenda (obrigatória)"
                  value={p.legenda}
                  onChange={(e) => updatePhoto(p.id, { legenda: e.target.value })}
                />
                <div className="flex gap-1.5">
                  <Input
                    className="h-7 text-xs flex-1"
                    type="time"
                    value={p.hora}
                    onChange={(e) => updatePhoto(p.id, { hora: e.target.value })}
                  />
                  <Select
                    value={p.tipo ?? "geral"}
                    onValueChange={(v) => updatePhoto(p.id, { tipo: v as DiaryPhoto["tipo"] })}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="geral">Geral</SelectItem>
                      <SelectItem value="antes">Antes</SelectItem>
                      <SelectItem value="depois">Depois</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
