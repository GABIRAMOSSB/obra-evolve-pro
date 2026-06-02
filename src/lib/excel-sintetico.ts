import * as XLSX from "xlsx";
import type { BudgetRow } from "./types";

function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9%]/g, "")
    .trim();
}

function toNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export interface SkippedRow {
  rowIndex: number;
  cells: string[];
  reason: string;
}

export interface ParsedRow {
  rowIndex: number;
  row: BudgetRow;
}

export interface SinteticoParseResult {
  modelo: "modelo_orcamento_sintetico";
  rows: BudgetRow[];
  parsed: ParsedRow[];
  skipped: SkippedRow[];
  headerRowIndex: number;
  headerLabels: string[];
  headerMap: Record<string, number>;
  sheetName: string;
  totalRows: number;
}

interface HeaderMap {
  item: number;
  codigo: number;
  banco: number;
  descricao: number;
  und: number;
  quantidade: number;
  valorUnit: number;
  // sob "Valor Unit com BDI"
  vUnitBDI_MO: number;
  vUnitBDI_MAT: number;
  vUnitBDI_Total: number;
  // sob "Total"
  total_MO: number;
  total_MAT: number;
  total_Total: number;
}

function detectHeader(matrix: unknown[][]): {
  headerRow: number;
  map: HeaderMap;
  labels: string[];
} | null {
  for (let i = 0; i < matrix.length - 1; i++) {
    const r1 = (matrix[i] ?? []).map((c) => norm(c));
    const r2 = (matrix[i + 1] ?? []).map((c) => norm(c));
    if (!r1.length) continue;

    const findCol = (predicate: (s: string) => boolean, from = 0) =>
      r1.findIndex((c, idx) => idx >= from && predicate(c));

    const itemCol = findCol((c) => c === "item" || c.startsWith("item"));
    const codigoCol = findCol((c) => c === "codigo" || c === "cod");
    const bancoCol = findCol((c) => c === "banco" || c === "fonte");
    const descCol = findCol((c) => c.startsWith("descric") || c === "servico");
    const undCol = findCol((c) => c === "und" || c === "un" || c === "unid" || c === "unidade");
    const qtdCol = findCol((c) => c.startsWith("quant") || c === "qtd" || c === "qte");
    // "Valor Unit" sem BDI
    const valorUnitCol = r1.findIndex(
      (c) =>
        (c.includes("valorunit") || c.includes("vunit") || c === "preunit") &&
        !c.includes("bdi"),
    );
    // "Valor Unit com BDI" (cabeça do grupo de 3 sub-colunas)
    const vUnitBDIHead = r1.findIndex(
      (c) => (c.includes("valorunit") || c.includes("vunit")) && c.includes("bdi"),
    );
    // "Total" (cabeça do grupo de 3 sub-colunas)
    // Pode aparecer mais de uma vez; pega o primeiro "total" puro
    // depois das colunas anteriores.
    let totalHead = -1;
    for (let k = 0; k < r1.length; k++) {
      if (r1[k] === "total" && k > (vUnitBDIHead >= 0 ? vUnitBDIHead : 0)) {
        totalHead = k;
        break;
      }
    }

    if (
      itemCol < 0 ||
      codigoCol < 0 ||
      descCol < 0 ||
      undCol < 0 ||
      qtdCol < 0 ||
      vUnitBDIHead < 0 ||
      totalHead < 0
    ) {
      continue;
    }

    // Sub-cabeçalhos M.O. / MAT. / Total na linha seguinte
    const isMO = (s: string) => s === "mo" || s.endsWith("mo");
    const isMAT = (s: string) => s === "mat" || s.endsWith("mat");
    const isTot = (s: string) => s === "total";

    // procura nas 3 colunas a partir de vUnitBDIHead
    const findInRange = (start: number, end: number, pred: (s: string) => boolean) => {
      for (let k = start; k <= end; k++) if (pred(r2[k] ?? "")) return k;
      return -1;
    };
    const bdiMO = findInRange(vUnitBDIHead, vUnitBDIHead + 2, isMO);
    const bdiMAT = findInRange(vUnitBDIHead, vUnitBDIHead + 2, isMAT);
    const bdiTotal = findInRange(vUnitBDIHead, vUnitBDIHead + 2, isTot);
    const totMO = findInRange(totalHead, totalHead + 2, isMO);
    const totMAT = findInRange(totalHead, totalHead + 2, isMAT);
    const totTotal = findInRange(totalHead, totalHead + 2, isTot);

    if (
      bdiMO < 0 ||
      bdiMAT < 0 ||
      bdiTotal < 0 ||
      totMO < 0 ||
      totMAT < 0 ||
      totTotal < 0
    ) {
      continue;
    }

    const map: HeaderMap = {
      item: itemCol,
      codigo: codigoCol,
      banco: bancoCol >= 0 ? bancoCol : -1,
      descricao: descCol,
      und: undCol,
      quantidade: qtdCol,
      valorUnit: valorUnitCol,
      vUnitBDI_MO: bdiMO,
      vUnitBDI_MAT: bdiMAT,
      vUnitBDI_Total: bdiTotal,
      total_MO: totMO,
      total_MAT: totMAT,
      total_Total: totTotal,
    };

    const labels: string[] = [];
    const headerVals = matrix[i] ?? [];
    Object.values(map)
      .filter((v) => typeof v === "number" && v >= 0)
      .sort((a, b) => (a as number) - (b as number))
      .forEach((idx) => {
        labels.push(String((headerVals as unknown[])[idx as number] ?? "").trim());
      });

    return { headerRow: i, map, labels };
  }
  return null;
}

