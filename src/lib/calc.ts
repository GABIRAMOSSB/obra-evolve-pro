import type { BudgetRow, Evolution, Measurement, ObraInfo } from "./types";

export interface ResumoCabecalhoBM {
  hasMeasurement: boolean;
  numeroBM: number;
  codigoBM: string;
  descricaoBM: string;
  periodoInicio?: string; // ISO yyyy-mm-dd
  periodoFim?: string; // ISO yyyy-mm-dd
  periodoLabel: string;
  dataMedicao: string; // dd/mm/yyyy
  valorTotalObra: number;
  valorDestaMedicao: number;
  valorAcumulado: number;
  acumuladoAnterior: number;
  percentualAcumulado: number;
  saldoRestante: number;
  diasDecorridos: number;
  diasRestantes: number;
}

export interface SavedMeasurement {
  number: number;
  /** Data oficial da medição (yyyy-mm-dd ou ISO completo). */
  date: string;
}

/**
 * Normaliza uma data (string ISO completa, "yyyy-mm-dd", Date ou null/undefined)
 * para o padrão brasileiro DD/MM/AAAA.
 *
 * Aceita inclusive strings ISO com horário/fuso (ex.: 2026-05-20T19:59:49.020Z)
 * e nunca produz saídas quebradas como "20T19:59:49.020Z/05/2026".
 */
export function formatarDataBR(data?: string | Date | null): string {
  if (data === undefined || data === null || data === "") return "";
  let d: Date;
  if (data instanceof Date) {
    d = data;
  } else {
    const s = String(data).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      d = new Date(s + "T12:00:00");
    } else {
      d = new Date(s);
    }
  }
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Lista de medições efetivamente salvas (fechadas) no projeto, ordenada por número. */
export function getSavedMeasurements(
  evolutions: Record<string, Evolution>,
): SavedMeasurement[] {
  const dateByNumber = new Map<number, string>();
  for (const evo of Object.values(evolutions || {})) {
    for (const m of evo?.measurements ?? []) {
      if (!m.closed) continue;
      const d = m.closedAt || m.dataExec || "";
      const cur = dateByNumber.get(m.number);
      if (!cur || (d && d > cur)) dateByNumber.set(m.number, d);
    }
  }
  return Array.from(dateByNumber.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([number, date]) => ({ number, date }));
}

function parseISODate(s?: string | null): Date | null {
  if (!s) return null;
  const str = String(s).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + "T12:00:00") : new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function diffInDays(a: Date, b: Date): number {
  const MS = 1000 * 60 * 60 * 24;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MS));
}

/**
 * Monta os dados do cabeçalho do Boletim de Medição.
 *
 * - Quando `selectedBM` é `null`/`undefined`, o resumo representa o estado geral
 *   da obra (sem nº de BM, sem data/período de medição).
 * - Quando `selectedBM` aponta para uma medição salva, calcula período, valores,
 *   acumulado anterior, dias decorridos e dias restantes da obra.
 */
export function calcularResumoCabecalhoBM(
  allRows: BudgetRow[],
  evolutions: Record<string, Evolution>,
  selectedBM: number | null | undefined,
  info: ObraInfo = {},
): ResumoCabecalhoBM {
  const saved = getSavedMeasurements(evolutions);
  const current = selectedBM ? saved.find((s) => s.number === selectedBM) : undefined;
  const hasMeasurement = !!current;
  const effectiveBM = current?.number ?? 0;

  let previous: SavedMeasurement | undefined;
  if (hasMeasurement) {
    for (const s of saved) {
      if (s.number < effectiveBM && (!previous || s.number > previous.number)) previous = s;
    }
  }

  let valorTotalObra = 0;
  let valorDestaMedicao = 0;
  let valorAcumulado = 0;
  let acumuladoAnterior = 0;

  for (const r of allRows) {
    if (r.isGroup) continue;
    valorTotalObra += r.total || 0;
    const vu = r.valorUnitBDI || r.valorUnit || 0;
    const list = evolutions[r.item]?.measurements ?? [];
    for (const mm of list) {
      const q = mm.quantExec || 0;
      const val = q * vu;
      if (hasMeasurement) {
        if (mm.number === effectiveBM) valorDestaMedicao += val;
        if (mm.number < effectiveBM) acumuladoAnterior += val;
        if (mm.number <= effectiveBM) valorAcumulado += val;
      } else if (mm.closed) {
        valorAcumulado += val;
      }
    }
  }

  const periodoInicio = hasMeasurement
    ? previous?.date ?? info.dataInicioObra
    : undefined;
  const periodoFim = hasMeasurement ? current?.date : undefined;
  const periodoLabel = hasMeasurement
    ? `${formatarDataBR(periodoInicio)} a ${formatarDataBR(periodoFim)}`
    : "";
  const dataMedicao = hasMeasurement ? formatarDataBR(periodoFim) : "";

  const dataInicio = parseISODate(info.dataInicioObra);
  const refFim = hasMeasurement ? parseISODate(periodoFim) : new Date();
  let diasDecorridos = 0;
  if (dataInicio && refFim) diasDecorridos = diffInDays(dataInicio, refFim);
  const prazo = info.prazoContratualDias ?? 0;
  const diasRestantes = prazo > 0 ? Math.max(0, prazo - diasDecorridos) : 0;

  if (valorAcumulado > valorTotalObra) valorAcumulado = valorTotalObra;
  const percentualAcumulado = valorTotalObra > 0 ? (valorAcumulado / valorTotalObra) * 100 : 0;
  const saldoRestante = Math.max(0, valorTotalObra - valorAcumulado);

  const codigoBM = hasMeasurement ? `BM-${String(effectiveBM).padStart(2, "0")}` : "";
  const descricaoBM = hasMeasurement ? `${codigoBM} (${effectiveBM}ª Medição)` : "";

  return {
    hasMeasurement,
    numeroBM: effectiveBM,
    codigoBM,
    descricaoBM,
    periodoInicio,
    periodoFim,
    periodoLabel,
    dataMedicao,
    valorTotalObra,
    valorDestaMedicao,
    valorAcumulado,
    acumuladoAnterior,
    percentualAcumulado,
    saldoRestante,
    diasDecorridos,
    diasRestantes,
  };
}

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

export const fmtDate = (iso?: string | Date | null) => formatarDataBR(iso);
