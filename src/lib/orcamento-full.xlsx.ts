/**
 * Exporta a planilha orçamentária COMPLETA da obra (todos os itens,
 * quantidades, valores unitários e totais), sem filtro por medição.
 * Layout institucional SOLV: navy + dourado, gridlines desativados.
 */
import ExcelJS from "exceljs";
import type { BudgetRow, Evolution, ObraInfo } from "./types";
import { activityMetrics } from "./calc";

const NAVY = "FF3E4A5C";       // sidebar SOLV
const GOLD = "FFB19777";       // logo SOLV
const BEGE = "FFF5EFE5";
const BEGE_ALT = "FFFCFAF5";
const BORDER = "FFD9CFBE";
const TEXT = "FF1F2937";
const WHITE = "FFFFFFFF";
const BRL = 'R$ #,##0.00;[Red](R$ #,##0.00);"-"';
const NUM = '#,##0.00;[Red](#,##0.00);"-"';

interface Args {
  rows: BudgetRow[];
  evolutions?: Record<string, Evolution>;
  info: ObraInfo;
  projectName: string;
}
const PCT = '0.00"%";[Red](0.00"%");"-"';

const thin = { style: "thin" as const, color: { argb: BORDER } };
const boxBorder = { top: thin, left: thin, bottom: thin, right: thin };

