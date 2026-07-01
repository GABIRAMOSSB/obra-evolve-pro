/**
 * Boletim de Medição — XLSX institucional SOLV via ExcelJS.
 * - Sem linhas de grade (tela e impressão).
 * - Fórmulas por linha (ROUND, acumulados, %).
 * - Proteção: só qtd_periodo desbloqueada.
 * - A4 paisagem, fit-to-width, cabeçalho repetido.
 */
import ExcelJS from "exceljs";
import { normalizeUnidade, sanitizeDescricao } from "./boletim-medicao.calc";

// Paleta SOLV (ARGB para ExcelJS)
const C = {
  graphite: "FF363C49",
  graphiteDark: "FF252A33",
  gold: "FFC8A66A",
  goldSoft: "FFF5EEDD",
  silver: "FFEEF0F2",
  zebra: "FFFAFBFC",
  white: "FFFFFFFF",
  text: "FF20242B",
  muted: "FF69717D",
};

interface XLSXInput {
  medicao: {
    numero_bm: string | null;
    numero: number;
    data_medicao: string | null;
    periodo_inicio: string;
    periodo_fim: string;
    observacoes: string | null;
  };
  contrato: { numero: string; objeto: string | null; orgao_contratante: string | null } | null;
  obra: { nome: string; endereco: string | null; cidade: string | null; uf: string | null; cliente: string | null } | null;
  company: { razao_social?: string | null; nome?: string | null } | null;
  responsavelTecnico?: { nome: string; registro: string | null } | null;
  fiscal?: { nome: string; registro: string | null } | null;
  itens: Array<{
    item_codigo: string;
    descricao: string;
    unidade: string | null;
    is_etapa: boolean;
    qtd_contratada: number;
    valor_unitario: number;
    qtd_acum_anterior: number;
    valor_acum_anterior: number;
    qtd_periodo: number;
  }>;
}

const fill = (c: string): ExcelJS.FillPattern => ({ type: "pattern", pattern: "solid", fgColor: { argb: c } });

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

