import * as XLSX from "xlsx";
import type { BudgetRow, ModeloImportacao } from "./types";
import { findSinteticoSheet, parseExcelSintetico } from "./excel-sintetico";

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
  modelo: ModeloImportacao;
}

export async function parseExcel(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // Detecta o modelo "Orçamento Sintético" pelo nome da aba.
  const sinteticoSheet = findSinteticoSheet(wb.SheetNames);
  if (sinteticoSheet) {
    const r = await parseExcelSintetico(file, sinteticoSheet);
    return {
      rows: r.rows,
      parsed: r.parsed,
      skipped: r.skipped,
      headerRowIndex: r.headerRowIndex,
      headerLabels: r.headerLabels,
      headerMap: r.headerMap,
      sheetName: r.sheetName,
      totalRows: r.totalRows,
      modelo: "modelo_orcamento_sintetico",
    };
  }

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
      // Ignora sub-cabeçalhos M.O. / MAT. (planilhas com 2 níveis sob "V.Unit c/BDI" e "Total")
      const isMO = cell.endsWith("mo");
      const isMAT = cell === "mat" || cell.endsWith("mat");

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
      else if (cell.includes("valorunit") && cell.includes("bdi") && !isMO && !isMAT) map.valorUnitBDI = idx;
      else if (cell.includes("vunit") && cell.includes("bdi") && !isMO && !isMAT) map.valorUnitBDI = idx;
      else if (
        (cell.includes("valorunit") || cell.includes("vunit") || cell === "preunit" || cell === "precounitario") &&
        !cell.includes("bdi") && !isMO && !isMAT &&
        map.valorUnit === undefined
      )
        map.valorUnit = idx;
      else if (
        (cell === "total" || cell.includes("valortotal") || cell === "precototal") &&
        !cell.includes("bdi") && !isMO && !isMAT
      )
        map.total = idx;
      else if (cell.includes("peso")) map.peso = idx;
    });
    return map;
  };

  // Detecta sub-cabeçalho M.O./MAT./Total na linha seguinte (planilhas de 2 níveis)
  const hasSubheader = (row: string[]) => {
    const ns = row.map(norm);
    return ns.includes("mo") && ns.includes("mat") && ns.includes("total");
  };

  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 4) continue;
    const cells = row.map((c) => String(c ?? ""));
    let map = buildMap(cells);
    let consumed = 1;
    const nextRowRaw = matrix[i + 1];
    const nextCells = nextRowRaw ? nextRowRaw.map((c) => String(c ?? "")) : null;
    // Força mesclagem se a linha seguinte for sub-cabeçalho M.O./MAT./Total,
    // ou se a linha atual sozinha não fechar os campos obrigatórios.
    const forceMerge = nextCells ? hasSubheader(nextCells) : false;
    if ((forceMerge || !REQUIRED_HEADERS.every((h) => map[h] !== undefined)) && nextCells) {
      const maxLen = Math.max(cells.length, nextCells.length);
      const merged: string[] = [];
      for (let k = 0; k < maxLen; k++) {
        merged.push(`${cells[k] ?? ""} ${nextCells[k] ?? ""}`.trim());
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
    // TOTAL: prioriza o valor da coluna "Total" da planilha (já vem com
    // a precisão original, sem perda por arredondamento de V.Unit c/ BDI).
    // Só recalcula (V.Unit c/ BDI × Quantidade) quando a coluna Total
    // estiver vazia/zerada.
    const unitForTotal = valorUnitBDI > 0 ? valorUnitBDI : valorUnit;
    const total =
      totalRaw > 0
        ? totalRaw
        : unitForTotal > 0 && quantidade > 0
          ? unitForTotal * quantidade
          : 0;
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
    const hasChild = rows.some((o) => o.item !== r.item && o.item.startsWith(r.item + "."));
    // ITEM EXECUTÁVEL: código + unidade + quantidade > 0 + total > 0.
    const isExecutable =
      !!r.codigo && !!r.und && r.quantidade > 0 && r.total > 0;
    // ETAPA / SUBETAPA: sem código, mas possui filhos na hierarquia.
    const isGroup = !r.codigo && hasChild;
    if (isExecutable) return true;
    if (isGroup) return true;
    skipped.push({
      rowIndex: parsed.find((p) => p.row === r)?.rowIndex ?? 0,
      cells: [r.item, r.codigo, r.descricao, r.und, String(r.quantidade), String(r.total)],
      reason: r.codigo
        ? "Código preenchido mas sem unidade/quantidade/total (item inválido)"
        : "Linha sem código e sem subitens (título/observação/total)",
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
