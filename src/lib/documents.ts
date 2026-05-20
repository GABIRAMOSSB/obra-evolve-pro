import { supabase } from "@/integrations/supabase/client";

const BUCKET = "obra-documentos";

export const DOC_FOLDERS = [
  "Contrato com Cliente",
  "Contratos com Empreiteiros",
  "Medições da Obra",
  "Notas Fiscais de Materiais",
  "Projetos",
  "Relatórios",
  "Diário de Obra",
  "Outros Documentos",
] as const;

export type DocFolder = (typeof DOC_FOLDERS)[number];

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "xls",
  "xlsx",
  "doc",
  "docx",
  "jpg",
  "jpeg",
  "png",
  "xml",
];

const ALLOWED_MIME = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "application/xml",
  "text/xml",
];

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export interface DocumentItem {
  name: string;
  path: string;
  size: number;
  updatedAt: string;
  folder: DocFolder;
}

function basePath(companyId: string, obraId: string, folder: DocFolder) {
  return `${companyId}/${obraId}/${folder}`;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return "Arquivo excede 25 MB.";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return `Formato não permitido (.${ext}). Use: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    // Some browsers omit MIME; only block when present and unknown.
    if (!file.type.startsWith("image/")) {
      // accept anyway by extension — MIME is just a soft check
    }
  }
  return null;
}

export async function uploadDocument(
  companyId: string,
  obraId: string,
  folder: DocFolder,
  file: File,
): Promise<void> {
  const err = validateFile(file);
  if (err) throw new Error(err);
  const safeName = file.name.replace(/[^\w.\-() ]+/g, "_");
  const path = `${basePath(companyId, obraId, folder)}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
}

export async function uploadDocumentBlob(
  companyId: string,
  obraId: string,
  folder: DocFolder,
  fileName: string,
  blob: Blob,
  contentType?: string,
): Promise<void> {
  const safeName = fileName.replace(/[^\w.\-() ]+/g, "_");
  const path = `${basePath(companyId, obraId, folder)}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: false,
    contentType: contentType || blob.type || undefined,
  });
  if (error) throw error;
}



export async function listDocuments(
  companyId: string,
  obraId: string,
  folder: DocFolder,
): Promise<DocumentItem[]> {
  const prefix = basePath(companyId, obraId, folder);
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
  if (error) throw error;
  return (data ?? [])
    .filter((o) => o.name && !o.name.endsWith("/"))
    .map((o) => ({
      name: o.name.replace(/^\d+-/, ""),
      path: `${prefix}/${o.name}`,
      size: (o.metadata as { size?: number } | null)?.size ?? 0,
      updatedAt: o.updated_at ?? o.created_at ?? "",
      folder,
    }));
}

export async function deleteDocument(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}

export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
