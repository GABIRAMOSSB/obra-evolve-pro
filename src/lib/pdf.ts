import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import XLSX from "xlsx-js-style";
import type { BudgetRow, DiaryEntry, Evolution, ObraInfo } from "./types";
import { activityMetrics, calcularResumoCabecalhoBM, fmtBRL, fmtNum, projectMetrics } from "./calc";
import { REPORT_RGB } from "./report-theme";

function fmtDateBR(d: Date) {
  return d.toLocaleDateString("pt-BR");
}


type Cell = string | number | { f: string } | null;
type StyledCell = { v?: string | number; f?: string; t?: string; s?: Record<string, unknown> };

// Paleta institucional SOLV — mantida em sincronia com REPORT_HEX (report-theme.ts)
// para paridade visual entre tela (Atividades / Medição), PDF e XLSX.
const NAVY = "785F44";           // marrom escuro SOLV (antes NAVY azul)
const NAVY_SOFT = "B19777";      // dourado SOLV (headers secundários)
const ORANGE = "C94B16";         // laranja medição
const GREEN = "21BD5C";          // verde acumulado
const LIGHT_ORANGE = "FDEBDC";
const LIGHT_GREEN = "DCFCE7";
const GROUP_BG = "EFE8DC";       // fundo etapa (bege claro SOLV)
const SUBGROUP_BG = "F5EFE5";
const HEADER_BG = "785F44";      // banda principal cabeçalho tabela
const HEADER_BG_ALT = "B19777";  // banda auxiliar (planejamento)
const SUBHEADER_BG = "EAE1D2";   // sub-cabeçalho bege
const LABEL_BG = "F5EFE5";       // fundo dos rótulos de metadados
const LABEL_COLOR = "6B5A46";    // marrom médio para rótulos
const VALUE_COLOR = "1F2937";
const BORDER = { style: "thin", color: { rgb: "D9CFBE" } };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function styleHeader(bg: string, color = "FFFFFF", size = 11): Record<string, unknown> {
  return {
    font: { bold: true, color: { rgb: color }, sz: size, name: "Calibri" },
    fill: { fgColor: { rgb: bg } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: ALL_BORDERS,
  };
}

function styleCell(opts: {
  bold?: boolean; align?: "left" | "center" | "right"; bg?: string;
  color?: string; numFmt?: string; locked?: boolean; italic?: boolean; size?: number;
} = {}): Record<string, unknown> {
  return {
    font: {
      bold: opts.bold ?? false,
      italic: opts.italic ?? false,
      color: { rgb: opts.color ?? "1F2937" },
      sz: opts.size ?? 10,
      name: "Calibri",
    },
    fill: opts.bg ? { fgColor: { rgb: opts.bg } } : undefined,
    alignment: { horizontal: opts.align ?? "left", vertical: "center", wrapText: true },
    border: ALL_BORDERS,
    numFmt: opts.numFmt,
    protection: { locked: opts.locked ?? true },
  };
}

export function exportAcompanhamentoXlsx(
  rows: BudgetRow[],
  evolutions: Record<string, Evolution>,
  info: ObraInfo = {},
  projectName = "Obra",
  measurementNumber = 1,
  fileName?: string,
  allRows?: BudgetRow[],
) {
  const wb = XLSX.utils.book_new();
  const aoa: Cell[][] = [];

  // Resumo do cabeçalho — usa SEMPRE allRows (lista completa), para que os
  // totais globais não mudem com filtros aplicados na tela.
  const resumo = calcularResumoCabecalhoBM(
    allRows ?? rows,
    evolutions,
    measurementNumber,
    info,
  );

  // Header banner (row 1)
  aoa.push([resumo.codigoBM, "BOLETIM DE MEDIÇÃO", "", "", "", "", "", "", "", "", "", "", `Período: ${resumo.periodoLabel}`, resumo.dataMedicao]);
  aoa.push([]);
  // Metadata (rows 3-5)
  aoa.push(["Licitador:", info.cliente || "—", "", "Contratante:", info.contratante || "—", "", "Empresa Executora:", info.empresaExecutora || "—", "", "CNPJ:", info.cnpj || "—", "", "Nº Contrato:", info.numeroContrato || "—"]);
  aoa.push(["Obra:", projectName, "", "Endereço:", info.endereco || "—", "", "Município:", info.municipio || "—", "", "UF:", info.estado || "—", "", "Nº Licitação:", info.numeroLicitacao || "—"]);
  aoa.push(["Resp. Técnico:", info.responsavelTecnico || "—", "", "CREA/CAU:", info.crea || "—", "", "Cargo (Resp.):", info.cargoResponsavel || "—", "", "ART/RRT:", info.artRrt || "—", "", "Fiscal:", info.fiscal || "—"]);
  aoa.push(["CPF Fiscal:", info.cpfFiscal || "—", "", "Cargo (Fiscal):", info.cargoFiscal || "—", "", "Início da Obra:", info.dataInicioObra || "—", "", "Prazo (dias):", info.prazoContratualDias ?? "—", "", "", ""]);
  // IMPORTANTE: o corpo da planilha usa SEMPRE a lista completa (allRows),
  // nunca a lista filtrada da tela. Assim os totais somam o contrato inteiro
  // e o cabeçalho (Valor Total / % Acumulado / Saldo) fica coerente com o BM.
  const bodyRows = allRows ?? rows;
  // Linha de resumo financeiro — os totais são derivados por FÓRMULA a
  // partir da linha de TOTAL GERAL da tabela (calculada mais abaixo),
  // garantindo que qualquer edição da coluna "Período" no Excel
  // atualize automaticamente todos os KPIs.
  const totalRowRef = 12 + bodyRows.length;
  aoa.push([
    "Nº do BM:", resumo.descricaoBM, "",
    "Data:", resumo.dataMedicao, "",
    "Valor Total da Obra:", { f: `F${totalRowRef}` }, "",
    "Valor desta Medição:", { f: `K${totalRowRef}` }, "",
    "Valor Acumulado:", { f: `L${totalRowRef}` },
  ]);
  aoa.push([
    "% Acumulado:", { f: `IF(H7=0,0,N7/H7)` }, "",
    "Saldo Restante:", { f: `H7-N7` }, "",
    "", "", "", "", "", "", "", "",
  ]);
  aoa.push([]);

  // Table headers (rows 7 & 8)
  aoa.push(["PLANEJAMENTO", "", "", "", "", "", "EXECUTADO FÍSICO", "", "", "EXECUTADO FINANCEIRO (R$)", "", "", "DESVIO", "STATUS"]);
  aoa.push(["Item", "Descrição", "Und", "Quant.", "V. Unit c/ BDI", "Total", "Acum. Anterior", "Período", "Acum. Atual", "Acum. Anterior", "Período", "Acum. Atual", "%", "Status"]);

  const dataStart = aoa.length + 1; // 1-based row of first data row
  let r = dataStart;
  const itemRows: number[] = [];
  const groupRows: number[] = [];
  const periodEditableRows: number[] = []; // unlocked cells (H column)
  for (const row of bodyRows) {
    if (row.isGroup) {
      aoa.push([row.item, row.descricao.toUpperCase(), "", "", "", "", "", "", "", "", "", "", "", "ETAPA"]);
      groupRows.push(r);
    } else {
      const list = evolutions[row.item]?.measurements ?? [];
      const qAnt = list.filter((m) => m.closed).reduce((s, m) => s + (m.quantExec || 0), 0);
      const open = list.find((m) => !m.closed);
      const qPer = open?.quantExec || 0;
      const a = activityMetrics(row, evolutions[row.item]);
      aoa.push([
        row.item,
        row.descricao,
        row.und,
        row.quantidade,
        row.valorUnitBDI || row.valorUnit,
        { f: `D${r}*E${r}` },
        qAnt,
        qPer,
        { f: `G${r}+H${r}` },
        { f: `G${r}*E${r}` },
        { f: `H${r}*E${r}` },
        { f: `I${r}*E${r}` },
        { f: `IF(F${r}=0,0,L${r}/F${r}*100)` },
        a.status,
      ]);
      itemRows.push(r);
      // Lock "Período" (col H) only when item already 100% measured
      if (qAnt < row.quantidade) periodEditableRows.push(r);
    }
    r++;
  }

  // Total row with formulas
  const totalRow = r;
  if (itemRows.length > 0) {
    const first = itemRows[0];
    const last = itemRows[itemRows.length - 1];
    aoa.push([
      "TOTAL GERAL", "", "", "", "",
      { f: `SUM(F${first}:F${last})` },
      { f: `SUM(G${first}:G${last})` },
      { f: `SUM(H${first}:H${last})` },
      { f: `SUM(I${first}:I${last})` },
      { f: `SUM(J${first}:J${last})` },
      { f: `SUM(K${first}:K${last})` },
      { f: `SUM(L${first}:L${last})` },
      { f: `IF(F${totalRow}=0,0,L${totalRow}/F${totalRow}*100)` },
      "",
    ]);
    r++;
  }

  aoa.push([]);
  aoa.push(["Os valores desta medição estão de acordo com o cronograma físico-financeiro e com as condições contratuais estabelecidas."]);
  aoa.push([]);
  aoa.push([]);
  aoa.push(["", "____________________________________", "", "", "", "", "", "", "____________________________________"]);
  aoa.push(["", info.responsavelTecnico || "Responsável Técnico", "", "", "", "", "", "", info.fiscal || "Fiscal da Obra"]);
  aoa.push(["", `${info.cargoResponsavel || "Responsável Técnico"}${info.crea ? " — CREA/CAU " + info.crea : ""}`, "", "", "", "", "", "", `${info.cargoFiscal || "Fiscal da Obra"}${info.cpfFiscal ? " — CPF " + info.cpfFiscal : ""}`]);

  const ws = XLSX.utils.aoa_to_sheet(aoa as (string | number | null)[][]);

  // === Styling ===
  const setStyle = (addr: string, style: Record<string, unknown>) => {
    if (!ws[addr]) ws[addr] = { t: "s", v: "" };
    (ws[addr] as StyledCell).s = style;
  };
  const col = (n: number) => XLSX.utils.encode_col(n);
  const addr = (rowIdx1: number, colIdx0: number) => `${col(colIdx0)}${rowIdx1}`;

  // Banner row 1
  for (let c = 0; c < 14; c++) {
    setStyle(addr(1, c), {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14, name: "Calibri" },
      fill: { fgColor: { rgb: NAVY } },
      alignment: { horizontal: c === 0 ? "left" : c === 13 ? "right" : "center", vertical: "center" },
      border: ALL_BORDERS,
    });
  }
  // Metadata rows 3-6: labels bold, values normal (paleta SOLV)
  for (let row1 = 3; row1 <= 6; row1++) {
    for (let c = 0; c < 14; c++) {
      const isLabel = c % 3 === 0;
      setStyle(addr(row1, c), styleCell({
        bold: isLabel,
        color: isLabel ? LABEL_COLOR : VALUE_COLOR,
        bg: isLabel ? LABEL_BG : "FFFFFF",
        size: 9,
      }));
    }
  }

  // Financial summary rows 7-8 (Nº do BM, Data, Valor Total da Obra...)
  for (let row1 = 7; row1 <= 8; row1++) {
    for (let c = 0; c < 14; c++) {
      const isLabel = c % 3 === 0;
      const isMoney = !isLabel && (c === 7 || c === 10 || c === 13 || (row1 === 8 && c === 4));
      const isPercent = row1 === 8 && c === 1;
      let bg = isLabel ? LABEL_BG : "FFFFFF";
      let color = isLabel ? LABEL_COLOR : VALUE_COLOR;
      if (row1 === 7 && c === 7) { bg = SUBGROUP_BG; color = NAVY; }        // Valor total da obra
      if (row1 === 7 && c === 10) { bg = LIGHT_ORANGE; color = ORANGE; }     // Valor desta medição
      if (row1 === 7 && c === 13) { bg = LIGHT_GREEN; color = GREEN; }       // Valor acumulado
      if (row1 === 8 && c === 1) { bg = SUBGROUP_BG; color = NAVY_SOFT; }    // % acumulado
      if (row1 === 8 && c === 4) { bg = SUBGROUP_BG; color = NAVY; }         // Saldo restante
      setStyle(addr(row1, c), styleCell({
        bold: isLabel || isMoney || isPercent,
        color,
        bg,
        size: 10,
        align: isLabel ? "left" : "right",
        numFmt: isMoney ? "R$ #,##0.00" : isPercent ? "0.0%" : undefined,
      }));
    }
  }

  // Group header row 10 — bandas coloridas SOLV
  for (let c = 0; c < 14; c++) {
    let bg = HEADER_BG_ALT;              // Planejamento (dourado SOLV)
    if (c >= 6 && c <= 8) bg = ORANGE;   // Executado físico (laranja medição)
    if (c >= 9 && c <= 11) bg = GREEN;   // Executado financeiro (verde acumulado)
    if (c === 12 || c === 13) bg = HEADER_BG; // Desvio / Status (marrom escuro)
    setStyle(addr(10, c), styleHeader(bg));
  }
  // Sub-header row 11 — bege institucional
  for (let c = 0; c < 14; c++) {
    setStyle(addr(11, c), styleHeader(SUBHEADER_BG, LABEL_COLOR, 10));
  }

  // Data rows
  for (let row1 = dataStart; row1 < totalRow; row1++) {
    const isGroup = groupRows.includes(row1);
    for (let c = 0; c < 14; c++) {
      if (isGroup) {
        setStyle(addr(row1, c), styleCell({
          bold: true, bg: GROUP_BG, color: NAVY, size: 10,
          align: c === 0 ? "center" : c === 1 ? "left" : "center",
        }));
      } else {
        let numFmt: string | undefined;
        let align: "left" | "center" | "right" = "right";
        let bg: string | undefined;
        let color: string | undefined;
        let bold = false;
        if (c === 0) { align = "center"; bold = true; }
        else if (c === 1) { align = "left"; }
        else if (c === 2) { align = "center"; }
        else if (c === 3 || c === 6 || c === 8) numFmt = "#,##0.00";
        else if (c === 7) { numFmt = "#,##0.00"; bg = LIGHT_ORANGE; }
        else if (c === 4 || c === 5 || c === 9) numFmt = "R$ #,##0.00";
        else if (c === 10) { numFmt = "R$ #,##0.00"; bg = LIGHT_ORANGE; color = ORANGE; bold = true; }
        else if (c === 11) { numFmt = "R$ #,##0.00"; bg = LIGHT_GREEN; color = GREEN; bold = true; }
        else if (c === 12) { numFmt = '0.0"%"'; }
        else if (c === 13) align = "center";
        const locked = !(c === 7 && periodEditableRows.includes(row1));
        setStyle(addr(row1, c), styleCell({ bold, align, bg, color, numFmt, locked }));
      }
    }
  }
  // Total row
  if (itemRows.length > 0) {
    for (let c = 0; c < 14; c++) {
      let numFmt: string | undefined;
      if (c === 3 || c === 6 || c === 7 || c === 8) numFmt = "#,##0.00";
      else if (c >= 4 && c <= 11) numFmt = "R$ #,##0.00";
      else if (c === 12) numFmt = '0.0"%"';
      setStyle(addr(totalRow, c), {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11, name: "Calibri" },
        fill: { fgColor: { rgb: NAVY } },
        alignment: { horizontal: c <= 2 ? "left" : "right", vertical: "center" },
        border: ALL_BORDERS,
        numFmt,
      });
    }
  }

  // Column widths
  ws["!cols"] = [
    { wch: 10 }, { wch: 50 }, { wch: 8 }, { wch: 12 }, { wch: 16 }, { wch: 16 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
    { wch: 10 }, { wch: 14 },
  ];
  // Row heights — layout mais respirado
  ws["!rows"] = [];
  ws["!rows"][0] = { hpt: 32 };  // banner
  ws["!rows"][2] = { hpt: 20 };  // metadata
  ws["!rows"][3] = { hpt: 20 };
  ws["!rows"][4] = { hpt: 20 };
  ws["!rows"][5] = { hpt: 20 };
  ws["!rows"][6] = { hpt: 24 };  // resumo financeiro
  ws["!rows"][7] = { hpt: 22 };
  ws["!rows"][9] = { hpt: 24 };  // group header
  ws["!rows"][10] = { hpt: 30 }; // sub-header

  // Freeze first 11 rows (banner + metadata + resumo + headers) and first 2 cols

  (ws as Record<string, unknown>)["!protect"] = {
    password: "",
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: false,
    formatColumns: true,
    formatRows: true,
    sort: true,
    autoFilter: true,
  };
  ws["!merges"] = [
    { s: { r: 0, c: 1 }, e: { r: 0, c: 11 } }, // Title centered
    { s: { r: 9, c: 0 }, e: { r: 9, c: 5 } },  // PLANEJAMENTO
    { s: { r: 9, c: 6 }, e: { r: 9, c: 8 } },  // EXEC FÍSICO
    { s: { r: 9, c: 9 }, e: { r: 9, c: 11 } }, // EXEC FINANCEIRO
    { s: { r: 9, c: 12 }, e: { r: 10, c: 12 } }, // DESVIO spans 2
    { s: { r: 9, c: 13 }, e: { r: 10, c: 13 } }, // STATUS spans 2
  ];

  // Print setup: A4 landscape, fit to 1 page wide, repeat headers
  (ws as Record<string, unknown>)["!pageSetup"] = { orientation: "landscape", paperSize: 9, fitToWidth: 1, fitToHeight: 0 };
  (ws as Record<string, unknown>)["!printHeader"] = [1, 11]; // repeat rows 1-11 on each printed page
  (ws as Record<string, unknown>)["!margins"] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };


  XLSX.utils.book_append_sheet(wb, ws, `BM-${String(measurementNumber).padStart(2, "0")}`);
  const finalName = fileName || `boletim-medicao-${String(measurementNumber).padStart(2, "0")}-${projectName}.xlsx`;
  XLSX.writeFile(wb, finalName);
}



