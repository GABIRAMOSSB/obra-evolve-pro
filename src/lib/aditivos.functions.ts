/**
 * Aditivos contratuais — Fase 11.
 *
 * CRUD de termos aditivos (valor, prazo, escopo, misto). A aplicação ao
 * contrato (somar valor_delta e prazo_dias_delta) é feita por trigger
 * BEFORE INSERT/UPDATE no banco — aqui só validamos e gravamos.
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

export const listAditivos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);

    const [aditRes, contratosRes] = await Promise.all([
      supabase
        .from("aditivos_contratuais")
        .select("id, contrato_id, numero, tipo, valor_delta, prazo_dias_delta, data_assinatura, justificativa, status, aplicado_em, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("contratos")
        .select("id, numero, objeto, orgao_contratante, valor_original, valor_atualizado, data_fim_vigencia, status")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);
    if (aditRes.error) throw new Error(aditRes.error.message);
    if (contratosRes.error) throw new Error(contratosRes.error.message);
    return { aditivos: aditRes.data ?? [], contratos: contratosRes.data ?? [] };
  });

const createSchema = z.object({
  contrato_id: z.string().uuid(),
  tipo: z.enum(["valor", "prazo", "escopo", "misto"]),
  valor_delta: z.number().finite().default(0),
  prazo_dias_delta: z.number().int().default(0),
  data_assinatura: z.string().optional().nullable(),
  justificativa: z.string().max(4000).optional().nullable(),
  status: z.enum(["rascunho", "vigente", "cancelado"]).default("rascunho"),
});

export const criarAditivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);

    const { data: contrato, error: cErr } = await supabase
      .from("contratos")
      .select("id")
      .eq("id", data.contrato_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contrato) throw new Error("Contrato não encontrado.");

    const { data: existentes } = await supabase
      .from("aditivos_contratuais")
      .select("numero")
      .eq("company_id", companyId)
      .eq("contrato_id", data.contrato_id);
    const proximoNumero = ((existentes ?? []).reduce((m: number, r: { numero: number }) => Math.max(m, r.numero), 0) ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("aditivos_contratuais")
      .insert({
        company_id: companyId,
        contrato_id: data.contrato_id,
        numero: proximoNumero,
        tipo: data.tipo,
        valor_delta: data.valor_delta,
        prazo_dias_delta: data.prazo_dias_delta,
        data_assinatura: data.data_assinatura || null,
        justificativa: data.justificativa ?? null,
        status: data.status,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string, numero: proximoNumero };
  });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["rascunho", "vigente", "cancelado"]),
});

export const atualizarStatusAditivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => statusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("aditivos_contratuais")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirAditivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    // Se estiver vigente, primeiro cancelar para reverter aplicação no contrato
    const { data: cur } = await supabase
      .from("aditivos_contratuais")
      .select("status")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cur?.status === "vigente") {
      const { error: revErr } = await supabase
        .from("aditivos_contratuais")
        .update({ status: "cancelado" })
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (revErr) throw new Error(revErr.message);
    }
    const { error } = await supabase
      .from("aditivos_contratuais")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
