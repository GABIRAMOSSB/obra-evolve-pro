/**
 * Server functions da Análise Gerencial da Obra.
 *
 * Sincroniza atividades vindas da planilha local com a tabela
 * `obra_atividades`, expõe edição pontual e calcula a análise gerencial
 * (indicadores, risco, ações, plano, tendência) num único payload.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calcularAnalise, type AtividadeInput, type ObraInput, type AnaliseResult } from "./analise-gerencial.server";

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

// --- Sincronização da planilha local -> banco -----------------------------
const rowSchema = z.object({
  item_codigo: z.string().min(1),
  descricao: z.string().default(""),
  etapa: z.string().nullable().optional(),
  unidade: z.string().nullable().optional(),
  quantidade: z.number().default(0),
  peso: z.number().default(0),
  valor: z.number().default(0),
  is_group: z.boolean().default(false),
  ordem: z.number().default(0),
  percentual_concluido: z.number().min(0).max(100).optional(),
});

const sincronizarSchema = z.object({
  obraId: z.string().uuid(),
  rows: z.array(rowSchema).max(5000),
  replaceMissing: z.boolean().default(false),
});

export const sincronizarAtividades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sincronizarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);

    // valida que a obra pertence à empresa
    const { data: obra, error: oErr } = await supabase
      .from("obras")
      .select("id")
      .eq("id", data.obraId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!obra) throw new Error("Obra não encontrada para esta empresa.");

    // upsert por (obra_id, item_codigo) — não sobrescreve campos manuais
    // como percentual, status, datas reais, responsável, prioridade, impedimento.
    const rows = data.rows.map((r) => ({
      company_id: companyId,
      obra_id: data.obraId,
      item_codigo: r.item_codigo,
      etapa: r.etapa ?? null,
      descricao: r.descricao || r.item_codigo,
      unidade: r.unidade ?? null,
      quantidade: r.quantidade,
      peso: r.peso,
      valor: r.valor,
      is_group: r.is_group,
      ordem: r.ordem,
      created_by: userId,
    }));

    if (rows.length === 0) return { upserted: 0 };

    // Estratégia: upsert (ignoreDuplicates=false) atualizando só metadados básicos.
    const { error } = await supabase
      .from("obra_atividades")
      .upsert(rows, { onConflict: "obra_id,item_codigo", ignoreDuplicates: false });
    if (error) throw new Error(error.message);

    return { upserted: rows.length };
  });

// --- Atualização pontual ---------------------------------------------------
const patchSchema = z.object({
  id: z.string().uuid(),
  patch: z
    .object({
      percentual_concluido: z.number().min(0).max(100).optional(),
      status: z.enum(["nao_iniciada", "em_andamento", "concluida", "paralisada"]).optional(),
      data_prevista_inicio: z.string().nullable().optional(),
      data_prevista_fim: z.string().nullable().optional(),
      data_real_inicio: z.string().nullable().optional(),
      data_real_fim: z.string().nullable().optional(),
      responsavel_nome: z.string().nullable().optional(),
      responsavel_id: z.string().uuid().nullable().optional(),
      prioridade: z.enum(["baixa", "media", "alta", "critica"]).optional(),
      impedimento: z.string().nullable().optional(),
      observacoes: z.string().nullable().optional(),
    })
    .refine((v) => Object.keys(v).length > 0, "patch vazio"),
});

export const atualizarAtividade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);
    const { error } = await supabase
      .from("obra_atividades")
      .update(data.patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// --- Análise consolidada ---------------------------------------------------
type SnapshotRow = {
  data_snapshot: string;
  avanco: number;
  risco: "baixo" | "moderado" | "alto" | "critico";
  fator_aceleracao: number | null;
  num_criticas: number;
  valor_executado: number | null;
};

export type AnaliseGerencialPayload = AnaliseResult & {
  tendencia: {
    d1: TendenciaItem | null;
    d7: TendenciaItem | null;
    medicao_anterior: TendenciaItem | null;
  };
  historico: SnapshotRow[];
};

export type TendenciaItem = {
  referencia: string;
  delta_avanco: number;
  risco_anterior: "baixo" | "moderado" | "alto" | "critico";
  delta_fator: number | null;
  delta_criticas: number;
};

export const getAnaliseGerencial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obraId: string }) => z.object({ obraId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<AnaliseGerencialPayload> => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);

    const [obraRes, ativRes, histRes] = await Promise.all([
      supabase
        .from("obras")
        .select("id, nome, data_inicio, data_fim_prevista, valor_contratado")
        .eq("id", data.obraId)
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("obra_atividades")
        .select("id, item_codigo, descricao, etapa, valor, peso, quantidade, percentual_concluido, status, data_prevista_inicio, data_prevista_fim, data_real_inicio, data_real_fim, responsavel_nome, prioridade, impedimento, is_group")
        .eq("company_id", companyId)
        .eq("obra_id", data.obraId)
        .order("ordem", { ascending: true }),
      supabase
        .from("obra_analise_snapshots")
        .select("data_snapshot, avanco, risco, fator_aceleracao, num_criticas, valor_executado")
        .eq("company_id", companyId)
        .eq("obra_id", data.obraId)
        .order("data_snapshot", { ascending: false })
        .limit(60),
    ]);
    if (obraRes.error) throw new Error(obraRes.error.message);
    if (!obraRes.data) throw new Error("Obra não encontrada.");
    if (ativRes.error) throw new Error(ativRes.error.message);
    if (histRes.error) throw new Error(histRes.error.message);

    const obra: ObraInput = {
      id: obraRes.data.id,
      nome: obraRes.data.nome,
      data_inicio: obraRes.data.data_inicio,
      data_fim_prevista: obraRes.data.data_fim_prevista,
      valor_contratado: obraRes.data.valor_contratado,
    };
    const atividades = (ativRes.data ?? []) as AtividadeInput[];
    const analise = calcularAnalise(obra, atividades);

    // --- Snapshot do dia (upsert) ---
    try {
      await supabase.from("obra_analise_snapshots").upsert(
        {
          company_id: companyId,
          obra_id: data.obraId,
          data_snapshot: new Date().toISOString().slice(0, 10),
          avanco: analise.indicadores.avanco,
          prazo_consumido: analise.indicadores.prazo_consumido,
          desvio: analise.indicadores.desvio,
          ritmo_atual: analise.indicadores.ritmo_atual,
          ritmo_necessario: analise.indicadores.ritmo_necessario,
          fator_aceleracao: analise.indicadores.fator_aceleracao,
          saldo_executar: analise.indicadores.saldo_executar,
          valor_executado: analise.indicadores.valor_executado,
          data_projetada: analise.indicadores.data_projetada,
          num_criticas: analise.criticas.length,
          risco: analise.risco.nivel,
          confiabilidade: analise.confiabilidade,
          payload: { metodo: analise.metodo_avanco, faixa: analise.risco },
        },
        { onConflict: "obra_id,data_snapshot" },
      );
    } catch {
      // não impede o retorno se snapshot falhar
    }

    const historico = (histRes.data ?? []) as SnapshotRow[];

    // --- Tendência ---
    const buildTendencia = (snap: SnapshotRow | undefined, label: string): TendenciaItem | null => {
      if (!snap) return null;
      return {
        referencia: label,
        delta_avanco: +(analise.indicadores.avanco - Number(snap.avanco)).toFixed(3),
        risco_anterior: snap.risco,
        delta_fator:
          analise.indicadores.fator_aceleracao !== null && snap.fator_aceleracao !== null
            ? +(analise.indicadores.fator_aceleracao - Number(snap.fator_aceleracao)).toFixed(3)
            : null,
        delta_criticas: analise.criticas.length - Number(snap.num_criticas),
      };
    };

    const hoje = new Date().toISOString().slice(0, 10);
    const d1Date = new Date(); d1Date.setDate(d1Date.getDate() - 1);
    const d7Date = new Date(); d7Date.setDate(d7Date.getDate() - 7);
    const d1Iso = d1Date.toISOString().slice(0, 10);
    const d7Iso = d7Date.toISOString().slice(0, 10);

    const d1Snap = historico.find((h) => h.data_snapshot <= d1Iso && h.data_snapshot !== hoje);
    const d7Snap = historico.find((h) => h.data_snapshot <= d7Iso);

    // medição anterior: pega valor_executado da última medição finalizada
    let medSnap: TendenciaItem | null = null;
    try {
      const { data: meds } = await supabase
        .from("medicoes")
        .select("valor_acumulado, periodo_fim")
        .eq("company_id", companyId)
        .eq("obra_id", data.obraId)
        .order("periodo_fim", { ascending: false })
        .limit(1);
      if (meds && meds[0]) {
        const valorAnt = Number(meds[0].valor_acumulado || 0);
        medSnap = {
          referencia: `Última medição (${new Date(meds[0].periodo_fim).toLocaleDateString("pt-BR")})`,
          delta_avanco: 0,
          risco_anterior: analise.risco.nivel,
          delta_fator: null,
          delta_criticas: 0,
        };
        if (analise.indicadores.valor_total > 0) {
          medSnap.delta_avanco = +(((analise.indicadores.valor_executado - valorAnt) / analise.indicadores.valor_total) * 100).toFixed(3);
        }
      }
    } catch {
      medSnap = null;
    }

    return {
      ...analise,
      tendencia: {
        d1: buildTendencia(d1Snap, "Ontem"),
        d7: buildTendencia(d7Snap, "Últimos 7 dias"),
        medicao_anterior: medSnap,
      },
      historico,
    };
  });

// --- Combinada: sincroniza obra + atividades e retorna análise --------------
const ensureSchema = z.object({
  legacyObraId: z.string().min(1),
  obraInfo: z.object({
    nome: z.string().default("Obra"),
    codigo: z.string().nullable().optional(),
    data_inicio: z.string().nullable().optional(),
    data_fim_prevista: z.string().nullable().optional(),
    valor_contratado: z.number().nullable().optional(),
    cliente: z.string().nullable().optional(),
    cidade: z.string().nullable().optional(),
    uf: z.string().nullable().optional(),
  }),
  rows: z.array(rowSchema).max(5000),
});

export const ensureAnalise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ensureSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ obraId: string; analise: AnaliseGerencialPayload; atividades: Array<{ id: string; item_codigo: string }> }> => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);

    // 1) upsert obra por (company_id, legacy_obra_id)
    const { data: existingObra } = await supabase
      .from("obras")
      .select("id, data_inicio, data_fim_prevista, valor_contratado")
      .eq("company_id", companyId)
      .eq("legacy_obra_id", data.legacyObraId)
      .maybeSingle();

    let obraId: string;
    if (existingObra?.id) {
      obraId = existingObra.id;
      // Atualiza apenas se vier valor novo (não sobrescreve com null)
      const patch: Record<string, unknown> = {};
      if (data.obraInfo.data_inicio) patch.data_inicio = data.obraInfo.data_inicio;
      if (data.obraInfo.data_fim_prevista) patch.data_fim_prevista = data.obraInfo.data_fim_prevista;
      if (data.obraInfo.valor_contratado != null) patch.valor_contratado = data.obraInfo.valor_contratado;
      if (data.obraInfo.nome) patch.nome = data.obraInfo.nome;
      if (Object.keys(patch).length) {
        await (supabase as AnySupabase).from("obras").update(patch).eq("id", obraId);
      }
    } else {
      const { data: created, error: cErr } = await supabase
        .from("obras")
        .insert({
          company_id: companyId,
          legacy_obra_id: data.legacyObraId,
          nome: data.obraInfo.nome,
          codigo: data.obraInfo.codigo ?? null,
          cliente: data.obraInfo.cliente ?? null,
          cidade: data.obraInfo.cidade ?? null,
          uf: data.obraInfo.uf ?? null,
          data_inicio: data.obraInfo.data_inicio ?? null,
          data_fim_prevista: data.obraInfo.data_fim_prevista ?? null,
          valor_contratado: data.obraInfo.valor_contratado ?? null,
          origem: "workspace_sync",
          status: "ativa",
          created_by: userId,
          metadata: {},
        })
        .select("id")
        .single();
      if (cErr) throw new Error(cErr.message);
      obraId = created.id;
    }

    // 2) upsert atividades — preserva campos manuais
    if (data.rows.length > 0) {
      // Lê o que já existe para não sobrescrever percentuais/datas/status já editados
      const { data: existentes } = await supabase
        .from("obra_atividades")
        .select("item_codigo")
        .eq("obra_id", obraId);
      const existSet = new Set((existentes ?? []).map((r: { item_codigo: string }) => r.item_codigo));

      // Novas: insert completo. Existentes: update apenas campos descritivos.
      const novas = data.rows.filter((r) => !existSet.has(r.item_codigo)).map((r) => ({
        company_id: companyId,
        obra_id: obraId,
        item_codigo: r.item_codigo,
        etapa: r.etapa ?? null,
        descricao: r.descricao || r.item_codigo,
        unidade: r.unidade ?? null,
        quantidade: r.quantidade,
        peso: r.peso,
        valor: r.valor,
        is_group: r.is_group,
        ordem: r.ordem,
        created_by: userId,
      }));
      if (novas.length) {
        const { error: insErr } = await supabase.from("obra_atividades").insert(novas);
        if (insErr) throw new Error(insErr.message);
      }
      // Updates apenas de metadados (valor, peso, quantidade, descrição, ordem)
      for (const r of data.rows) {
        if (!existSet.has(r.item_codigo)) continue;
        await supabase
          .from("obra_atividades")
          .update({
            descricao: r.descricao || r.item_codigo,
            etapa: r.etapa ?? null,
            unidade: r.unidade ?? null,
            quantidade: r.quantidade,
            peso: r.peso,
            valor: r.valor,
            is_group: r.is_group,
            ordem: r.ordem,
          })
          .eq("obra_id", obraId)
          .eq("item_codigo", r.item_codigo);
      }
    }

    // 3) lista de ids para o frontend usar nas edições inline
    const { data: lista } = await supabase
      .from("obra_atividades")
      .select("id, item_codigo")
      .eq("obra_id", obraId);

    // 4) calcula análise reaproveitando a fn pública
    const analiseRes = await getAnaliseGerencial({ data: { obraId } });

    return { obraId, analise: analiseRes, atividades: lista ?? [] };
  });