export function exportRelatorioPdf(
  rows: BudgetRow[],
  evolutions: Record<string, Evolution>,
  projectName = "Obra",
) {
  const doc = new jsPDF({ orientation: "landscape" });
  const m = projectMetrics(rows, evolutions);

  doc.setFontSize(16);
  doc.text("Relatório de Acompanhamento de Obra", 14, 15);
  doc.setFontSize(10);
  doc.text(projectName, 14, 22);
  doc.text(
    [
      `Valor total: ${fmtBRL(m.total)}`,
      `Valor executado: ${fmtBRL(m.exec)}`,
      `Valor restante: ${fmtBRL(m.restante)}`,
      `% Geral executado: ${fmtNum(m.percent)}%`,
      `Concluídas: ${m.concluidas}  |  Em andamento: ${m.andamento}  |  Não iniciadas: ${m.naoIniciadas}`,
    ].join("    "),
    14,
    28,
  );

  const body = rows.map((r) => {
    if (r.isGroup) {
      return [r.item, r.descricao, "", "", "", "", "", "ETAPA"];
    }
    const a = activityMetrics(r, evolutions[r.item]);
    return [
      r.item,
      r.descricao,
      r.und,
      fmtNum(r.quantidade),
      fmtBRL(r.total),
      fmtNum(a.quantExec),
      `${fmtNum(a.percent)}%`,
      a.status,
    ];
  });

  autoTable(doc, {
    head: [["Item", "Descrição", "Und", "Quant.", "Valor Total", "Qtd Exec.", "% Exec.", "Status"]],
    body,
    startY: 35,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [194, 102, 38] },
    columnStyles: { 1: { cellWidth: 90 } },
  });

  doc.save(`relatorio-${Date.now()}.pdf`);
}

