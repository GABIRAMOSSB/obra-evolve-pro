/**
 * Relatório gerencial em PDF — gerado client-side com jsPDF/autoTable
 * a partir do payload da Análise Gerencial.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { AnaliseGerencialPayload } from "./analise-gerencial.functions";

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(v: number | null | undefined, dec = 2) {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v.toFixed(dec)}%`;
}
function fmtData(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

const RISCO_COR: Record<string, [number, number, number]> = {
  baixo: [16, 185, 129],
  moderado: [245, 158, 11],
  alto: [249, 115, 22],
  critico: [239, 68, 68],
};

export async function gerarRelatorioGerencialPdf(a: AnaliseGerencialPayload): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", format: "a4", unit: "mm" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 18;

  // --- Capa ---
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Gerencial da Obra", margin, y);
  y += 8;
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(a.obra.nome, margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(110);
  doc.text(`Gerado em ${new Date(a.gerado_em).toLocaleString("pt-BR")}`, margin, y);
  doc.setTextColor(0);
  y += 10;

  // --- Faixa de risco ---
  const cor = RISCO_COR[a.risco.nivel] || [100, 100, 100];
  doc.setFillColor(cor[0], cor[1], cor[2]);
  doc.rect(margin, y, pageW - margin * 2, 14, "F");
  doc.setTextColor(255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Risco ${a.risco.nivel.toUpperCase()} — faixa estimada ${a.risco.faixa_min}% a ${a.risco.faixa_max}%`,
    margin + 3,
    y + 9,
  );
  doc.setTextColor(0);
  y += 20;

  // --- Leitura executiva ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Leitura executiva", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const linhas = doc.splitTextToSize(a.diagnostico, pageW - margin * 2);
  doc.text(linhas, margin, y);
  y += linhas.length * 4.5 + 5;

  // --- Indicadores ---
  const ind = a.indicadores;
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Avanço da obra", fmtPct(ind.avanco)],
      ["Prazo consumido", fmtPct(ind.prazo_consumido)],
      ["Desvio", ind.desvio !== null ? `${ind.desvio >= 0 ? "+" : ""}${ind.desvio.toFixed(2)} p.p.` : "—"],
      ["Dias decorridos / restantes", `${ind.dias_decorridos ?? "—"} / ${ind.dias_restantes ?? "—"}`],
      ["Ritmo atual", ind.ritmo_atual != null ? `${ind.ritmo_atual.toFixed(3)} %/dia` : "—"],
      ["Ritmo necessário", ind.ritmo_necessario != null ? `${ind.ritmo_necessario.toFixed(3)} %/dia` : "—"],
      ["Fator de aceleração", ind.fator_aceleracao != null ? `${ind.fator_aceleracao.toFixed(2)}×` : "—"],
      ["Valor total / executado", `${fmtBRL(ind.valor_total)} / ${fmtBRL(ind.valor_executado)}`],
      ["Saldo a executar", fmtBRL(ind.saldo_executar)],
      ["Meta semanal sugerida", fmtBRL(ind.meta_semanal)],
      ["Data projetada de conclusão", fmtData(ind.data_projetada)],
      ["Confiabilidade do avanço", a.confiabilidade],
    ],
    theme: "striped",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error – autotable adiciona lastAutoTable
  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // --- Atividades críticas ---
  if (a.criticas.length > 0) {
    if (y > 240) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Atividades críticas", margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Atividade", "Etapa", "Valor", "%", "Prazo", "Motivo", "Ação"]],
      body: a.criticas.slice(0, 25).map((c) => [
        c.descricao,
        c.etapa || "—",
        fmtBRL(c.valor),
        `${c.percentual_concluido.toFixed(0)}%`,
        c.data_prevista_fim ? fmtData(c.data_prevista_fim) : "—",
        c.motivo,
        c.acao_recomendada,
      ]),
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 38 }, 5: { cellWidth: 40 }, 6: { cellWidth: 34 } },
    });
    // @ts-expect-error
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // --- Ações recomendadas ---
  if (a.acoes.length > 0) {
    if (y > 240) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Ações recomendadas", margin, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Ação", "Atividade", "Prazo", "Prioridade", "Impacto"]],
      body: a.acoes.map((x) => [x.acao, x.atividade || "—", x.prazo_recomendado, x.prioridade, x.impacto]),
      theme: "grid",
      styles: { fontSize: 9 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: margin, right: margin },
    });
    // @ts-expect-error
    y = (doc.lastAutoTable?.finalY ?? y) + 8;
  }

  // --- Plano ---
  if (a.plano) {
    if (y > 230) { doc.addPage(); y = 18; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Plano de recuperação", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Meta 7 dias: ${a.plano.meta_7_dias.toFixed(2)}%`, margin, y); y += 5;
    doc.text(`Meta 15 dias: ${a.plano.meta_15_dias.toFixed(2)}%`, margin, y); y += 5;
    doc.text(`Meta 30 dias: ${a.plano.meta_30_dias.toFixed(2)}%`, margin, y); y += 6;
    if (a.plano.atividades_iniciar_imediato.length) {
      doc.setFont("helvetica", "bold"); doc.text("Iniciar imediatamente:", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      for (const it of a.plano.atividades_iniciar_imediato) {
        const ls = doc.splitTextToSize(`• ${it}`, pageW - margin * 2);
        doc.text(ls, margin, y); y += ls.length * 4;
      }
      y += 2;
    }
    if (a.plano.impedimentos_resolver.length) {
      doc.setFont("helvetica", "bold"); doc.text("Impedimentos a resolver:", margin, y); y += 4;
      doc.setFont("helvetica", "normal");
      for (const it of a.plano.impedimentos_resolver) {
        const ls = doc.splitTextToSize(`• ${it}`, pageW - margin * 2);
        doc.text(ls, margin, y); y += ls.length * 4;
      }
    }
  }

  // --- Avisos (no rodapé) ---
  if (a.avisos.length) {
    doc.setFontSize(8);
    doc.setTextColor(110);
    const aviso = "Observações: " + a.avisos.join(" | ");
    const ls = doc.splitTextToSize(aviso, pageW - margin * 2);
    doc.text(ls, margin, 285);
    doc.setTextColor(0);
  }

  const slug = a.obra.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50);
  doc.save(`relatorio-gerencial-${slug}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
