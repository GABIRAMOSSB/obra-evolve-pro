/**
 * Boletim de Medição — XLSX institucional SOLV (planilha única).
 *
 * Gera do zero (sem template) uma única aba "Boletim" seguindo o layout
 * aprovado pelo cliente. Não usa imagem de logo (a marca fica escrita
 * na parte superior esquerda para não sobrepor nada) e o rodapé é uma
 * única linha "TOTAL GERAL".
 */
import ExcelJS from "exceljs";
import { normalizeUnidade, sanitizeDescricao, computeTotais, fmtMoneyBR, fmtPctBR } from "./boletim-medicao.calc";

const BRL = 'R$ #,##0.00';
const PCT = '0.00%';

// Paleta institucional SOLV (refinada — estilo Figma)
const COLOR_GRAFITE = "FF0F1420";       // barra topo/etapa nível 1 (quase preto)
const COLOR_DOURADO = "FFC8A66A";       // detalhe dourado
const COLOR_BEGE = "FFF6EEDC";          // subgrupos
const COLOR_META_BG = "FFFAF7F1";       // fundo dos meta-cards
const COLOR_BEGE_LIGHT = "FFFCFAF5";    // linhas de dados (par)
const COLOR_ROW_ALT = "FFFFFFFF";       // linhas de dados (ímpar)
const COLOR_FIN = "FFF1F5FA";           // colunas financeiras (par)
const COLOR_FIN_ALT = "FFF8FBFE";       // colunas financeiras (ímpar)
const COLOR_TEXT = "FF1B2230";
const COLOR_MUTED = "FF4A5568";
const COLOR_LABEL = "FF8A6E3E";         // labels em dourado escuro
const COLOR_WHITE = "FFFFFFFF";
const COLOR_BORDER = "FFECE6D6";        // borda suave bege

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
  responsavelTecnico?: { nome: string; registro: string | null; cargo?: string | null; art_rrt?: string | null } | null;
  fiscal?: { nome: string; registro: string | null; cargo?: string | null } | null;
  licitador?: string | null;
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

