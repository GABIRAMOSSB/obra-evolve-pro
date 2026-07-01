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
  contrato: {
    numero: string;
    objeto: string | null;
    orgao_contratante: string | null;
    processo_administrativo?: string | null;
    numero_licitacao?: string | null;
    data_inicio?: string | null;
    prazo_dias?: number | null;
  } | null;
  obra: {
    nome: string;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    cliente: string | null;
    cnpj_cliente?: string | null;
  } | null;
  company: { razao_social?: string | null; nome?: string | null; cnpj?: string | null } | null;
  responsavelTecnico?: { nome: string; registro: string | null; cargo?: string | null } | null;
  fiscal?: { nome: string; registro: string | null; cargo?: string | null } | null;
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

/**
 * Calcula altura de linha necessária para que o texto envolvido não fique
 * escondido. Considera quebras explícitas (\n) e o wrap por largura da coluna.
 */
function autosizeRowHeight(
  texts: Array<{ text: string | null | undefined; colWidth: number }>,
  minHeight = 18,
): number {
  let maxLines = 1;
  for (const { text, colWidth } of texts) {
    if (!text) continue;
    const raw = String(text);
    const perLine = Math.max(8, Math.floor(colWidth * 1.05));
    const parts = raw.split(/\r?\n/);
    let total = 0;
    for (const p of parts) {
      total += Math.max(1, Math.ceil(p.length / perLine));
    }
    if (total > maxLines) maxLines = total;
  }
  return Math.max(minHeight, maxLines * 13 + 8);
}

