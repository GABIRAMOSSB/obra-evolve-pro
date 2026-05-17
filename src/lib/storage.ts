import type { ProjectData, Workspace } from "./types";

const KEY = "obra-acompanhamento-v2";
const LEGACY_KEY = "obra-acompanhamento-v1";

function genId() {
  return (
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)) as string
  );
}

export function loadWorkspace(): Workspace {
  if (typeof window === "undefined") return { obras: [], activeId: null };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const ws = JSON.parse(raw) as Workspace;
      if (ws && Array.isArray(ws.obras)) return ws;
    }
    // Migrate v1
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
      const ws: Workspace = { obras: [obra], activeId: obra.id };
      localStorage.setItem(KEY, JSON.stringify(ws));
      return ws;
    }
  } catch {
    // ignore
  }
  return { obras: [], activeId: null };
}

export function saveWorkspace(ws: Workspace) {
  localStorage.setItem(KEY, JSON.stringify(ws));
}

export function clearWorkspace() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(LEGACY_KEY);
}

export function newObraId() {
  return genId();
}

// Backwards-compat single-obra helpers (no longer used by app, kept for safety)
export function loadProject(): ProjectData | null {
  const ws = loadWorkspace();
  return ws.obras.find((o) => o.id === ws.activeId) ?? ws.obras[0] ?? null;
}
export function saveProject(_data: ProjectData) {
  // no-op: use saveWorkspace
}
export function clearProject() {
  clearWorkspace();
}
