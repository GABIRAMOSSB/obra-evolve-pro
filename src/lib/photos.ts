import { supabase } from "@/integrations/supabase/client";
import type { DiaryPhoto } from "./types";

const BUCKET = "obra-fotos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

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
  companyId: string,
): Promise<DiaryPhoto> {
  const isVideo = file.type.startsWith("video/");
  const blob = isVideo ? file : await compressImage(file);
  const ext = isVideo ? (file.name.split(".").pop() || "mp4") : "jpg";
  const path = `${companyId}/${obraId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: isVideo ? file.type : "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  const { data, error: signedError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (signedError) throw signedError;
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    url: data.signedUrl,
    path,
    legenda: "",
    hora: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    tipo: isVideo ? "video" : "geral",
  };
}

export async function getDiaryPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("getDiaryPhotoUrl", error);
    return null;
  }
  return data.signedUrl;
}

export async function getDiaryPhotoUrls(
  paths: string[],
): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("getDiaryPhotoUrls", error);
    return new Map();
  }
  return new Map(
    (data ?? [])
      .filter((item): item is { path: string; signedUrl: string } =>
        Boolean(item.path && item.signedUrl),
      )
      .map((item) => [item.path, item.signedUrl]),
  );
}
export async function deleteDiaryPhoto(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}
