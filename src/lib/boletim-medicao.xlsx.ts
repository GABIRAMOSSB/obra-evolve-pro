/**
 * Boletim de Medição — XLSX institucional SOLV.
 * Usa o template oficial (BM-01 CRAS PASSO Modernizado) como base, para que
 * cada boletim gerado saia com o mesmo layout, paleta, fontes e estilos.
 * Apenas os dados dinâmicos (cabeçalho + itens) são reescritos.
 */
import ExcelJS from "exceljs";
import { normalizeUnidade, sanitizeDescricao } from "./boletim-medicao.calc";
import templateUrl from "@/assets/boletim-template.xlsx?url";

const BRL = 'R$ #,##0.00';
const PCT = '0.00%';

// Estilos exatos capturados do template oficial
const STYLE_ETAPA = {
  fill: "FF141922", font: { name: "Aptos", size: 10, bold: true, color: "FFFFFFFF" },
};
const STYLE_SUBGRUPO = {
  fill: "FFF6EEDC", font: { name: "Aptos", size: 9, bold: true, color: "FF202833" },
};
const STYLE_ITEM_BG = "FFFFFFFF";
const STYLE_ITEM_FIN_BG = "FFEEF3F8";  // colunas J,K,L
const STYLE_ITEM_PERIODO_BG = "FFF6EEDC"; // coluna H editável
const STYLE_ITEM_FONT = { name: "Aptos", size: 8, bold: false, color: "FF202833" };
const STYLE_ITEM_FONT_MUTED = { name: "Aptos", size: 8, bold: false, color: "FF2E3745" };
const STYLE_ITEM_FONT_PERIODO = { name: "Aptos", size: 8, bold: true, color: "FF2E3745" };

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

const fill = (c: string): ExcelJS.FillPattern => ({ type: "pattern", pattern: "solid", fgColor: { argb: c } });

function fmtDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

function segmentCount(codigo: string): number {
  return codigo.split(".").filter((s) => s.trim().length > 0).length;
}

/** Estima altura da linha para o texto de descrição envolvido. */
function estimateHeight(descricao: string, colWidth = 53, fontSize = 8): number {
  const perLine = Math.max(6, Math.floor(colWidth * 1.6));
  const parts = descricao.split(/\r?\n/);
  let total = 0;
  for (const p of parts) total += Math.max(1, Math.ceil(p.length / perLine));
  const lineHeight = fontSize <= 8 ? 12 : 14;
  return Math.max(22, total * lineHeight + 8);
}

