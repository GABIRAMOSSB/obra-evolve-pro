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
import { resolveCompany, loadEvolutionsMap } from "./analise-v2.helpers.server";



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

    // READ-ONLY: atividades + snapshots + aditivos + medições
    const [ativRes, snapRes, contratoRes, medRes] = await Promise.all([
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
      supabase
        .from("contratos")
        .select("id")
        .eq("company_id", companyId)
        .eq("obra_id", obraRow.id)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("medicoes")
        .select("valor_executado, status")
        .eq("company_id", companyId)
        .eq("obra_id", obraRow.id),
    ]);
    if (ativRes.error) throw new Error(ativRes.error.message);
    if (snapRes.error) throw new Error(snapRes.error.message);

    // aditivos do contrato (se houver contrato vinculado à obra)
    let valor_aditivos = 0;
    let valor_supressoes = 0;
    if (contratoRes?.data?.id) {
      const { data: adit } = await supabase
        .from("aditivos_contratuais")
        .select("tipo, valor_delta, status")
        .eq("company_id", companyId)
        .eq("contrato_id", contratoRes.data.id)
        .eq("status", "vigente");
      for (const a of adit ?? []) {
        const v = Number((a as { valor_delta: number }).valor_delta) || 0;
        if (v >= 0) valor_aditivos += v;
        else valor_supressoes += Math.abs(v);
      }
    }

    let valor_medido = 0;
    let valor_pago = 0;
    for (const m of (medRes.data ?? []) as Array<{ valor_executado: number; status: string }>) {
      const v = Number(m.valor_executado) || 0;
      if (m.status === "aprovada" || m.status === "paga") valor_medido += v;
      if (m.status === "paga") valor_pago += v;
    }

    // Carrega evoluções/medições reais do workspace legado para sobrescrever
    // o percentual_concluido (que não é mantido em obra_atividades). READ-ONLY.
    const evolMap = await loadEvolutionsMap(supabase, companyId, data.legacyObraId);

    const atividadesMerged = ((ativRes.data ?? []) as unknown as Array<Record<string, unknown>>).map((a) => {
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
      { valor_aditivos, valor_supressoes, valor_medido, valor_pago },
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
