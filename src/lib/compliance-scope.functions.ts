/**
 * Fase 2.2 — Vínculo CND ↔ Obra/Contrato.
 * Server functions para listar opções de escopo e atualizar o vínculo de uma
 * certidão. O trigger `validate_certificate_scope` no banco garante que obra
 * e contrato pertencem à mesma empresa do certificado.
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
  if (data.role !== "admin" && data.role !== "editor") {
    throw new Error("Permissão insuficiente.");
  }
  return data.company_id as string;
}

export interface ScopeOptions {
  obras: Array<{ id: string; nome: string; codigo: string | null }>;
  contratos: Array<{ id: string; numero: string; obra_id: string | null; objeto: string | null }>;
}

export const listCertificateScopeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ScopeOptions> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const [obrasRes, ctosRes] = await Promise.all([
      supabase
        .from("obras")
        .select("id, nome, codigo")
        .eq("company_id", companyId)
        .neq("status", "cancelada")
        .order("nome"),
      supabase
        .from("contratos")
        .select("id, numero, obra_id, objeto")
        .eq("company_id", companyId)
        .neq("status", "rescindido")
        .order("numero"),
    ]);
    if (obrasRes.error) throw new Error(obrasRes.error.message);
    if (ctosRes.error) throw new Error(ctosRes.error.message);

    return {
      obras: (obrasRes.data ?? []) as ScopeOptions["obras"],
      contratos: (ctosRes.data ?? []) as ScopeOptions["contratos"],
    };
  });

const linkSchema = z.object({
  company_certificate_id: z.string().uuid(),
  obra_id: z.string().uuid().nullable(),
  contrato_id: z.string().uuid().nullable(),
});

export const linkCertificateScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => linkSchema.parse(input))
  .handler(async ({ context, data }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const { error } = await supabase
      .from("company_certificates")
      .update({
        obra_id: data.obra_id,
        contrato_id: data.contrato_id,
      })
      .eq("id", data.company_certificate_id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
