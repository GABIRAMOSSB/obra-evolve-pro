import { supabase } from "@/integrations/supabase/client";
import type { DiaryPhoto } from "./types";

const BUCKET = "obra-fotos";

// Compress image client-side to keep storage tight and uploads fast
async function compressImage(file: File, maxDim = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (b) => resolve(b ?? file),
      "image/jpeg",
      quality,
    );
  });
}

export async function uploadDiaryPhoto(
  obraId: string,
  file: File,
): Promise<DiaryPhoto> {
  const isVideo = file.type.startsWith("video/");
  const blob = isVideo ? file : await compressImage(file);
  const ext = isVideo ? (file.name.split(".").pop() || "mp4") : "jpg";
  const path = `${obraId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: isVideo ? file.type : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    url: data.publicUrl,
    path,
    legenda: "",
    hora: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    tipo: isVideo ? "video" : "geral",
  };
}

export async function deleteDiaryPhoto(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}
