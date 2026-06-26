/**
 * Server function da Análise Gerencial V2.
 *
 * Estritamente read-only sobre obra_atividades. Persiste apenas snapshot
 * diário em obra_analise_snapshots via upsert (idempotente).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularAnaliseV2, type AtividadeRaw, type ObraRaw, type SnapshotRaw } from "./analise-v2.engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function resolveCompany(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  return data.company_id as string;
}

type EvolInfo = { somaQtd: number; dataInicio: string | null; dataFim: string | null };

async function loadEvolutionsMap(
  supabase: AnySupabase,
  companyId: string,
  legacyObraId: string,
): Promise<Map<string, EvolInfo>> {
  const map = new Map<string, EvolInfo>();
  try {
    const { data: ws } = await supabase
      .from("company_workspaces")
      .select("workspace")
      .eq("company_id", companyId)
      .maybeSingle();
    const obras = (ws?.workspace?.obras ?? []) as Array<{ id?: string; evolutions?: Record<string, { measurements?: Array<{ quantExec?: number; dataExec?: string; closed?: boolean }> }> }>;
    const obra = obras.find((o) => String(o?.id) === legacyObraId);
    const evolutions = obra?.evolutions ?? {};
    for (const [item, ev] of Object.entries(evolutions)) {
      const meas = ev?.measurements ?? [];
      if (!meas.length) continue;
      let soma = 0;
      let dMin: string | null = null;
      let dMax: string | null = null;
      for (const m of meas) {
        soma += Number(m?.quantExec) || 0;
        const d = m?.dataExec ?? null;
        if (d) {
          if (!dMin || d < dMin) dMin = d;
          if (!dMax || d > dMax) dMax = d;
        }
      }
      map.set(String(item), { somaQtd: soma, dataInicio: dMin, dataFim: dMax });
    }
  } catch {
    // ignora — apenas degrada para o que houver em obra_atividades
  }
  return map;
}

const schema = z.object({
  legacyObraId: z.string().min(1),
});

export const getAnaliseV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);

    // Resolve obra (READ-ONLY)
    const { data: obraRow, error: obraErr } = await supabase
      .from("obras")
      .select("id, nome, data_inicio, data_fim_prevista, valor_contratado")
      .eq("company_id", companyId)
      .eq("legacy_obra_id", data.legacyObraId)
      .maybeSingle();
    if (obraErr) throw new Error(obraErr.message);
    if (!obraRow) {
      return { initialized: false as const };
    }

    // READ-ONLY: atividades + snapshots
    const [ativRes, snapRes] = await Promise.all([
      supabase
        .from("obra_atividades")
        .select(
          "id, item_codigo, descricao, etapa, valor, peso, quantidade, percentual_concluido, status, " +
          "data_prevista_inicio, data_prevista_fim, data_real_inicio, data_real_fim, responsavel_nome, " +
          "prioridade, impedimento, is_group",
        )
        .eq("company_id", companyId)
        .eq("obra_id", obraRow.id)
        .order("ordem", { ascending: true }),
      supabase
        .from("obra_analise_snapshots")
        .select("data_snapshot, avanco, prazo_consumido, desvio, ritmo_atual, ritmo_necessario, fator_aceleracao, num_criticas, risco, valor_executado, payload")
        .eq("company_id", companyId)
        .eq("obra_id", obraRow.id)
        .order("data_snapshot", { ascending: false })
        .limit(60),
    ]);
    if (ativRes.error) throw new Error(ativRes.error.message);
    if (snapRes.error) throw new Error(snapRes.error.message);

    // Carrega evoluções/medições reais do workspace legado para sobrescrever
    // o percentual_concluido (que não é mantido em obra_atividades). READ-ONLY.
    const evolMap = await loadEvolutionsMap(supabase, companyId, data.legacyObraId);

    const atividadesMerged = ((ativRes.data ?? []) as Array<Record<string, unknown>>).map((a) => {
      const ev = evolMap.get(String(a.item_codigo));
      if (!ev) return a as unknown as AtividadeRaw;
      const qtd = Number(a.quantidade) || 0;
      const percent = qtd > 0 ? Math.min(100, (ev.somaQtd / qtd) * 100) : Number(a.percentual_concluido) || 0;
      const status = percent >= 99.999 ? "concluida" : percent > 0 ? "em_andamento" : (a.status ?? "nao_iniciada");
      return {
        ...a,
        percentual_concluido: +percent.toFixed(2),
        status,
        data_real_inicio: a.data_real_inicio ?? ev.dataInicio ?? null,
        data_real_fim: a.data_real_fim ?? (percent >= 99.999 ? ev.dataFim : null),
      } as unknown as AtividadeRaw;
    });

    const analise = calcularAnaliseV2(
      obraRow as unknown as ObraRaw,
      atividadesMerged,
      (snapRes.data ?? []) as unknown as SnapshotRaw[],
    );

    // Snapshot diário — upsert por (obra_id, data_snapshot). Nunca toca obra_atividades.
    try {
      await supabase.from("obra_analise_snapshots").upsert(
        {
          company_id: companyId,
          obra_id: obraRow.id,
          data_snapshot: analise.data_referencia,
          avanco: analise.indicadores.avanco,
          prazo_consumido: analise.indicadores.prazo_consumido,
          desvio: analise.indicadores.desvio,
          ritmo_atual: analise.ritmo.acumulado,
          ritmo_necessario: analise.ritmo.necessario,
          fator_aceleracao: analise.ritmo.fator_aceleracao,
          saldo_executar: analise.indicadores.saldo_executar,
          valor_executado: analise.indicadores.valor_executado,
          data_projetada: analise.projecao.acumulado.data,
          num_criticas: analise.criticas.length,
          risco: analise.risco.nivel === "muito_alto" ? "alto" : analise.risco.nivel,
          confiabilidade: analise.confiabilidade,
          payload: { v: 2, score: analise.risco.score, metodo: analise.metodo_avanco },
        },
        { onConflict: "obra_id,data_snapshot" },
      );
    } catch {
      // não bloqueia a resposta
    }

    return { initialized: true as const, analise };
  });

export type AnaliseV2Payload = Awaited<ReturnType<typeof getAnaliseV2>>;
