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

/**
 * Gera um PDF da medição (snapshot do período fechado) e retorna como Blob,
 * para upload na pasta "Medições da Obra".
 */
export function buildMeasurementPdfBlob(
  rows: BudgetRow[],
  evolutions: Record<string, Evolution>,
  measurementNumber: number,
  projectName: string,
  closedAt: Date = new Date(),
): Blob {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(`Medição ${measurementNumber} — ${projectName}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Fechada em ${closedAt.toLocaleString("pt-BR")}`, 14, 22);

  const m = projectMetrics(rows, evolutions);
  doc.text(
    [
      `Valor total: ${fmtBRL(m.total)}`,
      `Acumulado executado: ${fmtBRL(m.exec)}`,
      `Saldo restante: ${fmtBRL(m.restante)}`,
      `% Geral: ${fmtNum(m.percent)}%`,
    ].join("    "),
    14,
    28,
  );

  const body: (string | number)[][] = [];
  let totalPeriodo = 0;
  for (const r of rows) {
    if (r.isGroup) continue;
    const evo = evolutions[r.item];
    const med = evo?.measurements?.find((mm) => mm.number === measurementNumber);
    const qPeriodo = med?.quantExec ?? 0;
    if (qPeriodo <= 0) continue;
    const a = activityMetrics(r, evo);
    const valorPeriodo =
      r.quantidade > 0 ? (qPeriodo / r.quantidade) * (r.total || 0) : 0;
    totalPeriodo += valorPeriodo;
    body.push([
      r.item,
      r.descricao,
      r.und,
      fmtNum(r.quantidade),
      fmtNum(qPeriodo),
      fmtNum(a.quantExec),
      `${fmtNum(a.percent)}%`,
      fmtBRL(valorPeriodo),
      a.status,
    ]);
  }

  autoTable(doc, {
    head: [
      [
        "Item",
        "Descrição",
        "Und",
        "Quant. Total",
        "Qtd no Período",
        "Acumulado",
        "% Acum.",
        "Valor no Período",
        "Status",
      ],
    ],
    body: body.length
      ? body
      : [["—", "Sem lançamentos neste período", "", "", "", "", "", "", ""]],
    startY: 35,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [194, 102, 38] },
    columnStyles: { 1: { cellWidth: 90 } },
    foot: [
      [
        "",
        "",
        "",
        "",
        "",
        "",
        "Total no período:",
        fmtBRL(totalPeriodo),
        "",
      ],
    ],
    footStyles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: 20 },
  });

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