export async function generateBoletimMedicaoXLSX(data: XLSXInput): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SOLV Construtora";
  wb.created = new Date();

  // ============================================================
  // ABA 1 — CAPA
  // ============================================================
  buildCapaSheet(wb, data);

  // ============================================================
  // ABA 2 — BOLETIM (principal)
  // ============================================================
  const ws = wb.addWorksheet("Boletim", {
    views: [{ state: "frozen", ySplit: 13, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      printTitlesRow: "12:13",
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

  // ===== HEADER SOLV (linhas 1-3) =====
  ws.mergeCells("A1:M1");
  const h1 = ws.getCell("A1");
  h1.value = "SOLV CONSTRUTORA";
  h1.font = { name: "Calibri", size: 16, bold: true, color: { argb: C.white } };
  h1.fill = fill(C.graphiteDark);
  h1.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(1).height = 26;

  const bmLabel = data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`;
  ws.mergeCells("A2:H2");
  const h2 = ws.getCell("A2");
  h2.value = "BOLETIM DE MEDIÇÃO";
  h2.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.gold } };
  h2.fill = fill(C.graphiteDark);
  h2.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.mergeCells("I2:M2");
  const h2r = ws.getCell("I2");
  h2r.value = `${bmLabel}  ·  ${fmtDateBR(data.medicao.data_medicao)}`;
  h2r.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
  h2r.fill = fill(C.graphiteDark);
  h2r.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  ws.getRow(2).height = 18;

  // Linha dourada
  ws.mergeCells("A3:M3");
  ws.getCell("A3").fill = fill(C.gold);
  ws.getRow(3).height = 3;

  // ===== DADOS CONTRATUAIS (linhas 4-11) =====
  const nomeObra = data.obra?.nome ?? "—";
  const endereco = [data.obra?.endereco, data.obra?.cidade, data.obra?.uf].filter(Boolean).join(", ");
  const executora = data.company?.razao_social ?? data.company?.nome ?? "SOLV Construtora";
  const contratante = data.obra?.cliente ?? data.contrato?.orgao_contratante ?? "—";
  const cnpjContratante = data.obra?.cnpj_cliente ?? "—";
  const cnpjExecutora = data.company?.cnpj ?? "—";
  const processo = data.contrato?.processo_administrativo ?? "—";
  const licitacao = data.contrato?.numero_licitacao ?? "—";
  const inicioObra = fmtDateBR(data.contrato?.data_inicio) || "—";
  const prazoStr = data.contrato?.prazo_dias ? `${data.contrato.prazo_dias} dias` : "—";
  const rtNome = data.responsavelTecnico?.nome ?? "—";
  const rtReg = [data.responsavelTecnico?.registro, data.responsavelTecnico?.cargo].filter(Boolean).join(" · ") || "—";
  const fiscalNome = data.fiscal?.nome ?? "—";
  const fiscalReg = [data.fiscal?.registro, data.fiscal?.cargo].filter(Boolean).join(" · ") || "—";

  const labelStyle = (cell: ExcelJS.Cell) => {
    cell.font = { name: "Calibri", size: 7.5, color: { argb: C.muted }, bold: true };
    cell.alignment = { vertical: "middle", indent: 1 };
    cell.fill = fill(C.silver);
  };
  const valueStyle = (cell: ExcelJS.Cell) => {
    cell.font = { name: "Calibri", size: 10, color: { argb: C.text }, bold: true };
    cell.alignment = { vertical: "middle", indent: 1, wrapText: true };
  };

  const kv = (rowLbl: number, col: number, label: string, value: string, span: number) => {
    if (span > 1) ws.mergeCells(rowLbl, col, rowLbl, col + span - 1);
    const cLabel = ws.getCell(rowLbl, col);
    cLabel.value = label.toUpperCase();
    labelStyle(cLabel);
    if (span > 1) ws.mergeCells(rowLbl + 1, col, rowLbl + 1, col + span - 1);
    const cVal = ws.getCell(rowLbl + 1, col);
    cVal.value = value;
    valueStyle(cVal);
  };

  // Linha 4/5
  kv(4, 1, "Obra", nomeObra, 5);
  kv(4, 6, "Cliente / Contratante", contratante, 3);
  kv(4, 9, "CNPJ Contratante", cnpjContratante, 2);
  kv(4, 11, "Endereço da obra", endereco || "—", 3);
  ws.getRow(4).height = 14;
  ws.getRow(5).height = autosizeRowHeight([
    { text: nomeObra, colWidth: 99 },
    { text: contratante, colWidth: 40 },
    { text: cnpjContratante, colWidth: 28 },
    { text: endereco || "—", colWidth: 42 },
  ], 20);

  // Linha 6/7
  kv(6, 1, "Empresa Executora", executora, 5);
  kv(6, 6, "CNPJ Executora", cnpjExecutora, 2);
  kv(6, 8, "Contrato nº", data.contrato?.numero ?? "—", 3);
  kv(6, 11, "Processo administrativo", processo, 3);
  ws.getRow(6).height = 14;
  ws.getRow(7).height = autosizeRowHeight([
    { text: executora, colWidth: 99 },
    { text: cnpjExecutora, colWidth: 28 },
    { text: data.contrato?.numero ?? "—", colWidth: 40 },
    { text: processo, colWidth: 42 },
  ], 20);

  // Linha 8/9
  kv(8, 1, "Nº Boletim", bmLabel, 2);
  kv(8, 3, "Data medição", fmtDateBR(data.medicao.data_medicao) || "—", 2);
  kv(8, 5, "Período de medição", `${fmtDateBR(data.medicao.periodo_inicio) || "—"} a ${fmtDateBR(data.medicao.periodo_fim) || "—"}`, 3);
  kv(8, 8, "Início da obra", inicioObra, 2);
  kv(8, 10, "Prazo contratual", prazoStr, 2);
  kv(8, 12, "Licitação nº", licitacao, 2);
  ws.getRow(8).height = 14;
  ws.getRow(9).height = 20;

  // Linha 10/11
  kv(10, 1, "Objeto do contrato", data.contrato?.objeto ?? "—", 6);
  kv(10, 7, "Responsável Técnico", `${rtNome}\n${rtReg}`, 3);
  kv(10, 10, "Fiscal da Obra", `${fiscalNome}\n${fiscalReg}`, 4);
  ws.getRow(10).height = 14;
  ws.getRow(11).height = autosizeRowHeight([
    { text: data.contrato?.objeto ?? "—", colWidth: 115 },
    { text: `${rtNome}\n${rtReg}`, colWidth: 36 },
    { text: `${fiscalNome}\n${fiscalReg}`, colWidth: 58 },
  ], 30);


  // ===== CABEÇALHO DA TABELA (linhas 12-13) =====
  const headerRow1 = ws.getRow(12);
  const headerRow2 = ws.getRow(13);
  headerRow1.height = 22;
  headerRow2.height = 18;

  const setHead = (cell: ExcelJS.Cell, value: string) => {
    cell.value = value;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.white } };
    cell.fill = fill(C.graphiteDark);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  };

  // Merges do grupo
  ws.mergeCells("A12:A13"); setHead(ws.getCell("A12"), "Item");
  ws.mergeCells("B12:B13"); setHead(ws.getCell("B12"), "Descrição");
  ws.mergeCells("C12:C13"); setHead(ws.getCell("C12"), "Un.");
  ws.mergeCells("D12:D13"); setHead(ws.getCell("D12"), "Qtd.");
  ws.mergeCells("E12:E13"); setHead(ws.getCell("E12"), "V. Unit.");
  ws.mergeCells("F12:F13"); setHead(ws.getCell("F12"), "Total");
  ws.mergeCells("G12:I12"); setHead(ws.getCell("G12"), "EXECUTADO FÍSICO");
  setHead(ws.getCell("G13"), "Anterior");
  setHead(ws.getCell("H13"), "Período");
  setHead(ws.getCell("I13"), "Acum.");
  ws.mergeCells("J12:L12"); setHead(ws.getCell("J12"), "EXECUTADO FINANCEIRO");
  setHead(ws.getCell("J13"), "Anterior");
  setHead(ws.getCell("K13"), "Período");
  setHead(ws.getCell("L13"), "Acum.");
  ws.mergeCells("M12:M13"); setHead(ws.getCell("M12"), "Executado %");

  // ===== LINHAS DE ITENS =====
  const startRow = 14;
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
    row.height = autosizeRowHeight([
      { text: sanitizeDescricao(i.descricao), colWidth: 55 },
      { text: i.item_codigo, colWidth: 12 },
    ], 22);



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

  // ============================================================
  // ABA 3 — BASE E CÁLCULOS (fórmulas expostas, sem proteção)
  // ============================================================
  buildBaseCalculosSheet(wb, data);

  // ============================================================
  // ABA 4 — SNAPSHOT (registro imutável dos valores da medição)
  // ============================================================
  buildSnapshotSheet(wb, data);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ===================================================================
// ABA 1 — CAPA
// ===================================================================
function buildCapaSheet(wb: ExcelJS.Workbook, data: XLSXInput) {
  const ws = wb.addWorksheet("Capa", {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
  });
  ws.pageSetup.showGridLines = false;

  ws.columns = [
    { width: 4 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 22 }, { width: 4 },
  ];

  // Faixa grafite topo
  ws.mergeCells("A1:F3");
  const top = ws.getCell("A1");
  top.value = "SOLV CONSTRUTORA";
  top.font = { name: "Calibri", size: 22, bold: true, color: { argb: C.white } };
  top.alignment = { horizontal: "center", vertical: "middle" };
  top.fill = fill(C.graphiteDark);

  // Linha dourada
  ws.mergeCells("A4:F4");
  ws.getCell("A4").fill = fill(C.gold);
  ws.getRow(4).height = 4;

  // Título
  ws.mergeCells("A6:F6");
  const t = ws.getCell("A6");
  t.value = "BOLETIM DE MEDIÇÃO";
  t.font = { name: "Calibri", size: 18, bold: true, color: { argb: C.graphiteDark } };
  t.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(6).height = 30;

  const bmLabel = data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`;
  ws.mergeCells("A7:F7");
  const sub = ws.getCell("A7");
  sub.value = `${bmLabel}  ·  ${fmtDateBR(data.medicao.data_medicao)}`;
  sub.font = { name: "Calibri", size: 12, color: { argb: C.gold } };
  sub.alignment = { horizontal: "center", vertical: "middle" };

  // Bloco de dados
  const executora = data.company?.razao_social ?? data.company?.nome ?? "SOLV Construtora";
  const contratante = data.obra?.cliente ?? data.contrato?.orgao_contratante ?? "—";
  const endereco = [data.obra?.endereco, data.obra?.cidade, data.obra?.uf].filter(Boolean).join(", ");

  const rows: Array<[string, string]> = [
    ["Obra", data.obra?.nome ?? "—"],
    ["Endereço", endereco || "—"],
    ["Cliente / Contratante", contratante],
    ["CNPJ Contratante", data.obra?.cnpj_cliente ?? "—"],
    ["Empresa Executora", executora],
    ["CNPJ Executora", data.company?.cnpj ?? "—"],
    ["Contrato nº", data.contrato?.numero ?? "—"],
    ["Objeto", data.contrato?.objeto ?? "—"],
    ["Período de medição", `${fmtDateBR(data.medicao.periodo_inicio) || "—"} a ${fmtDateBR(data.medicao.periodo_fim) || "—"}`],
    ["Data da medição", fmtDateBR(data.medicao.data_medicao) || "—"],
    ["Responsável Técnico", data.responsavelTecnico?.nome ?? "—"],
    ["Fiscal da Obra", data.fiscal?.nome ?? "—"],
  ];

  let r = 10;
  for (const [label, value] of rows) {
    ws.mergeCells(r, 2, r, 3);
    const cl = ws.getCell(r, 2);
    cl.value = label.toUpperCase();
    cl.font = { name: "Calibri", size: 8, bold: true, color: { argb: C.muted } };
    cl.fill = fill(C.silver);
    cl.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

    ws.mergeCells(r, 4, r, 5);
    const cv = ws.getCell(r, 4);
    cv.value = value;
    cv.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.text } };
    cv.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
    ws.getRow(r).height = autosizeRowHeight([{ text: value, colWidth: 44 }], 20);
    r++;
  }

  // Rodapé
  r += 2;
  ws.mergeCells(r, 1, r, 6);
  const foot = ws.getCell(r, 1);
  foot.value = "Documento gerado pelo sistema SOLV — valores em Reais (R$).";
  foot.font = { name: "Calibri", size: 8, italic: true, color: { argb: C.muted } };
  foot.alignment = { horizontal: "center", vertical: "middle" };
}

// ===================================================================
// ABA 3 — BASE E CÁLCULOS
// ===================================================================
function buildBaseCalculosSheet(wb: ExcelJS.Workbook, data: XLSXInput) {
  const ws = wb.addWorksheet("Base e Cálculos", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
      printTitlesRow: "2:3",
    },
  });
  ws.pageSetup.showGridLines = false;

  ws.columns = [
    { header: "Item", width: 12 },
    { header: "Descrição", width: 55 },
    { header: "Un.", width: 6 },
    { header: "Qtd. Contratada", width: 14 },
    { header: "V. Unit.", width: 14 },
    { header: "Total Contratado", width: 16 },
    { header: "Qtd. Anterior", width: 14 },
    { header: "Qtd. Período", width: 14 },
    { header: "Qtd. Acum.", width: 14 },
    { header: "Fin. Anterior", width: 16 },
    { header: "Fin. Período", width: 16 },
    { header: "Fin. Acum.", width: 16 },
    { header: "% Executado", width: 12 },
    { header: "Saldo Qtd.", width: 14 },
    { header: "Saldo R$", width: 16 },
  ];

  // Cabeçalho institucional
  ws.mergeCells("A1:O1");
  const h = ws.getCell("A1");
  h.value = "BASE E CÁLCULOS — Fórmulas expostas para conferência";
  h.font = { name: "Calibri", size: 11, bold: true, color: { argb: C.white } };
  h.fill = fill(C.graphiteDark);
  h.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(1).height = 24;

  // Cabeçalho de colunas (linha 2-3)
  const hdrRow = ws.getRow(2);
  ws.columns.forEach((col, i) => {
    const cell = hdrRow.getCell(i + 1);
    cell.value = col.header as string;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.white } };
    cell.fill = fill(C.graphite);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  hdrRow.height = 30;
  ws.mergeCells("A3:O3");
  ws.getCell("A3").fill = fill(C.gold);
  ws.getRow(3).height = 2;

  // Linhas
  const startRow = 4;
  let rowNum = startRow;
  for (const i of data.itens) {
    const row = ws.getRow(rowNum);
    row.height = autosizeRowHeight([
      { text: sanitizeDescricao(i.descricao), colWidth: 55 },
      { text: i.item_codigo, colWidth: 12 },
    ], 20);


    if (i.is_etapa) {
      row.getCell(1).value = i.item_codigo;
      row.getCell(2).value = sanitizeDescricao(i.descricao);
      for (let c = 1; c <= 15; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(C.silver);
        cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.graphiteDark } };
      }
    } else {
      row.getCell(1).value = i.item_codigo;
      row.getCell(2).value = sanitizeDescricao(i.descricao);
      row.getCell(3).value = normalizeUnidade(i.unidade);
      row.getCell(4).value = Number(i.qtd_contratada);
      row.getCell(4).numFmt = "#,##0.00";
      row.getCell(5).value = Number(i.valor_unitario);
      row.getCell(5).numFmt = 'R$ #,##0.00';
      row.getCell(6).value = { formula: `ROUND(D${rowNum}*E${rowNum},2)` };
      row.getCell(6).numFmt = 'R$ #,##0.00';
      row.getCell(7).value = Number(i.qtd_acum_anterior);
      row.getCell(7).numFmt = "#,##0.00";
      row.getCell(8).value = Number(i.qtd_periodo);
      row.getCell(8).numFmt = "#,##0.00";
      row.getCell(8).fill = fill(C.goldSoft);
      row.getCell(9).value = { formula: `G${rowNum}+H${rowNum}` };
      row.getCell(9).numFmt = "#,##0.00";
      row.getCell(10).value = Number(i.valor_acum_anterior);
      row.getCell(10).numFmt = 'R$ #,##0.00';
      row.getCell(11).value = { formula: `ROUND(H${rowNum}*E${rowNum},2)` };
      row.getCell(11).numFmt = 'R$ #,##0.00';
      row.getCell(12).value = { formula: `J${rowNum}+K${rowNum}` };
      row.getCell(12).numFmt = 'R$ #,##0.00';
      row.getCell(13).value = { formula: `IF(D${rowNum}=0,0,I${rowNum}/D${rowNum})` };
      row.getCell(13).numFmt = "0.00%";
      row.getCell(14).value = { formula: `D${rowNum}-I${rowNum}` };
      row.getCell(14).numFmt = "#,##0.00";
      row.getCell(15).value = { formula: `F${rowNum}-L${rowNum}` };
      row.getCell(15).numFmt = 'R$ #,##0.00';

      for (const c of [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
        row.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
      }
    }
    row.eachCell((cell) => {
      cell.font = { ...(cell.font ?? {}), name: "Calibri", size: 9 };
      cell.alignment = { ...(cell.alignment ?? {}), vertical: "middle", wrapText: true };
    });
    rowNum++;
  }

  // Totais
  const lastItem = rowNum - 1;
  const tr = ws.getRow(rowNum);
  tr.height = 24;
  ws.mergeCells(rowNum, 1, rowNum, 5);
  tr.getCell(1).value = "TOTAIS";
  tr.getCell(6).value = { formula: `SUM(F${startRow}:F${lastItem})` };
  tr.getCell(6).numFmt = 'R$ #,##0.00';
  tr.getCell(10).value = { formula: `SUM(J${startRow}:J${lastItem})` };
  tr.getCell(10).numFmt = 'R$ #,##0.00';
  tr.getCell(11).value = { formula: `SUM(K${startRow}:K${lastItem})` };
  tr.getCell(11).numFmt = 'R$ #,##0.00';
  tr.getCell(12).value = { formula: `SUM(L${startRow}:L${lastItem})` };
  tr.getCell(12).numFmt = 'R$ #,##0.00';
  tr.getCell(13).value = { formula: `IF(F${rowNum}=0,0,L${rowNum}/F${rowNum})` };
  tr.getCell(13).numFmt = "0.00%";
  tr.getCell(15).value = { formula: `F${rowNum}-L${rowNum}` };
  tr.getCell(15).numFmt = 'R$ #,##0.00';
  for (let c = 1; c <= 15; c++) {
    const cell = tr.getCell(c);
    cell.fill = fill(C.graphite);
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
    cell.alignment = { horizontal: c === 1 ? "left" : "right", vertical: "middle", indent: c === 1 ? 1 : 0 };
  }
}