export async function exportOrcamentoFullXLSX(args: Args): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SOLV — Obra Evolve";
  wb.created = new Date();

  const ws = wb.addWorksheet("Orçamento", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 8 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });

  const cols: Array<{ w: number }> = [
    { w: 12 }, // item
    { w: 46 }, // descrição
    { w: 8 },  // und
    { w: 12 }, // qtd contratada
    { w: 14 }, // valor unit c/ BDI
    { w: 16 }, // total contratual
    { w: 12 }, // qtd anterior
    { w: 15 }, // valor anterior
    { w: 12 }, // qtd período
    { w: 15 }, // valor período
    { w: 12 }, // qtd acumulada
    { w: 15 }, // valor acumulado
    { w: 15 }, // saldo
    { w: 10 }, // % exec
  ];
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });
  const COLS = cols.length;
  const lastColLetter = String.fromCharCode(64 + COLS); // "N"

  const headerRange = `A1:${lastColLetter}1`;
  ws.mergeCells(headerRange);
  const t1 = ws.getCell("A1");
  t1.value = "SOLV CONSTRUTORA E SOLUÇÕES";
  t1.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
  t1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getRow(1).height = 28;

  ws.mergeCells(`A2:${lastColLetter}2`);
  const t2 = ws.getCell("A2");
  t2.value = "PLANILHA ORÇAMENTÁRIA COMPLETA";
  t2.font = { name: "Calibri", size: 11, bold: true, color: { argb: NAVY } };
  t2.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAE1D2" } };
  ws.getRow(2).height = 20;

  const meta: Array<[string, string]> = [
    ["Obra", args.projectName],
    ["Contratante", args.info.contratante ?? "—"],
    ["Contrato", args.info.numeroContrato ?? "—"],
    ["Data de emissão", new Date().toLocaleDateString("pt-BR")],
  ];
  meta.forEach(([label, val], i) => {
    const row = 3 + i;
    ws.getCell(`A${row}`).value = label;
    ws.getCell(`A${row}`).font = { name: "Calibri", size: 9, bold: true, color: { argb: GOLD } };
    ws.getCell(`A${row}`).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getCell(`A${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F1" } };
    ws.mergeCells(`B${row}:${lastColLetter}${row}`);
    const c = ws.getCell(`B${row}`);
    c.value = val;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: TEXT } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F1" } };
    ws.getRow(row).height = 16;
  });

  // Cabeçalho em duas linhas (mescla vertical + grupos horizontais)
  const HEAD_ROW1 = 8;
  const HEAD_ROW2 = 9;

  // Descobre o maior número de BM fechada
  let maxBM = 0;
  if (args.evolutions) {
    for (const evo of Object.values(args.evolutions)) {
      for (const m of evo?.measurements ?? []) {
        if (m.closed && m.number > maxBM) maxBM = m.number;
      }
    }
  }

  const setHead = (cell: ExcelJS.Cell, text: string) => {
    cell.value = text;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.border = boxBorder;
  };

  // Colunas simples (mescla vertical)
  const simples: Array<[number, string]> = [
    [1, "Item"], [2, "Descrição"], [3, "Und"],
    [4, "Qtd. Contratada"], [5, "Vlr. Unit. c/ BDI"], [6, "Total Contratual (R$)"],
    [13, "Saldo (R$)"], [14, "% Exec."],
  ];
  simples.forEach(([col, txt]) => {
    ws.mergeCells(HEAD_ROW1, col, HEAD_ROW2, col);
    setHead(ws.getCell(HEAD_ROW1, col), txt);
  });

  // Grupos (mescla horizontal na linha 1, dois sub-headers na linha 2)
  const grupos: Array<[number, number, string]> = [
    [7, 8, "Acumulado até o período anterior"],
    [9, 10, "Medido no período"],
    [11, 12, "Acum. inclui o período"],
  ];
  grupos.forEach(([a, b, txt]) => {
    ws.mergeCells(HEAD_ROW1, a, HEAD_ROW1, b);
    setHead(ws.getCell(HEAD_ROW1, a), txt);
    setHead(ws.getCell(HEAD_ROW2, a), "Qtd.");
    setHead(ws.getCell(HEAD_ROW2, b), "Valor (R$)");
  });
  ws.getRow(HEAD_ROW1).height = 26;
  ws.getRow(HEAD_ROW2).height = 20;

  ws.views = [{ showGridLines: false, state: "frozen", ySplit: HEAD_ROW2 }];

  let rowIdx = HEAD_ROW2 + 1;
  const dataStart = rowIdx;
  for (const r of args.rows) {
    const isGroup = !!r.isGroup || ((r.quantidade ?? 0) === 0 && (r.valorUnitBDI || r.valorUnit || 0) === 0);
    const vuBDI = r.valorUnitBDI || r.valorUnit || 0;
    const qtd = Number(r.quantidade ?? 0);
    const total = qtd * vuBDI;

    // Anterior / Período
    let qAnt = 0, qPer = 0;
    if (!isGroup && args.evolutions) {
      const evo = args.evolutions[r.item];
      for (const m of evo?.measurements ?? []) {
        if (!m.closed) continue;
        if (m.number < maxBM) qAnt += m.quantExec || 0;
        else if (m.number === maxBM) qPer += m.quantExec || 0;
      }
    }
    let qAcum = qAnt + qPer;
    if (qtd > 0 && qAcum > qtd) {
      const excedente = qAcum - qtd;
      qPer = Math.max(0, qPer - excedente);
      qAcum = qtd;
    }
    const vAnt = qAnt * vuBDI;
    const vPer = qPer * vuBDI;
    const vAcum = qAcum * vuBDI;
    const saldo = total - vAcum;
    const pct = total > 0 ? (vAcum / total) * 100 : 0;

    const cells: (string | number | null)[] = [
      r.item ?? "",
      r.descricao ?? "",
      r.und ?? "",
      isGroup ? null : qtd,
      isGroup ? null : vuBDI,
      isGroup ? null : total,
      isGroup ? null : qAnt,
      isGroup ? null : vAnt,
      isGroup ? null : qPer,
      isGroup ? null : vPer,
      isGroup ? null : qAcum,
      isGroup ? null : vAcum,
      isGroup ? null : saldo,
      isGroup ? null : pct,
    ];
    cells.forEach((v, i) => {
      const c = ws.getCell(rowIdx, i + 1);
      c.value = v;
      c.border = boxBorder;
      c.alignment = { vertical: "middle", horizontal: i === 1 ? "left" : (i === 0 || i === 2 ? "center" : "right"), wrapText: i === 1, indent: i === 1 ? 1 : 0 };
      // formatos: 3=qtd contr, 6=qAnt, 8=qPer, 10=qAcum (índices 0-based: 3,6,8,10)
      if (i === 3 || i === 6 || i === 8 || i === 10) c.numFmt = NUM;
      else if (i === 4 || i === 5 || i === 7 || i === 9 || i === 11 || i === 12) c.numFmt = BRL;
      else if (i === 13) c.numFmt = PCT;

      if (isGroup) {
        c.font = { name: "Calibri", size: 10, bold: true, color: { argb: NAVY } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BEGE } };
      } else {
        c.font = { name: "Calibri", size: 9.5, color: { argb: TEXT } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: rowIdx % 2 === 0 ? WHITE : BEGE_ALT } };
      }
    });
    ws.getRow(rowIdx).height = isGroup ? 20 : 16;
    rowIdx++;
  }

  const dataEnd = rowIdx - 1;
  // Total geral: mescla A..E, depois totais por coluna
  ws.mergeCells(rowIdx, 1, rowIdx, 5);
  const totalLabel = ws.getCell(rowIdx, 1);
  totalLabel.value = "TOTAL GERAL DO CONTRATO";
  totalLabel.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
  totalLabel.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  totalLabel.border = boxBorder;

  const totalConfig: Array<[number, ExcelJS.CellValue, string]> = [
    [6, { formula: `SUM(F${dataStart}:F${dataEnd})` }, BRL],
    [7, { formula: `SUM(G${dataStart}:G${dataEnd})` }, NUM],
    [8, { formula: `SUM(H${dataStart}:H${dataEnd})` }, BRL],
    [9, { formula: `SUM(I${dataStart}:I${dataEnd})` }, NUM],
    [10, { formula: `SUM(J${dataStart}:J${dataEnd})` }, BRL],
    [11, { formula: `SUM(K${dataStart}:K${dataEnd})` }, NUM],
    [12, { formula: `SUM(L${dataStart}:L${dataEnd})` }, BRL],
    [13, { formula: `SUM(M${dataStart}:M${dataEnd})` }, BRL],
    [14, { formula: `IF(F${rowIdx}=0,0,L${rowIdx}/F${rowIdx}*100)` }, PCT],
  ];
  totalConfig.forEach(([col, val, fmt]) => {
    const c = ws.getCell(rowIdx, col);
    c.value = val;
    c.numFmt = fmt;
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
    c.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.border = boxBorder;
  });
  ws.getRow(rowIdx).height = 24;

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Orcamento-${args.projectName.replace(/[^a-z0-9-_]+/gi, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
