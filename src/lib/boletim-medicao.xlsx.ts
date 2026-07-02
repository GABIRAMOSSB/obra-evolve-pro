/**
 * Boletim de Medição — XLSX institucional SOLV (planilha única).
 *
 * Gera do zero (sem template) uma única aba "Boletim" seguindo o layout
 * aprovado pelo cliente. Não usa imagem de logo (a marca fica escrita
 * na parte superior esquerda para não sobrepor nada) e o rodapé é uma
 * única linha "TOTAL GERAL".
 */
import ExcelJS from "exceljs";
import { normalizeUnidade, sanitizeDescricao } from "./boletim-medicao.calc";

const BRL = 'R$ #,##0.00';
const PCT = '0.00%';

// Paleta institucional SOLV
const COLOR_GRAFITE = "FF141922";       // barra topo/etapa nível 1
const COLOR_DOURADO = "FFC8A66A";       // detalhe
const COLOR_BEGE = "FFF6EEDC";          // subgrupos e "Período"
const COLOR_BEGE_LIGHT = "FFFDF8EE";    // linhas de dados
const COLOR_FIN = "FFEEF3F8";           // colunas financeiras
const COLOR_TEXT = "FF202833";
const COLOR_MUTED = "FF2E3745";
const COLOR_WHITE = "FFFFFFFF";

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

const fill = (c: string): ExcelJS.FillPattern => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: c },
});

const thin = { style: "thin" as const, color: { argb: "FFD9D9D9" } };
const borderAll = {
  top: thin,
  left: thin,
  bottom: thin,
  right: thin,
} as Partial<ExcelJS.Borders> as ExcelJS.Borders;

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function segmentCount(codigo: string): number {
  return codigo.split(".").filter((s) => s.trim().length > 0).length;
}

function estimateHeight(descricao: string, colWidthChars = 55, fontSize = 8): number {
  const parts = descricao.split(/\r?\n/);
  let total = 0;
  for (const p of parts) total += Math.max(1, Math.ceil(p.length / colWidthChars));
  const lineHeight = fontSize <= 8 ? 12 : 14;
  return Math.max(22, total * lineHeight + 8);
}