// ===================================================================
// ABA 4 — SNAPSHOT (registro imutável)
// ===================================================================
function buildSnapshotSheet(wb: ExcelJS.Workbook, data: XLSXInput) {
  const ws = wb.addWorksheet("Snapshot", {
    views: [{ state: "frozen", ySplit: 3, showGridLines: false }],
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
  });
  ws.pageSetup.showGridLines = false;

  ws.mergeCells("A1:I1");
  const h = ws.getCell("A1");
  const bmLabel = data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`;
  h.value = `SNAPSHOT — ${bmLabel} · gerado em ${new Date().toLocaleString("pt-BR")}`;
  h.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.white } };
  h.fill = fill(C.graphiteDark);
  h.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(1).height = 22;

  const cols = [
    { header: "Item", width: 12 },
    { header: "Descrição", width: 55 },
    { header: "Un.", width: 6 },
    { header: "Qtd. Contratada", width: 14 },
    { header: "V. Unit. (R$)", width: 14 },
    { header: "Qtd. Anterior", width: 14 },
    { header: "Qtd. Período", width: 14 },
    { header: "Fin. Período (R$)", width: 18 },
    { header: "Fin. Acum. (R$)", width: 18 },
  ];
  ws.columns = cols.map((c) => ({ width: c.width }));

  const hdr = ws.getRow(2);
  cols.forEach((c, i) => {
    const cell = hdr.getCell(i + 1);
    cell.value = c.header;
    cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.white } };
    cell.fill = fill(C.graphite);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });
  hdr.height = 26;
  ws.mergeCells("A3:I3");
  ws.getCell("A3").fill = fill(C.gold);
  ws.getRow(3).height = 2;

  let rowNum = 4;
  for (const i of data.itens) {
    const row = ws.getRow(rowNum);
    row.height = autosizeRowHeight([
      { text: sanitizeDescricao(i.descricao), colWidth: 55 },
      { text: i.item_codigo, colWidth: 12 },
    ], 18);

    if (i.is_etapa) {
      row.getCell(1).value = i.item_codigo;
      row.getCell(2).value = sanitizeDescricao(i.descricao);
      for (let c = 1; c <= 9; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(C.silver);
        cell.font = { name: "Calibri", size: 9, bold: true, color: { argb: C.graphiteDark } };
      }
    } else {
      const qtdPer = Number(i.qtd_periodo);
      const vu = Number(i.valor_unitario);
      const finPer = Math.round(qtdPer * vu * 100) / 100;
      const finAcum = Math.round((Number(i.valor_acum_anterior) + finPer) * 100) / 100;
      row.getCell(1).value = i.item_codigo;
      row.getCell(2).value = sanitizeDescricao(i.descricao);
      row.getCell(3).value = normalizeUnidade(i.unidade);
      row.getCell(4).value = Number(i.qtd_contratada);
      row.getCell(4).numFmt = "#,##0.00";
      row.getCell(5).value = vu;
      row.getCell(5).numFmt = "#,##0.00";
      row.getCell(6).value = Number(i.qtd_acum_anterior);
      row.getCell(6).numFmt = "#,##0.00";
      row.getCell(7).value = qtdPer;
      row.getCell(7).numFmt = "#,##0.00";
      row.getCell(8).value = finPer;
      row.getCell(8).numFmt = "#,##0.00";
      row.getCell(9).value = finAcum;
      row.getCell(9).numFmt = "#,##0.00";
      for (const c of [4, 5, 6, 7, 8, 9]) {
        row.getCell(c).alignment = { horizontal: "right", vertical: "middle" };
      }
    }
    row.eachCell((cell) => {
      cell.font = { ...(cell.font ?? {}), name: "Calibri", size: 9 };
      cell.alignment = { ...(cell.alignment ?? {}), vertical: "middle", wrapText: true };
    });
    rowNum++;
  }

  // Nota
  rowNum += 1;
  ws.mergeCells(rowNum, 1, rowNum, 9);
  const nota = ws.getCell(rowNum, 1);
  nota.value =
    "Este snapshot registra os valores exatos utilizados no fechamento desta medição. Valores em Reais (R$), calculados em centavos inteiros para preservar a integridade contábil.";
  nota.font = { name: "Calibri", size: 8, italic: true, color: { argb: C.muted } };
  nota.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  ws.getRow(rowNum).height = 30;
}