/**
 * Gera um PDF da medição (snapshot do período fechado) e retorna como Blob,
 * para upload na pasta "Medições da Obra". A4 paisagem, cabeçalho corporativo,
 * dados da obra e área de assinaturas com dados do cadastro.
 */
export function buildMeasurementPdfBlob(
  rows: BudgetRow[],
  evolutions: Record<string, Evolution>,
  measurementNumber: number,
  projectName: string,
  closedAt: Date = new Date(),
  info: ObraInfo = {},
  periodoInicio?: Date,
  allRows?: BudgetRow[],
): Blob {
  const doc = new jsPDF({ orientation: "landscape", format: "a4", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  // Margem horizontal única — usada em TODO o documento (banner, dados da obra,
  // resumo financeiro, tabela e assinaturas) para garantir simetria visual.
  const MARGIN = 10;
  const usableW = pageW - 2 * MARGIN;
  const navy: [number, number, number] = REPORT_RGB.primaryDark;
  const orange: [number, number, number] = REPORT_RGB.measure;
  const green: [number, number, number] = REPORT_RGB.success;
  const gold: [number, number, number] = REPORT_RGB.primary;
  const cardBg = REPORT_RGB.cardBg;
  const border = REPORT_RGB.border;
  const labelMuted = REPORT_RGB.labelMuted;
  const subtitleOnDark = REPORT_RGB.subtitleOnDark;
  const measureSoft = REPORT_RGB.measureSoft;
  const successSoft = REPORT_RGB.successSoft;
  // Resumo do cabeçalho — usa SEMPRE allRows (lista completa), nunca a
  // lista filtrada. Garante que os totais do cabeçalho não mudem com filtros.
  const resumo = calcularResumoCabecalhoBM(allRows ?? rows, evolutions, measurementNumber, info);
  const bm = resumo.codigoBM;
  const periodoLabel = resumo.periodoLabel;

  // ─────────────────────────────────────────────────────────────────
  // HEADER — banda navy (18mm) + faixa dourada de 2mm; chip do BM à
  // esquerda, título centralizado com subtítulo, chip de data à direita.
  // ─────────────────────────────────────────────────────────────────
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(0, 18, pageW, 1.6, "F");


  // Chip do BM (arredondado)
  const chipW = 34, chipH = 9;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(MARGIN, 4.5, chipW, chipH, 1.6, 1.6, "F");
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(bm, MARGIN + chipW / 2, 10.6, { align: "center" });

  // Título + subtítulo centralizados
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("BOLETIM DE MEDIÇÃO", pageW / 2, 9.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.6);
  doc.setTextColor(230, 220, 200);
  doc.text("Snapshot oficial do período fechado", pageW / 2, 13.6, { align: "center" });

  // Chip de período à direita
  const rChipW = 74;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - MARGIN - rChipW, 4.5, rChipW, chipH, 1.6, 1.6, "F");
  doc.setTextColor(110, 92, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.text("PERÍODO DE MEDIÇÃO", pageW - MARGIN - rChipW + 2, 7.4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text(periodoLabel, pageW - MARGIN - rChipW + 2, 12);

  doc.setTextColor(0, 0, 0);

  // ─────────────────────────────────────────────────────────────────
  // CARTÃO — Dados da obra (bordas suaves + faixa lateral dourada)
  // ─────────────────────────────────────────────────────────────────
  const dy = (lbl: string, val: string, x: number, yy: number, w: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(120, 105, 82);
    doc.text(lbl.toUpperCase(), x, yy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(31, 41, 55);
    const lines = doc.splitTextToSize(val || "—", w);
    doc.text(lines[0] ?? "—", x, yy + 3.5);
  };

  let y = 24;
  const cardH = 34;
  doc.setFillColor(252, 250, 246);
  doc.setDrawColor(217, 207, 190);
  doc.roundedRect(MARGIN, y, usableW, cardH, 1.4, 1.4, "FD");
  doc.setFillColor(gold[0], gold[1], gold[2]);
  doc.rect(MARGIN, y, 1.4, cardH, "F");

  const col = usableW / 4;
  const px = MARGIN + 4;
  let yy = y + 5.5;
  dy("Licitador", info.cliente || "—", px, yy, col - 4);
  dy("Contratante", info.contratante || "—", px + col, yy, col - 4);
  dy("Empresa Executora", info.empresaExecutora || "—", px + 2 * col, yy, col - 4);
  dy("CNPJ", info.cnpj || "—", px + 3 * col, yy, col - 4);
  yy += 8;
  dy("Obra", projectName, px, yy, col * 2 - 4);
  dy("Endereço", info.endereco || "—", px + 2 * col, yy, col - 4);
  dy("Município / UF", `${info.municipio || "—"}${info.estado ? " / " + info.estado : ""}`, px + 3 * col, yy, col - 4);
  yy += 8;
  dy("Nº Contrato", info.numeroContrato || "—", px, yy, col - 4);
  dy("Nº Licitação", info.numeroLicitacao || "—", px + col, yy, col - 4);
  dy("Resp. Técnico", `${info.responsavelTecnico || "—"}${info.crea ? " — " + info.crea : ""}`, px + 2 * col, yy, col - 4);
  dy("Fiscal da Obra", `${info.fiscal || "—"}${info.creaFiscal ? " — " + info.creaFiscal : ""}`, px + 3 * col, yy, col - 4);
  y += cardH + 5;

  // ─────────────────────────────────────────────────────────────────
  // KPIs — 7 cartões coloridos (tira de badges)
  // ─────────────────────────────────────────────────────────────────
  const kpiH = 13;
  const col7 = usableW / 7;
  const kpi = (
    lbl: string,
    val: string,
    idx: number,
    tint: [number, number, number],
    valColor: [number, number, number] = [31, 41, 55],
  ) => {
    const x = MARGIN + idx * col7;
    const w = col7 - 1.2;
    doc.setFillColor(tint[0], tint[1], tint[2]);
    doc.setDrawColor(220, 213, 200);
    doc.roundedRect(x, y, w, kpiH, 1.2, 1.2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(110, 95, 72);
    doc.text(lbl.toUpperCase(), x + 2, y + 3.4);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(valColor[0], valColor[1], valColor[2]);
    doc.text(val, x + 2, y + 9.8);
  };
  kpi("Nº do BM", resumo.descricaoBM, 0, [245, 239, 229], navy);
  kpi("Data da Medição", resumo.dataMedicao, 1, [252, 250, 246]);
  kpi("Valor total do contrato", fmtBRL(resumo.valorTotalObra), 2, [252, 250, 246]);
  kpi("Valor desta medição", fmtBRL(resumo.valorDestaMedicao), 3, [253, 235, 220], orange);
  kpi("Valor acumulado", fmtBRL(resumo.valorAcumulado), 4, [220, 252, 231], green);
  kpi("% Acumulado", `${fmtNum(resumo.percentualAcumulado)}%`, 5, [245, 239, 229], navy);
  kpi("Saldo restante", fmtBRL(resumo.saldoRestante), 6, [252, 250, 246]);
  doc.setTextColor(0, 0, 0);
  y += kpiH + 4;



  // Tabela — colunas alinhadas com a página de Atividades (Planejamento — Orçamento Contratado)
  type CellDef = string | number | { content: string; colSpan?: number; rowSpan?: number; styles?: Record<string, unknown> };
  const body: CellDef[][] = [];
  let totalContrato = 0;
  let totalContratoMO = 0;
  let totalContratoMat = 0;
  let totalFisicoAnt = 0;
  let totalFisicoPer = 0;
  let totalFisicoAtual = 0;
  let totalFinAnt = 0;
  let totalFinPer = 0;
  let totalFinAtual = 0;

  const headerBg: [number, number, number] = REPORT_RGB.headerBg;
  const groupBg: [number, number, number] = REPORT_RGB.groupBg;

  for (const r of rows) {
    if (r.isGroup) {
      body.push([
        { content: r.item, styles: { fontStyle: "bold", halign: "center", fillColor: groupBg, textColor: navy } },
        { content: "", styles: { fillColor: groupBg } },
        { content: "", styles: { fillColor: groupBg } },
        { content: r.descricao.toUpperCase(), colSpan: 16, styles: { fontStyle: "bold", halign: "left", fillColor: groupBg, textColor: navy } },
        { content: "", styles: { fillColor: groupBg } },
        { content: "ETAPA", styles: { fontStyle: "bold", halign: "center", fillColor: groupBg, textColor: navy } },
      ]);
      continue;
    }
    const evo = evolutions[r.item];
    const list = evo?.measurements ?? [];
    const qAnt = list.filter((m) => m.closed && m.number < measurementNumber).reduce((s, m) => s + (m.quantExec || 0), 0);
    const med = list.find((mm) => mm.number === measurementNumber);
    const qPer = med?.quantExec ?? 0;
    const qAtual = qAnt + qPer;
    const vu = r.valorUnitBDI || r.valorUnit || 0;
    const vuMO = r.valorUnitMO || 0;
    const vuMat = r.valorUnitMaterial || 0;
    const tMO = r.totalMO || 0;
    const tMat = r.totalMaterial || 0;
    const finAnt = qAnt * vu;
    const finPer = qPer * vu;
    const finAtual = qAtual * vu;
    totalContrato += r.total || 0;
    totalContratoMO += tMO;
    totalContratoMat += tMat;
    totalFisicoAnt += qAnt;
    totalFisicoPer += qPer;
    totalFisicoAtual += qAtual;
    totalFinAnt += finAnt;
    totalFinPer += finPer;
    totalFinAtual += finAtual;
    const a = activityMetrics(r, evo);
    const pct = r.total > 0 ? (finAtual / r.total) * 100 : 0;
    body.push([
      { content: r.item, styles: { fontStyle: "bold", halign: "center" } },
      { content: r.codigo || "", styles: { halign: "center" } },
      { content: r.banco || "", styles: { halign: "center" } },
      { content: r.descricao, styles: { halign: "left" } },
      { content: r.und, styles: { halign: "center" } },
      { content: fmtNum(r.quantidade), styles: { halign: "right" } },
      { content: fmtBRL(r.valorUnit || 0), styles: { halign: "right" } },
      { content: vuMO ? fmtBRL(vuMO) : "", styles: { halign: "right" } },
      { content: vuMat ? fmtBRL(vuMat) : "", styles: { halign: "right" } },
      { content: fmtBRL(vu), styles: { halign: "right" } },
      { content: tMO ? fmtBRL(tMO) : "", styles: { halign: "right" } },
      { content: tMat ? fmtBRL(tMat) : "", styles: { halign: "right" } },
      { content: fmtBRL(r.total), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtNum(qAnt), styles: { halign: "right" } },
      { content: fmtNum(qPer), styles: { halign: "right", fillColor: [253, 235, 220], textColor: orange, fontStyle: "bold" } },
      { content: fmtNum(qAtual), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(finAnt), styles: { halign: "right" } },
      { content: fmtBRL(finPer), styles: { halign: "right", fillColor: [253, 235, 220], textColor: orange, fontStyle: "bold" } },
      { content: fmtBRL(finAtual), styles: { halign: "right", fillColor: [220, 252, 231], textColor: green, fontStyle: "bold" } },
      { content: `${fmtNum(pct)}%`, styles: { halign: "right" } },
      { content: a.status, styles: { halign: "center", fontSize: 6 } },
    ]);
  }

  const totalPctGeral = totalContrato > 0 ? (totalFinAtual / totalContrato) * 100 : 0;

  autoTable(doc, {
    head: [
      [
        { content: "PLANEJAMENTO — ORÇAMENTO CONTRATADO", colSpan: 7, styles: { fillColor: navy, textColor: 255, halign: "center", fontStyle: "bold" } },
        { content: "VALOR UNIT COM BDI", colSpan: 3, styles: { fillColor: navy, textColor: 255, halign: "center", fontStyle: "bold" } },
        { content: "TOTAL", colSpan: 3, styles: { fillColor: navy, textColor: 255, halign: "center", fontStyle: "bold" } },
        { content: "EXECUTADO FÍSICO", colSpan: 3, styles: { fillColor: orange, textColor: 255, halign: "center", fontStyle: "bold" } },
        { content: "EXECUTADO FINANCEIRO (R$)", colSpan: 3, styles: { fillColor: green, textColor: 255, halign: "center", fontStyle: "bold" } },
        { content: "DESVIO", rowSpan: 2, styles: { fillColor: green, textColor: 255, halign: "center", fontStyle: "bold", valign: "middle" } },
        { content: "STATUS", rowSpan: 2, styles: { fillColor: navy, textColor: 255, halign: "center", fontStyle: "bold", valign: "middle" } },
      ],
      [
        { content: "Item", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Código", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Banco", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Descrição", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Und", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Quant.", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Valor Unit", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "M.O.", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "MAT.", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Total", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "M.O.", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "MAT.", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Total", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Acum. Ant.", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Período", styles: { fillColor: [253, 235, 220], textColor: orange, halign: "center", fontStyle: "bold" } },
        { content: "Acum. Atual", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Acum. Ant.", styles: { fillColor: headerBg, textColor: 20, halign: "center" } },
        { content: "Período", styles: { fillColor: [253, 235, 220], textColor: orange, halign: "center", fontStyle: "bold" } },
        { content: "Acum. Atual", styles: { fillColor: [220, 252, 231], textColor: green, halign: "center", fontStyle: "bold" } },
      ],
    ],
    body: body.length ? body : [[{ content: "Sem lançamentos neste período", colSpan: 21, styles: { halign: "center", fontStyle: "italic", textColor: 120 } }]],
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: 18, bottom: 14 },
    tableWidth: usableW,
    styles: { fontSize: 5.6, cellPadding: 0.9, lineColor: [200, 207, 219], lineWidth: 0.1, overflow: "linebreak" },
    headStyles: { fontSize: 6.2, lineColor: [180, 187, 200], lineWidth: 0.15 },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 11 },
      2: { cellWidth: 9 },
      3: { cellWidth: 38 },
      4: { cellWidth: 7 },
      5: { cellWidth: 11 },
      6: { cellWidth: 13 },
      7: { cellWidth: 12 },
      8: { cellWidth: 12 },
      9: { cellWidth: 13 },
      10: { cellWidth: 13 },
      11: { cellWidth: 13 },
      12: { cellWidth: 14 },
      13: { cellWidth: 11 },
      14: { cellWidth: 12 },
      15: { cellWidth: 12 },
      16: { cellWidth: 13 },
      17: { cellWidth: 13 },
      18: { cellWidth: 14 },
      19: { cellWidth: 10 },
      20: { cellWidth: 11 },
    },

    foot: [[
      { content: "TOTAL GERAL", colSpan: 10, styles: { halign: "left", fontStyle: "bold" } },
      { content: fmtBRL(totalContratoMO), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(totalContratoMat), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(totalContrato), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtNum(totalFisicoAnt), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtNum(totalFisicoPer), styles: { halign: "right", fontStyle: "bold", fillColor: [253, 235, 220], textColor: orange } },
      { content: fmtNum(totalFisicoAtual), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(totalFinAnt), styles: { halign: "right", fontStyle: "bold" } },
      { content: fmtBRL(totalFinPer), styles: { halign: "right", fontStyle: "bold", fillColor: [253, 235, 220], textColor: orange } },
      { content: fmtBRL(totalFinAtual), styles: { halign: "right", fontStyle: "bold", fillColor: [220, 252, 231], textColor: green } },
      { content: `${fmtNum(totalPctGeral)}%`, styles: { halign: "right", fontStyle: "bold" } },
      { content: "", styles: {} },
    ]],
    footStyles: { fillColor: navy, textColor: 255, fontSize: 6.5 },
    // Cabeçalho do BM repetido em todas as páginas (a partir da pág. 2)
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(navy[0], navy[1], navy[2]);
        doc.rect(0, 0, pageW, 12, "F");
        doc.setFillColor(gold[0], gold[1], gold[2]);
        doc.rect(0, 12, pageW, 1.2, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(bm, MARGIN, 8);
        doc.setFontSize(11);
        doc.text("BOLETIM DE MEDIÇÃO", pageW / 2, 8, { align: "center" });
        doc.setFontSize(8);
        doc.text(periodoLabel, pageW - MARGIN, 8, { align: "right" });
        doc.setTextColor(0, 0, 0);
      }
      const pH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(217, 207, 190);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, pH - 8, pageW - MARGIN, pH - 8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(140);
      doc.text(projectName, MARGIN, pH - 4);
      doc.text(`${bm} • Página ${data.pageNumber}`, pageW - MARGIN, pH - 4, { align: "right" });
    },
  });

  type AutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };
  let endY = ((doc as AutoTableDoc).lastAutoTable?.finalY ?? y) + 8;
  const pageH = doc.internal.pageSize.getHeight();
  if (endY > pageH - 70) {
    doc.addPage();
    endY = 22;
  }

  // Local + data — em fonte serifada institucional
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  const local = info.municipio ? `${info.municipio}${info.estado ? "/" + info.estado : ""}` : "____________________";
  doc.text(`${local}, ${closedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}.`, MARGIN, endY);
  endY += 8;

  // Dois cartões de assinatura lado a lado
  const gap = 6;
  const boxW = (usableW - gap) / 2;
  const boxH = 42;
  const drawSignBox = (x: number, header: string, name: string, cargo: string, extra: string) => {
    // Cartão
    doc.setFillColor(252, 250, 246);
    doc.setDrawColor(217, 207, 190);
    doc.roundedRect(x, endY, boxW, boxH, 1.6, 1.6, "FD");
    // Faixa de topo
    doc.setFillColor(navy[0], navy[1], navy[2]);
    doc.roundedRect(x, endY, boxW, 6.5, 1.6, 1.6, "F");
    doc.rect(x, endY + 3, boxW, 3.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(header, x + boxW / 2, endY + 4.4, { align: "center" });
    // Linha de assinatura
    const lineY = endY + boxH - 14;
    doc.setDrawColor(80, 68, 52);
    doc.setLineWidth(0.35);
    doc.line(x + 10, lineY, x + boxW - 10, lineY);
    doc.setLineWidth(0.1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(31, 41, 55);
    doc.text(name || "—", x + boxW / 2, lineY + 4.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    doc.setTextColor(90, 78, 62);
    doc.text(cargo || " ", x + boxW / 2, lineY + 8.5, { align: "center" });
    if (extra) {
      doc.setFontSize(7);
      doc.text(extra, x + boxW / 2, lineY + 11.5, { align: "center" });
    }
    // Rodapé "Assinatura digital ou física" em small caps
    doc.setFontSize(6);
    doc.setTextColor(150, 138, 118);
    doc.text("ASSINATURA DIGITAL OU FÍSICA", x + boxW / 2, endY + boxH - 2.5, { align: "center" });
  };

  const respCargo = info.cargoResponsavel || "Responsável Técnico";
  const respExtra = [
    info.crea ? `CREA/CAU ${info.crea}` : "",
    info.artRrt ? `ART/RRT ${info.artRrt}` : "",
  ].filter(Boolean).join(" • ");
  const fiscExtra = [
    info.creaFiscal ? `CREA/CAU ${info.creaFiscal}` : "",
  ].filter(Boolean).join(" • ");

  drawSignBox(
    MARGIN,
    (info.empresaExecutora || "EMPRESA EXECUTORA").toUpperCase(),
    info.responsavelTecnico || "Responsável Técnico",
    respCargo,
    respExtra,
  );
  drawSignBox(
    MARGIN + boxW + gap,
    (info.contratante || "FISCALIZAÇÃO").toUpperCase(),
    info.fiscal || "Fiscal da Obra",
    info.cargoFiscal || "Fiscal da Obra",
    fiscExtra,
  );

  void projectMetrics;
  return doc.output("blob");
}


async function loadImageAsDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 800, h: 600 });
      img.src = dataUrl;
    });
    return { dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

async function loadVideoThumbnail(url: string): Promise<{ dataUrl: string } | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      video.preload = "metadata";
      video.src = url;
      const cleanup = () => {
        video.removeAttribute("src");
        video.load();
      };
      const timeout = setTimeout(() => {
        cleanup();
        resolve(null);
      }, 8000);
      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
        } catch {
          /* ignore */
        }
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            clearTimeout(timeout);
            cleanup();
            return resolve(null);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Overlay play icon
          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const r = Math.min(canvas.width, canvas.height) * 0.12;
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.35, cy - r * 0.5);
          ctx.lineTo(cx + r * 0.55, cy);
          ctx.lineTo(cx - r * 0.35, cy + r * 0.5);
          ctx.closePath();
          ctx.fill();
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
          clearTimeout(timeout);
          cleanup();
          resolve({ dataUrl });
        } catch {
          clearTimeout(timeout);
          cleanup();
          resolve(null);
        }
      };
      video.onerror = () => {
        clearTimeout(timeout);
        cleanup();
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

export async function exportDiarioPdf(entries: DiaryEntry[], titulo = "Diário de Obra") {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(16);
  doc.text(titulo, 14, 15);
  let y = 25;
  doc.setFontSize(10);

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 15) {
      doc.addPage();
      y = 20;
    }
  };

  for (const e of entries) {
    ensureSpace(30);
    doc.setFont("helvetica", "bold");
    doc.text(`${e.data} — ${e.etapa}`, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const horario = e.horaInicio || e.horaFim ? `  |  Horário: ${e.horaInicio || "-"} às ${e.horaFim || "-"}` : "";
    const status = e.statusDia ? `  |  Status: ${e.statusDia}` : "";
    const meta = `Clima: ${e.clima || "-"}  |  Equipe: ${e.equipe || "-"}  |  Equipamentos: ${e.equipamentos || "-"}${horario}${status}`;
    const metaLines = doc.splitTextToSize(meta, 180);
    doc.text(metaLines, 14, y);
    y += metaLines.length * 5 + 2;
    const texto = doc.splitTextToSize(e.texto, 180);
    ensureSpace(texto.length * 5 + 4);
    doc.text(texto, 14, y);
    y += texto.length * 5 + 4;
    if (e.pendencias) {
      const pend = doc.splitTextToSize(`Pendências: ${e.pendencias}`, 180);
      ensureSpace(pend.length * 5 + 4);
      doc.text(pend, 14, y);
      y += pend.length * 5 + 4;
    }
    if (e.observacoes) {
      doc.setFont("helvetica", "italic");
      const obs = doc.splitTextToSize(`Obs: ${e.observacoes}`, 180);
      ensureSpace(obs.length * 5 + 4);
      doc.text(obs, 14, y);
      y += obs.length * 5 + 4;
      doc.setFont("helvetica", "normal");
    }

    // Fotos
    if (e.fotos && e.fotos.length > 0) {
      ensureSpace(8);
      doc.setFont("helvetica", "bold");
      doc.text(`Registro fotográfico (${e.fotos.length})`, 14, y);
      doc.setFont("helvetica", "normal");
      y += 5;
      const items = e.fotos;
      const cols = 2;
      const gap = 4;
      const cellW = (pageW - 28 - gap) / cols;
      const cellH = cellW * 0.75;
      let col = 0;
      let rowX = 14;
      for (const f of items) {
        const isVideo = f.tipo === "video";
        const data = isVideo ? await loadVideoThumbnail(f.url) : await loadImageAsDataUrl(f.url);
        if (col === 0) {
          ensureSpace(cellH + 14);
          rowX = 14;
        }
        if (data) {
          try {
            doc.addImage(data.dataUrl, "JPEG", rowX, y, cellW, cellH, undefined, "FAST");
          } catch {
            /* ignore */
          }
        } else {
          // Placeholder
          doc.setDrawColor(180);
          doc.setFillColor(240, 240, 240);
          doc.rect(rowX, y, cellW, cellH, "FD");
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(isVideo ? "VIDEO" : "Imagem indisponivel", rowX + cellW / 2, y + cellH / 2, {
            align: "center",
          });
          doc.setFont("helvetica", "normal");
        }
        if (isVideo) {
          // Clickable link over the cell
          try {
            doc.link(rowX, y, cellW, cellH, { url: f.url });
          } catch {
            /* ignore */
          }
        }
        const tag = isVideo ? " [vídeo]" : f.tipo && f.tipo !== "geral" ? ` [${f.tipo}]` : "";
        const caption = `${f.hora || ""}${f.legenda ? " — " + f.legenda : ""}${tag}`;
        doc.setFontSize(8);
        const capLines = doc.splitTextToSize(caption, cellW);
        doc.text(capLines, rowX, y + cellH + 4);
        if (isVideo) {
          // Botão "Abrir vídeo" destacado
          const btnW = 32;
          const btnH = 7;
          const btnX = rowX + (cellW - btnW) / 2;
          const btnY = y + cellH + 7;
          doc.setFillColor(37, 99, 235);
          doc.setDrawColor(37, 99, 235);
          doc.roundedRect(btnX, btnY, btnW, btnH, 1.5, 1.5, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.textWithLink("Abrir video", btnX + btnW / 2, btnY + btnH / 2 + 1.5, {
            url: f.url,
            align: "center",
          });
          doc.setFont("helvetica", "normal");
          // Link "Baixar vídeo" logo abaixo
          doc.setFontSize(8);
          doc.setTextColor(37, 99, 235);
          const dlUrl = f.url + (f.url.includes("?") ? "&" : "?") + "download=1";
          doc.textWithLink("Baixar video", rowX + cellW / 2, btnY + btnH + 4, {
            url: dlUrl,
            align: "center",
          });
          doc.setTextColor(0, 0, 0);
        }
        doc.setFontSize(10);
        col++;
        const rowExtra = isVideo ? 28 : 14;
        if (col >= cols) {
          col = 0;
          y += cellH + rowExtra;
        } else {
          rowX += cellW + gap;
        }
      }
      if (col !== 0) y += cellH + (items.some((f) => f.tipo === "video") ? 28 : 14);
    }

    ensureSpace(8);
    doc.setDrawColor(200);
    doc.line(14, y, pageW - 14, y);
    y += 6;
  }
  doc.save(`diario-${Date.now()}.pdf`);
}

export function gerarTextoDiario(p: {
  etapa: string;
  descricao: string;
  quantExec: number;
  unidade: string;
  quantTotal?: number;
  percentTotal?: number;
}) {
  const pct =
    p.percentTotal !== undefined
      ? p.percentTotal
      : p.quantTotal && p.quantTotal > 0
        ? (p.quantExec / p.quantTotal) * 100
        : null;
  const pctStr = pct !== null ? ` (percentual executado de ${fmtNum(pct)}% do total previsto)` : "";
  const und = p.unidade ? ` ${p.unidade}` : "";
  return `Na presente data, foram executados serviços referentes à etapa ${p.etapa}, compreendendo ${p.descricao}, com execução de ${fmtNum(p.quantExec)}${und}${pctStr}, correspondente ao avanço físico da atividade. Os serviços ocorreram conforme planejamento da obra, mantendo-se o acompanhamento físico-financeiro do contrato.`;
}