export async function generateBoletimMedicaoXLSX(data: XLSXInput): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SOLV Construtora";
  wb.created = new Date();

  const bmLabel = data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`;
  const nomeObra = data.obra?.nome ?? "—";
  const endereco =
    [data.obra?.endereco, data.obra?.cidade, data.obra?.uf].filter(Boolean).join(", ") || "—";
  const executora = data.company?.razao_social ?? data.company?.nome ?? "SOLV Construtora";
  const contratante = data.obra?.cliente ?? data.contrato?.orgao_contratante ?? "—";
  const cnpjContratante = data.obra?.cnpj_cliente ?? "—";
  const cnpjExecutora = data.company?.cnpj ?? "—";
  const processo = data.contrato?.processo_administrativo ?? "—";
  const licitacao = data.contrato?.numero_licitacao ?? "—";
  const inicioObra = fmtDateBR(data.contrato?.data_inicio);
  const prazoStr = data.contrato?.prazo_dias ? `${data.contrato.prazo_dias} dias` : "—";
  const rtLinha = data.responsavelTecnico
    ? `${data.responsavelTecnico.nome}\n${data.responsavelTecnico.registro ?? "—"}`
    : "—";
  const fiscalLinha = data.fiscal
    ? `${data.fiscal.nome}\n${data.fiscal.registro ?? "—"}`
    : "—";
  const dataMedBR = fmtDateBR(data.medicao.data_medicao);
  const periodoStr = `${fmtDateBR(data.medicao.periodo_inicio)} a ${fmtDateBR(data.medicao.periodo_fim)}`;

  const ws = wb.addWorksheet("Boletim", {
    views: [{ state: "frozen", ySplit: 13 }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Larguras: A..M (13 colunas)
  const widths = [12, 55, 6, 9, 12, 13, 10, 10, 10, 13, 13, 13, 10];
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));

  // ============ LINHA 1: identificação superior ============
  ws.mergeCells("A1:D1");
  ws.mergeCells("E1:I1");
  ws.mergeCells("J1:M1");
  const c1a = ws.getCell("A1");
  c1a.value = `${bmLabel}  •  ${dataMedBR}`;
  c1a.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_WHITE } };
  c1a.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  c1a.fill = fill(COLOR_GRAFITE);

  const c1b = ws.getCell("E1");
  c1b.value = "S O L V   C O N S T R U T O R A";
  c1b.font = { name: "Aptos", size: 12, bold: true, color: { argb: COLOR_DOURADO } };
  c1b.alignment = { horizontal: "center", vertical: "middle" };
  c1b.fill = fill(COLOR_GRAFITE);

  const c1c = ws.getCell("J1");
  c1c.value = "◤ EXCELÊNCIA EM CONSTRUÇÃO CIVIL ◢";
  c1c.font = { name: "Aptos", size: 9, bold: true, color: { argb: COLOR_DOURADO } };
  c1c.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  c1c.fill = fill(COLOR_GRAFITE);

  ws.getRow(1).height = 26;

  // ============ LINHA 2: título ============
  ws.mergeCells("A2:D2");
  ws.mergeCells("E2:F2");
  ws.mergeCells("G2:H2");
  ws.mergeCells("I2:J2");
  ws.mergeCells("K2:M2");
  ws.getCell("A2").value = "";
  ws.getCell("A2").fill = fill(COLOR_GRAFITE);
  const c2t = ws.getCell("E2");
  c2t.value = "BOLETIM DE MEDIÇÃO";
  c2t.font = { name: "Aptos", size: 14, bold: true, color: { argb: COLOR_WHITE } };
  c2t.alignment = { horizontal: "center", vertical: "middle" };
  c2t.fill = fill(COLOR_GRAFITE);
  const c2bm = ws.getCell("G2");
  c2bm.value = `◈ ${bmLabel}`;
  c2bm.font = { name: "Aptos", size: 11, bold: true, color: { argb: COLOR_DOURADO } };
  c2bm.alignment = { horizontal: "center", vertical: "middle" };
  c2bm.fill = fill(COLOR_GRAFITE);
  const c2sep = ws.getCell("I2");
  c2sep.value = "— → —";
  c2sep.font = { name: "Aptos", size: 10, color: { argb: COLOR_DOURADO } };
  c2sep.alignment = { horizontal: "center", vertical: "middle" };
  c2sep.fill = fill(COLOR_GRAFITE);
  const c2em = ws.getCell("K2");
  c2em.value = `EMISSÃO · ${dataMedBR}`;
  c2em.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_WHITE } };
  c2em.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  c2em.fill = fill(COLOR_GRAFITE);
  ws.getRow(2).height = 26;

  // Linha 3 vazia (respiro)
  ws.getRow(3).height = 6;

  const metaRow = (row: number, defs: Array<[string, string, string]>) => {
    for (const [span, label, value] of defs) {
      ws.mergeCells(span);
      const [start] = span.split(":");
      const cell = ws.getCell(start);
      cell.value = {
        richText: [
          { text: `${label}\n`, font: { name: "Aptos", size: 8, bold: true, color: { argb: COLOR_DOURADO } } },
          { text: value, font: { name: "Aptos", size: 9, bold: false, color: { argb: COLOR_TEXT } } },
        ],
      };
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
      cell.fill = fill(COLOR_BEGE);
      cell.border = borderAll;
    }
    ws.getRow(row).height = 34;
  };

  metaRow(4, [
    ["A4:D4", "OBRA", nomeObra],
    ["E4:G4", "CLIENTE / CONTRATANTE", contratante],
    ["H4:I4", "CNPJ CONTRATANTE", cnpjContratante],
    ["J4:M4", "ENDEREÇO DA OBRA", endereco],
  ]);

  metaRow(5, [
    ["A5:D5", "EMPRESA EXECUTORA", executora],
    ["E5:G5", "CNPJ EXECUTORA", cnpjExecutora],
    ["H5:I5", "CONTRATO Nº", data.contrato?.numero ? `nº ${data.contrato.numero}` : "—"],
    ["J5:M5", "PROCESSO ADMINISTRATIVO", processo],
  ]);

  metaRow(6, [
    ["A6:B6", "Nº BOLETIM", bmLabel],
    ["C6:D6", "DATA MEDIÇÃO", dataMedBR],
    ["E6:G6", "PERÍODO DE MEDIÇÃO", periodoStr],
    ["H6:I6", "INÍCIO DA OBRA", inicioObra],
    ["J6:K6", "PRAZO CONTRATUAL", prazoStr],
    ["L6:M6", "LICITAÇÃO Nº", licitacao],
  ]);

  metaRow(7, [
    ["A7:F7", "OBJETO DO CONTRATO", data.contrato?.objeto ?? "—"],
    ["G7:I7", "RESPONSÁVEL TÉCNICO", rtLinha],
    ["J7:M7", "FISCAL DA OBRA", fiscalLinha],
  ]);
  ws.getRow(7).height = 42;

  // Linha 8 vazia (respiro)
  ws.getRow(8).height = 4;

  // ============ Cabeçalho da grade (linhas 9..10) ============
  // Estrutura: Item | Descrição | Un. | Qtd. | V. Unit. | Total | EXEC. FÍSICO (3) | EXEC. FINANCEIRO (3) | Executado %
  const header1: Record<string, string> = {
    A: "Item",
    B: "Descrição",
    C: "Un.",
    D: "Qtd.",
    E: "V. Unit.",
    F: "Total",
    G: "EXECUTADO FÍSICO",
    J: "EXECUTADO FINANCEIRO",
    M: "Executado %",
  };
  const header2: Record<string, string> = {
    G: "Anterior", H: "Período", I: "Acum.",
    J: "Anterior", K: "Período", L: "Acum.",
  };

  // Merges do header (linha 9 + 10) — colunas simples: A..F e M ocupam duas linhas
  ["A", "B", "C", "D", "E", "F", "M"].forEach((col) => {
    ws.mergeCells(`${col}9:${col}10`);
  });
  ws.mergeCells("G9:I9");
  ws.mergeCells("J9:L9");

  for (const [col, txt] of Object.entries(header1)) {
    const cell = ws.getCell(`${col}9`);
    cell.value = txt;
    cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: COLOR_WHITE } };
    cell.fill = fill(COLOR_GRAFITE);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = borderAll;
  }
  for (const [col, txt] of Object.entries(header2)) {
    const cell = ws.getCell(`${col}10`);
    cell.value = txt;
    cell.font = { name: "Aptos", size: 8, bold: true, color: { argb: COLOR_TEXT } };
    cell.fill = fill(COLOR_BEGE);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderAll;
  }
  ws.getRow(9).height = 22;
  ws.getRow(10).height = 18;

  // ============ Itens (a partir da linha 11) ============
  const startRow = 11;
  const N = data.itens.length;

  for (let i = 0; i < N; i++) {
    const item = data.itens[i];
    const r = startRow + i;
    const row = ws.getRow(r);
    const codigo = item.item_codigo;
    const segs = segmentCount(codigo);
    const isEtapa = item.is_etapa;
    const isNivel1 = isEtapa && segs <= 1;
    const isSubgrupo = isEtapa && !isNivel1;

    row.getCell(1).value = codigo;
    row.getCell(2).value = sanitizeDescricao(item.descricao);

    if (isNivel1) {
      row.height = 22;
      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(COLOR_GRAFITE);
        cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_WHITE } };
        cell.alignment = {
          horizontal: c === 2 ? "left" : "center",
          vertical: "middle",
          wrapText: true,
          indent: c === 2 ? 1 : 0,
        };
        cell.border = borderAll;
      }
    } else if (isSubgrupo) {
      row.height = 20;
      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(COLOR_BEGE);
        cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: COLOR_TEXT } };
        cell.alignment = {
          horizontal: c === 2 ? "left" : "center",
          vertical: "middle",
          wrapText: true,
          indent: c === 2 ? 1 : 0,
        };
        cell.border = borderAll;
      }
    } else {
      row.height = estimateHeight(sanitizeDescricao(item.descricao));
      row.getCell(3).value = normalizeUnidade(item.unidade);
      row.getCell(4).value = Number(item.qtd_contratada);
      row.getCell(4).numFmt = "#,##0.00";
      row.getCell(5).value = Number(item.valor_unitario);
      row.getCell(5).numFmt = BRL;
      row.getCell(6).value = { formula: `ROUND(D${r}*E${r},2)` };
      row.getCell(6).numFmt = BRL;
      row.getCell(7).value = Number(item.qtd_acum_anterior);
      row.getCell(7).numFmt = "#,##0.00";
      const per = row.getCell(8);
      per.value = Number(item.qtd_periodo);
      per.numFmt = "#,##0.00";
      row.getCell(9).value = { formula: `G${r}+H${r}` };
      row.getCell(9).numFmt = "#,##0.00";
      row.getCell(10).value = Number(item.valor_acum_anterior);
      row.getCell(10).numFmt = BRL;
      row.getCell(11).value = { formula: `ROUND(H${r}*E${r},2)` };
      row.getCell(11).numFmt = BRL;
      row.getCell(12).value = { formula: `J${r}+K${r}` };
      row.getCell(12).numFmt = BRL;
      row.getCell(13).value = { formula: `IF(D${r}=0,0,I${r}/D${r})` };
      row.getCell(13).numFmt = PCT;

      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        let bg = COLOR_BEGE_LIGHT;
        let bold = false;
        let color = COLOR_TEXT;
        if (c === 8) { bg = COLOR_BEGE; bold = true; color = COLOR_MUTED; }
        else if (c === 7 || c === 9) { color = COLOR_MUTED; }
        else if (c === 10 || c === 11 || c === 12) { bg = COLOR_FIN; }
        cell.fill = fill(bg);
        cell.font = { name: "Aptos", size: 8, bold, color: { argb: color } };
        cell.alignment = {
          horizontal: c === 2 ? "left" : "center",
          vertical: c <= 2 ? "top" : "middle",
          wrapText: true,
          indent: c === 2 ? 1 : 0,
        };
        cell.border = borderAll;
      }
    }
  }

  // ============ TOTAL GERAL (única linha de rodapé) ============
  const totalRow = startRow + N;
  ws.mergeCells(`A${totalRow}:E${totalRow}`);
  const tCell = ws.getCell(`A${totalRow}`);
  tCell.value = "TOTAL GERAL";
  tCell.font = { name: "Aptos", size: 11, bold: true, color: { argb: COLOR_WHITE } };
  tCell.fill = fill(COLOR_GRAFITE);
  tCell.alignment = { horizontal: "right", vertical: "middle", indent: 1 };

  ws.getCell(`F${totalRow}`).value = N > 0 ? { formula: `SUM(F${startRow}:F${totalRow - 1})` } : 0;
  ws.getCell(`F${totalRow}`).numFmt = BRL;
  ws.mergeCells(`G${totalRow}:I${totalRow}`);
  ws.getCell(`G${totalRow}`).value = "";
  ws.getCell(`J${totalRow}`).value = N > 0 ? { formula: `SUM(J${startRow}:J${totalRow - 1})` } : 0;
  ws.getCell(`J${totalRow}`).numFmt = BRL;
  ws.getCell(`K${totalRow}`).value = N > 0 ? { formula: `SUM(K${startRow}:K${totalRow - 1})` } : 0;
  ws.getCell(`K${totalRow}`).numFmt = BRL;
  ws.getCell(`L${totalRow}`).value = N > 0 ? { formula: `SUM(L${startRow}:L${totalRow - 1})` } : 0;
  ws.getCell(`L${totalRow}`).numFmt = BRL;
  ws.getCell(`M${totalRow}`).value = N > 0 ? { formula: `IF(F${totalRow}=0,0,L${totalRow}/F${totalRow})` } : 0;
  ws.getCell(`M${totalRow}`).numFmt = PCT;

  for (let c = 6; c <= 13; c++) {
    const cell = ws.getRow(totalRow).getCell(c);
    cell.fill = fill(COLOR_GRAFITE);
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_DOURADO } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = borderAll;
  }
  ws.getRow(totalRow).height = 24;

  ws.pageSetup.printTitlesRow = "1:10";

  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
