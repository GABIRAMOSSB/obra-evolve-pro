// Backup/Restore: exporta e restaura todos os dados da empresa.
//
// Formatos suportados:
//  - .zip (recomendado): contém backup.json + fotos/<path> com os binários do
//    Storage. Permite restauração 100% offline, sem depender do Storage original.
//  - .json (legado): só dados; fotos continuam apontando para os links do Storage.
//
// XMLs de NF-e já viajam dentro do JSON (coluna xml_content), então não
// precisam ser duplicados no ZIP.

import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { getDiaryPhotoUrl, getDiaryPhotoUrls } from "@/lib/photos";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
const PHOTO_BUCKET = "obra-fotos";

// Tabelas exportadas (ordem importa na restauração por causa de FKs lógicas)
const TABLES = [
  "unidades_medida",
  "insumo_categorias",
  "insumos_mestre",
  "insumo_aliases",
  "funcoes_mao_obra",
  "funcionarios",
  "equipamentos",
  "equipes",
  "equipe_membros",
  "composicoes_proprias",
  "composicoes_proprias_insumos",
  "notas_fiscais",
  "nota_fiscal_itens",
  "nfe_item_apropriacoes",
  "estoque_movimentos",
  "apontamentos_mao_obra",
] as const;

export interface BackupFile {
  format: "obra-acompanhamento-backup";
  version: 1;
  exportedAt: string;
  companyId: string;
  companyName?: string;
  workspace: unknown;
  tables: Record<string, unknown[]>;
  // Lista de paths de fotos incluídas no ZIP (quando aplicável)
  photoPaths?: string[];
}

// ---------- Helpers ----------

interface PhotoRef { path: string; url: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectPhotoRefs(workspace: any): PhotoRef[] {
  const refs = new Map<string, string>();
  const obras = workspace?.obras ?? [];
  for (const obra of obras) {
    const diarios = obra?.diarios ?? [];
    for (const d of diarios) {
      const fotos = d?.fotos ?? [];
      for (const f of fotos) {
        if (f?.path && f?.url) refs.set(f.path, f.url);
      }
    }
  }
  return Array.from(refs, ([path, url]) => ({ path, url }));
}

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

// ---------- Export ----------

async function buildBackupFile(
  companyId: string,
  companyName?: string,
): Promise<BackupFile> {
  const { data: wsRow, error: wsErr } = await db
    .from("company_workspaces")
    .select("workspace")
    .eq("company_id", companyId)
    .maybeSingle();
  if (wsErr) throw wsErr;

  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const all: unknown[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await db
        .from(t)
        .select("*")
        .eq("company_id", companyId)
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const chunk = (data ?? []) as unknown[];
      all.push(...chunk);
      if (chunk.length < pageSize) break;
      from += pageSize;
    }
    tables[t] = all;
  }

  return {
    format: "obra-acompanhamento-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    companyId,
    companyName,
    workspace: wsRow?.workspace ?? null,
    tables,
  };
}

export interface ExportProgress {
  stage: "data" | "photos" | "zipping";
  current?: number;
  total?: number;
}

export async function exportBackupZip(
  companyId: string,
  companyName?: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; filename: string; photoCount: number; recordCount: number }> {
  onProgress?.({ stage: "data" });
  const file = await buildBackupFile(companyId, companyName);

  const zip = new JSZip();
  const refs = collectPhotoRefs(file.workspace);
  const includedPaths: string[] = [];

  if (refs.length > 0) {
    const fotosDir = zip.folder("fotos")!;
    let i = 0;
    for (const ref of refs) {
      i++;
      onProgress?.({ stage: "photos", current: i, total: refs.length });
      const signedUrl = await getDiaryPhotoUrl(ref.path);
      const blob = await fetchBlob(signedUrl ?? ref.url);
      if (!blob) continue;
      fotosDir.file(ref.path, blob);
      includedPaths.push(ref.path);
    }
  }
  file.photoPaths = includedPaths;

  zip.file("backup.json", JSON.stringify(file, null, 2));

  onProgress?.({ stage: "zipping" });
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const recordCount = Object.values(file.tables).reduce(
    (s, arr) => s + (arr as unknown[]).length,
    0,
  );
  return {
    blob,
    filename: `backup-obras-${stamp}.zip`,
    photoCount: includedPaths.length,
    recordCount,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- Restore ----------

export interface RestoreOptions {
  // "merge": faz upsert por id (mantém o que já existe e atualiza/cria o resto)
  // "replace": apaga tudo da empresa antes de restaurar (USE COM CUIDADO)
  mode: "merge" | "replace";
}

export interface RestoreReport {
  workspaceRestored: boolean;
  perTable: Record<string, { inserted: number; total: number; error?: string }>;
  photos?: { uploaded: number; total: number; failed: number };
}

export interface LoadedBackup {
  file: BackupFile;
  // Mapa path -> Blob das fotos contidas no ZIP (vazio quando .json puro)
  photos: Map<string, Blob>;
}

export async function readBackup(file: File): Promise<LoadedBackup> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    const jsonEntry = zip.file("backup.json");
    if (!jsonEntry) throw new Error("ZIP inválido: backup.json não encontrado.");
    const text = await jsonEntry.async("string");
    const parsed = JSON.parse(text) as BackupFile;
    const photos = new Map<string, Blob>();
    const fotosFolder = zip.folder("fotos");
    if (fotosFolder) {
      const entries: { path: string; entry: JSZip.JSZipObject }[] = [];
      zip.forEach((relativePath, entry) => {
        if (!entry.dir && relativePath.startsWith("fotos/")) {
          entries.push({ path: relativePath.slice("fotos/".length), entry });
        }
      });
      for (const { path, entry } of entries) {
        photos.set(path, await entry.async("blob"));
      }
    }
    return { file: parsed, photos };
  }
  // JSON puro (legado)
  const text = await file.text();
  return { file: JSON.parse(text) as BackupFile, photos: new Map() };
}

