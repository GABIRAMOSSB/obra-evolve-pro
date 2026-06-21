/**
 * Engine de cálculo da Análise Gerencial da Obra.
 *
 * Pura — sem I/O — para facilitar testes e reuso entre server functions
 * e snapshots de cron.
 */

export type AtividadeInput = {
  id: string;
  item_codigo: string;
  descricao: string;
  etapa: string | null;
  valor: number;
  peso: number;
  quantidade: number;
  percentual_concluido: number;
  status: "nao_iniciada" | "em_andamento" | "concluida" | "paralisada";
  data_prevista_inicio: string | null;
  data_prevista_fim: string | null;
  data_real_inicio: string | null;
  data_real_fim: string | null;
  responsavel_nome: string | null;
  prioridade: "baixa" | "media" | "alta" | "critica";
  impedimento: string | null;
  is_group?: boolean;
};

export type ObraInput = {
  id: string;
  nome: string;
  data_inicio: string | null; // ISO date
  data_fim_prevista: string | null;
  valor_contratado: number | null;
};

export type Confiabilidade = "alta" | "media" | "baixa";
export type Risco = "baixo" | "moderado" | "alto" | "critico";

export type AtividadeCritica = AtividadeInput & {
  motivo: string;
  acao_recomendada: string;
  dias_atraso: number;
  valor_executado: number;
  valor_pendente: number;
};

export type AcaoRecomendada = {
  acao: string;
  atividade?: string;
  motivo: string;
  responsavel?: string | null;
  prazo_recomendado: string;
  prioridade: "baixa" | "media" | "alta" | "critica";
  impacto: string;
};

export type PlanoRecuperacao = {
  meta_7_dias: number;
  meta_15_dias: number;
  meta_30_dias: number;
  atividades_iniciar_imediato: string[];
  atividades_paralelo: string[];
  impedimentos_resolver: string[];
} | null;

export type AnaliseResult = {
  obra: { id: string; nome: string };
  gerado_em: string;
  confiabilidade: Confiabilidade;
  metodo_avanco: "financeiro" | "fisico" | "media_simples";
  indicadores: {
    avanco: number;
    prazo_consumido: number | null;
    desvio: number | null;
    dias_decorridos: number | null;
    dias_restantes: number | null;
    dias_atraso: number;
    ritmo_atual: number | null;
    ritmo_necessario: number | null;
    fator_aceleracao: number | null;
    valor_total: number;
    valor_executado: number;
    saldo_executar: number;
    producao_dia_realizada: number | null;
    producao_dia_necessaria: number | null;
    meta_semanal: number | null;
    data_projetada: string | null;
    dias_atraso_projetado: number | null;
  };
  risco: { nivel: Risco; faixa_min: number; faixa_max: number };
  criticas: AtividadeCritica[];
  acoes: AcaoRecomendada[];
  plano: PlanoRecuperacao;
  diagnostico: string;
  avisos: string[];
};

const TODAY = () => new Date().toISOString().slice(0, 10);

