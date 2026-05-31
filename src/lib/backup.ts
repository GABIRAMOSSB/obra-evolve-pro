// Backup/Restore: exporta e restaura todos os dados da empresa em um arquivo JSON.
// Inclui o workspace (obras/etapas/diários/evoluções) e todas as tabelas de
// cadastro/movimento escopadas por company_id. Fotos e XMLs continuam no Storage
// — o backup guarda as URLs/paths referenciados.

import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

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
}

export async function exportBackup(
  companyId: string,
  companyName?: string,
): Promise<BackupFile> {
  // Workspace (JSON com obras e diários)
  const { data: wsRow, error: wsErr } = await db
    .from("company_workspaces")
    .select("workspace")
    .eq("company_id", companyId)
    .maybeSingle();
  if (wsErr) throw wsErr;

  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    // page de 1000 em 1000 para evitar o limite padrão do PostgREST
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

export function downloadBackup(file: BackupFile) {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `backup-obras-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface RestoreOptions {
  // "merge": faz upsert por id (mantém o que já existe e atualiza/cria o resto)
  // "replace": apaga tudo da empresa antes de restaurar (USE COM CUIDADO)
  mode: "merge" | "replace";
}

export interface RestoreReport {
  workspaceRestored: boolean;
  perTable: Record<string, { inserted: number; total: number; error?: string }>;
}

export async function restoreBackup(
  companyId: string,
  file: BackupFile,
  opts: RestoreOptions,
): Promise<RestoreReport> {
  if (file?.format !== "obra-acompanhamento-backup") {
    throw new Error("Arquivo inválido: não é um backup deste sistema.");
  }
  if (!file.tables || typeof file.tables !== "object") {
    throw new Error("Arquivo inválido: estrutura ausente.");
  }

  const report: RestoreReport = { workspaceRestored: false, perTable: {} };

  // Modo replace: apaga primeiro (ordem inversa)
  if (opts.mode === "replace") {
    for (const t of [...TABLES].reverse()) {
      const { error } = await db.from(t).delete().eq("company_id", companyId);
      if (error) console.error(`delete ${t}`, error);
    }
  }

  // Workspace
  if (file.workspace) {
    const { error } = await db
      .from("company_workspaces")
      .upsert(
        { company_id: companyId, workspace: file.workspace },
        { onConflict: "company_id" },
      );
    if (!error) report.workspaceRestored = true;
    else console.error("workspace restore", error);
  }

  // Tabelas
  for (const t of TABLES) {
    const rows = (file.tables[t] ?? []) as Array<Record<string, unknown>>;
    const total = rows.length;
    if (total === 0) {
      report.perTable[t] = { inserted: 0, total: 0 };
      continue;
    }
    // Força o company_id atual (segurança: backup de outra empresa não invade)
    const fixed = rows.map((r) => ({ ...r, company_id: companyId }));

    // Lotes de 500
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

export async function readBackupFile(file: File): Promise<BackupFile> {
  const text = await file.text();
  return JSON.parse(text) as BackupFile;
}
