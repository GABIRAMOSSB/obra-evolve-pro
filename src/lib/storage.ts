import { supabase } from "@/integrations/supabase/client";
import type { ProjectData, Workspace } from "./types";

const KEY = "obra-acompanhamento-v2";
const LEGACY_KEY = "obra-acompanhamento-v1";
const MIGRATED_KEY = "obra-acompanhamento-cloud-migrated";

function genId() {
  return (
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)) as string
  );
}

function emptyWs(): Workspace {
  return { obras: [], activeId: null };
}

function readLocal(): Workspace | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const ws = JSON.parse(raw) as Workspace;
      if (ws && Array.isArray(ws.obras)) return ws;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const old = JSON.parse(legacy) as Partial<ProjectData>;
      const obra: ProjectData = {
        id: genId(),
        nome: old.fileName?.replace(/\.[^.]+$/, "") || "Obra 1",
        fileName: old.fileName || "",
        importedAt: old.importedAt || new Date().toISOString(),
        rows: old.rows || [],
        evolutions: old.evolutions || {},
        diaries: old.diaries || [],
      };
      return { obras: [obra], activeId: obra.id };
    }
  } catch {
    // ignore
  }
  return null;
}

export interface MigrationPlan {
  needed: boolean;
  obrasCount: number;
  diariesCount: number;
  fotosCount: number;
  local: Workspace | null;
}

export function detectMigration(): MigrationPlan {
  if (typeof window === "undefined" || localStorage.getItem(MIGRATED_KEY)) {
    return { needed: false, obrasCount: 0, diariesCount: 0, fotosCount: 0, local: null };
  }
  const local = readLocal();
  if (!local || local.obras.length === 0) {
    return { needed: false, obrasCount: 0, diariesCount: 0, fotosCount: 0, local: null };
  }
  let diaries = 0;
  let fotos = 0;
  for (const o of local.obras) {
    diaries += o.diaries?.length ?? 0;
    for (const d of o.diaries ?? []) fotos += d.fotos?.length ?? 0;
  }
  return { needed: true, obrasCount: local.obras.length, diariesCount: diaries, fotosCount: fotos, local };
}

export function markMigrated() {
  if (typeof window !== "undefined") localStorage.setItem(MIGRATED_KEY, "1");
}

export async function loadWorkspaceCloud(userId: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from("user_workspaces")
    .select("workspace")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("loadWorkspaceCloud", error);
  }
  const remote = (data?.workspace as Workspace | undefined) ?? null;
  return remote ?? emptyWs();
}

export async function saveWorkspaceCloud(userId: string, ws: Workspace) {
  const { error } = await supabase
    .from("user_workspaces")
    .upsert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { user_id: userId, workspace: ws as any },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("saveWorkspaceCloud", error);
    throw error;
  }
}

export function newObraId() {
  return genId();
}
