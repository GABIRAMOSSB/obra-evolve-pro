import type { BudgetRow, Evolution, Measurement } from "./types";

export type Status = "Não iniciada" | "Em andamento" | "Concluída";

export function getStatus(percent: number, valorExec: number): Status {
  if (percent <= 0 || valorExec <= 0) return "Não iniciada";
  if (percent >= 100 && valorExec > 0) return "Concluída";
  return "Em andamento";
}

/**
 * Normaliza evolução: retorna lista de medições, migrando formato legado
 * (`quantExec` único no nível da evolução) para uma medição fechada M1.
 */
export function getMeasurements(evo?: Evolution): Measurement[] {
  if (!evo) return [];
  if (evo.measurements && evo.measurements.length > 0) return evo.measurements;
  if (evo.quantExec && evo.quantExec > 0) {
    return [
      {
        id: "legacy-1",
        number: 1,
        quantExec: evo.quantExec,
        dataExec: evo.dataExec ?? "",
        observacoes: evo.observacoes ?? "",
        closed: true,
        closedAt: evo.dataExec ?? undefined,
      },
    ];
  }
  return [];
}

export function activityMetrics(row: BudgetRow, evo?: Evolution) {
  const measurements = getMeasurements(evo);
  const somaQtd = measurements.reduce((s, m) => s + (m.quantExec || 0), 0);
  // Cap acumulado no total previsto.
  const quantExec = row.quantidade > 0 ? Math.min(somaQtd, row.quantidade) : 0;
  const percent = row.quantidade > 0 ? (quantExec / row.quantidade) * 100 : 0;
  const valorExec = (percent / 100) * (row.total || 0);
  const quantRestante = Math.max(0, row.quantidade - quantExec);
  const valorRestante = Math.max(0, (row.total || 0) - valorExec);
  return {
    quantExec,
    percent,
    valorExec,
    quantRestante,
    valorRestante,
    status: getStatus(percent, valorExec),
    measurements,
    openMeasurement: measurements.find((m) => !m.closed),
    closedCount: measurements.filter((m) => m.closed).length,
  };
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
  return { total, exec, percent, status: getStatus(percent, exec) };
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
