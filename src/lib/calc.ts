import type { BudgetRow, Evolution } from "./types";

export type Status = "Não iniciada" | "Em andamento" | "Concluída";

export function getStatus(percent: number): Status {
  if (percent <= 0) return "Não iniciada";
  if (percent >= 100) return "Concluída";
  return "Em andamento";
}

export function activityMetrics(row: BudgetRow, evo?: Evolution) {
  const quantExec = evo?.quantExec ?? 0;
  const percent = row.quantidade > 0 ? Math.min(100, (quantExec / row.quantidade) * 100) : 0;
  const valorExec = (percent / 100) * row.total;
  const quantRestante = Math.max(0, row.quantidade - quantExec);
  const valorRestante = Math.max(0, row.total - valorExec);
  return { quantExec, percent, valorExec, quantRestante, valorRestante, status: getStatus(percent) };
}

export function isChildOf(child: string, parent: string) {
  return child !== parent && child.startsWith(parent + ".");
}

export function groupMetrics(
  group: BudgetRow,
  rows: BudgetRow[],
  evolutions: Record<string, Evolution>,
) {
  let total = 0;
  let exec = 0;
  for (const r of rows) {
    if (!r.isGroup && isChildOf(r.item, group.item)) {
      total += r.total;
      exec += activityMetrics(r, evolutions[r.item]).valorExec;
    }
  }
  const percent = total > 0 ? (exec / total) * 100 : 0;
  return { total, exec, percent, status: getStatus(percent) };
}

export function projectMetrics(rows: BudgetRow[], evolutions: Record<string, Evolution>) {
  let total = 0;
  let exec = 0;
  let concluidas = 0;
  let andamento = 0;
  let naoIniciadas = 0;
  for (const r of rows) {
    if (r.isGroup) continue;
    total += r.total;
    const m = activityMetrics(r, evolutions[r.item]);
    exec += m.valorExec;
    if (m.status === "Concluída") concluidas++;
    else if (m.status === "Em andamento") andamento++;
    else naoIniciadas++;
  }
  const percent = total > 0 ? (exec / total) * 100 : 0;
  return { total, exec, restante: total - exec, percent, concluidas, andamento, naoIniciadas };
}

export function findParentGroup(item: string, rows: BudgetRow[]): BudgetRow | undefined {
  // top-level group (first segment)
  const top = item.split(".")[0];
  return rows.find((r) => r.item === top && r.isGroup);
}

export const fmtBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtNum = (n: number, dec = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: dec, maximumFractionDigits: dec });

export const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};
