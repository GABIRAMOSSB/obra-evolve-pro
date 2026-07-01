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
  unidade?: string | null;
  descricao?: string | null;
}

export interface ItemComputed {
  total_contratual: number;
  qtd_acum_atual: number;
  valor_periodo: number;
  valor_acum_atual: number;
  pct_executado: number; // fraction 0..1
  saldo_qtd: number;
  saldo_financeiro: number;
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
      saldo_qtd: 0,
      saldo_financeiro: 0,
      status_calc: "nao_iniciada",
    };
  }
  const total_contratual = roundMoney(i.qtd_contratada, i.valor_unitario);
  const qtd_acum_atual = Number((i.qtd_acum_anterior + i.qtd_periodo).toFixed(4));
  const valor_periodo = roundMoney(i.qtd_periodo, i.valor_unitario);
  const valor_acum_atual = Number((i.valor_acum_anterior + valor_periodo).toFixed(2));
  const pct_executado = i.qtd_contratada > 0 ? qtd_acum_atual / i.qtd_contratada : 0;
  const saldo_qtd = Number((i.qtd_contratada - qtd_acum_atual).toFixed(4));
  const saldo_financeiro = Number((total_contratual - valor_acum_atual).toFixed(2));

  let status_calc: ItemComputed["status_calc"] = "nao_iniciada";
  if (qtd_acum_atual > i.qtd_contratada + EPSILON) status_calc = "erro";
  else if (Math.abs(qtd_acum_atual - i.qtd_contratada) <= EPSILON && i.qtd_contratada > 0) status_calc = "concluida";
  else if (qtd_acum_atual > EPSILON) status_calc = "em_andamento";

  return { total_contratual, qtd_acum_atual, valor_periodo, valor_acum_atual, pct_executado, saldo_qtd, saldo_financeiro, status_calc };
}

/**
 * Classifica hierarquicamente a linha a partir do código do item e da flag is_etapa.
 * Convenção institucional SOLV:
 *   1        → etapa      (fundo grafite, texto branco)
 *   1.1      → subetapa   (fundo cinza azulado, texto branco)
 *   1.1.1    → grupo      (fundo cinza claro, texto grafite)
 *   1.1.0.0.1 ou linha com qtd_contratada > 0 → item mensurável (fundo branco)
 */
export type NivelHierarquico = "etapa" | "subetapa" | "grupo" | "item";

