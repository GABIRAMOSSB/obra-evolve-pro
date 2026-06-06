/**
 * Fase 8 — Cronograma físico-financeiro.
 *
 * Gerencia cronogramas vinculados a obras/propostas/contratos com etapas e
 * períodos. Suporta geração automática a partir de itens da proposta, baseline
 * (versão congelada) e lançamento de % realizado para cálculo de Curva S.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function resolveCompanyId(supabase: AnySupabase, userId: string): Promise<string> {
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

async function requireEditor(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  if (data.role !== "admin" && data.role !== "editor") throw new Error("Permissão insuficiente.");
  return data.company_id as string;
}

/* ===================== TYPES ===================== */

export interface CronogramaRow {
  id: string;
  nome: string;
  obra_id: string | null;
  proposta_id: string | null;
  contrato_id: string | null;
  data_inicio: string | null;
  prazo_dias: number | null;
  numero_periodos: number;
  unidade_periodo: string;
  is_baseline: boolean;
  versao: number;
  status: string;
  valor_total: number;
  obra_nome: string | null;
  proposta_titulo: string | null;
  created_at: string;
  updated_at: string;
}

export interface EtapaRow {
  id: string;
  cronograma_id: string;
  ordem: number;
  codigo: string | null;
  descricao: string;
  valor_etapa: number;
}

export interface PeriodoRow {
  id: string;
  etapa_id: string;
  periodo_idx: number;
  percent_fisico: number;
  valor_financeiro: number;
  percent_realizado: number | null;
  valor_realizado: number | null;
}

/* ===================== LIST ===================== */

export const listCronogramas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CronogramaRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("cronogramas")
      .select(
        "id, nome, obra_id, proposta_id, contrato_id, data_inicio, prazo_dias, numero_periodos, unidade_periodo, is_baseline, versao, status, valor_total, created_at, updated_at, obra:obras(nome), proposta:propostas(titulo)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    type Raw = Omit<CronogramaRow, "obra_nome" | "proposta_titulo"> & {
      obra?: { nome: string } | null;
      proposta?: { titulo: string } | null;
    };
    return ((data ?? []) as Raw[]).map((r) => ({
      ...r,
      obra_nome: r.obra?.nome ?? null,
      proposta_titulo: r.proposta?.titulo ?? null,
    }));
  });

/* ===================== CREATE ===================== */

const createSchema = z.object({
  nome: z.string().min(2).max(200),
  obra_id: z.string().uuid().nullable().optional(),
  proposta_id: z.string().uuid().nullable().optional(),
  contrato_id: z.string().uuid().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  prazo_dias: z.number().int().nullable().optional(),
  numero_periodos: z.number().int().min(1).max(120),
  unidade_periodo: z.enum(["dia", "semana", "mes"]).default("mes"),
});

export const createCronograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: row, error } = await supabase
      .from("cronogramas")
      .insert({ company_id: companyId, created_by: context.userId, ...data })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/* ===================== GERAR DA PROPOSTA ===================== */

const gerarSchema = z.object({
  proposta_id: z.string().uuid(),
  nome: z.string().min(2).max(200),
  numero_periodos: z.number().int().min(1).max(120),
  unidade_periodo: z.enum(["dia", "semana", "mes"]).default("mes"),
  data_inicio: z.string().nullable().optional(),
  prazo_dias: z.number().int().nullable().optional(),
  distribuicao: z.enum(["uniforme", "curva_s"]).default("uniforme"),
});

function curvaSDistribution(n: number): number[] {
  // Distribuição S (sigmoid normalizada): pesos por período somando 100.
  const xs = Array.from({ length: n }, (_, i) => (i + 0.5) / n);
  const sig = xs.map((x) => 1 / (1 + Math.exp(-12 * (x - 0.5))));
  const sum = sig.reduce((a, b) => a + b, 0);
  return sig.map((v) => (v / sum) * 100);
}

