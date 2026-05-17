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

  // Migration: if no cloud data and we have local data, push it once.
  if (
    (!remote || remote.obras.length === 0) &&
    typeof window !== "undefined" &&
    !localStorage.getItem(MIGRATED_KEY)
  ) {
    const local = readLocal();
    if (local && local.obras.length > 0) {
      await saveWorkspaceCloud(userId, local);
      localStorage.setItem(MIGRATED_KEY, "1");
      return local;
    }
  }

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
