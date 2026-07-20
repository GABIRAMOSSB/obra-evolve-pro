/**
 * Planilha Orçamentária COMPLETA — PDF institucional SOLV.
 * Segue exatamente o mesmo layout do Boletim de Medição (A4 paisagem):
 * cabeçalho grafite + faixa dourada, dados contratuais em KV, KPIs,
 * tabela sem linhas de grade verticais, TOTAL GERAL, rodapé paginado
 * e blocos de assinatura.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BudgetRow, Evolution, ObraInfo } from "./types";
import { fmtBRL, fmtNum, activityMetrics } from "./calc";

// SOLV tokens (RGB) — idênticos ao Boletim de Medição
const GRAPHITE: [number, number, number] = [54, 60, 73];
const GRAPHITE_DARK: [number, number, number] = [37, 42, 51];
const GOLD: [number, number, number] = [200, 166, 106];
const GOLD_SOFT: [number, number, number] = [245, 238, 221];
const SILVER: [number, number, number] = [238, 240, 242];
const ZEBRA: [number, number, number] = [250, 251, 252];
const TEXT: [number, number, number] = [32, 36, 43];
const MUTED: [number, number, number] = [105, 113, 125];

interface Args {
  rows: BudgetRow[];
  evolutions?: Record<string, Evolution>;
  info: ObraInfo;
  projectName: string;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function exportOrcamentoFullPDF({ rows, evolutions, info, projectName }: Args) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 11;

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
  doc.setTextColor(...GOLD);
  doc.text("PLANILHA ORÇAMENTÁRIA COMPLETA", margin, 15);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(projectName, pageW - margin, 10, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(220, 220, 220);
  doc.text(`Emissão: ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, 15, { align: "right" });

  // ===== DADOS CONTRATUAIS =====
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
  const endereco = [info.endereco, info.municipio, info.estado].filter(Boolean).join(", ");
  const executora = info.empresaExecutora ?? "SOLV Construtora";
  const contratante = info.contratante ?? info.cliente ?? "—";
  const prazoStr = info.prazoContratualDias ? `${info.prazoContratualDias} dias` : "—";
  const rtLine = info.responsavelTecnico
    ? `${info.responsavelTecnico}${info.crea ? ` — ${info.crea}` : ""}${info.cargoResponsavel ? ` (${info.cargoResponsavel})` : ""}`
    : "—";
  const fsLine = info.fiscal
    ? `${info.fiscal}${info.creaFiscal ? ` — ${info.creaFiscal}` : ""}${info.cargoFiscal ? ` (${info.cargoFiscal})` : ""}`
    : "—";

  kv("Obra", projectName, margin, col4);
  kv("Cliente / Contratante", contratante, margin + col4, col4);
  kv("CNPJ Contratante", info.cnpjContratante, margin + col4 * 2, col4);
  kv("Empresa Executora", executora, margin + col4 * 3, col4);
  y += 8;
  kv("CNPJ Executora", info.cnpj, margin, col4);
  kv("Endereço da obra", endereco || "—", margin + col4, col4 * 2);
  kv("Contrato nº", info.numeroContrato, margin + col4 * 3, col4);
  y += 8;
  kv("Processo administrativo", info.processoAdministrativo, margin, col6);
  kv("Licitação nº", info.numeroLicitacao, margin + col6, col6);
  kv("Início da obra", fmtDate(info.dataInicioObra), margin + col6 * 2, col6);
  kv("Prazo contratual", prazoStr, margin + col6 * 3, col6);
  kv("ART / RRT", info.artRrt, margin + col6 * 4, col6);
  kv("Emissão", new Date().toLocaleDateString("pt-BR"), margin + col6 * 5, col6);
  y += 8;
  kv("Objeto do contrato", info.objetoContrato ?? "—", margin, col4 * 2);
  kv("Responsável Técnico", rtLine, margin + col4 * 2, col4);
  kv("Fiscal da Obra", fsLine, margin + col4 * 3, col4);
  y += 10;

  // ===== KPIs =====
  let totalContrato = 0;
  let totalExec = 0;
  let itensCount = 0;
  let etapasCount = 0;
  for (const r of rows) {
    const isGroup = !!r.isGroup || ((r.quantidade ?? 0) === 0 && (r.valorUnitBDI || r.valorUnit || 0) === 0);
    if (isGroup) { etapasCount++; continue; }
    itensCount++;
    const vuBDI = r.valorUnitBDI || r.valorUnit || 0;
    const qtd = Number(r.quantidade ?? 0);
    const totalItem = qtd * vuBDI;
    totalContrato += totalItem;
    if (evolutions) {
      const m = activityMetrics(r, evolutions[r.item]);
      totalExec += m.valorExec;
    }
  }
  const saldoContratual = totalContrato - totalExec;
  const pctExecTotal = totalContrato > 0 ? (totalExec / totalContrato) * 100 : 0;

  const kpiW = (pageW - margin * 2 - 8) / 5;
  const kpis: Array<[string, string]> = [
    ["Valor total do contrato", fmtBRL(totalContrato)],
    ["Total executado", fmtBRL(totalExec)],
    ["Saldo contratual", fmtBRL(saldoContratual)],
    ["% Executado", `${fmtNum(pctExecTotal)}%`],
    ["Itens / Etapas", `${itensCount} / ${etapasCount}`],
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

  // ===== TABELA =====
  // Descobre o maior número de BM fechada para tratar como "período atual"
  let maxBM = 0;
  if (evolutions) {
    for (const evo of Object.values(evolutions)) {
      for (const m of evo?.measurements ?? []) {
        if (m.closed && m.number > maxBM) maxBM = m.number;
      }
    }
  }

  const head = [[
    { content: "Item", rowSpan: 2 },
    { content: "Descrição", rowSpan: 2 },
    { content: "Un.", rowSpan: 2 },
    { content: "Qtd. Contr.", rowSpan: 2 },
    { content: "V. Unit. c/ BDI", rowSpan: 2 },
    { content: "Total Contratual", rowSpan: 2 },
    { content: "EXECUTADO FÍSICO", colSpan: 3, styles: { halign: "center" as const } },
    { content: "EXECUTADO FINANCEIRO (R$)", colSpan: 3, styles: { halign: "center" as const } },
    { content: "Saldo (R$)", rowSpan: 2 },
    { content: "% Exec.", rowSpan: 2 },
  ], [
    "Acum. Ant.", "Período", "Acum. Atual",
    "Acum. Ant.", "Período", "Acum. Atual",
  ]] as never;

  const body: (string | { content: string; styles?: Record<string, unknown> })[][] = [];
  let totQAnt = 0, totVAnt = 0, totQPer = 0, totVPer = 0, totVAcum = 0;
  for (const r of rows) {
    const isGroup = !!r.isGroup || ((r.quantidade ?? 0) === 0 && (r.valorUnitBDI || r.valorUnit || 0) === 0);
    if (isGroup) {
      body.push([
        { content: r.item ?? "", styles: { fontStyle: "bold", fillColor: SILVER } },
        { content: r.descricao ?? "", styles: { fontStyle: "bold", fillColor: SILVER } },
        ...Array(12).fill({ content: "", styles: { fillColor: SILVER } }),
      ]);
      continue;
    }
    const vuBDI = r.valorUnitBDI || r.valorUnit || 0;
    const qtd = Number(r.quantidade ?? 0);
    const totalItem = qtd * vuBDI;
    const evo = evolutions ? evolutions[r.item] : undefined;
    let qAnt = 0, qPer = 0;
    if (evo?.measurements) {
      for (const m of evo.measurements) {
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
    const saldo = totalItem - vAcum;
    const pct = totalItem > 0 ? (vAcum / totalItem) * 100 : 0;
    totQAnt += qAnt; totVAnt += vAnt;
    totQPer += qPer; totVPer += vPer;
    totVAcum += vAcum;
    body.push([
      r.item ?? "",
      r.descricao ?? "",
      r.und ?? "",
      fmtNum(qtd),
      fmtBRL(vuBDI),
      fmtBRL(totalItem),
      fmtNum(qAnt),
      fmtBRL(vAnt),
      fmtNum(qPer),
      fmtBRL(vPer),
      fmtNum(qAcum),
      fmtBRL(vAcum),
      fmtBRL(saldo),
      `${fmtNum(pct)}%`,
    ]);
  }

  // Linha TOTAL GERAL
  const totalStyle = { fontStyle: "bold", fillColor: GRAPHITE, textColor: [255, 255, 255] as [number, number, number] };
  body.push([
    { content: "TOTAL GERAL DO CONTRATO", styles: totalStyle },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: fmtBRL(totalContrato), styles: totalStyle },
    { content: fmtNum(totQAnt), styles: totalStyle },
    { content: fmtBRL(totVAnt), styles: totalStyle },
    { content: fmtNum(totQPer), styles: totalStyle },
    { content: fmtBRL(totVPer), styles: totalStyle },
    { content: "", styles: { fillColor: GRAPHITE } },
    { content: fmtBRL(totVAcum), styles: totalStyle },
    { content: fmtBRL(totalContrato - totVAcum), styles: totalStyle },
    { content: `${fmtNum(totalContrato > 0 ? (totVAcum / totalContrato) * 100 : 0)}%`, styles: totalStyle },
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    margin: { left: margin, right: margin, top: 28, bottom: 22 },
    theme: "plain",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: { top: 1.6, right: 1.2, bottom: 1.6, left: 1.2 },
      textColor: TEXT,
      lineWidth: 0,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: GRAPHITE_DARK,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
      lineWidth: 0,
    },
    alternateRowStyles: { fillColor: ZEBRA },
    columnStyles: {
      0: { cellWidth: 15, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 9, halign: "center" },
      3: { cellWidth: 14, halign: "right" },
      4: { cellWidth: 17, halign: "right" },
      5: { cellWidth: 19, halign: "right" },
      6: { cellWidth: 13, halign: "right" },
      7: { cellWidth: 18, halign: "right" },
      8: { cellWidth: 13, halign: "right" },
      9: { cellWidth: 18, halign: "right" },
      10: { cellWidth: 13, halign: "right" },
      11: { cellWidth: 18, halign: "right" },
      12: { cellWidth: 18, halign: "right" },
      13: { cellWidth: 12, halign: "right" },
    },
    rowPageBreak: "avoid",
    didDrawPage: (hook) => {
      if (hook.pageNumber > 1) {
        doc.setFillColor(...GRAPHITE_DARK);
        doc.rect(0, 0, pageW, 18, "F");
        doc.setFillColor(...GOLD);
        doc.rect(0, 18, pageW, 0.6, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("SOLV CONSTRUTORA — PLANILHA ORÇAMENTÁRIA COMPLETA", margin, 8);
        doc.setFontSize(8);
        doc.text(projectName, margin, 13);
      }
      const pageStr = `SOLV Construtora e Soluções Ltda.  |  ${projectName}  |  Planilha Orçamentária  |  Página ${hook.pageNumber}`;
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
  const decl =
    "Esta planilha orçamentária reflete a totalidade dos serviços contratados, com quantitativos, valores unitários (com e sem BDI) e valor total do contrato.";
  doc.text(doc.splitTextToSize(decl, pageW - margin * 2), margin, sy);
  sy += 10;

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
    info.responsavelTecnico ?? "—",
    info.crea ?? null,
    info.cargoResponsavel ?? null,
    margin,
  );
  drawSig(
    "Fiscal da Obra",
    info.fiscal ?? "—",
    info.creaFiscal ?? null,
    info.cargoFiscal ?? null,
    margin + sigW + 12,
  );

  doc.save(
    `Orcamento-${projectName.replace(/[^a-z0-9-_]+/gi, "_")}-${Date.now()}.pdf`,
  );
}
