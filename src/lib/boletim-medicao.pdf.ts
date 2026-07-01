/**
 * Boletim de Medição — PDF institucional SOLV (A4 paisagem).
 * Sem linhas de grade verticais; separadores horizontais discretos.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  fmtMoneyBR,
  fmtNumberBR,
  fmtPctBR,
  normalizeUnidade,
  sanitizeDescricao,
  computeItem,
  computeTotais,
} from "./boletim-medicao.calc";

// SOLV tokens (RGB)
const GRAPHITE: [number, number, number] = [54, 60, 73];
const GRAPHITE_DARK: [number, number, number] = [37, 42, 51];
const GOLD: [number, number, number] = [200, 166, 106];
const GOLD_SOFT: [number, number, number] = [245, 238, 221];
const SILVER: [number, number, number] = [238, 240, 242];
const ZEBRA: [number, number, number] = [250, 251, 252];
const TEXT: [number, number, number] = [32, 36, 43];
const MUTED: [number, number, number] = [105, 113, 125];

interface BoletimData {
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
    processo_administrativo: string | null;
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
    cnpj_cliente: string | null;
    data_inicio: string | null;
  } | null;
  company: {
    razao_social?: string | null;
    nome?: string | null;
    cnpj?: string | null;
  } | null;
  responsavelTecnico?: { nome: string; registro: string | null; cargo: string | null } | null;
  fiscal?: { nome: string; registro: string | null; cargo: string | null } | null;
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


function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function generateBoletimMedicaoPDF(data: BoletimData): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 11;

  const totais = computeTotais(data.itens);

  // ===== CABEÇALHO =====
  doc.setFillColor(...GRAPHITE_DARK);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 22, pageW, 0.8, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SOLV CONSTRUTORA", margin, 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 166, 106);
  doc.text("BOLETIM DE MEDIÇÃO", margin, 15);

  // Bloco direita: BM + data
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const bmLabel = data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`;
  doc.text(bmLabel, pageW - margin, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`Data: ${fmtDate(data.medicao.data_medicao)}`, pageW - margin, 15, { align: "right" });
  doc.text(
    `Período: ${fmtDate(data.medicao.periodo_inicio)} a ${fmtDate(data.medicao.periodo_fim)}`,
    pageW - margin,
    19,
    { align: "right" },
  );

  // ===== DADOS CONTRATUAIS (sem bordas) =====
  let y = 28;
  const kv = (label: string, value: string | null | undefined, x: number, colW: number) => {
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(label.toUpperCase(), x, y);
    doc.setTextColor(...TEXT);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const val = value && String(value).trim() ? String(value) : "—";
    doc.text(doc.splitTextToSize(val, colW - 2), x, y + 3.2);
  };

  const col4 = (pageW - margin * 2) / 4;
  const col6 = (pageW - margin * 2) / 6;
  const nomeObra = data.obra?.nome ?? "—";
  const endereco = [data.obra?.endereco, data.obra?.cidade, data.obra?.uf].filter(Boolean).join(", ");
  const executora = data.company?.razao_social ?? data.company?.nome ?? "SOLV Construtora";
  const contratante = data.obra?.cliente ?? data.contrato?.orgao_contratante ?? "—";
  const prazoStr = data.contrato?.prazo_dias ? `${data.contrato.prazo_dias} dias` : "—";
  const inicioObra = fmtDate(data.contrato?.data_inicio ?? data.obra?.data_inicio ?? null);
  const rt = data.responsavelTecnico;
  const fs = data.fiscal;
  const rtLine = rt ? `${rt.nome}${rt.registro ? ` — ${rt.registro}` : ""}${rt.cargo ? ` (${rt.cargo})` : ""}` : "—";
  const fsLine = fs ? `${fs.nome}${fs.registro ? ` — ${fs.registro}` : ""}${fs.cargo ? ` (${fs.cargo})` : ""}` : "—";

  // Linha 1 (4 colunas)
  kv("Obra", nomeObra, margin, col4);
  kv("Cliente / Contratante", contratante, margin + col4, col4);
  kv("CNPJ Contratante", data.obra?.cnpj_cliente, margin + col4 * 2, col4);
  kv("Empresa Executora", executora, margin + col4 * 3, col4);
  y += 8;
  // Linha 2 (4 colunas)
  kv("CNPJ Executora", data.company?.cnpj, margin, col4);
  kv("Endereço da obra", endereco || "—", margin + col4, col4 * 2);
  kv("Contrato nº", data.contrato?.numero, margin + col4 * 3, col4);
  y += 8;
  // Linha 3 (6 colunas — dados temporais)
  kv("Processo administrativo", data.contrato?.processo_administrativo, margin, col6);
  kv("Licitação nº", data.contrato?.numero_licitacao, margin + col6, col6);
  kv("Início da obra", inicioObra, margin + col6 * 2, col6);
  kv("Prazo contratual", prazoStr, margin + col6 * 3, col6);
  kv("Data medição", fmtDate(data.medicao.data_medicao), margin + col6 * 4, col6);
  kv("Período", `${fmtDate(data.medicao.periodo_inicio)} a ${fmtDate(data.medicao.periodo_fim)}`, margin + col6 * 5, col6);
  y += 8;
  // Linha 4 — objeto + responsáveis
  kv("Objeto do contrato", data.contrato?.objeto ?? "—", margin, col4 * 2);
  kv("Responsável Técnico", rtLine, margin + col4 * 2, col4);
  kv("Fiscal da Obra", fsLine, margin + col4 * 3, col4);
  y += 10;


  // ===== KPIs =====
  const kpiW = (pageW - margin * 2 - 8) / 5;
  const kpis: Array<[string, string]> = [
    ["Valor total contrato", fmtMoneyBR(totais.valor_total_contrato)],
    ["Medição do período", fmtMoneyBR(totais.valor_medicao_atual)],
    ["Acumulado", fmtMoneyBR(totais.valor_acumulado)],
    ["% Executado", fmtPctBR(totais.percentual_executado, 2)],
    ["Saldo contratual", fmtMoneyBR(totais.saldo_contratual)],
  ];
  kpis.forEach(([label, val], i) => {
    const x = margin + i * (kpiW + 2);
    doc.setFillColor(...GOLD_SOFT);
    doc.roundedRect(x, y, kpiW, 12, 1.5, 1.5, "F");
    doc.setTextColor(...MUTED);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.text(label.toUpperCase(), x + 2, y + 4);
    doc.setTextColor(...GRAPHITE_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(val, x + 2, y + 9.5);
  });
  y += 15;

  // ===== TABELA DE SERVIÇOS =====
  const head = [
    [
      { content: "Item", rowSpan: 2 },
      { content: "Descrição", rowSpan: 2 },
      { content: "Un.", rowSpan: 2 },
      { content: "Qtd.", rowSpan: 2 },
      { content: "V. Unit.", rowSpan: 2 },
      { content: "Total", rowSpan: 2 },
      { content: "Executado Físico", colSpan: 3 },
      { content: "Executado Financeiro", colSpan: 3 },
      { content: "Executado %", rowSpan: 2 },
    ],
    [
      { content: "Anterior" },
      { content: "Período" },
      { content: "Acum." },
      { content: "Anterior" },
      { content: "Período" },
      { content: "Acum." },
    ],
  ];

  const body: (string | { content: string; styles?: Record<string, unknown> })[][] = [];
  for (const i of data.itens) {
    const c = computeItem(i);
    if (i.is_etapa) {
      body.push([
        { content: i.item_codigo, styles: { fontStyle: "bold", fillColor: SILVER } },
        { content: sanitizeDescricao(i.descricao), styles: { fontStyle: "bold", fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
        { content: "", styles: { fillColor: SILVER } },
      ]);
    } else {
      body.push([
        i.item_codigo,
        sanitizeDescricao(i.descricao),
        normalizeUnidade(i.unidade),
        fmtNumberBR(i.qtd_contratada, 2),
        fmtMoneyBR(i.valor_unitario),
        fmtMoneyBR(c.total_contratual),
        fmtNumberBR(i.qtd_acum_anterior, 2),
        fmtNumberBR(i.qtd_periodo, 2),
        fmtNumberBR(c.qtd_acum_atual, 2),
        fmtMoneyBR(i.valor_acum_anterior),
        fmtMoneyBR(c.valor_periodo),
        fmtMoneyBR(c.valor_acum_atual),
        fmtPctBR(c.pct_executado, 2),
      ]);
    }
  }

  // Linha TOTAL GERAL
  body.push([
    { content: "TOTAL GERAL", styles: { fontStyle: "bold", fillColor: GRAPHITE, textColor: [255, 255, 255] } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: fmtMoneyBR(totais.valor_total_contrato), styles: { fontStyle: "bold", fillColor: GRAPHITE, textColor: [255, 255, 255] } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: fmtMoneyBR(totais.valor_medicao_atual), styles: { fontStyle: "bold", fillColor: GRAPHITE, textColor: [255, 255, 255] } },
    { content: fmtMoneyBR(totais.valor_acumulado), styles: { fontStyle: "bold", fillColor: GRAPHITE, textColor: [255, 255, 255] } },
    { content: fmtPctBR(totais.percentual_executado, 2), styles: { fontStyle: "bold", fillColor: GRAPHITE, textColor: [255, 255, 255] } },
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin, top: 28, bottom: 22 },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 7,
      cellPadding: { top: 2, right: 1.6, bottom: 2, left: 1.6 },
      textColor: TEXT,
      lineWidth: 0,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: GRAPHITE_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
      halign: "center",
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 18, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 15, halign: "right" },
      4: { cellWidth: 18, halign: "right" },
      5: { cellWidth: 22, halign: "right" },
      6: { cellWidth: 16, halign: "right" },
      7: { cellWidth: 16, halign: "right" },
      8: { cellWidth: 16, halign: "right" },
      9: { cellWidth: 20, halign: "right" },
      10: { cellWidth: 20, halign: "right" },
      11: { cellWidth: 22, halign: "right" },
      12: { cellWidth: 15, halign: "right" },
    },
    rowPageBreak: "avoid",
    didDrawPage: (hook) => {
      // Header repetido
      if (hook.pageNumber > 1) {
        doc.setFillColor(...GRAPHITE_DARK);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setFillColor(...GOLD);
        doc.rect(0, 18, pageW, 0.6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("SOLV CONSTRUTORA — BOLETIM DE MEDIÇÃO", margin, 8);
        doc.setFontSize(8);
        doc.text(`${bmLabel} · ${nomeObra}`, margin, 13);
      }
      // Footer
      const pageStr = `SOLV Construtora e Soluções Ltda.  |  ${nomeObra}  |  ${bmLabel}  |  Página ${hook.pageNumber}`;
      doc.setDrawColor(...SILVER);
      doc.setLineWidth(0.1);
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.setTextColor(...MUTED);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(pageStr, margin, pageH - 8);
      doc.text(new Date().toLocaleString("pt-BR"), pageW - margin, pageH - 8, { align: "right" });
    },
  });

  // ===== DECLARAÇÃO + ASSINATURAS =====
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  let sy = finalY;
  if (sy > pageH - 55) {
    doc.addPage();
    sy = 32;
  }

  doc.setTextColor(...TEXT);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  const decl = "Os valores desta medição estão de acordo com o cronograma físico-financeiro e com as condições contratuais estabelecidas.";
  doc.text(doc.splitTextToSize(decl, pageW - margin * 2), margin, sy);
  sy += 10;

  // Blocos de assinatura
  const sigW = (pageW - margin * 2 - 12) / 2;
  const drawSig = (title: string, nome: string, registro: string | null, cargo: string | null, x: number) => {
    doc.setDrawColor(...GRAPHITE);
    doc.setLineWidth(0.2);
    doc.line(x, sy + 18, x + sigW, sy + 18);
    doc.setTextColor(...GRAPHITE_DARK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(nome || "—", x + sigW / 2, sy + 22, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    if (registro) doc.text(registro, x + sigW / 2, sy + 26, { align: "center" });
    if (cargo) doc.text(cargo, x + sigW / 2, sy + 30, { align: "center" });
    doc.setTextColor(...GOLD);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(title.toUpperCase(), x + sigW / 2, sy + 6, { align: "center" });
  };

  drawSig(
    "Responsável Técnico",
    data.responsavelTecnico?.nome ?? "—",
    data.responsavelTecnico?.registro ?? null,
    data.responsavelTecnico?.cargo ?? null,
    margin,
  );
  drawSig(
    "Fiscal da Obra",
    data.fiscal?.nome ?? "—",
    data.fiscal?.registro ?? null,
    data.fiscal?.cargo ?? null,
    margin + sigW + 12,
  );

  return doc;
}