const thin = { style: "thin" as const, color: { argb: COLOR_BORDER } };
const hair = { style: "hair" as const, color: { argb: COLOR_BORDER } };
const borderAll = {
  top: hair,
  left: hair,
  bottom: hair,
  right: hair,
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
  const licitador = data.licitador ?? data.obra?.cliente ?? "—";
  const contratante = data.contrato?.orgao_contratante ?? data.obra?.cliente ?? "—";
  const cnpjContratante = data.obra?.cnpj_cliente ?? "—";
  const cnpjExecutora = data.company?.cnpj ?? "—";
  const processo = data.contrato?.processo_administrativo ?? "—";
  const licitacao = data.contrato?.numero_licitacao ?? "—";
  const inicioObra = fmtDateBR(data.contrato?.data_inicio);
  const prazoStr = data.contrato?.prazo_dias ? `${data.contrato.prazo_dias} dias` : "—";
  const rt = data.responsavelTecnico;
  const rtLinha = rt
    ? [
        rt.nome,
        rt.cargo ? `Cargo: ${rt.cargo}` : null,
        rt.registro ? `CREA/CAU: ${rt.registro}` : null,
        rt.art_rrt ? `ART/RRT: ${rt.art_rrt}` : null,
      ].filter(Boolean).join("\n")
    : "—";
  const fs = data.fiscal;
  const fiscalLinha = fs
    ? [
        fs.nome,
        fs.cargo ? `Cargo: ${fs.cargo}` : null,
        fs.registro ? `CREA/CAU: ${fs.registro}` : null,
      ].filter(Boolean).join("\n")
    : "—";
  const dataMedBR = fmtDateBR(data.medicao.data_medicao);
  // Duração do período (dias) — quanto tempo levou para fechar a medição
  const parseDay = (s?: string | null): Date | null => {
    if (!s) return null;
    const d = new Date(s.length === 10 ? s + "T00:00:00" : s);
    return isNaN(d.getTime()) ? null : d;
  };
  const dIni = parseDay(data.medicao.periodo_inicio);
  const dFim = parseDay(data.medicao.periodo_fim);
  let duracaoDias = 0;
  if (dIni && dFim) {
    duracaoDias = Math.max(0, Math.round((dFim.getTime() - dIni.getTime()) / (1000 * 60 * 60 * 24)));
  }
  const periodoStr =
    dIni && dFim
      ? `${fmtDateBR(data.medicao.periodo_inicio)} a ${fmtDateBR(data.medicao.periodo_fim)}`
      : "—";
  const duracaoStr = dIni && dFim ? `${duracaoDias} dia${duracaoDias === 1 ? "" : "s"}` : "—";

  const ws = wb.addWorksheet("Boletim", {
    views: [{ state: "frozen", ySplit: 11, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.7, header: 0.2, footer: 0.3 },
    },
    headerFooter: {
      differentFirst: false,
      oddFooter:
        '&L&"Aptos,Regular"&8&K4A5568SOLV Construtora  •  Boletim de Medição ' +
        bmLabel +
        '&C&"Aptos,Bold"&9&K0F1420Página &P de &N' +
        '&R&"Aptos,Regular"&8&K4A5568Emitido em ' + dataMedBR,
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
  ws.mergeCells("A2:F2");
  ws.mergeCells("G2:I2");
  ws.mergeCells("J2:M2");
  const c2t = ws.getCell("A2");
  c2t.value = "BOLETIM DE MEDIÇÃO";
  c2t.font = { name: "Aptos", size: 14, bold: true, color: { argb: COLOR_WHITE } };
  c2t.alignment = { horizontal: "center", vertical: "middle" };
  c2t.fill = fill(COLOR_GRAFITE);
  const c2bm = ws.getCell("G2");
  c2bm.value = `◈ ${bmLabel}`;
  c2bm.font = { name: "Aptos", size: 12, bold: true, color: { argb: COLOR_DOURADO } };
  c2bm.alignment = { horizontal: "center", vertical: "middle" };
  c2bm.fill = fill(COLOR_GRAFITE);
  const c2em = ws.getCell("J2");
  c2em.value = `EMISSÃO · ${dataMedBR}`;
  c2em.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_WHITE } };
  c2em.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  c2em.fill = fill(COLOR_GRAFITE);
  ws.getRow(2).height = 30;

  // Linha 3 vazia (respiro)
  ws.getRow(3).height = 6;

  const colIdx = (letter: string): number =>
    letter.split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0);
  const spanWidthChars = (span: string): number => {
    const [a, b] = span.split(":");
    const ca = colIdx(a.replace(/\d+/g, ""));
    const cb = colIdx(b.replace(/\d+/g, ""));
    let total = 0;
    for (let c = ca; c <= cb; c++) total += ws.getColumn(c).width ?? 10;
    return Math.max(4, total - 3); // desconta indent + padding
  };
  const estimateMetaHeight = (value: string, widthChars: number, fontSize = 9.5): number => {
    const parts = String(value ?? "").split(/\r?\n/);
    let lines = 0;
    for (const p of parts) lines += Math.max(1, Math.ceil((p.length || 1) / widthChars));
    const lineH = fontSize <= 8 ? 12 : 14;
    return Math.max(32, lines * lineH + 18); // +18 pela linha do label
  };

  const metaRow = (row: number, defs: Array<[string, string, string]>) => {
    let maxH = 32;
    for (const [span, label, value] of defs) {
      ws.mergeCells(span);
      const [start] = span.split(":");
      const cell = ws.getCell(start);
      cell.value = {
        richText: [
          { text: `${label.toUpperCase()}\n`, font: { name: "Aptos", size: 7, bold: true, color: { argb: COLOR_LABEL } } },
          { text: value, font: { name: "Aptos", size: 9.5, bold: false, color: { argb: COLOR_TEXT } } },
        ],
      };
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
      cell.fill = fill(COLOR_META_BG);
      cell.border = {
        top: hair,
        bottom: hair,
        left: hair,
        right: hair,
      };
      const h = estimateMetaHeight(value, spanWidthChars(span));
      if (h > maxH) maxH = h;
    }
    ws.getRow(row).height = maxH;
  };

  metaRow(4, [
    ["A4:D4", "OBRA", nomeObra],
    ["E4:G4", "LICITADOR", licitador],
    ["H4:I4", "CNPJ CONTRATANTE", cnpjContratante],
    ["J4:M4", "ENDEREÇO DA OBRA", endereco],
  ]);

  metaRow(5, [
    ["A5:D5", "CONTRATANTE", contratante],
    ["E5:G5", "EMPRESA EXECUTORA", executora],
    ["H5:I5", "CNPJ EXECUTORA", cnpjExecutora],
    ["J5:M5", "PROCESSO ADMINISTRATIVO", processo],
  ]);

  metaRow(6, [
    ["A6:B6", "Nº BOLETIM", bmLabel],
    ["C6:D6", "DATA MEDIÇÃO", dataMedBR],
    ["E6:F6", "CONTRATO Nº", data.contrato?.numero ? `nº ${data.contrato.numero}` : "—"],
    ["G6:H6", "LICITAÇÃO Nº", licitacao],
    ["I6:J6", "INÍCIO DA OBRA", inicioObra],
    ["K6:M6", "PRAZO CONTRATUAL", prazoStr],
  ]);

  metaRow(7, [
    ["A7:C7", "PERÍODO DE MEDIÇÃO", periodoStr],
    ["D7:E7", "DURAÇÃO", duracaoStr],
    ["F7:M7", "OBJETO DO CONTRATO", data.contrato?.objeto ?? "—"],
  ]);

  metaRow(8, [
    ["A8:F8", "RESPONSÁVEL TÉCNICO", rtLinha],
    ["G8:M8", "FISCAL DA OBRA", fiscalLinha],
  ]);
  


  // ============ LINHA 9: KPIs (BM, Data, Valor total, Medição, Acumulado, %, Saldo) ============
  const _tot = computeTotais(data.itens);
  const kpiDefs: Array<[string, string, string, string]> = [
    // [span, label, value, accentBg]
    ["A9:B9", "Nº DO BM", bmLabel, "FFF6EEDC"],
    ["C9:D9", "DATA DA MEDIÇÃO", dataMedBR, "FFF6EEDC"],
    ["E9:F9", "VALOR TOTAL DO CONTRATO", fmtMoneyBR(_tot.valor_total_contrato), "FFEFF3F8"],
    ["G9:H9", "VALOR DESTA MEDIÇÃO", fmtMoneyBR(_tot.valor_medicao_atual), "FFFBE9E1"],
    ["I9:J9", "VALOR ACUMULADO", fmtMoneyBR(_tot.valor_acumulado), "FFE5F3EC"],
    ["K9:L9", "% ACUMULADO", fmtPctBR(_tot.percentual_executado, 2), "FFEFEBFF"],
    ["M9:M9", "SALDO RESTANTE", fmtMoneyBR(_tot.saldo_contratual), "FFF6EEDC"],
  ];
  for (const [span, label, value, bg] of kpiDefs) {
    ws.mergeCells(span);
    const [start] = span.split(":");
    const cell = ws.getCell(start);
    cell.value = {
      richText: [
        { text: `${label}\n`, font: { name: "Aptos", size: 6.5, bold: true, color: { argb: COLOR_LABEL } } },
        { text: value, font: { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_TEXT } } },
      ],
    };
    cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true, indent: 1 };
    cell.fill = fill(bg);
    cell.border = borderAll;
  }
  ws.getRow(9).height = 32;

  // ============ Cabeçalho da grade (linhas 10..11) ============
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

  // Merges do header (linha 10 + 11) — colunas simples: A..F e M ocupam duas linhas
  ["A", "B", "C", "D", "E", "F", "M"].forEach((col) => {
    ws.mergeCells(`${col}10:${col}11`);
  });
  ws.mergeCells("G10:I10");
  ws.mergeCells("J10:L10");

  for (const [col, txt] of Object.entries(header1)) {
    const cell = ws.getCell(`${col}10`);
    cell.value = txt;
    cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: COLOR_WHITE } };
    cell.fill = fill(COLOR_GRAFITE);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: thin,
    };
  }
  for (const [col, txt] of Object.entries(header2)) {
    const cell = ws.getCell(`${col}11`);
    cell.value = txt;
    cell.font = { name: "Aptos", size: 8, bold: true, color: { argb: COLOR_LABEL } };
    cell.fill = fill(COLOR_BEGE);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: hair,
    };
  }
  ws.getRow(10).height = 22;
  ws.getRow(11).height = 18;

  // ============ Itens (a partir da linha 12) ============
  const startRow = 12;
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
      row.height = 24;
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
        cell.border = {
          top: thin,
          bottom: thin,
        };
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
        cell.border = {
          bottom: hair,
        };
      }
    } else {
      row.height = estimateHeight(sanitizeDescricao(item.descricao));
      row.getCell(3).value = normalizeUnidade(item.unidade);
      row.getCell(4).value = Number(item.qtd_contratada);
      row.getCell(4).numFmt = "#,##0.00";
      row.getCell(5).value = Number(item.valor_unitario);
      row.getCell(5).numFmt = BRL;
      row.getCell(6).value = { formula: `D${r}*E${r}` };
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
      row.getCell(11).value = { formula: `H${r}*E${r}` };
      row.getCell(11).numFmt = BRL;
      row.getCell(12).value = { formula: `J${r}+K${r}` };
      row.getCell(12).numFmt = BRL;
      row.getCell(13).value = { formula: `IF(D${r}=0,0,I${r}/D${r})` };
      row.getCell(13).numFmt = PCT;

      const zebra = i % 2 === 0;
      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        let bg = zebra ? COLOR_BEGE_LIGHT : COLOR_ROW_ALT;
        let bold = false;
        let color = COLOR_TEXT;
        if (c === 8) { bg = COLOR_BEGE; bold = true; color = COLOR_TEXT; }
        else if (c === 7 || c === 9) { color = COLOR_MUTED; }
        else if (c === 10 || c === 11 || c === 12) { bg = zebra ? COLOR_FIN : COLOR_FIN_ALT; }
        cell.fill = fill(bg);
        cell.font = { name: "Aptos", size: 8.5, bold, color: { argb: color } };
        cell.alignment = {
          horizontal: c === 2 ? "left" : "center",
          vertical: c <= 2 ? "top" : "middle",
          wrapText: true,
          indent: c === 2 ? 1 : 0,
        };
        // Bordas suaves: só divisão inferior + verticais entre grupos
        cell.border = {
          bottom: hair,
          left: c === 7 || c === 10 || c === 13
            ? { style: "hair", color: { argb: COLOR_DOURADO } }
            : undefined,
        };
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

  for (let c = 1; c <= 13; c++) {
    const cell = ws.getRow(totalRow).getCell(c);
    cell.fill = fill(COLOR_GRAFITE);
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: c <= 5 ? COLOR_WHITE : COLOR_DOURADO } };
    if (c > 5) cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: thin,
      bottom: thin,
    };
  }
  ws.getRow(totalRow).height = 26;

  // ============ Assinaturas (rodapé) ============
  const empresa = data.company?.razao_social ?? data.company?.nome ?? "SOLV Construtora";
  const rtNome = data.responsavelTecnico?.nome ?? "";
  const rtCargo = data.responsavelTecnico?.cargo ?? "Responsável Técnico";
  const rtReg = data.responsavelTecnico?.registro ?? "";
  const rtArt = data.responsavelTecnico?.art_rrt ?? "";
  const fiscalNome = data.fiscal?.nome ?? "";
  const fiscalCargo = data.fiscal?.cargo ?? "Fiscal da Obra";
  const fiscalReg = data.fiscal?.registro ?? "";
  const fiscalOrgao = data.obra?.cliente ?? data.contrato?.orgao_contratante ?? "";

  const spacer1 = totalRow + 1;
  ws.getRow(spacer1).height = 10;
  const signSpace = totalRow + 2;
  ws.getRow(signSpace).height = 55; // espaço em branco para assinatura (digital/à punho)
  const signLine = totalRow + 3;
  const nameRow = totalRow + 4;
  const cargoRow = totalRow + 5;
  const regRow = totalRow + 6;

  const drawSignBlock = (colStart: string, colEnd: string, header: string, nome: string, cargo: string, registro: string) => {
    // linha da assinatura
    ws.mergeCells(`${colStart}${signLine}:${colEnd}${signLine}`);
    const line = ws.getCell(`${colStart}${signLine}`);
    line.value = "";
    line.border = { top: thin };

    ws.mergeCells(`${colStart}${nameRow}:${colEnd}${nameRow}`);
    const nc = ws.getCell(`${colStart}${nameRow}`);
    nc.value = header;
    nc.font = { name: "Aptos", size: 8.5, bold: true, color: { argb: COLOR_LABEL } };
    nc.alignment = { horizontal: "center", vertical: "middle" };

    ws.mergeCells(`${colStart}${cargoRow}:${colEnd}${cargoRow}`);
    const cc = ws.getCell(`${colStart}${cargoRow}`);
    cc.value = nome || "—";
    cc.font = { name: "Aptos", size: 10, bold: true, color: { argb: COLOR_TEXT } };
    cc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

    ws.mergeCells(`${colStart}${regRow}:${colEnd}${regRow}`);
    const rc = ws.getCell(`${colStart}${regRow}`);
    const parts = [cargo, registro].filter(Boolean).join(" • ");
    rc.value = parts;
    rc.font = { name: "Aptos", size: 9, color: { argb: COLOR_MUTED } };
    rc.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  };

  drawSignBlock(
    "A", "F",
    empresa.toUpperCase(),
    rtNome,
    rtCargo,
    [rtReg, rtArt && `ART/RRT ${rtArt}`].filter(Boolean).join(" • "),
  );
  drawSignBlock(
    "H", "M",
    (fiscalOrgao || "Contratante").toUpperCase(),
    fiscalNome,
    fiscalCargo,
    fiscalReg,
  );

  ws.getRow(nameRow).height = 16;
  ws.getRow(cargoRow).height = 18;
  ws.getRow(regRow).height = 16;

  ws.pageSetup.printTitlesRow = "10:11";

  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