function diffDays(a: string, b: string): number {
  const da = new Date(a + "T00:00:00Z").getTime();
  const db = new Date(b + "T00:00:00Z").getTime();
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtPct(n: number, dec = 2): string {
  return `${n.toFixed(dec)}%`;
}

export function calcularAnalise(
  obra: ObraInput,
  atividadesRaw: AtividadeInput[],
  hojeISO: string = TODAY(),
): AnaliseResult {
  const avisos: string[] = [];
  const atividades = atividadesRaw.filter((a) => !a.is_group);

  // --- Confiabilidade & avanço ---
  const somaValores = atividades.reduce((s, a) => s + (Number(a.valor) || 0), 0);
  const somaPesos = atividades.reduce((s, a) => s + (Number(a.peso) || 0), 0);

  let metodo: "financeiro" | "fisico" | "media_simples";
  let confiabilidade: Confiabilidade;
  let avanco = 0;
  let valorExecutado = 0;
  const valorTotal = somaValores;

  if (somaValores > 0) {
    metodo = "financeiro";
    confiabilidade = "alta";
    for (const a of atividades) {
      valorExecutado += (Number(a.valor) || 0) * (Number(a.percentual_concluido) || 0) / 100;
    }
    avanco = (valorExecutado / somaValores) * 100;
  } else if (somaPesos > 0) {
    metodo = "fisico";
    confiabilidade = "media";
    let exec = 0;
    for (const a of atividades) {
      exec += (Number(a.peso) || 0) * (Number(a.percentual_concluido) || 0) / 100;
    }
    avanco = (exec / somaPesos) * 100;
    avisos.push("Avanço calculado por peso físico (sem valor financeiro nas atividades).");
  } else {
    metodo = "media_simples";
    confiabilidade = "baixa";
    if (atividades.length > 0) {
      avanco = atividades.reduce((s, a) => s + (Number(a.percentual_concluido) || 0), 0) / atividades.length;
    }
    avisos.push("Avanço estimado com baixa confiabilidade — atividades sem peso financeiro ou físico definido.");
  }
  avanco = Math.max(0, Math.min(100, avanco));
  const saldoExecutar = Math.max(0, valorTotal - valorExecutado);

  // --- Prazo ---
  let prazoConsumido: number | null = null;
  let diasDecorridos: number | null = null;
  let diasRestantes: number | null = null;
  let diasAtraso = 0;
  let prazoTotal: number | null = null;

  if (obra.data_inicio && obra.data_fim_prevista) {
    prazoTotal = diffDays(obra.data_inicio, obra.data_fim_prevista);
    diasDecorridos = diffDays(obra.data_inicio, hojeISO);
    diasRestantes = diffDays(hojeISO, obra.data_fim_prevista);
    if (prazoTotal > 0 && diasDecorridos >= 0) {
      prazoConsumido = Math.min(200, (diasDecorridos / prazoTotal) * 100);
    }
    if (diasRestantes < 0) {
      diasAtraso = -diasRestantes;
      diasRestantes = 0;
    }
  } else {
    avisos.push("Datas da obra ausentes — preencha data de início e previsão de conclusão para indicadores de prazo.");
  }

  const desvio = prazoConsumido !== null ? avanco - prazoConsumido : null;

  // --- Ritmo ---
  let ritmoAtual: number | null = null;
  let ritmoNecessario: number | null = null;
  let fator: number | null = null;
  let prodDiaReal: number | null = null;
  let prodDiaNec: number | null = null;
  let metaSemanal: number | null = null;

  if (diasDecorridos !== null && diasDecorridos > 0) {
    ritmoAtual = avanco / diasDecorridos;
    if (valorExecutado > 0) prodDiaReal = valorExecutado / diasDecorridos;
  }
  const restantePct = 100 - avanco;
  if (diasRestantes !== null && diasRestantes > 0) {
    ritmoNecessario = restantePct / diasRestantes;
    if (saldoExecutar > 0) {
      prodDiaNec = saldoExecutar / diasRestantes;
      metaSemanal = prodDiaNec * 7;
    }
  } else if (diasRestantes === 0 && restantePct > 0) {
    ritmoNecessario = Infinity;
  }
  if (ritmoAtual !== null && ritmoNecessario !== null && ritmoAtual > 0 && Number.isFinite(ritmoNecessario)) {
    fator = ritmoNecessario / ritmoAtual;
  } else if (ritmoNecessario !== null && !Number.isFinite(ritmoNecessario)) {
    fator = Infinity;
  }

  // --- Projeção ---
  let dataProjetada: string | null = null;
  let diasAtrasoProjetado: number | null = null;
  if (avanco > 0 && diasDecorridos !== null && diasDecorridos > 0 && obra.data_inicio) {
    const diasTotaisProjetados = diasDecorridos / (avanco / 100);
    dataProjetada = addDays(obra.data_inicio, Math.round(diasTotaisProjetados));
    if (obra.data_fim_prevista) {
      diasAtrasoProjetado = diffDays(obra.data_fim_prevista, dataProjetada);
    }
  }

  // --- Atividades críticas ---
  const criticas: AtividadeCritica[] = [];
  for (const a of atividades) {
    const motivos: string[] = [];
    let acao = "";
    const pct = Number(a.percentual_concluido) || 0;
    let atrasoAtiv = 0;

    if (a.data_prevista_fim && pct < 100) {
      const at = diffDays(a.data_prevista_fim, hojeISO);
      if (at > 0) {
        atrasoAtiv = at;
        motivos.push(`prazo vencido há ${at} dia(s)`);
        acao = "Reforçar equipe e replanejar entrega";
      }
    }
    if (a.prioridade === "alta" || a.prioridade === "critica") {
      motivos.push(`prioridade ${a.prioridade}`);
    }
    if (a.impedimento && a.impedimento.trim()) {
      motivos.push("impedimento registrado");
      acao = acao || "Resolver impedimento registrado";
    }
    if (!a.responsavel_nome) {
      motivos.push("sem responsável definido");
      acao = acao || "Definir responsável imediatamente";
    }
    if (a.data_prevista_inicio && pct === 0) {
      const deveriaTer = diffDays(a.data_prevista_inicio, hojeISO);
      if (deveriaTer > 0) {
        motivos.push("deveria ter iniciado e está em 0%");
        acao = acao || "Iniciar atividade imediatamente";
      }
    }
    if (a.data_prevista_fim && pct < 100 && pct > 0) {
      const restanteAtiv = diffDays(hojeISO, a.data_prevista_fim);
      if (restanteAtiv >= 0 && restanteAtiv <= 7 && pct < 70) {
        motivos.push(`vence em ${restanteAtiv} dia(s) com avanço insuficiente`);
        acao = acao || "Acelerar para concluir no prazo";
      }
    }
    const valorRelevante = somaValores > 0 && (Number(a.valor) || 0) >= somaValores * 0.1;
    if (valorRelevante && pct < 100) motivos.push("valor relevante do contrato");

    if (motivos.length === 0) continue;

    const valExec = (Number(a.valor) || 0) * pct / 100;
    criticas.push({
      ...a,
      motivo: motivos.join("; "),
      acao_recomendada: acao || "Acompanhar de perto",
      dias_atraso: atrasoAtiv,
      valor_executado: valExec,
      valor_pendente: (Number(a.valor) || 0) - valExec,
    });
  }
  criticas.sort((x, y) => (y.valor_pendente - x.valor_pendente) || (y.dias_atraso - x.dias_atraso));

  // --- Classificação de risco ---
  const numCriticasRelevantes = criticas.filter((c) => c.dias_atraso > 0 || c.prioridade === "critica" || c.impedimento).length;
  let nivelRisco: Risco = "baixo";
  let faixaMin = 10, faixaMax = 25;
  const desvioCheck = desvio ?? 0;
  const fatorCheck = fator ?? 1;

  if (desvioCheck < -20 || fatorCheck > 2.2 || numCriticasRelevantes >= 5) {
    nivelRisco = "critico"; faixaMin = 75; faixaMax = 90;
  } else if (desvioCheck < -10 || fatorCheck > 1.6 || numCriticasRelevantes >= 3) {
    nivelRisco = "alto"; faixaMin = 45; faixaMax = 75;
  } else if (desvioCheck < -5 || fatorCheck > 1.3 || numCriticasRelevantes >= 1) {
    nivelRisco = "moderado"; faixaMin = 25; faixaMax = 45;
  }

  // --- Ações recomendadas (até 5) ---
  const acoes: AcaoRecomendada[] = [];
  for (const c of criticas.slice(0, 5)) {
    acoes.push({
      acao: c.acao_recomendada,
      atividade: c.descricao,
      motivo: c.motivo,
      responsavel: c.responsavel_nome,
      prazo_recomendado: c.dias_atraso > 0 ? "Imediato" : "Próximos 7 dias",
      prioridade: c.prioridade === "baixa" ? "media" : c.prioridade,
      impacto: c.valor_pendente > 0
        ? `Liberar R$ ${c.valor_pendente.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`
        : "Reduz risco de atraso",
    });
  }

  // --- Plano de recuperação (só para risco alto/crítico) ---
  let plano: PlanoRecuperacao = null;
  if ((nivelRisco === "alto" || nivelRisco === "critico") && ritmoNecessario !== null && Number.isFinite(ritmoNecessario)) {
    plano = {
      meta_7_dias: +(ritmoNecessario * 7).toFixed(2),
      meta_15_dias: +(ritmoNecessario * 15).toFixed(2),
      meta_30_dias: +(ritmoNecessario * 30).toFixed(2),
      atividades_iniciar_imediato: criticas
        .filter((c) => (Number(c.percentual_concluido) || 0) === 0)
        .slice(0, 5)
        .map((c) => c.descricao),
      atividades_paralelo: criticas
        .filter((c) => (Number(c.percentual_concluido) || 0) > 0 && (Number(c.percentual_concluido) || 0) < 100)
        .slice(0, 5)
        .map((c) => c.descricao),
      impedimentos_resolver: criticas
        .filter((c) => c.impedimento)
        .slice(0, 5)
        .map((c) => `${c.descricao}: ${c.impedimento}`),
    };
  }

  // --- Diagnóstico ---
  const dataHoje = new Date(hojeISO).toLocaleDateString("pt-BR");
  const partes: string[] = [];
  partes.push(
    `Com base nos registros atualizados até ${dataHoje}, a obra apresenta risco ${nivelRisco.toUpperCase()} de atraso, ` +
      `com faixa estimada entre ${faixaMin}% e ${faixaMax}%.`,
  );
  if (prazoConsumido !== null) {
    partes.push(
      `Foram consumidos ${fmtPct(prazoConsumido)} do prazo contratual, enquanto o avanço calculado pelas atividades atingiu ${fmtPct(avanco)}.`,
    );
  } else {
    partes.push(`O avanço calculado pelas atividades atingiu ${fmtPct(avanco)}. Sem datas da obra cadastradas, não é possível comparar com o prazo.`);
  }
  if (desvio !== null) {
    partes.push(`O desvio atual é de ${desvio >= 0 ? "+" : ""}${desvio.toFixed(2)} pontos percentuais.`);
  }
  if (fator !== null && Number.isFinite(fator) && diasRestantes !== null) {
    partes.push(
      `Para concluir nos ${diasRestantes} dia(s) restantes, será necessário um ritmo aproximadamente ${fator.toFixed(2)} vez(es) maior que o ritmo médio acumulado.`,
    );
  }
  if (criticas.length > 0) {
    partes.push(`Principais frentes que exigem decisão: ${criticas.slice(0, 3).map((c) => c.descricao).join("; ")}.`);
  }
  const recuperavel = nivelRisco !== "critico" || (fator !== null && Number.isFinite(fator) && fator < 3);
  partes.push(`A situação ${recuperavel ? "é" : "exige medidas extraordinárias para ser"} recuperável, desde que as ações recomendadas sejam executadas.`);
  const diagnostico = partes.join(" ");

  return {
    obra: { id: obra.id, nome: obra.nome },
    gerado_em: new Date().toISOString(),
    confiabilidade,
    metodo_avanco: metodo,
    indicadores: {
      avanco: +avanco.toFixed(3),
      prazo_consumido: prazoConsumido !== null ? +prazoConsumido.toFixed(3) : null,
      desvio: desvio !== null ? +desvio.toFixed(3) : null,
      dias_decorridos: diasDecorridos,
      dias_restantes: diasRestantes,
      dias_atraso: diasAtraso,
      ritmo_atual: ritmoAtual !== null ? +ritmoAtual.toFixed(5) : null,
      ritmo_necessario: ritmoNecessario !== null && Number.isFinite(ritmoNecessario) ? +ritmoNecessario.toFixed(5) : null,
      fator_aceleracao: fator !== null && Number.isFinite(fator) ? +fator.toFixed(4) : null,
      valor_total: +valorTotal.toFixed(2),
      valor_executado: +valorExecutado.toFixed(2),
      saldo_executar: +saldoExecutar.toFixed(2),
      producao_dia_realizada: prodDiaReal !== null ? +prodDiaReal.toFixed(2) : null,
      producao_dia_necessaria: prodDiaNec !== null ? +prodDiaNec.toFixed(2) : null,
      meta_semanal: metaSemanal !== null ? +metaSemanal.toFixed(2) : null,
      data_projetada: dataProjetada,
      dias_atraso_projetado: diasAtrasoProjetado,
    },
    risco: { nivel: nivelRisco, faixa_min: faixaMin, faixa_max: faixaMax },
    criticas: criticas.slice(0, 50),
    acoes,
    plano,
    diagnostico,
    avisos,
  };
}
