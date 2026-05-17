import type { ProjectData } from "./types";

const KEY = "obra-acompanhamento-v1";

export function loadProject(): ProjectData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ProjectData) : null;
  } catch {
    return null;
  }
}

export function saveProject(data: ProjectData) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearProject() {
  localStorage.removeItem(KEY);
}
