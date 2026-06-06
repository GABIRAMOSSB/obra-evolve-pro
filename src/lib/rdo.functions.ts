/**
 * RDO — Relatório Diário de Obra (Fase 13).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function resolveCompany(supabase: AnySupabase, userId: string, requireEditor = false) {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  if (requireEditor && data.role !== "admin" && data.role !== "editor") {
    throw new Error("Permissão insuficiente.");
  }
  return data.company_id as string;
}

export type RDORow = {
  id: string;
  obra_id: string;
  data: string;
  clima_manha: string | null;
  clima_tarde: string | null;
  clima_noite: string | null;
  condicao_trabalho: string | null;
  efetivo_total: number;
  observacoes: string | null;
  atividades_executadas: string | null;
  status: "rascunho" | "fechado" | "aprovado";
  created_at: string;
};

export type ObraLite = { id: string; nome: string; codigo: string | null; status: string | null };

export const listRDOs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rdos: RDORow[]; obras: ObraLite[] }> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);
    const [rRes, oRes] = await Promise.all([
      supabase
        .from("rdos")
        .select("id, obra_id, data, clima_manha, clima_tarde, clima_noite, condicao_trabalho, efetivo_total, observacoes, atividades_executadas, status, created_at")
        .eq("company_id", companyId)
        .order("data", { ascending: false })
        .limit(500),
      supabase
        .from("obras")
        .select("id, nome, codigo, status")
        .eq("company_id", companyId)
        .order("nome", { ascending: true }),
    ]);
    if (rRes.error) throw new Error(rRes.error.message);
    if (oRes.error) throw new Error(oRes.error.message);
    return { rdos: (rRes.data ?? []) as RDORow[], obras: (oRes.data ?? []) as ObraLite[] };
  });

const equipeSchema = z.object({
  funcao: z.string().min(1).max(100),
  quantidade: z.number().int().min(0),
  horas_trabalhadas: z.number().min(0).default(0),
  observacao: z.string().max(500).optional().nullable(),
});
const equipamentoSchema = z.object({
  equipamento: z.string().min(1).max(100),
  horas_operadas: z.number().min(0).default(0),
  horas_paradas: z.number().min(0).default(0),
  observacao: z.string().max(500).optional().nullable(),
});
const ocorrenciaSchema = z.object({
  tipo: z.enum(["atraso", "acidente", "seguranca", "qualidade", "visita", "outro"]),
  descricao: z.string().min(1).max(2000),
  severidade: z.enum(["baixa", "media", "alta", "critica"]).optional().nullable(),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  obra_id: z.string().uuid(),
  data: z.string().min(8),
  clima_manha: z.string().max(40).optional().nullable(),
  clima_tarde: z.string().max(40).optional().nullable(),
  clima_noite: z.string().max(40).optional().nullable(),
  condicao_trabalho: z.enum(["praticavel", "impraticavel", "parcial"]).optional().nullable(),
  observacoes: z.string().max(4000).optional().nullable(),
  atividades_executadas: z.string().max(4000).optional().nullable(),
  status: z.enum(["rascunho", "fechado", "aprovado"]).default("rascunho"),
  equipes: z.array(equipeSchema).default([]),
  equipamentos: z.array(equipamentoSchema).default([]),
  ocorrencias: z.array(ocorrenciaSchema).default([]),
});

export const upsertRDO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);

    const efetivoTotal = data.equipes.reduce((s, e) => s + Number(e.quantidade || 0), 0);
    const payload = {
      company_id: companyId,
      obra_id: data.obra_id,
      data: data.data,
      clima_manha: data.clima_manha ?? null,
      clima_tarde: data.clima_tarde ?? null,
      clima_noite: data.clima_noite ?? null,
      condicao_trabalho: data.condicao_trabalho ?? null,
      observacoes: data.observacoes ?? null,
      atividades_executadas: data.atividades_executadas ?? null,
      status: data.status,
      efetivo_total: efetivoTotal,
      created_by: context.userId,
    };

    let rdoId = data.id ?? null;
    if (rdoId) {
      const { error } = await supabase.from("rdos").update(payload).eq("id", rdoId).eq("company_id", companyId);
      if (error) throw new Error(error.message);
    } else {
      const { data: created, error } = await supabase
        .from("rdos")
        .upsert(payload, { onConflict: "company_id,obra_id,data" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      rdoId = created.id as string;
    }

    // Substitui filhos (estratégia replace)
    await Promise.all([
      supabase.from("rdo_equipes").delete().eq("rdo_id", rdoId).eq("company_id", companyId),
      supabase.from("rdo_equipamentos").delete().eq("rdo_id", rdoId).eq("company_id", companyId),
      supabase.from("rdo_ocorrencias").delete().eq("rdo_id", rdoId).eq("company_id", companyId),
    ]);
    if (data.equipes.length) {
      await supabase.from("rdo_equipes").insert(
        data.equipes.map((e) => ({ ...e, rdo_id: rdoId, company_id: companyId })),
      );
    }
    if (data.equipamentos.length) {
      await supabase.from("rdo_equipamentos").insert(
        data.equipamentos.map((e) => ({ ...e, rdo_id: rdoId, company_id: companyId })),
      );
    }
    if (data.ocorrencias.length) {
      await supabase.from("rdo_ocorrencias").insert(
        data.ocorrencias.map((o) => ({ ...o, rdo_id: rdoId, company_id: companyId })),
      );
    }
    return { id: rdoId };
  });

export const getRDODetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);
    const [rdo, eq, em, oc] = await Promise.all([
      supabase.from("rdos").select("*").eq("id", data.id).eq("company_id", companyId).maybeSingle(),
      supabase.from("rdo_equipes").select("*").eq("rdo_id", data.id).eq("company_id", companyId),
      supabase.from("rdo_equipamentos").select("*").eq("rdo_id", data.id).eq("company_id", companyId),
      supabase.from("rdo_ocorrencias").select("*").eq("rdo_id", data.id).eq("company_id", companyId),
    ]);
    if (rdo.error) throw new Error(rdo.error.message);
    return {
      rdo: rdo.data,
      equipes: eq.data ?? [],
      equipamentos: em.data ?? [],
      ocorrencias: oc.data ?? [],
    };
  });

export const excluirRDO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase.from("rdos").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const atualizarStatusRDO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["rascunho", "fechado", "aprovado"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase.from("rdos").update({ status: data.status }).eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