export async function parseExcelSintetico(
  file: File,
  sheetName: string,
): Promise<SinteticoParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Aba "${sheetName}" não encontrada.`);
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const detected = detectHeader(matrix);
  if (!detected) {
    throw new Error(
      "Não foi possível localizar os cabeçalhos da aba Orçamento Sintético (Item, Código, Descrição, Und, Quant., Valor Unit com BDI, Total).",
    );
  }
  const { headerRow, map, labels } = detected;

  const rows: BudgetRow[] = [];
  const parsed: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];

  // pula as 2 linhas de cabeçalho
  for (let i = headerRow + 2; i < matrix.length; i++) {
    const row = matrix[i] ?? [];
    const excelRowIndex = i + 1;
    const cells = row.map((c) => String(c ?? "").trim());

    const rawItem = String(row[map.item] ?? "").trim();
    const item = rawItem.replace(/\s+/g, "").replace(/\.+$/, "");
    const descricao = String(row[map.descricao] ?? "").trim();

    if (!item && !descricao && cells.every((c) => !c)) continue;
    if (!item || !descricao) {
      skipped.push({
        rowIndex: excelRowIndex,
        cells,
        reason: !item ? "Item vazio" : "Descrição vazia",
      });
      continue;
    }
    if (!/^\d+(\.\d+)*$/.test(item)) {
      skipped.push({
        rowIndex: excelRowIndex,
        cells,
        reason: `Item em formato inválido ("${rawItem}")`,
      });
      continue;
    }

    const codigo = String(row[map.codigo] ?? "").trim();
    const banco = map.banco >= 0 ? String(row[map.banco] ?? "").trim() : "";
    const und = String(row[map.und] ?? "").trim();
    const quantidade = toNumber(row[map.quantidade]);
    const valorUnit = map.valorUnit >= 0 ? toNumber(row[map.valorUnit]) : 0;
    const vUnitBDI_MO = toNumber(row[map.vUnitBDI_MO]);
    const vUnitBDI_MAT = toNumber(row[map.vUnitBDI_MAT]);
    const vUnitBDI_Total = toNumber(row[map.vUnitBDI_Total]);
    const totalMO = toNumber(row[map.total_MO]);
    const totalMAT = toNumber(row[map.total_MAT]);
    const totalTotal = toNumber(row[map.total_Total]);

    // Etapa: sem código, sem unidade, sem quantidade
    const isEtapa = !codigo && !und && quantidade === 0;
    // Composição: tem código, unidade e quantidade
    const isComposicao = !!codigo && !!und && quantidade > 0;

    if (!isEtapa && !isComposicao) {
      // tem descrição mas formato inválido para composição -> tratamos como etapa
      // (item nivelado, descrição preenchida)
    }

    const tipoLinha: "etapa" | "composicao" = isComposicao ? "composicao" : "etapa";

    const segments = item.split(".");
    const nivelHierarquico = segments.length;
    const itemPai = segments.length > 1 ? segments.slice(0, -1).join(".") : "";

    const precoVendaTotal =
      totalTotal > 0
        ? totalTotal
        : vUnitBDI_Total > 0 && quantidade > 0
          ? vUnitBDI_Total * quantidade
          : 0;

    const budgetRow: BudgetRow = {
      item,
      codigo,
      banco,
      descricao,
      und,
      quantidade,
      valorUnit,
      valorUnitBDI: vUnitBDI_Total,
      total: precoVendaTotal,
      peso: 0,
      isGroup: tipoLinha === "etapa",
      level: nivelHierarquico,
      modelo: "modelo_orcamento_sintetico",
      valorUnitMO: vUnitBDI_MO,
      valorUnitMaterial: vUnitBDI_MAT,
      totalMO,
      totalMaterial: totalMAT,
      precoVendaTotal,
      itemPai,
      nivelHierarquico,
      tipoLinha,
    };

    rows.push(budgetRow);
    parsed.push({ rowIndex: excelRowIndex, row: budgetRow });
  }

  if (rows.length === 0) {
    throw new Error("Nenhum item válido encontrado na aba Orçamento Sintético.");
  }

  // mapa para headerMap "público" (chaves estáveis)
  const headerMap: Record<string, number> = {
    item: map.item,
    codigo: map.codigo,
    descricao: map.descricao,
    und: map.und,
    quantidade: map.quantidade,
    "valorUnit c/ BDI (MO)": map.vUnitBDI_MO,
    "valorUnit c/ BDI (MAT)": map.vUnitBDI_MAT,
    "valorUnit c/ BDI (Total)": map.vUnitBDI_Total,
    "Total (MO)": map.total_MO,
    "Total (MAT)": map.total_MAT,
    "Total (Total)": map.total_Total,
  };
  if (map.banco >= 0) headerMap.banco = map.banco;
  if (map.valorUnit >= 0) headerMap["valorUnit (sem BDI)"] = map.valorUnit;

  return {
    modelo: "modelo_orcamento_sintetico",
    rows,
    parsed,
    skipped,
    headerRowIndex: headerRow + 1,
    headerLabels: labels,
    headerMap,
    sheetName,
    totalRows: matrix.length,
  };
}

/** Retorna o nome exato da aba "Orçamento Sintético" se existir. */
export function findSinteticoSheet(sheetNames: string[]): string | null {
  for (const name of sheetNames) {
    if (norm(name).includes("orcamentosintetico")) return name;
  }
  return null;
}