export async function generateBoletimMedicaoXLSX(data: XLSXInput): Promise<Blob> {
  // Carrega o template oficial
  const res = await fetch(templateUrl);
  const buf = await res.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const bmLabel = data.medicao.numero_bm ?? `BM-${String(data.medicao.numero).padStart(2, "0")}`;
  const nomeObra = data.obra?.nome ?? "—";
  const endereco = [data.obra?.endereco, data.obra?.cidade, data.obra?.uf].filter(Boolean).join(", ") || "—";
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

  // ========== CAPA ==========
  const cap = wb.getWorksheet("Capa");
  if (cap) {
    cap.getCell("A1").value = `${bmLabel}  •  ${dataMedBR}`;
    cap.getCell("D5").value = `${nomeObra}  •  ${[data.obra?.cidade, data.obra?.uf].filter(Boolean).join("/") || "—"}`;
    cap.getCell("D6").value = `${bmLabel}  •  ${dataMedBR}`;
    cap.getCell("D7").value = executora;
    cap.getCell("D15").value = nomeObra;
    cap.getCell("D16").value = endereco;
    cap.getCell("D17").value = contratante;
    cap.getCell("D18").value = executora;
    cap.getCell("D19").value = cnpjExecutora;
    cap.getCell("D20").value = data.contrato?.numero ?? "—";
    cap.getCell("D21").value = dataMedBR;
    cap.getCell("D22").value = data.responsavelTecnico?.nome ?? "—";
    cap.getCell("D23").value = data.fiscal
      ? `${data.fiscal.nome}${data.fiscal.registro ? " – " + data.fiscal.registro : ""}`
      : "—";
  }

  // ========== BOLETIM ==========
  const ws = wb.getWorksheet("Boletim");
  if (!ws) throw new Error("Template do Boletim inválido.");

  // Header cells dinâmicos
  ws.getCell("A1").value = `${bmLabel}  •  ${dataMedBR}`;
  ws.getCell("F2").value = `◈ ${bmLabel}`;
  ws.getCell("K2").value = `EMISSÃO · ${dataMedBR}`;
  ws.getCell("A5").value = nomeObra;
  ws.getCell("F5").value = contratante;
  ws.getCell("I5").value = cnpjContratante;
  ws.getCell("K5").value = endereco;
  ws.getCell("A7").value = executora;
  ws.getCell("F7").value = cnpjExecutora;
  ws.getCell("H7").value = data.contrato?.numero ? `nº ${data.contrato.numero}` : "—";
  ws.getCell("K7").value = processo;
  ws.getCell("A9").value = bmLabel;
  ws.getCell("C9").value = dataMedBR;
  ws.getCell("E9").value = periodoStr;
  ws.getCell("H9").value = inicioObra;
  ws.getCell("J9").value = prazoStr;
  ws.getCell("L9").value = licitacao;
  ws.getCell("A11").value = data.contrato?.objeto ?? "—";
  ws.getCell("G11").value = rtLinha;
  ws.getCell("J11").value = fiscalLinha;

  // Reescreve os itens: remove as 232 linhas do template (14..245) e insere N novas
  const templateItemCount = 232;
  ws.spliceRows(14, templateItemCount);
  // Após splicing, a linha "TOTAL GERAL" (antes 246) fica em 14. Antes de rewrite, insere N linhas.
  const N = data.itens.length;
  if (N > 0) {
    const empties: unknown[][] = [];
    for (let i = 0; i < N; i++) empties.push([]);
    ws.spliceRows(14, 0, ...(empties as never[]));
  }

  // Preenche cada linha
  for (let i = 0; i < N; i++) {
    const item = data.itens[i];
    const r = 14 + i;
    const row = ws.getRow(r);
    const codigo = item.item_codigo;
    const segs = segmentCount(codigo);
    const isEtapa = item.is_etapa;
    const isNivel1 = isEtapa && segs <= 1;
    const isSubgrupo = isEtapa && !isNivel1;

    row.getCell(1).value = codigo;
    row.getCell(2).value = sanitizeDescricao(item.descricao);

    if (isNivel1) {
      row.height = 23;
      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(STYLE_ETAPA.fill);
        cell.font = { name: STYLE_ETAPA.font.name, size: STYLE_ETAPA.font.size, bold: true, color: { argb: STYLE_ETAPA.font.color } };
        cell.alignment = { horizontal: c === 2 ? undefined : "center", vertical: "middle", wrapText: true };
      }
    } else if (isSubgrupo) {
      row.height = 23;
      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        cell.fill = fill(STYLE_SUBGRUPO.fill);
        cell.font = { name: STYLE_SUBGRUPO.font.name, size: STYLE_SUBGRUPO.font.size, bold: true, color: { argb: STYLE_SUBGRUPO.font.color } };
        cell.alignment = { horizontal: c === 2 ? undefined : "center", vertical: "middle", wrapText: true };
      }
    } else {
      // Item normal
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

      // Fills e fontes por coluna (matching template row 16)
      for (let c = 1; c <= 13; c++) {
        const cell = row.getCell(c);
        let bg = STYLE_ITEM_BG;
        let f = STYLE_ITEM_FONT;
        if (c === 8) { bg = STYLE_ITEM_PERIODO_BG; f = STYLE_ITEM_FONT_PERIODO; }
        else if (c === 7 || c === 9) { f = STYLE_ITEM_FONT_MUTED; }
        else if (c === 10 || c === 11 || c === 12) { bg = STYLE_ITEM_FIN_BG; }
        cell.fill = fill(bg);
        cell.font = { name: f.name, size: f.size, bold: f.bold, color: { argb: f.color } };
        cell.alignment = {
          horizontal: c === 2 ? undefined : "center",
          vertical: c <= 2 ? "top" : "middle",
          wrapText: true,
        };
      }
    }
  }

  // Recalcula linhas de TOTAL e RESUMO (que foram deslocadas)
  const totalRow = 14 + N; // linha do TOTAL GERAL após splicing
  if (N > 0) {
    // TOTAL GERAL
    ws.getCell(`F${totalRow}`).value = { formula: `SUM(F14:F${totalRow - 1})` };
    ws.getCell(`F${totalRow}`).numFmt = BRL;
    ws.getCell(`K${totalRow}`).value = { formula: `SUM(K14:K${totalRow - 1})` };
    ws.getCell(`K${totalRow}`).numFmt = BRL;
    ws.getCell(`L${totalRow}`).value = { formula: `SUM(L14:L${totalRow - 1})` };
    ws.getCell(`L${totalRow}`).numFmt = BRL;
    ws.getCell(`M${totalRow}`).value = { formula: `IF(F${totalRow}=0,0,L${totalRow}/F${totalRow})` };
    ws.getCell(`M${totalRow}`).numFmt = PCT;

    // RESUMO EXECUTIVO — deslocado em (N - 232) linhas em relação ao template
    const shift = N - templateItemCount;
    const resumoRow = 251 + shift;
    ws.getCell(`A${resumoRow}`).value = { formula: `F${totalRow}` };
    ws.getCell(`A${resumoRow}`).numFmt = BRL;
    ws.getCell(`D${resumoRow}`).value = { formula: `K${totalRow}` };
    ws.getCell(`D${resumoRow}`).numFmt = BRL;
    ws.getCell(`F${resumoRow}`).value = { formula: `L${totalRow}` };
    ws.getCell(`F${resumoRow}`).numFmt = BRL;
    ws.getCell(`I${resumoRow}`).value = { formula: `IF(F${totalRow}=0,0,L${totalRow}/F${totalRow})` };
    ws.getCell(`I${resumoRow}`).numFmt = PCT;
    ws.getCell(`K${resumoRow}`).value = { formula: `F${totalRow}-L${totalRow}` };
    ws.getCell(`K${resumoRow}`).numFmt = BRL;
  }

  const out = await wb.xlsx.writeBuffer();
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
