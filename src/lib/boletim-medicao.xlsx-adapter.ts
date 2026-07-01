/**
 * Adapta o modelo legado (BudgetRow[] + Evolution map + ObraInfo)
 * para o novo gerador ExcelJS institucional SOLV.
 * Assim o botão "Excel" do ObraApp já dispara o novo layout com
 * fórmulas, sem gridlines, paleta grafite/dourado.
 */
import type { BudgetRow, Evolution, ObraInfo } from "./types";
import { generateBoletimMedicaoXLSX } from "./boletim-medicao.xlsx";

interface Args {
  rows: BudgetRow[];           // usado só como fallback
  evolutions: Record<string, Evolution>;
  info: ObraInfo;
  projectName: string;
  measurementNumber: number;
  allRows?: BudgetRow[];       // preferido — sempre o contrato completo
}

export async function exportBoletimMedicaoInstitucional(args: Args): Promise<void> {
  const bodyRows = args.allRows ?? args.rows;

  const itens = bodyRows.map((r, idx) => {
    const list = args.evolutions[r.item]?.measurements ?? [];
    // Acumulado anterior = tudo que já está fechado
    const qtdAcumAnterior = list.filter((m) => m.closed).reduce((s, m) => s + (m.quantExec || 0), 0);
    // Período = medição em aberto (não fechada) OU a da BM selecionada
    const emAberto = list.find((m) => !m.closed);
    const daBM = list.find((m) => m.number === args.measurementNumber);
    const qtdPeriodo = (emAberto?.quantExec ?? daBM?.quantExec ?? 0);

    const valorUnitario = r.valorUnitBDI || r.valorUnit || 0;
    const valorAcumAnterior = qtdAcumAnterior * valorUnitario;

    return {
      item_codigo: r.item,
      descricao: r.descricao,
      unidade: r.und ?? null,
      is_etapa: !!r.isGroup || (r.quantidade ?? 0) === 0 || valorUnitario === 0,
      qtd_contratada: Number(r.quantidade ?? 0),
      valor_unitario: Number(valorUnitario),
      qtd_acum_anterior: Number(qtdAcumAnterior),
      valor_acum_anterior: Number(valorAcumAnterior),
      qtd_periodo: Number(qtdPeriodo),
      _ordem: idx,
    };
  });

  const numeroBM = `BM-${String(args.measurementNumber).padStart(2, "0")}`;

  const blob = await generateBoletimMedicaoXLSX({
    medicao: {
      numero_bm: numeroBM,
      numero: args.measurementNumber,
      data_medicao: new Date().toISOString().slice(0, 10),
      periodo_inicio: "",
      periodo_fim: "",
      observacoes: null,
    },
    contrato: {
      numero: args.info.numeroContrato ?? "—",
      objeto: null,
      orgao_contratante: args.info.contratante ?? null,
    },
    obra: {
      nome: args.projectName,
      endereco: args.info.endereco ?? null,
      cidade: args.info.municipio ?? null,
      uf: args.info.estado ?? null,
      cliente: args.info.cliente ?? args.info.contratante ?? null,
    },
    company: {
      razao_social: args.info.empresaExecutora ?? null,
    },
    responsavelTecnico: args.info.responsavelTecnico
      ? { nome: args.info.responsavelTecnico, registro: args.info.crea ?? args.info.artRrt ?? null }
      : null,
    fiscal: args.info.fiscal ? { nome: args.info.fiscal, registro: args.info.creaFiscal ?? null } : null,
    itens,
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${numeroBM}-${args.projectName.replace(/[^a-z0-9-_]+/gi, "_")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
