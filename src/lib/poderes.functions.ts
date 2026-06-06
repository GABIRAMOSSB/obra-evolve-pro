/**
 * Matriz de Poderes — Fase 5.x.
 *
 * Catálogo persistente de signatários autorizados a representar a empresa
 * + procurações vigentes (com escopo, validade e status).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function resolveCompany(
  supabase: AnySupabase,
  userId: string,
  requireEditor = false,
) {
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

export type SignatarioRow = {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  tipo: "socio" | "administrador" | "procurador" | "representante" | "outro";
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
};

export type ProcuracaoRow = {
  id: string;
  signatario_id: string;
  tipo: "publica" | "particular";
  numero: string | null;
  cartorio: string | null;
  data_outorga: string;
  data_validade: string | null;
  poderes_gerais: boolean;
  escopo: Record<string, boolean>;
  poderes_especificos: string | null;
  substabelecimento: boolean;
  arquivo_path: string | null;
  status: "vigente" | "expirada" | "revogada" | "suspensa";
  revogada_em: string | null;
  revogada_motivo: string | null;
  observacoes: string | null;
  created_at: string;
};

export const ESCOPO_PADRAO = [
  { key: "licitacoes", label: "Licitações" },
  { key: "contratos", label: "Contratos" },
  { key: "bancario", label: "Bancário" },
  { key: "fiscal", label: "Fiscal / Tributário" },
  { key: "trabalhista", label: "Trabalhista / RH" },
  { key: "judicial", label: "Judicial" },
  { key: "administrativo", label: "Administrativo geral" },
] as const;

export const listPoderes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    signatarios: SignatarioRow[];
    procuracoes: ProcuracaoRow[];
  }> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);

    const [sRes, pRes] = await Promise.all([
      supabase
        .from("company_signatarios")
        .select("id, nome, cpf, email, telefone, cargo, tipo, ativo, observacoes, created_at")
        .eq("company_id", companyId)
        .order("nome", { ascending: true }),
      supabase
        .from("procuracoes")
        .select(
          "id, signatario_id, tipo, numero, cartorio, data_outorga, data_validade, poderes_gerais, escopo, poderes_especificos, substabelecimento, arquivo_path, status, revogada_em, revogada_motivo, observacoes, created_at",
        )
        .eq("company_id", companyId)
        .order("data_outorga", { ascending: false }),
    ]);
    if (sRes.error) throw new Error(sRes.error.message);
    if (pRes.error) throw new Error(pRes.error.message);

    // Marca procurações como expiradas se data_validade < hoje
    const hoje = new Date().toISOString().slice(0, 10);
    const procuracoes = ((pRes.data ?? []) as ProcuracaoRow[]).map((p) => {
      if (
        p.status === "vigente" &&
        p.data_validade &&
        p.data_validade < hoje
      ) {
        return { ...p, status: "expirada" as const };
      }
      return p;
    });

    return {
      signatarios: (sRes.data ?? []) as SignatarioRow[],
      procuracoes,
    };
  });

const signatarioSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2).max(200),
  cpf: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  telefone: z.string().max(40).optional().nullable(),
  cargo: z.string().max(120).optional().nullable(),
  tipo: z.enum(["socio", "administrador", "procurador", "representante", "outro"]),
  ativo: z.boolean().default(true),
  observacoes: z.string().max(2000).optional().nullable(),
});

export const upsertSignatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => signatarioSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const row = {
      company_id: companyId,
      nome: data.nome.trim(),
      cpf: data.cpf || null,
      email: data.email ? String(data.email).trim() : null,
      telefone: data.telefone || null,
      cargo: data.cargo || null,
      tipo: data.tipo,
      ativo: data.ativo,
      observacoes: data.observacoes || null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("company_signatarios")
        .update(row)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("company_signatarios")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const excluirSignatario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("company_signatarios")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const procuracaoSchema = z.object({
  id: z.string().uuid().optional(),
  signatario_id: z.string().uuid(),
  tipo: z.enum(["publica", "particular"]),
  numero: z.string().max(80).optional().nullable(),
  cartorio: z.string().max(200).optional().nullable(),
  data_outorga: z.string().min(10),
  data_validade: z.string().min(10).optional().nullable(),
  poderes_gerais: z.boolean().default(false),
  escopo: z.record(z.string().min(1).max(40), z.boolean()).default({}),
  poderes_especificos: z.string().max(4000).optional().nullable(),
  substabelecimento: z.boolean().default(false),
  arquivo_path: z.string().max(500).optional().nullable(),
  status: z.enum(["vigente", "expirada", "revogada", "suspensa"]).default("vigente"),
  observacoes: z.string().max(2000).optional().nullable(),
});

export const upsertProcuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => procuracaoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);

    // Confere se o signatário pertence à mesma empresa
    const { data: sig, error: sErr } = await supabase
      .from("company_signatarios")
      .select("id")
      .eq("id", data.signatario_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!sig) throw new Error("Signatário não encontrado nesta empresa.");

    const row = {
      company_id: companyId,
      signatario_id: data.signatario_id,
      tipo: data.tipo,
      numero: data.numero || null,
      cartorio: data.cartorio || null,
      data_outorga: data.data_outorga,
      data_validade: data.data_validade || null,
      poderes_gerais: data.poderes_gerais,
      escopo: data.escopo ?? {},
      poderes_especificos: data.poderes_especificos || null,
      substabelecimento: data.substabelecimento,
      arquivo_path: data.arquivo_path || null,
      status: data.status,
      observacoes: data.observacoes || null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("procuracoes")
        .update(row)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("procuracoes")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const revogarProcuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), motivo: z.string().max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("procuracoes")
      .update({
        status: "revogada",
        revogada_em: new Date().toISOString(),
        revogada_motivo: data.motivo || null,
      })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirProcuracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("procuracoes")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