export const gerarCronogramaDaProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => gerarSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: prop, error: pErr } = await supabase
      .from("propostas")
      .select("id, titulo")
      .eq("id", data.proposta_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Proposta não encontrada.");

    const { data: itens, error: iErr } = await supabase
      .from("proposta_itens")
      .select("descricao, codigo, preco_total, ordem")
      .eq("proposta_id", data.proposta_id)
      .order("ordem", { ascending: true });
    if (iErr) throw new Error(iErr.message);
    if (!itens || itens.length === 0) throw new Error("Proposta sem itens.");

    const { data: cron, error: cErr } = await supabase
      .from("cronogramas")
      .insert({
        company_id: companyId,
        proposta_id: data.proposta_id,
        nome: data.nome,
        data_inicio: data.data_inicio ?? null,
        prazo_dias: data.prazo_dias ?? null,
        numero_periodos: data.numero_periodos,
        unidade_periodo: data.unidade_periodo,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (cErr) throw new Error(cErr.message);
    const cronId = cron.id as string;

    const pesos = data.distribuicao === "curva_s"
      ? curvaSDistribution(data.numero_periodos)
      : Array.from({ length: data.numero_periodos }, () => 100 / data.numero_periodos);

    const etapasRows = (itens as Array<{ descricao: string; codigo: string | null; preco_total: number; ordem: number }>).map((it, idx) => ({
      company_id: companyId,
      cronograma_id: cronId,
      ordem: it.ordem ?? idx,
      codigo: it.codigo,
      descricao: it.descricao,
      valor_etapa: Number(it.preco_total ?? 0),
    }));

    const { data: etapasInseridas, error: eErr } = await supabase
      .from("cronograma_etapas")
      .insert(etapasRows)
      .select("id, valor_etapa");
    if (eErr) throw new Error(eErr.message);

    const periodosRows: Array<Record<string, unknown>> = [];
    for (const et of etapasInseridas as Array<{ id: string; valor_etapa: number }>) {
      for (let p = 0; p < data.numero_periodos; p++) {
        const pct = pesos[p];
        periodosRows.push({
          company_id: companyId,
          cronograma_id: cronId,
          etapa_id: et.id,
          periodo_idx: p,
          percent_fisico: Number(pct.toFixed(6)),
          valor_financeiro: Number((Number(et.valor_etapa) * pct / 100).toFixed(2)),
        });
      }
    }
    if (periodosRows.length) {
      const { error: ppErr } = await supabase.from("cronograma_periodos").insert(periodosRows);
      if (ppErr) throw new Error(ppErr.message);
    }

    await supabase.rpc("recalc_cronograma_totals", { p_cronograma_id: cronId });
    return { id: cronId };
  });

/* ===================== GET DETALHE ===================== */

export const getCronograma = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const { data: cron, error: cErr } = await supabase
      .from("cronogramas")
      .select("*")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!cron) throw new Error("Cronograma não encontrado.");

    const { data: etapas, error: eErr } = await supabase
      .from("cronograma_etapas")
      .select("id, cronograma_id, ordem, codigo, descricao, valor_etapa")
      .eq("cronograma_id", data.id)
      .order("ordem");
    if (eErr) throw new Error(eErr.message);

    const { data: periodos, error: pErr } = await supabase
      .from("cronograma_periodos")
      .select("id, etapa_id, periodo_idx, percent_fisico, valor_financeiro, percent_realizado, valor_realizado")
      .eq("cronograma_id", data.id);
    if (pErr) throw new Error(pErr.message);

    return {
      cronograma: cron as CronogramaRow & { observacoes: string | null },
      etapas: (etapas ?? []) as EtapaRow[],
      periodos: (periodos ?? []) as PeriodoRow[],
    };
  });

/* ===================== UPDATE PERIODOS ===================== */

const upsertPeriodoSchema = z.object({
  cronograma_id: z.string().uuid(),
  itens: z.array(
    z.object({
      etapa_id: z.string().uuid(),
      periodo_idx: z.number().int().min(0),
      percent_fisico: z.number().min(0).max(100).optional(),
      percent_realizado: z.number().min(0).max(100).nullable().optional(),
    }),
  ).max(2000),
});

export const upsertPeriodos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertPeriodoSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    // Atualiza linha a linha (idx + etapa_id é UNIQUE)
    for (const it of data.itens) {
      const patch: Record<string, unknown> = {};
      if (it.percent_fisico !== undefined) patch.percent_fisico = it.percent_fisico;
      if (it.percent_realizado !== undefined) patch.percent_realizado = it.percent_realizado;
      if (Object.keys(patch).length === 0) continue;
      const { error } = await supabase
        .from("cronograma_periodos")
        .update(patch)
        .eq("etapa_id", it.etapa_id)
        .eq("periodo_idx", it.periodo_idx)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);

      if (it.percent_realizado !== undefined) {
        // valor_realizado = valor_etapa * pct / 100
        const { data: etRow } = await supabase
          .from("cronograma_etapas").select("valor_etapa").eq("id", it.etapa_id).maybeSingle();
        const valor = etRow ? Number((Number(etRow.valor_etapa) * (it.percent_realizado ?? 0) / 100).toFixed(2)) : null;
        await supabase
          .from("cronograma_periodos")
          .update({ valor_realizado: valor })
          .eq("etapa_id", it.etapa_id)
          .eq("periodo_idx", it.periodo_idx)
          .eq("company_id", companyId);
      }
    }

    await supabase.rpc("recalc_cronograma_totals", { p_cronograma_id: data.cronograma_id });
    return { ok: true };
  });

/* ===================== BASELINE ===================== */

export const congelarBaseline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ cronograma_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("cronogramas")
      .update({ is_baseline: true, status: "aprovado" })
      .eq("id", data.cronograma_id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCronograma = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase.from("cronogramas").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ===================== HELPERS PARA SELECT ===================== */

export const listPropostasParaCronograma = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("propostas")
      .select("id, titulo, valor_total")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; titulo: string; valor_total: number | null }>;
  });
