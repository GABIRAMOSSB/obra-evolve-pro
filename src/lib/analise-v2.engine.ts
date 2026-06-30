/**
 * Engine pura da Análise Gerencial V2 da obra.
 *
 * Sem I/O. Recebe obra, atividades e snapshots recentes — devolve DTO
 * estruturado para o painel. Toda a lógica é determinística e idempotente.
 */

export type AtividadeRaw = {
  id: string;
  item_codigo: string;
  descricao: string;
  etapa: string | null;
  valor: number | null;
  peso: number | null;
  quantidade: number | null;
  percentual_concluido: number;
  status: "nao_iniciada" | "em_andamento" | "concluida" | "paralisada";
  data_prevista_inicio: string | null;
  data_prevista_fim: string | null;
  data_real_inicio: string | null;
  data_real_fim: string | null;
  responsavel_nome: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  impedimento: string | null;
  is_group: boolean | null;
  // Fase 2 — baseline planejada editável
  baseline_inicio?: string | null;
  baseline_fim?: string | null;
  prontidao?: number | null;
};

export type DependenciaRaw = {
  id: string;
  predecessora_id: string;
  sucessora_id: string;
  tipo: "TI" | "II" | "TT" | "IT";
  defasagem_dias: number;
  percentual_minimo: number;
};

export type ObraRaw = {
  id: string;
  nome: string;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  valor_contratado: number | null;
};

export type SnapshotRaw = {
  data_snapshot: string;
  avanco: number;
  prazo_consumido: number | null;
  desvio: number | null;
  ritmo_atual: number | null;
  ritmo_necessario: number | null;
  fator_aceleracao: number | null;
  num_criticas: number;
  risco: string;
  valor_executado: number | null;
  payload?: Record<string, unknown> | null;
};

// ---------- helpers ----------
const DAY = 86_400_000;
function parseDate(d: string | null | undefined): Date | null {
  if (!d) return null;
  const s = d.length === 10 ? d + "T00:00:00Z" : d;
  const t = new Date(s);
  return Number.isFinite(t.getTime()) ? t : null;
}
function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY);
}
function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function safeDiv(n: number, d: number, fallback: number | null = null): number | null {
  return d > 0 ? n / d : fallback;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}
function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------- classificações ----------
export type ClassDesvio = "adiantada" | "no_prazo" | "pequeno" | "atencao" | "elevado" | "critico";
export type ClassIDP = "acima" | "controlada" | "atencao" | "alto" | "critico";
export type ClassAceleracao = "suficiente" | "leve" | "moderado" | "elevado" | "critico";
export type ClassRisco = "baixo" | "moderado" | "alto" | "muito_alto" | "critico";
export type Confiabilidade = "alta" | "media" | "baixa";

function classDesvio(desvio: number): ClassDesvio {
  if (desvio > 0) return "adiantada";
  if (desvio >= -5) return "pequeno";
  if (desvio >= -10) return "atencao";
  if (desvio >= -20) return "elevado";
  return "critico";
}
function classIDP(idp: number | null): ClassIDP {
  if (idp == null) return "controlada";
  if (idp >= 1) return "acima";
  if (idp >= 0.9) return "controlada";
  if (idp >= 0.75) return "atencao";
  if (idp >= 0.6) return "alto";
  return "critico";
}
function classAceleracao(f: number | null): ClassAceleracao {
  if (f == null) return "suficiente";
  if (f <= 1) return "suficiente";
  if (f <= 1.3) return "leve";
  if (f <= 1.6) return "moderado";
  if (f <= 2) return "elevado";
  return "critico";
}
function classRisco(score: number): ClassRisco {
  if (score >= 80) return "critico";
  if (score >= 65) return "muito_alto";
  if (score >= 45) return "alto";
  if (score >= 25) return "moderado";
  return "baixo";
}

// ---------- dependências por etapa (regras fixas) ----------
const ETAPA_DEPS: Record<string, string[]> = {
  cobertura: ["acabamentos", "forros", "pintura", "pisos", "revestimentos"],
  estrutura: ["alvenaria", "cobertura", "instalações elétricas", "instalações hidráulicas"],
  alvenaria: ["instalações elétricas", "instalações hidráulicas", "revestimentos", "drywall"],
  "instalações elétricas": ["drywall", "forros", "pintura"],
  "instalações hidráulicas": ["drywall", "revestimentos", "pisos"],
  drywall: ["pintura", "acabamentos"],
  esquadrias: ["acabamentos", "pintura", "vedação"],
  ppci: ["entrega", "testes e entrega"],
  revestimentos: ["pisos", "acabamentos"],
  forros: ["pintura", "acabamentos"],
};
function normEtapa(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().trim();
}

// ---------- DTO ----------
export type AnaliseV2 = ReturnType<typeof calcularAnaliseV2>;

export type FinanceirosRaw = {
  valor_aditivos: number;        // soma de aditivos vigentes positivos
  valor_supressoes: number;      // soma de aditivos vigentes negativos (sempre positiva aqui)
  valor_medido: number;          // soma de medicoes aprovadas/pagas
  valor_pago: number;            // soma de medicoes status=paga
};

