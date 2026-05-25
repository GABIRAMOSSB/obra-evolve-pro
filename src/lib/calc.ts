import type { BudgetRow, Evolution, Measurement, ObraInfo } from "./types";

export interface ResumoCabecalhoBM {
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
  percentualAcumulado: number;
  saldoRestante: number;
}

/**
 * Função única de cálculo do resumo do cabeçalho do Boletim de Medição.
 * IMPORTANTE: sempre receber **TODAS** as linhas (data.rows) — nunca a lista
 * filtrada — para que os totais globais não mudem com filtros de tela.
 */
export function calcularResumoCabecalhoBM(
  allRows: BudgetRow[],
  evolutions: Record<string, Evolution>,
  selectedBM: number,
  info: ObraInfo = {},
): ResumoCabecalhoBM {
  let valorTotalObra = 0;
  let valorDestaMedicao = 0;
  let valorAcumulado = 0;

  for (const r of allRows) {
    if (r.isGroup) continue;
    valorTotalObra += r.total || 0;
    const vu = r.valorUnitBDI || r.valorUnit || 0;
    const list = evolutions[r.item]?.measurements ?? [];
    for (const mm of list) {
      const q = mm.quantExec || 0;
      if (mm.number === selectedBM) valorDestaMedicao += q * vu;
      if (mm.number <= selectedBM) valorAcumulado += q * vu;
    }
  }

  // Datas: fim = closedAt da medição selecionada (ou hoje, se em aberto)
  //        início = closedAt da medição anterior (ou data de início da obra)
  let prevClose: string | undefined;
  let thisClose: string | undefined;
  for (const evo of Object.values(evolutions)) {
    for (const mm of evo?.measurements ?? []) {
      if (!mm.closed || !mm.closedAt) continue;
      if (mm.number === selectedBM - 1 && (!prevClose || mm.closedAt > prevClose)) prevClose = mm.closedAt;
      if (mm.number === selectedBM && (!thisClose || mm.closedAt > thisClose)) thisClose = mm.closedAt;
    }
  }
  const periodoInicio = prevClose ?? info.dataInicioObra;
  const periodoFim = thisClose;
  const toBR = (iso?: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
  };
  const periodoLabel = periodoInicio && periodoFim
    ? `${toBR(periodoInicio)} a ${toBR(periodoFim)}`
    : periodoInicio
      ? `${toBR(periodoInicio)} a ${new Date().toLocaleDateString("pt-BR")}`
      : `até ${new Date().toLocaleDateString("pt-BR")}`;
  const dataMedicao = periodoFim ? toBR(periodoFim) : new Date().toLocaleDateString("pt-BR");

  if (valorAcumulado > valorTotalObra) valorAcumulado = valorTotalObra;
  const percentualAcumulado = valorTotalObra > 0 ? (valorAcumulado / valorTotalObra) * 100 : 0;
  const saldoRestante = Math.max(0, valorTotalObra - valorAcumulado);
  const codigoBM = `BM-${String(selectedBM).padStart(2, "0")}`;

  return {
    numeroBM: selectedBM,
    codigoBM,
    descricaoBM: `${codigoBM} (${selectedBM}ª Medição)`,
    periodoInicio,
    periodoFim,
    periodoLabel,
    dataMedicao,
    valorTotalObra,
    valorDestaMedicao,
    valorAcumulado,
    percentualAcumulado,
    saldoRestante,
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

export const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};
