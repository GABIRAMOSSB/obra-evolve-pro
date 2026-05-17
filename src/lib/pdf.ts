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
      const imgs = e.fotos.filter((f) => f.tipo !== "video");
      const cols = 2;
      const gap = 4;
      const cellW = (pageW - 28 - gap) / cols;
      const cellH = cellW * 0.75;
      let col = 0;
      let rowX = 14;
      for (const f of imgs) {
        const data = await loadImageAsDataUrl(f.url);
        if (!data) continue;
        if (col === 0) {
          ensureSpace(cellH + 12);
          rowX = 14;
        }
        try {
          doc.addImage(data.dataUrl, "JPEG", rowX, y, cellW, cellH, undefined, "FAST");
        } catch {
          // skip if invalid
        }
        const caption = `${f.hora || ""}${f.legenda ? " — " + f.legenda : ""}${f.tipo && f.tipo !== "geral" ? ` [${f.tipo}]` : ""}`;
        doc.setFontSize(8);
        doc.text(doc.splitTextToSize(caption, cellW), rowX, y + cellH + 4);
        doc.setFontSize(10);
        col++;
        if (col >= cols) {
          col = 0;
          y += cellH + 12;
        } else {
          rowX += cellW + gap;
        }
      }
      if (col !== 0) y += cellH + 12;
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
