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

const REQUIRED_HEADERS = ["item", "descricao", "und", "total"];

export async function parseExcel(file: File): Promise<BudgetRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find header row
  let headerRow = -1;
  let headerMap: Record<string, number> = {};
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 4) continue;
    const normalized = row.map(norm);
    const map: Record<string, number> = {};
    normalized.forEach((cell, idx) => {
      if (cell.startsWith("item") && map.item === undefined) map.item = idx;
      else if (cell === "codigo") map.codigo = idx;
      else if (cell === "banco") map.banco = idx;
      else if (cell.startsWith("descric")) map.descricao = idx;
      else if (cell === "und" || cell === "unidade") map.und = idx;
      else if (cell.startsWith("quant")) map.quantidade = idx;
      else if (cell.includes("valorunitario") && cell.includes("bdi")) map.valorUnitBDI = idx;
      else if (cell.includes("valorunit") && map.valorUnit === undefined) map.valorUnit = idx;
      else if (cell === "total" || cell.includes("valortotal")) map.total = idx;
      else if (cell.includes("peso")) map.peso = idx;
    });
    if (REQUIRED_HEADERS.every((h) => map[h] !== undefined)) {
      headerRow = i;
      headerMap = map;
      break;
    }
  }

  if (headerRow < 0) {
    throw new Error(
      "Não foi possível localizar os cabeçalhos da planilha (Item, Descrição, Und, Total).",
    );
  }

  const rows: BudgetRow[] = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) continue;
    const item = String(row[headerMap.item] ?? "").trim();
    const descricao = String(row[headerMap.descricao] ?? "").trim();
    if (!item || !descricao) continue;
    // skip repeated headers
    if (norm(item) === "item" && norm(descricao).startsWith("descric")) continue;
    // require item to look like 1, 1.1, 1.1.1
    if (!/^\d+(\.\d+)*$/.test(item)) continue;

    const und = String(row[headerMap.und] ?? "").trim();
    const quantidade = toNumber(row[headerMap.quantidade]);
    const total = toNumber(row[headerMap.total]);
    const isGroup = !und && !quantidade && !total;

    rows.push({
      item,
      codigo: String(row[headerMap.codigo] ?? "").trim(),
      banco: String(row[headerMap.banco] ?? "").trim(),
      descricao,
      und,
      quantidade,
      valorUnit: toNumber(row[headerMap.valorUnit]),
      valorUnitBDI: toNumber(row[headerMap.valorUnitBDI]),
      total,
      peso: toNumber(row[headerMap.peso]),
      isGroup,
      level: item.split(".").length,
    });
  }

  if (rows.length === 0) {
    throw new Error("Nenhum item válido encontrado na planilha.");
  }

  return rows;
}