export async function generateBoletimMedicaoXLSX(data: XLSXInput): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SOLV Construtora";
  wb.created = new Date();

  const ws = wb.addWorksheet("Boletim de Medição", {
    views: [{ state: "frozen", ySplit: 12, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      printTitlesRow: "11:12",
    },
    properties: { defaultRowHeight: 18 },
  });
  // showGridLines na impressão (via propriedade pageSetup)
  ws.pageSetup.showGridLines = false;
  ws.pageSetup.horizontalCentered = true;

  // Colunas (13)
  ws.columns = [
    { key: "item", width: 12 },
    { key: "descricao", width: 55 },
    { key: "un", width: 6 },
    { key: "qtd", width: 12 },
    { key: "vunit", width: 14 },
    { key: "vtotal", width: 16 },
    { key: "fisAnt", width: 12 },
    { key: "fisPer", width: 12 },
    { key: "fisAcum", width: 12 },
    { key: "finAnt", width: 16 },
    { key: "finPer", width: 16 },
    { key: "finAcum", width: 16 },
    { key: "pct", width: 10 },
  ];

  // ===== HEADER SOLV (linhas 1-4) =====
  ws.mergeCells("A1:M1");
  const h1 = ws.getCell("A1");
  h1.value = "SOLV CONSTRUTORA";
  h1.font = { name: "Calibri", size: 16, bold: true, color: { argb: C.white } };
  h1.fill = fill(C.graphiteDark);
  h1.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(1).height = 26;

  ws.mergeCells("A2:M2");
  const h2 = ws.getCell("A2");
  h2.value = "BOLETIM DE MEDIÇÃO";
  h2.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.gold } };
  h2.fill = fill(C.graphiteDark);
  h2.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(2).height = 16;

  // Linha dourada
  ws.mergeCells("A3:M3");
  ws.getCell("A3").fill = fill(C.gold);
  ws.getRow(3).height = 3;

  // ===== DADOS CONTRATUAIS (linhas 4-8) =====
  const bmLabel = data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`;
  const nomeObra = data.obra?.nome ?? "—";
  const endereco = [data.obra?.endereco, data.obra?.cidade, data.obra?.uf].filter(Boolean).join(", ");
  const executora = data.company?.razao_social ?? data.company?.nome ?? "SOLV Construtora";
  const contratante = data.obra?.cliente ?? data.contrato?.orgao_contratante ?? "—";

  const labelStyle = (cell: ExcelJS.Cell) => {
    cell.font = { name: "Calibri", size: 8, color: { argb: C.muted }, bold: true };
    cell.alignment = { vertical: "middle" };
  };
  const valueStyle = (cell: ExcelJS.Cell) => {
    cell.font = { name: "Calibri", size: 10, color: { argb: C.text }, bold: true };
    cell.alignment = { vertical: "middle" };
  };

  const kv = (row: number, col: number, label: string, value: string, span = 3) => {
    const cLabel = ws.getCell(row, col);
    cLabel.value = label.toUpperCase();
    labelStyle(cLabel);
    ws.mergeCells(row + 1, col, row + 1, col + span - 1);
    const cVal = ws.getCell(row + 1, col);
    cVal.value = value;
    valueStyle(cVal);
  };

  // Row 4 labels / Row 5 values
  kv(4, 1, "Obra", nomeObra, 4);
  kv(4, 5, "Contratante", contratante, 3);
  kv(4, 8, "Executora", executora, 3);
  kv(4, 11, "Contrato nº", data.contrato?.numero ?? "—", 3);
  ws.getRow(5).height = 20;

  // Row 6 labels / Row 7 values
  kv(6, 1, "Endereço", endereco || "—", 5);
  kv(6, 6, "Objeto", data.contrato?.objeto ?? "—", 5);
  kv(6, 11, "Nº BM", bmLabel, 1);
  kv(6, 12, "Data", fmtDateBR(data.medicao.data_medicao), 1);
  kv(6, 13, "Período", `${fmtDateBR(data.medicao.periodo_inicio)} a ${fmtDateBR(data.medicao.periodo_fim)}`, 1);
  ws.getRow(7).height = 20;

  // Espaço em branco
  ws.getRow(8).height = 6;
  ws.getRow(9).height = 6;

  // ===== KPI band (linha 10) — deixamos para os totais no rodapé =====
  ws.getRow(10).height = 6;

  // ===== CABEÇALHO DA TABELA (linhas 11-12) =====
  const headerRow1 = ws.getRow(11);
  const headerRow2 = ws.getRow(12);
  headerRow1.height = 22;
  headerRow2.height = 18;

  const setHead = (cell: ExcelJS.Cell, value: string) => {
    cell.value = value;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.white } };
    cell.fill = fill(C.graphiteDark);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  };

  // Merges do grupo
  ws.mergeCells("A11:A12"); setHead(ws.getCell("A11"), "Item");
  ws.mergeCells("B11:B12"); setHead(ws.getCell("B11"), "Descrição");
  ws.mergeCells("C11:C12"); setHead(ws.getCell("C11"), "Un.");
  ws.mergeCells("D11:D12"); setHead(ws.getCell("D11"), "Qtd.");
  ws.mergeCells("E11:E12"); setHead(ws.getCell("E11"), "V. Unit.");
  ws.mergeCells("F11:F12"); setHead(ws.getCell("F11"), "Total");
  ws.mergeCells("G11:I11"); setHead(ws.getCell("G11"), "EXECUTADO FÍSICO");
  setHead(ws.getCell("G12"), "Anterior");
  setHead(ws.getCell("H12"), "Período");
  setHead(ws.getCell("I12"), "Acum.");
  ws.mergeCells("J11:L11"); setHead(ws.getCell("J11"), "EXECUTADO FINANCEIRO");
  setHead(ws.getCell("J12"), "Anterior");
  setHead(ws.getCell("K12"), "Período");
  setHead(ws.getCell("L12"), "Acum.");
  ws.mergeCells("M11:M12"); setHead(ws.getCell("M11"), "Executado %");

  // ===== LINHAS DE ITENS =====
  const startRow = 13;
  let rowNum = startRow;
  let zebra = false;

  const applyCommon = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.font = { ...(cell.font ?? {}), name: "Calibri", size: 9, color: { argb: C.text } };
      cell.alignment = { ...(cell.alignment ?? {}), vertical: "middle", wrapText: true };
    });
  };

  for (const i of data.itens) {
    const row = ws.getRow(rowNum);
    row.height = 22;

    if (i.is_etapa) {
      row.getCell(1).value = i.item_codigo;
      row.getCell(2).value = sanitizeDescricao(i.descricao);
      // fundo prata suave, texto bold, sem valores
      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(C.silver);
        cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.graphiteDark } };
      }
    } else {
      row.getCell(1).value = i.item_codigo;
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(2).value = sanitizeDescricao(i.descricao);
      row.getCell(3).value = normalizeUnidade(i.unidade);
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(4).value = Number(i.qtd_contratada);
      row.getCell(4).numFmt = "#,##0.00";
      row.getCell(5).value = Number(i.valor_unitario);
      row.getCell(5).numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00';
      // Total = ROUND(D*E, 2)
      row.getCell(6).value = { formula: `ROUND(D${rowNum}*E${rowNum},2)` };
      row.getCell(6).numFmt = 'R$ #,##0.00';
      row.getCell(7).value = Number(i.qtd_acum_anterior);
      row.getCell(7).numFmt = "#,##0.00";
      // Período (EDITÁVEL) — destaque dourado suave
      const periodoCell = row.getCell(8);
      periodoCell.value = Number(i.qtd_periodo);
      periodoCell.numFmt = "#,##0.00";
      periodoCell.fill = fill(C.goldSoft);
      periodoCell.protection = { locked: false };
      periodoCell.dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Valor inválido",
        error: "Informe uma quantidade maior ou igual a zero.",
      };
      // Acum físico = G + H
      row.getCell(9).value = { formula: `G${rowNum}+H${rowNum}` };
      row.getCell(9).numFmt = "#,##0.00";
      row.getCell(10).value = Number(i.valor_acum_anterior);
      row.getCell(10).numFmt = 'R$ #,##0.00';
      // Período financeiro = ROUND(H*E,2)
      row.getCell(11).value = { formula: `ROUND(H${rowNum}*E${rowNum},2)` };
      row.getCell(11).numFmt = 'R$ #,##0.00';
      // Acum financeiro = J + K
      row.getCell(12).value = { formula: `J${rowNum}+K${rowNum}` };
      row.getCell(12).numFmt = 'R$ #,##0.00';
      // Pct executado = IF(D=0,0,I/D)
      row.getCell(13).value = { formula: `IF(D${rowNum}=0,0,I${rowNum}/D${rowNum})` };
      row.getCell(13).numFmt = "0.00%";

      // Alinhamento numérico à direita
      for (const c of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) {
        row.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
      }

      // Zebra
      if (zebra) {
        for (let c = 1; c <= 13; c++) {
          const cell = row.getCell(c);
          if (!cell.fill || (cell.fill as ExcelJS.FillPattern).fgColor?.argb !== C.goldSoft) {
            cell.fill = fill(C.zebra);
          }
        }
      }
      zebra = !zebra;
    }
    applyCommon(row);
    rowNum++;
  }

  // ===== TOTAL GERAL =====
  const lastItemRow = rowNum - 1;
  const totalRow = ws.getRow(rowNum);
  totalRow.height = 26;
  totalRow.getCell(1).value = "TOTAL GERAL";
  ws.mergeCells(rowNum, 1, rowNum, 5);
  totalRow.getCell(6).value = { formula: `SUM(F${startRow}:F${lastItemRow})` };
  totalRow.getCell(6).numFmt = 'R$ #,##0.00';
  totalRow.getCell(11).value = { formula: `SUM(K${startRow}:K${lastItemRow})` };
  totalRow.getCell(11).numFmt = 'R$ #,##0.00';
  totalRow.getCell(12).value = { formula: `SUM(L${startRow}:L${lastItemRow})` };
  totalRow.getCell(12).numFmt = 'R$ #,##0.00';
  totalRow.getCell(13).value = { formula: `IF(F${rowNum}=0,0,L${rowNum}/F${rowNum})` };
  totalRow.getCell(13).numFmt = "0.00%";
  for (let c = 1; c <= 13; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = fill(C.graphite);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
    cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle", indent: c === 1 ? 1 : 0 };
  }
  const totalRowNum = rowNum;
  rowNum++;

  // ===== RESUMO FINANCEIRO (5 KPIs abaixo) =====
  rowNum += 2;
  const kpiLabelRow = ws.getRow(rowNum);
  const kpiValueRow = ws.getRow(rowNum + 1);
  kpiLabelRow.height = 16;
  kpiValueRow.height = 22;

  const kpis: Array<[string, ExcelJS.CellValue, string]> = [
    ["Valor total contrato", { formula: `F${totalRowNum}` }, 'R$ #,##0.00'],
    ["Medição do período", { formula: `K${totalRowNum}` }, 'R$ #,##0.00'],
    ["Acumulado", { formula: `L${totalRowNum}` }, 'R$ #,##0.00'],
    ["% Executado", { formula: `IF(F${totalRowNum}=0,0,L${totalRowNum}/F${totalRowNum})` }, "0.00%"],
    ["Saldo contratual", { formula: `F${totalRowNum}-L${totalRowNum}` }, 'R$ #,##0.00'],
  ];

  const kpiCols = [
    [1, 3], [4, 5], [6, 7], [8, 9], [10, 13],
  ] as const;
  kpis.forEach(([label, val, fmt], idx) => {
    const [cStart, cEnd] = kpiCols[idx];
    ws.mergeCells(rowNum, cStart, rowNum, cEnd);
    ws.mergeCells(rowNum + 1, cStart, rowNum + 1, cEnd);
    const l = ws.getCell(rowNum, cStart);
    l.value = label.toUpperCase();
    l.font = { name: "Calibri", size: 8, bold: true, color: { argb: C.muted } };
    l.fill = fill(C.goldSoft);
    l.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const v = ws.getCell(rowNum + 1, cStart);
    v.value = val;
    v.numFmt = fmt;
    v.font = { name: "Calibri", size: 12, bold: true, color: { argb: C.graphiteDark } };
    v.fill = fill(C.goldSoft);
    v.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  });
  rowNum += 3;

  // ===== DECLARAÇÃO + ASSINATURAS =====
  rowNum += 2;
  ws.mergeCells(rowNum, 1, rowNum, 13);
  const decl = ws.getCell(rowNum, 1);
  decl.value =
    "Os valores desta medição estão de acordo com o cronograma físico-financeiro e com as condições contratuais estabelecidas.";
  decl.font = { name: "Calibri", size: 9, italic: true, color: { argb: C.text } };
  decl.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getRow(rowNum).height = 24;
  rowNum += 3;

  const sig = (row: number, cStart: number, cEnd: number, titulo: string, nome: string, registro: string | null) => {
    ws.mergeCells(row, cStart, row, cEnd);
    const t = ws.getCell(row, cStart);
    t.value = titulo.toUpperCase();
    t.font = { name: "Calibri", size: 8, bold: true, color: { argb: C.gold } };
    t.alignment = { horizontal: "center", vertical: "middle" };
    // linha (border-top na row+3)
    ws.mergeCells(row + 3, cStart, row + 3, cEnd);
    const line = ws.getCell(row + 3, cStart);
    line.border = { top: { style: "thin", color: { argb: C.graphite } } };
    ws.mergeCells(row + 4, cStart, row + 4, cEnd);
    const n = ws.getCell(row + 4, cStart);
    n.value = nome;
    n.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.graphiteDark } };
    n.alignment = { horizontal: "center", vertical: "middle" };
    if (registro) {
      ws.mergeCells(row + 5, cStart, row + 5, cEnd);
      const r = ws.getCell(row + 5, cStart);
      r.value = registro;
      r.font = { name: "Calibri", size: 8, color: { argb: C.muted } };
      r.alignment = { horizontal: "center", vertical: "middle" };
    }
  };

  sig(rowNum, 1, 6, "Responsável Técnico", data.responsavelTecnico?.nome ?? "—", data.responsavelTecnico?.registro ?? null);
  sig(rowNum, 8, 13, "Fiscal da Obra", data.fiscal?.nome ?? "—", data.fiscal?.registro ?? null);

  // ===== PROTEÇÃO: só coluna "Período" (H) desbloqueada =====
  // Bloqueia todas as células por padrão via worksheet.protect;
  // as células "Período" já foram marcadas como locked:false acima.
  await ws.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: false,
    formatRows: false,
    insertRows: false,
    insertColumns: false,
    deleteRows: false,
    deleteColumns: false,
    sort: false,
    autoFilter: false,
  });

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
