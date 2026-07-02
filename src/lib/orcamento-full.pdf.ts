/**
 * PDF institucional SOLV — Planilha Orçamentária COMPLETA da obra.
 * Layout paisagem A4, cabeçalho navy + dourado, tabela com grupos destacados,
 * totalizador ao final. Sem filtro por medição.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BudgetRow, ObraInfo } from "./types";
import { fmtBRL, fmtNum } from "./calc";
import { REPORT_RGB } from "./report-theme";

interface Args {
  rows: BudgetRow[];
  info: ObraInfo;
  projectName: string;
}

export function exportOrcamentoFullPDF({ rows, info, projectName }: Args) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const NAVY = REPORT_RGB.primaryDark;
  const GOLD = REPORT_RGB.primary;
  const CREAM = REPORT_RGB.cardBg;
  const LABEL = REPORT_RGB.labelMuted;
  const TEXT = REPORT_RGB.textOnLight;
  const SUBTITLE = REPORT_RGB.subtitleOnDark;
  const BORDER = REPORT_RGB.border;
  const GROUP_BG = REPORT_RGB.groupBg;
  const FOOTER = REPORT_RGB.footerText;

  // ---- Header band ----
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 22, pageW, 1.2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SOLV CONSTRUTORA E SOLUÇÕES", 12, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(SUBTITLE[0], SUBTITLE[1], SUBTITLE[2]);
  doc.text("Planilha Orçamentária Completa", 12, 17);

  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text(
    `Emissão: ${new Date().toLocaleDateString("pt-BR")}`,
    pageW - 12,
    17,
    { align: "right" },
  );

  // ---- Metadata card ----
  const cardY = 28;
  const cardH = 18;
  doc.setFillColor(CREAM[0], CREAM[1], CREAM[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(10, cardY, pageW - 20, cardH, 1.5, 1.5, "FD");

  const meta: Array<[string, string]> = [
    ["OBRA", projectName],
    ["CONTRATANTE", info.contratante ?? "—"],
    ["CONTRATO", info.numeroContrato ?? "—"],
    ["LOCAL", info.local ?? "—"],
  ];
  const colW = (pageW - 20) / meta.length;
  meta.forEach(([label, val], i) => {
    const x = 10 + i * colW + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(LABEL[0], LABEL[1], LABEL[2]);
    doc.text(label, x, cardY + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(TEXT[0], TEXT[1], TEXT[2]);
    const truncated = doc.splitTextToSize(String(val || "—"), colW - 8)[0];
    doc.text(truncated, x, cardY + 13);
  });

  // ---- Table ----
  let totalGeral = 0;
  const body = rows.map((r) => {
    const isGroup =
      !!r.isGroup ||
      ((r.quantidade ?? 0) === 0 && (r.valorUnitBDI || r.valorUnit || 0) === 0);
    const vu = r.valorUnit || 0;
    const vuBDI = r.valorUnitBDI || vu;
    const qtd = Number(r.quantidade ?? 0);
    const total = qtd * vuBDI;
    if (!isGroup) totalGeral += total;
    return {
      isGroup,
      row: [
        r.item ?? "",
        r.descricao ?? "",
        r.und ?? "",
        isGroup ? "" : fmtNum(qtd),
        isGroup ? "" : fmtBRL(vu),
        isGroup ? "" : fmtBRL(vuBDI),
        isGroup ? "" : fmtBRL(total),
        isGroup ? "" : r.peso != null ? `${fmtNum(r.peso)}%` : "",
      ],
    };
  });

  autoTable(doc, {
    startY: cardY + cardH + 4,
    head: [
      [
        "Item",
        "Descrição",
        "Und",
        "Quant.",
        "Valor Unit.",
        "Vlr. Unit. c/ BDI",
        "Total (R$)",
        "Peso %",
      ],
    ],
    body: body.map((b) => b.row),
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 1.6, right: 2, bottom: 1.6, left: 2 },
      lineColor: BORDER,
      lineWidth: 0.1,
      textColor: TEXT,
      font: "helvetica",
    },
    headStyles: {
      fillColor: NAVY,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      lineColor: NAVY,
      lineWidth: 0.1,
    },
    alternateRowStyles: { fillColor: [252, 250, 246] },
    columnStyles: {
      0: { cellWidth: 20, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 14, halign: "center" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 26, halign: "right" },
      5: { cellWidth: 30, halign: "right" },
      6: { cellWidth: 30, halign: "right", fontStyle: "bold" },
      7: { cellWidth: 18, halign: "right" },
    },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const meta = body[data.row.index];
      if (meta?.isGroup) {
        data.cell.styles.fillColor = GROUP_BG;
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.textColor = NAVY;
      }
    },
    margin: { left: 10, right: 10, top: 30, bottom: 15 },
    didDrawPage: () => {
      const p = doc.getNumberOfPages();
      // Rodapé
      doc.setFontSize(7.5);
      doc.setTextColor(FOOTER[0], FOOTER[1], FOOTER[2]);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${projectName}  •  Planilha Orçamentária Completa`,
        10,
        pageH - 6,
      );
      doc.text(`Página ${p}`, pageW - 10, pageH - 6, { align: "right" });
    },
  });

  // ---- Totalizador ----
  // @ts-expect-error lastAutoTable is added by jspdf-autotable
  const finalY = (doc as unknown).lastAutoTable?.finalY ?? cardY + cardH + 4;
  let ty = finalY + 4;
  if (ty > pageH - 20) {
    doc.addPage();
    ty = 20;
  }
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(10, ty, pageW - 20, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TOTAL GERAL DO CONTRATO", 14, ty + 7.6);
  doc.setFontSize(12);
  doc.text(fmtBRL(totalGeral), pageW - 14, ty + 7.8, { align: "right" });

  doc.save(
    `Orcamento-${projectName.replace(/[^a-z0-9-_]+/gi, "_")}-${Date.now()}.pdf`,
  );
}
