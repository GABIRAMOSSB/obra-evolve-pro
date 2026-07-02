/**
 * Exporta a planilha orçamentária COMPLETA da obra (todos os itens,
 * quantidades, valores unitários e totais), sem filtro por medição.
 * Layout institucional SOLV: navy + dourado, gridlines desativados.
 */
import ExcelJS from "exceljs";
import type { BudgetRow, ObraInfo } from "./types";

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
  info: ObraInfo;
  projectName: string;
}

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

  // Colunas
  const cols: Array<{ w: number }> = [
    { w: 12 }, // item
    { w: 58 }, // descrição
    { w: 8 },  // und
    { w: 12 }, // quantidade
    { w: 16 }, // valor unit
    { w: 16 }, // valor unit c/ BDI
    { w: 18 }, // total
    { w: 10 }, // peso %
  ];
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; });

  // ---- HEADER (linhas 1..7) ----
  ws.mergeCells("A1:H1");
  const t1 = ws.getCell("A1");
  t1.value = "SOLV CONSTRUTORA E SOLUÇÕES";
  t1.font = { name: "Calibri", size: 16, bold: true, color: { argb: WHITE } };
  t1.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  ws.getRow(1).height = 28;

  ws.mergeCells("A2:H2");
  const t2 = ws.getCell("A2");
  t2.value = "PLANILHA ORÇAMENTÁRIA COMPLETA";
  t2.font = { name: "Calibri", size: 11, bold: true, color: { argb: NAVY } };
  t2.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEAE1D2" } };
  ws.getRow(2).height = 20;

  // Metadados obra (linhas 3..6)
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
    ws.mergeCells(`B${row}:H${row}`);
    const c = ws.getCell(`B${row}`);
    c.value = val;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: TEXT } };
    c.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F1" } };
    ws.getRow(row).height = 16;
  });

  // Cabeçalho tabela (linha 8)
  const HEAD_ROW = 8;
  const headers = ["Item", "Descrição", "Und", "Quantidade", "Valor Unit.", "Valor Unit. c/ BDI", "Total (R$)", "Peso %"];
  headers.forEach((h, i) => {
    const c = ws.getCell(HEAD_ROW, i + 1);
    c.value = h;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    c.border = boxBorder;
  });
  ws.getRow(HEAD_ROW).height = 24;

  // Corpo
  let rowIdx = HEAD_ROW + 1;
  const dataStart = rowIdx;
  for (const r of args.rows) {
    const isGroup = !!r.isGroup || ((r.quantidade ?? 0) === 0 && (r.valorUnitBDI || r.valorUnit || 0) === 0);
    const vu = r.valorUnit || 0;
    const vuBDI = r.valorUnitBDI || vu;
    const qtd = Number(r.quantidade ?? 0);
    const total = qtd * vuBDI;

    const cells = [
      r.item ?? "",
      r.descricao ?? "",
      r.und ?? "",
      isGroup ? null : qtd,
      isGroup ? null : vu,
      isGroup ? null : vuBDI,
      isGroup ? null : total,
      isGroup ? null : (r.peso ?? null),
    ];
    cells.forEach((v, i) => {
      const c = ws.getCell(rowIdx, i + 1);
      c.value = v;
      c.border = boxBorder;
      c.alignment = { vertical: "middle", horizontal: i === 1 ? "left" : (i === 0 || i === 2 ? "center" : "right"), wrapText: i === 1, indent: i === 1 ? 1 : 0 };
      if (i === 3) c.numFmt = NUM;
      else if (i === 4 || i === 5 || i === 6) c.numFmt = BRL;
      else if (i === 7) c.numFmt = '0.00"%"';

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

  // Totalizador
  const dataEnd = rowIdx - 1;
  ws.mergeCells(rowIdx, 1, rowIdx, 6);
  const totalLabel = ws.getCell(rowIdx, 1);
  totalLabel.value = "TOTAL GERAL DO CONTRATO";
  totalLabel.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
  totalLabel.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  totalLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  totalLabel.border = boxBorder;

  const totalCell = ws.getCell(rowIdx, 7);
  totalCell.value = { formula: `SUM(G${dataStart}:G${dataEnd})` };
  totalCell.numFmt = BRL;
  totalCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
  totalCell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  totalCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  totalCell.border = boxBorder;

  const pesoCell = ws.getCell(rowIdx, 8);
  pesoCell.value = 100;
  pesoCell.numFmt = '0.00"%"';
  pesoCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
  pesoCell.alignment = { vertical: "middle", horizontal: "right", indent: 1 };
  pesoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  pesoCell.border = boxBorder;
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
