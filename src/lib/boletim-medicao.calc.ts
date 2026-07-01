/**
 * Cálculos do Boletim de Medição — trabalhando em centavos inteiros
 * para eliminar erros de ponto flutuante (evita 236950.98099999997).
 *
 * Regra ouro: arredondar CADA valor de linha (qtd × unit) para
 * 2 casas ANTES de totalizar, replicando o comportamento do modelo
 * "boletim-medicao-01-Obra Cras Passo.xlsx".
 */

export const EPSILON = 0.000001;

/** Converte reais (number/string com , ou .) em centavos inteiros. */
export function toCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "string"
    ? Number(value.replace(/\./g, "").replace(",", "."))
    : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Converte centavos em reais (number com 2 casas). */
export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

/** ROUND(qtd × unitario, 2) usando aritmética inteira. */
export function roundMoney(qtd: number, unit: number): number {
  const cents = Math.round(qtd * unit * 100);
  return cents / 100;
}

export function fmtMoneyBR(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtNumberBR(value: number | string | null | undefined, decimals = 2): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPctBR(fraction: number | string | null | undefined, decimals = 2): string {
  const n = Number(fraction ?? 0) * 100;
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
}

/** Padroniza unidade só para EXIBIÇÃO. Não altera o dado armazenado. */
export function normalizeUnidade(raw: string | null | undefined): string {
  if (!raw) return "";
  const u = String(raw).trim().toLowerCase();
  if (u === "m2" || u === "m²") return "M²";
  if (u === "m3" || u === "m³") return "M³";
  return u.toUpperCase();
}

/** Limpa "x000d", quebras duplas, espaços duplos; preserva acentos e códigos. */
export function sanitizeDescricao(raw: string | null | undefined): string {
  if (!raw) return "";
  return String(raw)
    .replace(/_?x000D_?/gi, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export interface ItemInput {
  item_codigo: string;
  is_etapa: boolean;
  qtd_contratada: number;
  valor_unitario: number;
  qtd_acum_anterior: number;
  valor_acum_anterior: number;
  qtd_periodo: number;
}

export interface ItemComputed {
  total_contratual: number;
  qtd_acum_atual: number;
  valor_periodo: number;
  valor_acum_atual: number;
  pct_executado: number; // fraction 0..1
  status_calc: "nao_iniciada" | "em_andamento" | "concluida" | "erro";
}

export function computeItem(i: ItemInput): ItemComputed {
  if (i.is_etapa) {
    return {
      total_contratual: 0,
      qtd_acum_atual: 0,
      valor_periodo: 0,
      valor_acum_atual: 0,
      pct_executado: 0,
      status_calc: "nao_iniciada",
    };
  }
  const total_contratual = roundMoney(i.qtd_contratada, i.valor_unitario);
  const qtd_acum_atual = Number((i.qtd_acum_anterior + i.qtd_periodo).toFixed(4));
  const valor_periodo = roundMoney(i.qtd_periodo, i.valor_unitario);
  const valor_acum_atual = Number((i.valor_acum_anterior + valor_periodo).toFixed(2));

  const pct_executado = i.qtd_contratada > 0 ? qtd_acum_atual / i.qtd_contratada : 0;

  let status_calc: ItemComputed["status_calc"] = "nao_iniciada";
  if (qtd_acum_atual > i.qtd_contratada + EPSILON) status_calc = "erro";
  else if (Math.abs(qtd_acum_atual - i.qtd_contratada) <= EPSILON && i.qtd_contratada > 0) status_calc = "concluida";
  else if (qtd_acum_atual > EPSILON) status_calc = "em_andamento";

  return { total_contratual, qtd_acum_atual, valor_periodo, valor_acum_atual, pct_executado, status_calc };
}

export interface TotaisMedicao {
  valor_total_contrato: number;
  valor_medicao_atual: number;
  valor_acumulado: number;
  percentual_executado: number;
  saldo_contratual: number;
  itens_medidos: number;
  itens_concluidos: number;
}

export function computeTotais(itens: (ItemInput & Partial<ItemComputed>)[]): TotaisMedicao {
  // Somamos em CENTAVOS INTEIROS para eliminar drift de ponto flutuante.
  let totalContratoCents = 0;
  let medicaoAtualCents = 0;
  let acumuladoCents = 0;
  let itens_medidos = 0;
  let itens_concluidos = 0;

  for (const it of itens) {
    if (it.is_etapa) continue;
    const c = computeItem(it);
    totalContratoCents += Math.round(c.total_contratual * 100);
    medicaoAtualCents += Math.round(c.valor_periodo * 100);
    acumuladoCents += Math.round(c.valor_acum_atual * 100);
    if (it.qtd_periodo > EPSILON) itens_medidos++;
    if (c.status_calc === "concluida") itens_concluidos++;
  }

  const valor_total_contrato = fromCents(totalContratoCents);
  const valor_medicao_atual = fromCents(medicaoAtualCents);
  const valor_acumulado = fromCents(acumuladoCents);
  const percentual_executado = totalContratoCents > 0 ? acumuladoCents / totalContratoCents : 0;
  const saldo_contratual = fromCents(totalContratoCents - acumuladoCents);

  return {
    valor_total_contrato,
    valor_medicao_atual,
    valor_acumulado,
    percentual_executado,
    saldo_contratual,
    itens_medidos,
    itens_concluidos,
  };
}


/** Valida um item; devolve mensagens de erro (vazio = ok). */
export function validateItem(i: ItemInput): string[] {
  const erros: string[] = [];
  if (i.is_etapa) return erros;
  if (i.qtd_periodo < 0) erros.push(`${i.item_codigo}: quantidade do período não pode ser negativa`);
  const acum = i.qtd_acum_anterior + i.qtd_periodo;
  if (acum > i.qtd_contratada + EPSILON) {
    erros.push(`${i.item_codigo}: quantidade acumulada ultrapassa o contratado`);
  }
  return erros;
}
