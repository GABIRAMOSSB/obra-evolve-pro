import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type { BudgetRow, DiaryEntry, Evolution } from "./types";
import { activityMetrics, fmtBRL, fmtNum, projectMetrics } from "./calc";

export function exportAcompanhamentoXlsx(
  rows: BudgetRow[],
  evolutions: Record<string, Evolution>,
  fileName = "acompanhamento.xlsx",
) {
  const data = rows.map((r) => {
    if (r.isGroup) {
      return {
        Item: r.item,
        Código: r.codigo,
        Banco: r.banco,
        Descrição: r.descricao,
        Und: "",
        "Quant. Total": "",
        "Valor Unit. c/ BDI": "",
        "Valor Total": "",
        "Peso %": r.peso || "",
        "Quant. Executada": "",
        "% Executado": "",
        "Valor Executado": "",
        Status: "ETAPA",
        "Data Execução": "",
        Observações: "",
      };
    }
    const m = activityMetrics(r, evolutions[r.item]);
    const evo = evolutions[r.item];
    return {
      Item: r.item,
      Código: r.codigo,
      Banco: r.banco,
      Descrição: r.descricao,
      Und: r.und,
      "Quant. Total": r.quantidade,
      "Valor Unit. c/ BDI": r.valorUnitBDI || r.valorUnit,
      "Valor Total": r.total,
      "Peso %": r.peso,
      "Quant. Executada": m.quantExec,
      "% Executado": Number(m.percent.toFixed(2)),
      "Valor Executado": Number(m.valorExec.toFixed(2)),
      Status: m.status,
      "Data Execução": evo?.dataExec ?? "",
      Observações: evo?.observacoes ?? "",
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Acompanhamento");
  XLSX.writeFile(wb, fileName);
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

export function exportDiarioPdf(entries: DiaryEntry[], titulo = "Diário de Obra") {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(titulo, 14, 15);
  let y = 25;
  doc.setFontSize(10);
  for (const e of entries) {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.text(`${e.data} — ${e.etapa}`, 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const meta = `Clima: ${e.clima || "-"}  |  Equipe: ${e.equipe || "-"}  |  Equipamentos: ${e.equipamentos || "-"}`;
    doc.text(doc.splitTextToSize(meta, 180), 14, y);
    y += 10;
    doc.text(doc.splitTextToSize(e.texto, 180), 14, y);
    y += doc.splitTextToSize(e.texto, 180).length * 5 + 4;
    if (e.observacoes) {
      doc.setFont("helvetica", "italic");
      doc.text(doc.splitTextToSize(`Obs: ${e.observacoes}`, 180), 14, y);
      y += doc.splitTextToSize(e.observacoes, 180).length * 5 + 4;
      doc.setFont("helvetica", "normal");
    }
    y += 4;
    doc.setDrawColor(200);
    doc.line(14, y, 196, y);
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
  const pctStr = pct !== null ? ` (${fmtNum(pct)}% do total previsto)` : "";
  return `Na presente data, foram executados serviços referentes à etapa ${p.etapa}, compreendendo ${p.descricao}, com execução de ${fmtNum(p.quantExec)} ${p.unidade}${pctStr}, correspondente ao avanço físico da atividade. Os serviços ocorreram conforme planejamento da obra, mantendo-se o acompanhamento físico-financeiro do contrato.`;
}