export interface RestoreProgress {
  stage: "delete" | "workspace" | "tables" | "photos";
  detail?: string;
  current?: number;
  total?: number;
}

export async function restoreBackup(
  companyId: string,
  loaded: LoadedBackup,
  opts: RestoreOptions,
  onProgress?: (p: RestoreProgress) => void,
): Promise<RestoreReport> {
  const { file, photos } = loaded;
  if (file?.format !== "obra-acompanhamento-backup") {
    throw new Error("Arquivo inválido: não é um backup deste sistema.");
  }
  if (!file.tables || typeof file.tables !== "object") {
    throw new Error("Arquivo inválido: estrutura ausente.");
  }

  const report: RestoreReport = { workspaceRestored: false, perTable: {} };

  // Modo replace: apaga primeiro (ordem inversa)
  if (opts.mode === "replace") {
    onProgress?.({ stage: "delete" });
    for (const t of [...TABLES].reverse()) {
      const { error } = await db.from(t).delete().eq("company_id", companyId);
      if (error) console.error(`delete ${t}`, error);
    }
  }

  // Fotos primeiro: reenvia para o Storage com os mesmos paths,
  // assim as URLs salvas no workspace continuam válidas após a restauração.
  if (photos.size > 0) {
    let uploaded = 0;
    let failed = 0;
    let i = 0;
    for (const [path, blob] of photos) {
      i++;
      onProgress?.({ stage: "photos", current: i, total: photos.size });
      const isVideo = path.match(/\.(mp4|mov|webm|avi|mkv)$/i);
      const contentType = isVideo ? "video/mp4" : "image/jpeg";
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, blob, { contentType, upsert: true });
      if (error) {
        console.error(`upload foto ${path}`, error);
        failed++;
      } else {
        uploaded++;
      }
    }
    report.photos = { uploaded, total: photos.size, failed };
  }

  // Workspace
  if (file.workspace) {
    onProgress?.({ stage: "workspace" });
    // Reescreve URLs públicas das fotos para o bucket atual (caso o backup
    // tenha vindo de outro projeto Supabase). Mantém o mesmo path.
    const rewritten = photos.size > 0
      ? await rewritePhotoUrls(file.workspace, photos)
      : file.workspace;
    const { error } = await db
      .from("company_workspaces")
      .upsert(
        { company_id: companyId, workspace: rewritten },
        { onConflict: "company_id" },
      );
    if (!error) report.workspaceRestored = true;
    else console.error("workspace restore", error);
  }

  // Tabelas
  onProgress?.({ stage: "tables" });
  for (const t of TABLES) {
    const rows = (file.tables[t] ?? []) as Array<Record<string, unknown>>;
    const total = rows.length;
    if (total === 0) {
      report.perTable[t] = { inserted: 0, total: 0 };
      continue;
    }
    const fixed = rows.map((r) => ({ ...r, company_id: companyId }));

    let inserted = 0;
    let lastError: string | undefined;
    for (let i = 0; i < fixed.length; i += 500) {
      const batch = fixed.slice(i, i + 500);
      const { error } = await db
        .from(t)
        .upsert(batch, { onConflict: "id", ignoreDuplicates: false });
      if (error) {
        lastError = error.message;
        console.error(`restore ${t}`, error);
      } else {
        inserted += batch.length;
      }
    }
    report.perTable[t] = { inserted, total, error: lastError };
  }

  return report;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rewritePhotoUrls(workspace: any, photos: Map<string, Blob>): Promise<any> {
  try {
    const clone = JSON.parse(JSON.stringify(workspace));
    const signedUrls = await getDiaryPhotoUrls(Array.from(photos.keys()));
    for (const obra of clone?.obras ?? []) {
      for (const d of obra?.diarios ?? []) {
        for (const f of d?.fotos ?? []) {
          if (f?.path && photos.has(f.path)) {
            const signedUrl = signedUrls.get(f.path);
            if (signedUrl) f.url = signedUrl;
          }
        }
      }
    }
    return clone;
  } catch {
    return workspace;
  }
}