export function calcularAnaliseV2(
  obra: ObraRaw,
  atividadesRaw: AtividadeRaw[],
  snapshots: SnapshotRaw[],
  financeiros?: FinanceirosRaw,
  dependencias?: DependenciaRaw[],
) {
  const hoje = new Date(isoToday() + "T00:00:00Z");
  const ativ = atividadesRaw.filter((a) => !a.is_group);
  const totalCount = ativ.length;

  // --- valores ---
  const totalValor = ativ.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const totalPeso = ativ.reduce((s, a) => s + (Number(a.peso) || 0), 0);
  const usaValor = totalValor > 0;
  const usaPeso = !usaValor && totalPeso > 0;
  const metodo_avanco: "valor" | "peso" | "media" = usaValor ? "valor" : usaPeso ? "peso" : "media";

  // --- avanço ponderado ---
  const avancoNum = ativ.reduce((s, a) => {
    const p = Number(a.percentual_concluido) || 0;
    if (usaValor) return s + (Number(a.valor) || 0) * (p / 100);
    if (usaPeso) return s + (Number(a.peso) || 0) * (p / 100);
    return s + p / 100;
  }, 0);
  const avancoDen = usaValor ? totalValor : usaPeso ? totalPeso : Math.max(1, totalCount);
  const avanco = (avancoNum / avancoDen) * 100;
  const valor_executado = usaValor ? avancoNum : avanco / 100 * totalValor;
  const saldo_executar = Math.max(0, totalValor - valor_executado);

  // --- prazo ---
  const di = parseDate(obra.data_inicio);
  const df = parseDate(obra.data_fim_prevista);
  const prazoTotal = di && df ? Math.max(1, diffDays(df, di)) : null;
  const diasDecorridos = di ? Math.max(0, diffDays(hoje, di)) : null;
  const diasRestantes = df ? diffDays(df, hoje) : null;
  const prazo_consumido = prazoTotal && diasDecorridos != null ? Math.min(100, (diasDecorridos / prazoTotal) * 100) : null;

  const desvio = prazo_consumido != null ? +(avanco - prazo_consumido).toFixed(2) : null;
  const idp = prazo_consumido != null && prazo_consumido > 0 ? +(avanco / prazo_consumido).toFixed(3) : null;

  // --- ritmo ---
  const ritmo_acumulado = diasDecorridos && diasDecorridos > 0 ? +(avanco / diasDecorridos).toFixed(4) : null;
  // ritmo recente (a partir de snapshots)
  const snapsOrdenados = [...snapshots].sort((a, b) => a.data_snapshot.localeCompare(b.data_snapshot));
  function ritmoEntre(diasAtras: number): number | null {
    if (!snapsOrdenados.length) return null;
    const limite = fmtISO(addDays(hoje, -diasAtras));
    const passado = [...snapsOrdenados].reverse().find((s) => s.data_snapshot <= limite);
    if (!passado) return null;
    const dias = diffDays(hoje, new Date(passado.data_snapshot + "T00:00:00Z"));
    if (dias <= 0) return null;
    return +((avanco - Number(passado.avanco)) / dias).toFixed(4);
  }
  const ritmo_7d = ritmoEntre(7);
  const ritmo_15d = ritmoEntre(15);

  const pctRestante = Math.max(0, 100 - avanco);
  const ritmo_necessario = diasRestantes && diasRestantes > 0 ? +(pctRestante / diasRestantes).toFixed(4) : null;
  const producao_financ_dia = diasRestantes && diasRestantes > 0 ? +(saldo_executar / diasRestantes).toFixed(2) : null;
  const meta_semanal_pct = ritmo_necessario != null ? +(ritmo_necessario * 7).toFixed(3) : null;
  const meta_semanal_valor = producao_financ_dia != null ? +(producao_financ_dia * 7).toFixed(2) : null;

  const fator_aceleracao = ritmo_necessario != null && ritmo_acumulado && ritmo_acumulado > 0
    ? +(ritmo_necessario / ritmo_acumulado).toFixed(3)
    : null;

  // --- projeções ---
  function projetar(ritmo: number | null): { data: string | null; atraso_dias: number | null; pct_no_vencimento: number | null } {
    if (!di || !df || ritmo == null || ritmo <= 0) return { data: null, atraso_dias: null, pct_no_vencimento: null };
    const diasNecessarios = (100 - avanco) / ritmo;
    const dataProj = addDays(hoje, Math.ceil(diasNecessarios));
    const atraso = diffDays(dataProj, df);
    const diasAteVenc = diffDays(df, hoje);
    const pctVenc = +(avanco + ritmo * Math.max(0, diasAteVenc)).toFixed(2);
    return { data: fmtISO(dataProj), atraso_dias: atraso, pct_no_vencimento: Math.min(100, pctVenc) };
  }
  const proj_acumulado = projetar(ritmo_acumulado);
  const proj_recente = projetar(ritmo_7d ?? ritmo_15d ?? ritmo_acumulado);
  const tendencia_recente: "melhor" | "pior" | "estavel" = (() => {
    const r1 = ritmo_7d ?? ritmo_15d;
    if (r1 == null || ritmo_acumulado == null) return "estavel";
    const dif = r1 - ritmo_acumulado;
    if (Math.abs(dif) < 0.005) return "estavel";
    return dif > 0 ? "melhor" : "pior";
  })();

  // --- atividades enriquecidas ---
  type EnrAt = AtividadeRaw & {
    valor_executado: number;
    valor_pendente: number;
    dias_atraso: number;
    dias_para_prazo: number | null;
    impact_score: number;
    impact_nivel: "critica" | "alta" | "media" | "baixa";
    motivos: string[];
    acao_recomendada: string;
  };
  const enriquecidas: EnrAt[] = ativ.map((a) => {
    const valor = Number(a.valor) || 0;
    const p = Number(a.percentual_concluido) || 0;
    const ve = valor * (p / 100);
    const vp = valor - ve;
    const dpf = parseDate(a.data_prevista_fim);
    const dias_atraso = dpf && a.status !== "concluida" ? Math.max(0, diffDays(hoje, dpf)) : 0;
    const dias_para_prazo = dpf ? diffDays(dpf, hoje) : null;

    // score 0..100
    let score = 0;
    const motivos: string[] = [];
    // valor financeiro: até 30 pontos (proporcional ao share do contrato pendente)
    if (totalValor > 0) {
      const shareVP = vp / totalValor;
      const sV = Math.min(30, shareVP * 100 * 1.5);
      if (sV > 5) motivos.push(`R$ ${vp.toFixed(0)} pendente (${(shareVP * 100).toFixed(1)}% do contrato)`);
      score += sV;
    }
    // dias de atraso: até 25 pontos (>30 dias = máx)
    if (dias_atraso > 0) {
      score += Math.min(25, (dias_atraso / 30) * 25);
      motivos.push(`${dias_atraso} dia(s) de atraso`);
    }
    // % pendente: até 15
    score += Math.min(15, ((100 - p) / 100) * 15);
    // prioridade
    if (a.prioridade === "critica") { score += 10; motivos.push("prioridade crítica"); }
    else if (a.prioridade === "alta") { score += 6; motivos.push("prioridade alta"); }
    // impedimento
    if (a.impedimento) { score += 10; motivos.push(`impedimento: ${a.impedimento}`); }
    // sem responsável
    if (!a.responsavel_nome) { score += 5; motivos.push("sem responsável"); }
    // proximidade do prazo
    if (dias_para_prazo != null && dias_para_prazo >= 0 && dias_para_prazo <= 14 && a.status !== "concluida") {
      score += Math.min(5, (15 - dias_para_prazo) / 3);
      motivos.push(`vence em ${dias_para_prazo} dia(s)`);
    }
    if (a.status === "paralisada") { score += 8; motivos.push("paralisada"); }

    const impact_nivel: "critica" | "alta" | "media" | "baixa" =
      score >= 55 ? "critica" : score >= 35 ? "alta" : score >= 18 ? "media" : "baixa";

    let acao_recomendada = "Acompanhar evolução.";
    if (a.impedimento) acao_recomendada = `Remover impedimento: ${a.impedimento}.`;
    else if (!a.responsavel_nome) acao_recomendada = "Definir responsável imediatamente.";
    else if (dias_atraso > 0) acao_recomendada = "Reforçar equipe e renegociar prazo da atividade.";
    else if (a.status === "paralisada") acao_recomendada = "Avaliar causa da paralisação e replanejar.";
    else if (p === 0 && dias_para_prazo != null && dias_para_prazo <= 7) acao_recomendada = "Confirmar material, equipe e data de início nas próximas 48h.";

    return {
      ...a,
      valor_executado: ve,
      valor_pendente: vp,
      dias_atraso,
      dias_para_prazo,
      impact_score: +score.toFixed(1),
      impact_nivel,
      motivos,
      acao_recomendada,
    };
  });

  const criticas = enriquecidas
    .filter((a) => a.impact_nivel === "critica" || a.impact_nivel === "alta")
    .sort((a, b) => b.impact_score - a.impact_score);

  // --- exposição financeira ---
  const atrasadas = enriquecidas.filter((a) => a.dias_atraso > 0);
  const nao_iniciadas = enriquecidas.filter((a) => (Number(a.percentual_concluido) || 0) === 0 && a.status !== "concluida");
  const valor_nao_iniciadas = nao_iniciadas.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const valor_atrasadas = atrasadas.reduce((s, a) => s + a.valor_pendente, 0);
  const valor_criticas = criticas.reduce((s, a) => s + a.valor_pendente, 0);
  const pct_contrato_zero = totalValor > 0 ? +((valor_nao_iniciadas / totalValor) * 100).toFixed(2) : null;
  const top5_pendentes = [...enriquecidas].sort((a, b) => b.valor_pendente - a.valor_pendente).slice(0, 5);
  const pct_top5 = totalValor > 0
    ? +((top5_pendentes.reduce((s, a) => s + a.valor_pendente, 0) / totalValor) * 100).toFixed(2)
    : null;

  // --- por etapa ---
  type EtapaAgg = {
    etapa: string;
    valor: number;
    avanco: number;
    saldo: number;
    qtd: number;
    atrasadas: number;
    criticas: number;
    responsavel: string | null;
    situacao: "concluida" | "no_prazo" | "atencao" | "atrasada" | "bloqueada" | "nao_iniciada";
  };
  const byEtapa = new Map<string, EnrAt[]>();
  for (const a of enriquecidas) {
    const key = a.etapa || "Sem etapa";
    if (!byEtapa.has(key)) byEtapa.set(key, []);
    byEtapa.get(key)!.push(a);
  }
  const etapas: EtapaAgg[] = Array.from(byEtapa.entries()).map(([etapa, lista]) => {
    const v = lista.reduce((s, a) => s + (Number(a.valor) || 0), 0);
    const ve = lista.reduce((s, a) => s + a.valor_executado, 0);
    const avancoEt = v > 0 ? (ve / v) * 100 : lista.reduce((s, a) => s + (Number(a.percentual_concluido) || 0), 0) / Math.max(1, lista.length);
    const atr = lista.filter((a) => a.dias_atraso > 0).length;
    const crit = lista.filter((a) => a.impact_nivel === "critica").length;
    const resp = lista.find((a) => a.responsavel_nome)?.responsavel_nome ?? null;
    let situacao: EtapaAgg["situacao"] = "no_prazo";
    if (avancoEt >= 99.9) situacao = "concluida";
    else if (lista.every((a) => (Number(a.percentual_concluido) || 0) === 0)) situacao = "nao_iniciada";
    else if (lista.some((a) => a.impedimento)) situacao = "bloqueada";
    else if (atr > 0) situacao = "atrasada";
    else if (avancoEt < (prazo_consumido ?? 0) - 5) situacao = "atencao";
    return {
      etapa,
      valor: +v.toFixed(2),
      avanco: +avancoEt.toFixed(2),
      saldo: +(v - ve).toFixed(2),
      qtd: lista.length,
      atrasadas: atr,
      criticas: crit,
      responsavel: resp,
      situacao,
    };
  }).sort((a, b) => b.valor - a.valor);

  // --- dependências e bloqueios ---
  type Bloqueio = { bloqueadora: string; bloqueadas: string[]; valor_bloqueado: number; dias_bloqueio: number; responsavel: string | null };
  const bloqueios: Bloqueio[] = [];
  for (const [etapaNome, lista] of byEtapa.entries()) {
    const deps = ETAPA_DEPS[normEtapa(etapaNome)];
    if (!deps) continue;
    const avancoBloq = (() => {
      const v = lista.reduce((s, a) => s + (Number(a.valor) || 0), 0);
      const ve = lista.reduce((s, a) => s + a.valor_executado, 0);
      return v > 0 ? (ve / v) * 100 : 0;
    })();
    if (avancoBloq >= 80) continue; // só conta como bloqueio se não estiver quase concluída
    const bloqueadas: string[] = [];
    let valorBloq = 0;
    for (const [outroEt, outraLista] of byEtapa.entries()) {
      if (!deps.includes(normEtapa(outroEt))) continue;
      const avancoDep = outraLista.length
        ? outraLista.reduce((s, a) => s + (Number(a.percentual_concluido) || 0), 0) / outraLista.length
        : 0;
      if (avancoDep < 50) {
        bloqueadas.push(outroEt);
        valorBloq += outraLista.reduce((s, a) => s + a.valor_pendente, 0);
      }
    }
    if (bloqueadas.length) {
      const piorAtraso = Math.max(0, ...lista.map((a) => a.dias_atraso));
      bloqueios.push({
        bloqueadora: etapaNome,
        bloqueadas,
        valor_bloqueado: +valorBloq.toFixed(2),
        dias_bloqueio: piorAtraso,
        responsavel: lista.find((a) => a.responsavel_nome)?.responsavel_nome ?? null,
      });
    }
  }
  const num_bloqueadas = bloqueios.reduce((s, b) => s + b.bloqueadas.length, 0);
  const valor_bloqueado = bloqueios.reduce((s, b) => s + b.valor_bloqueado, 0);

  // --- prontidão das frentes ---
  // Matriz real (6 critérios derivados dos campos atualmente persistidos).
  // Critérios adicionais (projeto liberado, material comprado/entregue, equipe,
  // equipamento, segurança, documentação) entrarão quando o cadastro de prontidão
  // detalhada estiver disponível em obra_atividades.prontidao_checklist.
  type Prontidao = {
    atividade: string;
    pct: number;
    criterios_ok: number;
    criterios_total: number;
    pendencias: string[];
    responsavel: string | null;
    data_necessaria: string | null;
  };
  const frentes: Prontidao[] = enriquecidas
    .filter((a) => (Number(a.percentual_concluido) || 0) === 0 && a.status !== "concluida")
    .slice(0, 30)
    .map((a) => {
      const checks: { ok: boolean; label: string }[] = [
        { ok: !!a.responsavel_nome, label: "responsável definido" },
        { ok: !!a.data_prevista_inicio, label: "data de início planejada" },
        { ok: !!a.data_prevista_fim, label: "data de término planejada" },
        { ok: !a.impedimento, label: "sem impedimento registrado" },
        { ok: a.prioridade === "alta" || a.prioridade === "critica" || a.prioridade === "media", label: "prioridade classificada" },
        { ok: !!a.etapa, label: "etapa identificada" },
      ];
      const ok = checks.filter((c) => c.ok).length;
      const total = checks.length;
      const pct = Math.round((ok / total) * 100);
      const pendencias = checks.filter((c) => !c.ok).map((c) => c.label);
      return {
        atividade: a.descricao,
        pct,
        criterios_ok: ok,
        criterios_total: total,
        pendencias,
        responsavel: a.responsavel_nome,
        data_necessaria: a.data_prevista_inicio,
      };
    })
    .sort((a, b) => a.pct - b.pct);

  // --- produtividade recente (via snapshots) ---
  const avanco_7d = ritmo_7d != null ? +(ritmo_7d * 7).toFixed(3) : null;
  const meta_semanal = meta_semanal_pct;
  const desempenho_semanal = meta_semanal && meta_semanal > 0 && avanco_7d != null
    ? +((avanco_7d / meta_semanal) * 100).toFixed(1)
    : null;
  // duas semanas consecutivas abaixo de 75%?
  let alerta_duas_semanas = false;
  if (snapsOrdenados.length >= 2 && meta_semanal && meta_semanal > 0) {
    const r14 = ritmoEntre(14);
    if (r14 != null && +(r14 * 7).toFixed(3) / meta_semanal < 0.75 && desempenho_semanal != null && desempenho_semanal < 75) {
      alerta_duas_semanas = true;
    }
  }

  // --- metas de recuperação ---
  type Meta = { rotulo: string; data: string; pct_esperado: number; valor_esperado: number };
  function metaEm(dias: number, rotulo: string): Meta | null {
    if (!di || !df || ritmo_necessario == null) return null;
    const d = addDays(hoje, dias);
    const pct = Math.min(100, +(avanco + ritmo_necessario * dias).toFixed(2));
    return { rotulo, data: fmtISO(d), pct_esperado: pct, valor_esperado: +(totalValor * (pct / 100)).toFixed(2) };
  }
  const metas: Meta[] = [
    metaEm(7, "7 dias"),
    metaEm(15, "15 dias"),
    metaEm(30, "30 dias"),
    diasRestantes ? metaEm(Math.floor(diasRestantes / 2), "Metade do prazo restante") : null,
    diasRestantes ? metaEm(Math.max(0, diasRestantes - 15), "15 dias antes do vencimento") : null,
    diasRestantes ? metaEm(diasRestantes, "Data contratual") : null,
  ].filter(Boolean) as Meta[];

  // --- cenários ---
  const cenarios = {
    atual: { ritmo: ritmo_acumulado, ...proj_acumulado, risco: "manter situação atual" },
    reforco_30: (() => {
      const r = ritmo_acumulado ? ritmo_acumulado * 1.3 : null;
      const p = projetar(r);
      return { ritmo: r, ...p, observacao: "Considerando aumento de 30% no ritmo atual" };
    })(),
    necessario: {
      ritmo: ritmo_necessario,
      data: df ? fmtISO(df) : null,
      atraso_dias: 0,
      pct_no_vencimento: 100,
      meta_diaria: ritmo_necessario,
      meta_semanal: meta_semanal_pct,
      fator_aceleracao,
      observacao: "Ritmo exato necessário para concluir no prazo contratual",
    },
  };

  // --- pontuação de risco 0..100 ---
  function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
  const fDesvio = desvio != null ? clamp01(Math.abs(Math.min(0, desvio)) / 25) : 0; // -25pp = máx
  const fAcel = fator_aceleracao != null ? clamp01((fator_aceleracao - 1) / 1.5) : 0; // 2.5x = máx
  const fCriticas = totalValor > 0 ? clamp01(valor_criticas / totalValor) : 0;
  const fAtrasoBloq = clamp01((atrasadas.length + num_bloqueadas) / Math.max(5, totalCount * 0.2));
  const fProdSem = desempenho_semanal != null ? clamp01((100 - desempenho_semanal) / 100) : 0;
  const fGestao = (() => {
    const semResp = enriquecidas.filter((a) => !a.responsavel_nome).length / Math.max(1, totalCount);
    const comImp = enriquecidas.filter((a) => a.impedimento).length / Math.max(1, totalCount);
    return clamp01(semResp * 0.6 + comImp * 0.4);
  })();
  const score = +(fDesvio * 25 + fAcel * 20 + fCriticas * 20 + fAtrasoBloq * 15 + fProdSem * 10 + fGestao * 10).toFixed(1);
  const risco_nivel = classRisco(score);
  const risco_fatores = [
    { fator: "Desvio prazo x avanço", peso: 25, contrib: +(fDesvio * 25).toFixed(1) },
    { fator: "Fator de aceleração", peso: 20, contrib: +(fAcel * 20).toFixed(1) },
    { fator: "Valor em atividades críticas", peso: 20, contrib: +(fCriticas * 20).toFixed(1) },
    { fator: "Atrasadas e bloqueadas", peso: 15, contrib: +(fAtrasoBloq * 15).toFixed(1) },
    { fator: "Produtividade recente", peso: 10, contrib: +(fProdSem * 10).toFixed(1) },
    { fator: "Falta de responsável/material", peso: 10, contrib: +(fGestao * 10).toFixed(1) },
  ].sort((a, b) => b.contrib - a.contrib);

  // --- confiabilidade ---
  const semValor = enriquecidas.filter((a) => !a.valor).length;
  const semPrazo = enriquecidas.filter((a) => !a.data_prevista_fim).length;
  const semResp = enriquecidas.filter((a) => !a.responsavel_nome).length;
  const totalGap = semValor + semPrazo + semResp;
  let confiabilidade: Confiabilidade = "alta";
  if (totalGap > totalCount) confiabilidade = "baixa";
  else if (totalGap > totalCount * 0.4) confiabilidade = "media";
  const gaps_dados: { campo: string; qtd: number }[] = [
    { campo: "Atividades sem valor", qtd: semValor },
    { campo: "Atividades sem prazo de conclusão", qtd: semPrazo },
    { campo: "Atividades sem responsável", qtd: semResp },
    { campo: "Atividades sem etapa", qtd: enriquecidas.filter((a) => !a.etapa).length },
  ].filter((g) => g.qtd > 0);

  // --- diagnóstico estruturado ---
  const principalEtapa = etapas.find((e) => e.situacao === "atrasada" || e.situacao === "bloqueada") || etapas[0];
  const diagnostico = {
    situacao: prazo_consumido != null && desvio != null
      ? `Prazo consumido de ${prazo_consumido.toFixed(2)}%, avanço ponderado de ${avanco.toFixed(2)}%, desvio de ${desvio.toFixed(2)} pontos percentuais. Risco ${risco_nivel.replace("_", " ")}.`
      : `Avanço ponderado de ${avanco.toFixed(2)}%. Datas de contrato não informadas.`,
    causa: principalEtapa
      ? `Principal impacto concentrado na etapa "${principalEtapa.etapa}" (R$ ${principalEtapa.saldo.toFixed(2)} pendentes, ${principalEtapa.atrasadas} atividade(s) atrasada(s)).`
      : "Sem etapa dominante identificada.",
    consequencia: proj_acumulado.data
      ? `Mantido o ritmo atual, conclusão projetada para ${proj_acumulado.data} (${proj_acumulado.atraso_dias && proj_acumulado.atraso_dias > 0 ? `${proj_acumulado.atraso_dias} dias após o vencimento` : "dentro do prazo"}).`
      : "Não foi possível projetar a conclusão com os dados atuais.",
    recuperacao: fator_aceleracao != null
      ? fator_aceleracao <= 1
        ? "Ritmo atual já é suficiente para concluir no prazo, mantendo as frentes ativas."
        : `Recuperação possível desde que a produção aumente aproximadamente ${fator_aceleracao.toFixed(2)} vezes o ritmo médio realizado e os bloqueios sejam resolvidos.`
      : "Sem dados para estimar recuperação.",
    decisao: criticas.length
      ? `Decidir agora sobre as ${Math.min(3, criticas.length)} atividade(s) de maior impacto: ${criticas.slice(0, 3).map((c) => c.descricao).join("; ")}.`
      : "Sem decisões críticas imediatas.",
  };

  // --- decisões necessárias agora (até 7) ---
  type Decisao = {
    problema: string; impacto: string; decisao: string; responsavel: string;
    prazo: string; resultado_esperado: string; situacao: "aberta" | "andamento";
  };
  const decisoes: Decisao[] = criticas.slice(0, 7).map((c) => ({
    problema: c.descricao + (c.dias_atraso ? ` (atrasada ${c.dias_atraso}d)` : ""),
    impacto: c.motivos[0] ?? `R$ ${c.valor_pendente.toFixed(2)} pendente`,
    decisao: c.acao_recomendada,
    responsavel: c.responsavel_nome ?? "Responsável não definido",
    prazo: c.impact_nivel === "critica" ? "48 horas" : "7 dias",
    resultado_esperado: c.impedimento ? "Liberação da frente" : (c.status === "nao_iniciada" ? "Início da atividade" : "Avanço significativo"),
    situacao: c.status === "em_andamento" ? "andamento" : "aberta",
  }));

  // --- plano de ação ---
  type Acao = {
    prioridade: "critica" | "alta" | "media";
    acao: string; atividade: string; responsavel: string; prazo: string; impacto: string; status: string;
  };
  const plano_acao: Acao[] = enriquecidas
    .filter((a) => a.impact_nivel === "critica" || a.impact_nivel === "alta" || !a.responsavel_nome)
    .slice(0, 20)
    .map((a) => ({
      prioridade: a.impact_nivel === "critica" ? "critica" : a.impact_nivel === "alta" ? "alta" : "media",
      acao: a.responsavel_nome ? a.acao_recomendada : `Definir responsável pela atividade.`,
      atividade: a.descricao,
      responsavel: a.responsavel_nome ?? "Responsável não definido",
      prazo: a.data_prevista_fim ?? "—",
      impacto: a.motivos[0] ?? "—",
      status: a.status,
    }));

  // --- tendência hoje x ontem / 7d / análise anterior ---
  const snapHoje = snapsOrdenados[snapsOrdenados.length - 1];
  const snapOntem = [...snapsOrdenados].reverse().find((s) => s.data_snapshot < isoToday());
  const snap7d = [...snapsOrdenados].reverse().find((s) => s.data_snapshot <= fmtISO(addDays(hoje, -7)));
  function compareSnap(prev: SnapshotRaw | undefined, label: string) {
    if (!prev) return null;
    return {
      referencia: label,
      data: prev.data_snapshot,
      delta_avanco: +(avanco - Number(prev.avanco)).toFixed(2),
      delta_risco_score: snapHoje ? +(score - (Number((snapHoje.payload as { score?: number } | null)?.score ?? 0))).toFixed(1) : null,
      risco_anterior: prev.risco,
      delta_fator: prev.fator_aceleracao != null && fator_aceleracao != null
        ? +(fator_aceleracao - Number(prev.fator_aceleracao)).toFixed(2) : null,
      delta_criticas: criticas.length - prev.num_criticas,
    };
  }
  const tendencia = {
    ontem: compareSnap(snapOntem, "Ontem"),
    sete_dias: compareSnap(snap7d, "7 dias atrás"),
    analise_anterior: compareSnap(snapsOrdenados[snapsOrdenados.length - 2], "Análise anterior"),
  };

  // --- alertas inteligentes ---
  const alertas: { tipo: string; mensagem: string; severidade: "alta" | "media" | "baixa" }[] = [];
  if (fator_aceleracao != null && fator_aceleracao > 2) alertas.push({ tipo: "aceleracao", mensagem: `Fator de aceleração ${fator_aceleracao.toFixed(2)}x — situação crítica`, severidade: "alta" });
  if (alerta_duas_semanas) alertas.push({ tipo: "produtividade", mensagem: "Duas semanas consecutivas abaixo da meta", severidade: "alta" });
  for (const c of criticas.filter((x) => !x.responsavel_nome).slice(0, 3))
    alertas.push({ tipo: "responsavel", mensagem: `Atividade crítica sem responsável: ${c.descricao}`, severidade: "alta" });
  for (const a of nao_iniciadas.filter((x) => (Number(x.valor) || 0) > totalValor * 0.05).slice(0, 3))
    alertas.push({ tipo: "valor_zero", mensagem: `R$ ${(Number(a.valor) || 0).toFixed(0)} parados em 0%: ${a.descricao}`, severidade: "media" });
  for (const a of atrasadas.slice(0, 3))
    alertas.push({ tipo: "atraso", mensagem: `Prazo vencido: ${a.descricao} (${a.dias_atraso}d)`, severidade: "alta" });
  for (const b of bloqueios.slice(0, 3))
    alertas.push({ tipo: "bloqueio", mensagem: `${b.bloqueadora} bloqueia ${b.bloqueadas.join(", ")}`, severidade: "alta" });

  // --- frase-resultado (bloco 21) ---
  const frase_resultado = (() => {
    const partes: string[] = [];
    if (atrasadas.length) {
      partes.push(`Existem ${atrasadas.length} atividade(s) atrasada(s), que representam R$ ${valor_atrasadas.toFixed(2)} e ${totalValor ? ((valor_atrasadas / totalValor) * 100).toFixed(2) : "0"}% do contrato.`);
    }
    if (bloqueios.length) {
      partes.push(`${bloqueios.length} frente(s) bloqueia(m) outras ${num_bloqueadas} atividade(s) (R$ ${valor_bloqueado.toFixed(2)} em risco).`);
    }
    const top = criticas[0];
    if (top) {
      partes.push(`O maior impacto está em "${top.descricao}", com R$ ${top.valor_pendente.toFixed(2)} pendentes.`);
      partes.push(`Decisão prioritária: ${top.acao_recomendada}`);
    }
    return partes.join(" ");
  })();

  // ============================================================
  // ===== NOVOS BLOCOS (Fase 1) ================================
  // ============================================================

  // --- baseline planejada (avanço planejado por integração diária) ---
  // Cada atividade contribui com pct_planejado linear entre data_prevista_inicio
  // e data_prevista_fim. Atividades sem datas planejadas são marcadas como
  // "não previstas" e não entram no avanço planejado (entram só no contador
  // de gaps).
  function pctPlanejadoAt(a: AtividadeRaw, ref: Date): number | null {
    const pi = parseDate(a.data_prevista_inicio);
    const pf = parseDate(a.data_prevista_fim);
    if (!pi || !pf) return null;
    if (ref.getTime() <= pi.getTime()) return 0;
    if (ref.getTime() >= pf.getTime()) return 100;
    const dur = Math.max(1, diffDays(pf, pi));
    const passou = diffDays(ref, pi);
    return Math.min(100, Math.max(0, (passou / dur) * 100));
  }
  const planejadosPorAt = ativ.map((a) => pctPlanejadoAt(a, hoje));
  const ativComBaseline = planejadosPorAt.filter((p) => p != null).length;
  let avanco_planejado: number | null = null;
  if (ativComBaseline > 0) {
    const num = ativ.reduce((s, a, idx) => {
      const p = planejadosPorAt[idx];
      if (p == null) return s;
      const peso = usaValor ? Number(a.valor) || 0 : usaPeso ? Number(a.peso) || 0 : 1;
      return s + peso * (p / 100);
    }, 0);
    const den = (() => {
      const dd = ativ.reduce((s, a, idx) => {
        if (planejadosPorAt[idx] == null) return s;
        return s + (usaValor ? Number(a.valor) || 0 : usaPeso ? Number(a.peso) || 0 : 1);
      }, 0);
      return dd > 0 ? dd : 1;
    })();
    avanco_planejado = +((num / den) * 100).toFixed(2);
  }

  // SPI real (não confundir com índice linear, que continua em `idp`).
  const spi = avanco_planejado != null && avanco_planejado > 0
    ? +(avanco / avanco_planejado).toFixed(3)
    : null;
  type SpiClasse = "no_prazo" | "atencao" | "atraso_relevante" | "atraso_critico" | "nao_previsto";
  const spi_classe: SpiClasse = (() => {
    if (avanco_planejado == null) return "nao_previsto";
    if (avanco_planejado === 0) return "nao_previsto";
    if (spi == null) return "nao_previsto";
    if (spi >= 1.0) return "no_prazo";
    if (spi >= 0.95) return "atencao";
    if (spi >= 0.85) return "atraso_relevante";
    return "atraso_critico";
  })();
  const desvio_planejado = avanco_planejado != null
    ? +(avanco - avanco_planejado).toFixed(2)
    : null;

  // --- cobertura de dados ---
  const sem_valor = ativ.filter((a) => !(Number(a.valor) > 0)).length;
  const sem_peso = ativ.filter((a) => !(Number(a.peso) > 0)).length;
  const sem_planej_inicio = ativ.filter((a) => !a.data_prevista_inicio).length;
  const sem_planej_fim = ativ.filter((a) => !a.data_prevista_fim).length;
  const sem_responsavel = ativ.filter((a) => !a.responsavel_nome).length;
  const sem_etapa = ativ.filter((a) => !a.etapa).length;
  const cobertura_valor = totalCount > 0 ? +((1 - sem_valor / totalCount) * 100).toFixed(1) : 0;
  const cobertura_peso = totalCount > 0 ? +((1 - sem_peso / totalCount) * 100).toFixed(1) : 0;
  const cobertura_planejamento = totalCount > 0
    ? +((1 - Math.max(sem_planej_inicio, sem_planej_fim) / totalCount) * 100).toFixed(1)
    : 0;
  const dados_insuficientes_valor = cobertura_valor < 100 && cobertura_peso < 100;
  // Confiança 0–100 (média ponderada das coberturas)
  const confianca_dados = +(
    cobertura_valor * 0.35 +
    cobertura_planejamento * 0.35 +
    (totalCount > 0 ? (1 - sem_responsavel / totalCount) * 100 : 0) * 0.2 +
    Math.min(100, snapshots.length * 10) * 0.1
  ).toFixed(0);

  // --- financeiro estendido ---
  const valor_contratado_original = Number(obra.valor_contratado) || 0;
  const valor_aditivos = Number(financeiros?.valor_aditivos) || 0;
  const valor_supressoes = Number(financeiros?.valor_supressoes) || 0;
  const valor_vigente = valor_contratado_original + valor_aditivos - valor_supressoes;
  const valor_medido = Number(financeiros?.valor_medido) || 0;
  const valor_pago = Number(financeiros?.valor_pago) || 0;
  const valor_agregado_producao = valor_executado; // produção a preço de contrato
  const valor_executado_nao_medido = Math.max(0, valor_agregado_producao - valor_medido);
  const valor_medido_nao_recebido = Math.max(0, valor_medido - valor_pago);
  const divergencia_contrato_atividades = +(valor_vigente - totalValor).toFixed(2);
  const pct_cobertura_contrato = valor_vigente > 0
    ? +((totalValor / valor_vigente) * 100).toFixed(2)
    : null;

  // --- riscos por dimensão (0–100) ---
  // Cada dimensão usa fatores já calculados, sem somar o mesmo problema 2x.
  function clamp(x: number, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, x)); }
  const risco_prazo = (() => {
    let s = 0;
    if (spi != null && spi < 1) s += clamp((1 - spi) * 100, 0, 50);
    else if (desvio != null && desvio < 0) s += clamp(Math.abs(desvio) * 1.5, 0, 50);
    if (proj_acumulado.atraso_dias != null && proj_acumulado.atraso_dias > 0) {
      s += clamp(proj_acumulado.atraso_dias / 2, 0, 30);
    }
    if (fator_aceleracao != null && fator_aceleracao > 1) {
      s += clamp((fator_aceleracao - 1) * 20, 0, 20);
    }
    return Math.round(clamp(s));
  })();
  const risco_operacional = (() => {
    let s = 0;
    if (desempenho_semanal != null) s += clamp(100 - desempenho_semanal, 0, 35);
    if (frentes.length) {
      const mediaPront = frentes.reduce((acc, f) => acc + f.pct, 0) / frentes.length;
      s += clamp((100 - mediaPront) * 0.35, 0, 35);
    }
    if (totalCount > 0) {
      const pctImped = enriquecidas.filter((a) => a.impedimento).length / totalCount;
      s += clamp(pctImped * 100 * 0.3, 0, 30);
    }
    return Math.round(clamp(s));
  })();
  const risco_financeiro = (() => {
    let s = 0;
    if (valor_vigente > 0) {
      s += clamp((valor_executado_nao_medido / valor_vigente) * 200, 0, 35);
      s += clamp((valor_medido_nao_recebido / valor_vigente) * 200, 0, 25);
    }
    if (totalValor > 0) {
      s += clamp((valor_criticas / totalValor) * 100, 0, 25);
    }
    if (Math.abs(divergencia_contrato_atividades) > Math.max(1, valor_vigente * 0.05)) {
      s += 15;
    }
    return Math.round(clamp(s));
  })();
  const risco_gerencial = (() => {
    let s = 0;
    if (totalCount > 0) {
      s += clamp((sem_responsavel / totalCount) * 100 * 0.4, 0, 40);
      s += clamp((sem_planej_fim / totalCount) * 100 * 0.3, 0, 30);
      s += clamp((sem_valor / totalCount) * 100 * 0.3, 0, 30);
    }
    return Math.round(clamp(s));
  })();
  const risco_consolidado = Math.round(
    risco_prazo * 0.35 + risco_operacional * 0.25 + risco_financeiro * 0.25 + risco_gerencial * 0.15,
  );

  // ============================================================
  return {
    obra_id: obra.id,
    obra_nome: obra.nome,
    data_referencia: isoToday(),
    metodo_avanco,

    indicadores: {
      prazo_consumido,
      avanco,
      desvio,
      idp,
      idp_classe: classIDP(idp),
      desvio_classe: desvio != null ? classDesvio(desvio) : null,
      dias_decorridos: diasDecorridos,
      dias_restantes: diasRestantes,
      prazo_total: prazoTotal,
      data_inicio: obra.data_inicio,
      data_fim_prevista: obra.data_fim_prevista,
      valor_contratado: obra.valor_contratado,
      valor_total: totalValor,
      valor_executado,
      saldo_executar,
    },
    ritmo: {
      acumulado: ritmo_acumulado,
      ultimos_7d: ritmo_7d,
      ultimos_15d: ritmo_15d,
      necessario: ritmo_necessario,
      producao_financ_dia,
      meta_semanal_pct,
      meta_semanal_valor,
      fator_aceleracao,
      fator_classe: classAceleracao(fator_aceleracao),
      frase: ritmo_acumulado && fator_aceleracao
        ? `A obra precisa produzir aproximadamente ${fator_aceleracao.toFixed(2)} vezes o ritmo médio registrado até agora.`
        : null,
    },
    projecao: {
      acumulado: proj_acumulado,
      recente: proj_recente,
      tendencia_recente,
    },
    atividades: enriquecidas,
    criticas,
    exposicao: {
      valor_nao_iniciadas, valor_atrasadas, valor_criticas,
      pct_contrato_zero, pct_top5,
      top5: top5_pendentes.map((a) => ({ descricao: a.descricao, valor_pendente: a.valor_pendente })),
    },
    etapas,
    bloqueios,
    num_bloqueadas, valor_bloqueado,
    frentes,
    produtividade: {
      avanco_7d, meta_semanal, desempenho_semanal,
      alerta_duas_semanas,
    },
    metas,
    cenarios,
    risco: { score, nivel: risco_nivel, fatores: risco_fatores },
    confiabilidade,
    gaps_dados,
    diagnostico,
    decisoes,
    plano_acao,
    tendencia,
    alertas,
    frase_resultado,
    // ===== novos (Fase 1) =====
    planejamento: {
      avanco_planejado,
      desvio_planejado,
      spi,
      spi_classe,
      atividades_com_baseline: ativComBaseline,
      atividades_sem_baseline: totalCount - ativComBaseline,
    },
    cobertura_dados: {
      total_atividades: totalCount,
      sem_valor,
      sem_peso,
      sem_planejamento_inicio: sem_planej_inicio,
      sem_planejamento_fim: sem_planej_fim,
      sem_responsavel,
      sem_etapa,
      cobertura_valor_pct: cobertura_valor,
      cobertura_peso_pct: cobertura_peso,
      cobertura_planejamento_pct: cobertura_planejamento,
      dados_insuficientes_avanco_valor: dados_insuficientes_valor,
      confianca: confianca_dados,
    },
    financeiro: {
      valor_contratado_original,
      valor_aditivos,
      valor_supressoes,
      valor_vigente,
      valor_total_atividades: totalValor,
      divergencia_contrato_atividades,
      pct_cobertura_contrato,
      valor_agregado_producao,
      valor_medido,
      valor_executado_nao_medido,
      valor_pago,
      valor_medido_nao_recebido,
      saldo_contratual: Math.max(0, valor_vigente - valor_pago),
      potencial_proxima_medicao: valor_executado_nao_medido,
    },
    riscos_dimensoes: {
      prazo: risco_prazo,
      operacional: risco_operacional,
      financeiro: risco_financeiro,
      gerencial: risco_gerencial,
      consolidado: risco_consolidado,
      confianca: confianca_dados,
    },
  };
}