export function classifyHierarquia(codigo: string, isEtapa: boolean, qtdContratada = 0, valorUnitario = 0): NivelHierarquico {
  if (!isEtapa && (qtdContratada > 0 || valorUnitario > 0)) return "item";
  const segs = String(codigo || "").split(".").filter((s) => s.length > 0).length;
  if (segs <= 1) return "etapa";
  if (segs === 2) return "subetapa";
  return "grupo";
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
export function validateItem(i: ItemInput & { justificativa?: string | null }): string[] {
  const erros: string[] = [];
  if (i.is_etapa) return erros;
  if (i.qtd_periodo < 0) erros.push(`${i.item_codigo}: quantidade do período não pode ser negativa`);
  const acum = i.qtd_acum_anterior + i.qtd_periodo;
  if (acum > i.qtd_contratada + EPSILON) {
    const temJust = !!(i.justificativa && i.justificativa.trim().length >= 10);
    if (!temJust) {
      erros.push(`${i.item_codigo}: quantidade acumulada ultrapassa o contratado (registre justificativa formal)`);
    }
  }
  return erros;
}


/* ============================================================
 * CONFERÊNCIA AUTOMÁTICA (Fase C) — 12 verificações
 * ============================================================ */

export type Severidade = "ok" | "aviso" | "erro";

export interface CheckResultado {
  codigo: string;              // C01..C12
  titulo: string;
  severidade: Severidade;
  passou: boolean;
  contagem: number;            // nº de itens afetados
  detalhes: { item_codigo: string; mensagem: string }[];
  descricao: string;           // explicação do check
}

export interface ConferenciaResumo {
  total_checks: number;
  ok: number;
  avisos: number;
  erros: number;
  bloqueia_aprovacao: boolean; // true se qualquer erro
  checks: CheckResultado[];
}

export function runConferencia(
  itens: (ItemInput & { justificativa?: string | null })[],
  totais: TotaisMedicao,
): ConferenciaResumo {
  const mensuraveis = itens.filter((i) => !i.is_etapa);
  const checks: CheckResultado[] = [];

  const push = (
    codigo: string,
    titulo: string,
    descricao: string,
    severidade: Severidade,
    detalhes: { item_codigo: string; mensagem: string }[],
  ) => {
    checks.push({
      codigo, titulo, descricao, severidade,
      passou: detalhes.length === 0,
      contagem: detalhes.length,
      detalhes,
    });
  };

  // C01 — Quantidade do período negativa
  push("C01", "Quantidades negativas", "Nenhum item pode ter quantidade lançada menor que zero.", "erro",
    mensuraveis.filter((i) => i.qtd_periodo < -EPSILON).map((i) => ({
      item_codigo: i.item_codigo, mensagem: `qtd_periodo = ${i.qtd_periodo}`,
    })),
  );

  // C02 — Acumulado excede contratado sem justificativa
  push("C02", "Extrapolação sem justificativa", "Itens cujo acumulado supera o contratado precisam de justificativa formal.", "erro",
    mensuraveis.filter((i) => {
      const acum = i.qtd_acum_anterior + i.qtd_periodo;
      return acum > i.qtd_contratada + EPSILON && !(i.justificativa && i.justificativa.trim().length >= 10);
    }).map((i) => ({
      item_codigo: i.item_codigo,
      mensagem: `acumulado ${fmtNumberBR(i.qtd_acum_anterior + i.qtd_periodo)} > contratado ${fmtNumberBR(i.qtd_contratada)}`,
    })),
  );

  // C03 — Extrapolação COM justificativa (aviso informativo)
  push("C03", "Exceções autorizadas", "Itens extrapolados com justificativa registrada — revisar em reunião de aprovação.", "aviso",
    mensuraveis.filter((i) => {
      const acum = i.qtd_acum_anterior + i.qtd_periodo;
      return acum > i.qtd_contratada + EPSILON && !!(i.justificativa && i.justificativa.trim().length >= 10);
    }).map((i) => ({ item_codigo: i.item_codigo, mensagem: i.justificativa ?? "" })),
  );

  // C04 — Valor unitário ausente ou zero
  push("C04", "Valor unitário ausente", "Todo item mensurável deve ter valor unitário maior que zero.", "erro",
    mensuraveis.filter((i) => i.valor_unitario <= 0).map((i) => ({
      item_codigo: i.item_codigo, mensagem: "valor_unitario ≤ 0",
    })),
  );

  // C05 — Quantidade contratada ausente
  push("C05", "Quantidade contratada ausente", "Itens sem quantidade contratada não podem ser medidos.", "erro",
    mensuraveis.filter((i) => i.qtd_contratada <= 0 && i.qtd_periodo > EPSILON).map((i) => ({
      item_codigo: i.item_codigo, mensagem: "medindo item sem qtd contratada",
    })),
  );

  // C06 — Unidade não informada
  push("C06", "Unidade não informada", "Itens sem unidade de medida atrapalham a rastreabilidade contratual.", "aviso",
    mensuraveis.filter((i) => !i.unidade || i.unidade.trim() === "").map((i) => ({
      item_codigo: i.item_codigo, mensagem: "unidade em branco",
    })),
  );

  // C07 — Descrição muito curta (< 6 caracteres)
  push("C07", "Descrição incompleta", "Descrições muito curtas dificultam a leitura do boletim oficial.", "aviso",
    mensuraveis.filter((i) => sanitizeDescricao(i.descricao).length < 6).map((i) => ({
      item_codigo: i.item_codigo, mensagem: `descrição: "${sanitizeDescricao(i.descricao)}"`,
    })),
  );

  // C08 — Valor financeiro anterior maior que o total contratual do item
  push("C08", "Valor anterior inconsistente", "Valor acumulado anterior maior que o total contratual do item — provável erro de importação.", "erro",
    mensuraveis.filter((i) => i.valor_acum_anterior > (i.qtd_contratada * i.valor_unitario) + 0.01).map((i) => ({
      item_codigo: i.item_codigo,
      mensagem: `anterior ${fmtMoneyBR(i.valor_acum_anterior)} > total ${fmtMoneyBR(i.qtd_contratada * i.valor_unitario)}`,
    })),
  );

  // C09 — Divergência entre qtd anterior e valor anterior (> 1%)
  push("C09", "Divergência físico × financeiro anterior", "Quantidade anterior e valor anterior devem ser coerentes (tolerância 1%).", "aviso",
    mensuraveis.filter((i) => {
      if (i.qtd_acum_anterior <= EPSILON || i.valor_unitario <= 0) return false;
      const esperado = i.qtd_acum_anterior * i.valor_unitario;
      if (esperado <= 0.01) return false;
      const dif = Math.abs(esperado - i.valor_acum_anterior) / esperado;
      return dif > 0.01;
    }).map((i) => ({
      item_codigo: i.item_codigo,
      mensagem: `esperado ${fmtMoneyBR(i.qtd_acum_anterior * i.valor_unitario)}, informado ${fmtMoneyBR(i.valor_acum_anterior)}`,
    })),
  );

  // C10 — Códigos duplicados
  const cont = new Map<string, number>();
  mensuraveis.forEach((i) => cont.set(i.item_codigo, (cont.get(i.item_codigo) ?? 0) + 1));
  push("C10", "Códigos de item duplicados", "Cada item mensurável deve ter código único.", "erro",
    [...cont.entries()].filter(([, n]) => n > 1).map(([codigo, n]) => ({
      item_codigo: codigo, mensagem: `${n} ocorrências`,
    })),
  );

  // C11 — Boletim vazio (nenhum item medido no período)
  const medidosNoPeriodo = mensuraveis.filter((i) => i.qtd_periodo > EPSILON).length;
  push("C11", "Boletim sem lançamento no período", "Nenhum item recebeu quantidade no período — verifique se o BM realmente deve ser emitido.",
    medidosNoPeriodo === 0 ? "aviso" : "ok",
    medidosNoPeriodo === 0 ? [{ item_codigo: "—", mensagem: "0 itens medidos" }] : [],
  );

  // C12 — Total do período não confere com a soma dos itens (tolerância R$ 0,05)
  const somaPeriodo = mensuraveis.reduce((s, i) => s + roundMoney(i.qtd_periodo, i.valor_unitario), 0);
  const difTotal = Math.abs(somaPeriodo - totais.valor_medicao_atual);
  push("C12", "Fechamento do período", "Soma item-a-item deve bater com o total exibido nos KPIs (tolerância R$ 0,05).",
    difTotal > 0.05 ? "erro" : "ok",
    difTotal > 0.05 ? [{ item_codigo: "—", mensagem: `soma ${fmtMoneyBR(somaPeriodo)} × total ${fmtMoneyBR(totais.valor_medicao_atual)}` }] : [],
  );

  const erros = checks.filter((c) => c.severidade === "erro" && !c.passou).length;
  const avisos = checks.filter((c) => c.severidade === "aviso" && !c.passou).length;
  const ok = checks.filter((c) => c.passou).length;

  return {
    total_checks: checks.length,
    ok, avisos, erros,
    bloqueia_aprovacao: erros > 0,
    checks,
  };
}

/* ============================================================
 * PAINEL EXECUTIVO (Fase D) — 16 indicadores gerenciais
 * ============================================================ */

export type TendenciaPainel = "positiva" | "neutra" | "negativa";

export interface IndicadorPainel {
  codigo: string;         // I01..I16
  titulo: string;
  valor: string;          // formatado para exibição
  valorNumerico: number;  // para gráficos/ordenação
  descricao: string;      // explicação curta
  categoria: "financeiro" | "fisico" | "prazo" | "qualidade";
  tendencia: TendenciaPainel;
  destaque?: boolean;     // KPI principal da categoria
}

export interface PainelExecutivoResumo {
  indicadores: IndicadorPainel[];
  ritmoPorBM: number;               // fração 0..1
  bmsRestantesEstimados: number | null;
  aderenciaPlanejado: number;       // p.p. (realizado - planejado)
  concentracaoTop5: number;         // fração 0..1 do saldo nos top 5
}

export interface PainelInput {
  itens: (ItemInput & { justificativa?: string | null })[];
  totais: TotaisMedicao;
  numBMsAprovados: number;
  posicaoBMAtual: number;           // 1 = primeiro BM, 2 = segundo etc.
  totalBMsProjetados?: number;      // se conhecido; senão estimado
}

export function computePainelExecutivo(input: PainelInput): PainelExecutivoResumo {
  const { itens, totais, numBMsAprovados, posicaoBMAtual } = input;
  const mensuraveis = itens.filter((i) => !i.is_etapa);

  // Ritmo médio por BM: %executado / nº de BMs realizados
  const bmsFeitos = Math.max(numBMsAprovados + 1, posicaoBMAtual, 1);
  const ritmoPorBM = totais.percentual_executado / bmsFeitos;
  const bmsRestantesEstimados =
    ritmoPorBM > 0 && totais.percentual_executado < 1
      ? Math.ceil((1 - totais.percentual_executado) / ritmoPorBM)
      : null;

  // Aderência ao planejado (linear): planejado no ponto atual = posicaoBM / totalBMs
  const totalBMsProj = input.totalBMsProjetados ?? (bmsRestantesEstimados ? bmsFeitos + bmsRestantesEstimados : bmsFeitos);
  const planejadoAtual = totalBMsProj > 0 ? posicaoBMAtual / totalBMsProj : 0;
  const aderenciaPP = (totais.percentual_executado - planejadoAtual) * 100;

  // Contagens de status
  let concluidos = 0, emAndamento = 0, naoIniciados = 0, extrapolados = 0, excecoes = 0;
  const saldos: number[] = [];
  for (const it of mensuraveis) {
    const c = computeItem(it);
    if (c.status_calc === "concluida") concluidos++;
    else if (c.status_calc === "em_andamento") emAndamento++;
    else if (c.status_calc === "erro") extrapolados++;
    else naoIniciados++;
    if (it.justificativa && it.justificativa.trim().length >= 10) excecoes++;
    if (c.saldo_financeiro > 0.01) saldos.push(c.saldo_financeiro);
  }

  const totalItens = mensuraveis.length;
  const totalSaldo = saldos.reduce((s, v) => s + v, 0);
  const top5 = [...saldos].sort((a, b) => b - a).slice(0, 5).reduce((s, v) => s + v, 0);
  const concentracaoTop5 = totalSaldo > 0 ? top5 / totalSaldo : 0;

  const ticketMedioPeriodo = totais.itens_medidos > 0 ? totais.valor_medicao_atual / totais.itens_medidos : 0;
  const pctConcluidos = totalItens > 0 ? concluidos / totalItens : 0;
  const pctNaoIniciados = totalItens > 0 ? naoIniciados / totalItens : 0;

  const tendAderencia: TendenciaPainel = aderenciaPP >= 0 ? "positiva" : aderenciaPP >= -5 ? "neutra" : "negativa";
  const tendExtrapolados: TendenciaPainel = extrapolados === 0 ? "positiva" : extrapolados <= 2 ? "neutra" : "negativa";
  const tendConcentracao: TendenciaPainel = concentracaoTop5 <= 0.5 ? "positiva" : concentracaoTop5 <= 0.75 ? "neutra" : "negativa";

  const indicadores: IndicadorPainel[] = [
    { codigo: "I01", categoria: "financeiro", destaque: true, titulo: "Valor total contratado",
      valor: fmtMoneyBR(totais.valor_total_contrato), valorNumerico: totais.valor_total_contrato,
      descricao: "Somatório contratual de todos os itens mensuráveis.", tendencia: "neutra" },
    { codigo: "I02", categoria: "financeiro", titulo: "Acumulado executado",
      valor: fmtMoneyBR(totais.valor_acumulado), valorNumerico: totais.valor_acumulado,
      descricao: "Valor total já medido, incluindo este boletim.", tendencia: "positiva" },
    { codigo: "I03", categoria: "financeiro", destaque: true, titulo: "Medição do período",
      valor: fmtMoneyBR(totais.valor_medicao_atual), valorNumerico: totais.valor_medicao_atual,
      descricao: "Total financeiro executado exclusivamente neste BM.", tendencia: "positiva" },
    { codigo: "I04", categoria: "financeiro", titulo: "Saldo contratual",
      valor: fmtMoneyBR(totais.saldo_contratual), valorNumerico: totais.saldo_contratual,
      descricao: "Valor ainda a executar até o fim do contrato.", tendencia: totais.saldo_contratual > 0 ? "neutra" : "positiva" },
    { codigo: "I05", categoria: "fisico", destaque: true, titulo: "% Físico-financeiro",
      valor: fmtPctBR(totais.percentual_executado, 2), valorNumerico: totais.percentual_executado,
      descricao: "Percentual acumulado sobre o total contratado.", tendencia: "positiva" },
    { codigo: "I06", categoria: "prazo", destaque: true, titulo: "Aderência ao planejado",
      valor: `${aderenciaPP >= 0 ? "+" : ""}${aderenciaPP.toFixed(1)} p.p.`, valorNumerico: aderenciaPP,
      descricao: "Diferença entre realizado e planejado linear no ponto atual.", tendencia: tendAderencia },
    { codigo: "I07", categoria: "prazo", titulo: "Ritmo médio por BM",
      valor: fmtPctBR(ritmoPorBM, 2), valorNumerico: ritmoPorBM,
      descricao: "Percentual médio executado por boletim já emitido.", tendencia: ritmoPorBM > 0 ? "positiva" : "neutra" },
    { codigo: "I08", categoria: "prazo", titulo: "BMs restantes estimados",
      valor: bmsRestantesEstimados == null ? "—" : String(bmsRestantesEstimados),
      valorNumerico: bmsRestantesEstimados ?? 0,
      descricao: "Projeção linear com base no ritmo médio atual.", tendencia: "neutra" },
    { codigo: "I09", categoria: "fisico", titulo: "Itens contratados",
      valor: String(totalItens), valorNumerico: totalItens,
      descricao: "Total de itens mensuráveis no contrato.", tendencia: "neutra" },
    { codigo: "I10", categoria: "fisico", titulo: "Itens medidos no período",
      valor: String(totais.itens_medidos), valorNumerico: totais.itens_medidos,
      descricao: "Itens que receberam quantidade neste boletim.", tendencia: "positiva" },
    { codigo: "I11", categoria: "fisico", titulo: "Itens concluídos",
      valor: `${concluidos} (${fmtPctBR(pctConcluidos, 1)})`, valorNumerico: concluidos,
      descricao: "Itens com quantidade acumulada igual à contratada.", tendencia: "positiva" },
    { codigo: "I12", categoria: "fisico", titulo: "Itens não iniciados",
      valor: `${naoIniciados} (${fmtPctBR(pctNaoIniciados, 1)})`, valorNumerico: naoIniciados,
      descricao: "Itens sem execução até o momento.", tendencia: naoIniciados === 0 ? "positiva" : "neutra" },
    { codigo: "I13", categoria: "qualidade", titulo: "Itens em andamento",
      valor: String(emAndamento), valorNumerico: emAndamento,
      descricao: "Itens parcialmente executados.", tendencia: "neutra" },
    { codigo: "I14", categoria: "qualidade", titulo: "Itens extrapolados",
      valor: String(extrapolados), valorNumerico: extrapolados,
      descricao: "Itens cujo acumulado ultrapassou o contratado.", tendencia: tendExtrapolados },
    { codigo: "I15", categoria: "qualidade", titulo: "Exceções autorizadas",
      valor: String(excecoes), valorNumerico: excecoes,
      descricao: "Extrapolações formalmente justificadas neste boletim.", tendencia: excecoes === 0 ? "positiva" : "neutra" },
    { codigo: "I16", categoria: "financeiro", titulo: "Concentração top 5 (saldo)",
      valor: fmtPctBR(concentracaoTop5, 1), valorNumerico: concentracaoTop5,
      descricao: `Ticket médio no período: ${fmtMoneyBR(ticketMedioPeriodo)}. Quanto maior a concentração, maior o risco de dependência de poucos itens.`,
      tendencia: tendConcentracao },
  ];

  return { indicadores, ritmoPorBM, bmsRestantesEstimados, aderenciaPlanejado: aderenciaPP, concentracaoTop5 };
}

