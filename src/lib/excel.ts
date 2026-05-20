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

const REQUIRED_HEADERS = ["item", "banco", "descricao", "und", "quantidade", "total"];

export interface SkippedRow {
  rowIndex: number; // 1-based as in Excel
  cells: string[];
  reason: string;
}

export interface ParsedRow {
  rowIndex: number; // 1-based as in Excel
  row: BudgetRow;
}

export interface ParseResult {
  rows: BudgetRow[];
  parsed: ParsedRow[];
  skipped: SkippedRow[];
  headerRowIndex: number; // 1-based
  headerLabels: string[]; // labels actually picked, in column order present
  headerMap: Record<string, number>; // logical key -> column index
  sheetName: string;
  totalRows: number;
}

export async function parseExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find header row (try single row, then merged with next row for 2-line headers)
  let headerRow = -1;
  let headerMap: Record<string, number> = {};
  let headerRowsConsumed = 1;

  const buildMap = (cells: string[]) => {
    const normalized = cells.map(norm);
    const map: Record<string, number> = {};
    normalized.forEach((cell, idx) => {
      if (cell.startsWith("item") && map.item === undefined) map.item = idx;
      else if (cell === "codigo" || cell === "cod") map.codigo = idx;
      else if (cell === "banco" || cell === "fonte") map.banco = idx;
      else if (cell.startsWith("descric") || cell === "servico" || cell === "discriminacao")
        map.descricao = idx;
      else if (cell === "und" || cell === "un" || cell === "unid" || cell === "unidade" || cell === "u")
        map.und = idx;
      else if (
        (cell.startsWith("quant") || cell === "qtd" || cell === "qte" || cell === "qtde") &&
        map.quantidade === undefined
      )
        map.quantidade = idx;
      else if (cell.includes("valorunit") && cell.includes("bdi")) map.valorUnitBDI = idx;
      else if (cell.includes("vunit") && cell.includes("bdi")) map.valorUnitBDI = idx;
      else if (
        (cell.includes("valorunit") || cell.includes("vunit") || cell === "preunit" || cell === "precounitario") &&
        map.valorUnit === undefined
      )
        map.valorUnit = idx;
      else if (cell === "total" || cell.includes("valortotal") || cell === "precototal")
        map.total = idx;
      else if (cell.includes("peso")) map.peso = idx;
    });
    return map;
  };

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 4) continue;
    const cells = row.map((c) => String(c ?? ""));
    let map = buildMap(cells);
    let consumed = 1;
    // Try merging with next row if not all required headers found
    if (!REQUIRED_HEADERS.every((h) => map[h] !== undefined) && matrix[i + 1]) {
      const next = matrix[i + 1].map((c) => String(c ?? ""));
      const maxLen = Math.max(cells.length, next.length);
      const merged: string[] = [];
      for (let k = 0; k < maxLen; k++) {
        merged.push(`${cells[k] ?? ""} ${next[k] ?? ""}`.trim());
      }
      const mergedMap = buildMap(merged);
      if (REQUIRED_HEADERS.every((h) => mergedMap[h] !== undefined)) {
        map = mergedMap;
        consumed = 2;
      }
    }
    if (REQUIRED_HEADERS.every((h) => map[h] !== undefined)) {
      headerRow = i;
      headerMap = map;
      headerRowsConsumed = consumed;
      break;
    }
  }

  if (headerRow < 0) {
    throw new Error(
      "Não foi possível localizar os cabeçalhos da planilha (Item, Descrição, Und, Total).",
    );
  }

  const headerLabels: string[] = [];
  const headerRowVals = matrix[headerRow] ?? [];
  Object.entries(headerMap)
    .sort((a, b) => a[1] - b[1])
    .forEach(([, idx]) => {
      headerLabels.push(String(headerRowVals[idx] ?? "").trim());
    });

  const rows: BudgetRow[] = [];
  const parsed: ParsedRow[] = [];
  const skipped: SkippedRow[] = [];

  const rowToStrings = (row: unknown[]) =>
    (row ?? []).map((c) => String(c ?? "").trim());

  for (let i = headerRow + headerRowsConsumed; i < matrix.length; i++) {
    const row = matrix[i];
    const excelRowIndex = i + 1;
    if (!row) continue;
    const cells = rowToStrings(row);

    const rawItem = String(row[headerMap.item] ?? "").trim();
    // Normalize: strip trailing dot(s), collapse spaces
    const item = rawItem.replace(/\s+/g, "").replace(/\.+$/, "");
    const descricao = String(row[headerMap.descricao] ?? "").trim();

    if (!item && !descricao && cells.every((c) => !c)) continue; // truly blank

    if (!item || !descricao) {
      skipped.push({
        rowIndex: excelRowIndex,
        cells,
        reason: !item && !descricao ? "Item e Descrição vazios" : !item ? "Item vazio" : "Descrição vazia",
      });
      continue;
    }
    if (norm(item) === "item" && norm(descricao).startsWith("descric")) {
      skipped.push({ rowIndex: excelRowIndex, cells, reason: "Cabeçalho repetido" });
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

    const codigo = String(row[headerMap.codigo] ?? "").trim();
    const und = String(row[headerMap.und] ?? "").trim();
    const quantidade = toNumber(row[headerMap.quantidade]);
    const valorUnit = toNumber(row[headerMap.valorUnit]);
    const valorUnitBDI = toNumber(row[headerMap.valorUnitBDI]);
    const totalRaw = toNumber(row[headerMap.total]);
    // Regra: TOTAL deve ser sempre V.Unit c/ BDI × Quantidade quando ambos
    // existirem. Caso a coluna BDI não exista, cai para V.Unit × Quantidade.
    // Só usa o valor da coluna "Total" da planilha quando não há nem unit
    // nem BDI preenchido (linhas de grupo, p.ex.).
    const unitForTotal = valorUnitBDI > 0 ? valorUnitBDI : valorUnit;
    const total =
      unitForTotal > 0 && quantidade > 0
        ? unitForTotal * quantidade
        : totalRaw;
    // Regra de classificação: ITEM EXECUTÁVEL = possui CÓDIGO preenchido.
    // Demais linhas são etapas/subetapas (ou serão descartadas adiante se
    // não tiverem filhos).
    const isGroup = !codigo;

    // Effective level: count only non-zero segments so "1.2.0.0.1" reads as
    // depth 3 (etapa 1 → sub 1.2 → serviço 1.2.0.0.1) for indentation purposes.
    const segments = item.split(".");
    const effectiveLevel = segments.filter((s, i) => i === 0 || s !== "0").length;

    const budgetRow: BudgetRow = {
      item,
      codigo,
      banco: String(row[headerMap.banco] ?? "").trim(),
      descricao,
      und,
      quantidade,
      valorUnit,
      valorUnitBDI,
      total,
      peso: toNumber(row[headerMap.peso]),
      isGroup,
      level: effectiveLevel,
    };
    rows.push(budgetRow);
    parsed.push({ rowIndex: excelRowIndex, row: budgetRow });
  }

  // Structural re-classification: an item is a group if any other parsed
  // item starts with `${item}.` — this preserves the spreadsheet hierarchy
  // even when intermediate groups carry totals/quantities.
  for (const r of rows) {
    const hasChild = rows.some((o) => o.item !== r.item && o.item.startsWith(r.item + "."));
    if (hasChild) r.isGroup = true;
  }

  // Remove non-executable rows that are NOT real etapas/subetapas
  // (i.e. they have no children) — these are títulos, observações,
  // textos informativos, subtítulos, totais gerais, etc.
  const filtered = rows.filter((r) => {
    // Regra: é ITEM quando tem CÓDIGO preenchido (independente das demais
    // colunas). Demais linhas só permanecem se forem etapas/subetapas
    // (i.e., possuem filhos na hierarquia).
    const isItem = !!r.codigo;
    const hasChild = rows.some((o) => o.item !== r.item && o.item.startsWith(r.item + "."));
    if (isItem) return true;
    if (hasChild) return true;
    skipped.push({
      rowIndex: parsed.find((p) => p.row === r)?.rowIndex ?? 0,
      cells: [r.item, r.codigo, r.descricao, r.und, String(r.quantidade), String(r.total)],
      reason: "Linha sem código e sem subitens (título/observação/total)",
    });
    return false;
  });

  if (filtered.length === 0) {
    throw new Error("Nenhum item válido encontrado na planilha.");
  }

  return {
    rows: filtered,
    parsed: parsed.filter((p) => filtered.includes(p.row)),
    skipped,
    headerRowIndex: headerRow + 1,
    headerLabels,
    headerMap,
    sheetName,
    totalRows: matrix.length,
  };
}
