import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const signerDraftSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().max(255).optional().or(z.literal("")),
  cpf: z.string().max(20).optional().or(z.literal("")),
  phone_country: z.string().max(4).optional().or(z.literal("")),
  phone_number: z.string().max(20).optional().or(z.literal("")),
  role: z.string().max(64).optional().or(z.literal("")),
  auth_mode: z.string().max(64).optional(),
});

const placementSchema = z.object({
  signerIndex: z.number().int().min(0).max(19),
  page: z.number().int().min(1).max(500),
  type: z.enum(["signature", "visto", "name", "date", "cpf", "email", "text"]),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0.01).max(1),
  h: z.number().min(0.01).max(1),
});

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().or(z.literal("")),
  document_folder: z.string().max(120).optional().or(z.literal("")),
  expiration_days: z.number().int().min(1).max(365).optional(),
  custom_message: z.string().max(2000).optional().or(z.literal("")),
  default_auth_mode: z.string().max(64).optional(),
  signers: z.array(signerDraftSchema).min(1).max(20),
  placements: z.array(placementSchema).max(200).default([]),
});

async function getCompanyId(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Sem empresa vinculada.");
  return { companyId: data.company_id as string, role: data.role as string };
}

export const listSignatureTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { companyId } = await getCompanyId(supabase, userId);
    const { data, error } = await supabase
      .from("signature_templates")
      .select("*")
      .eq("company_id", companyId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  });

export const upsertSignatureTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => upsertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, role } = await getCompanyId(supabase, userId);
    if (!["admin", "editor"].includes(role)) {
      throw new Error("Sem permissão para gerenciar templates.");
    }

    const payload = {
      company_id: companyId,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      document_folder: data.document_folder?.trim() || null,
      expiration_days: data.expiration_days ?? 30,
      custom_message: data.custom_message?.trim() || null,
      default_auth_mode: data.default_auth_mode ?? "assinaturaTela",
      signers: data.signers,
      placements: data.placements ?? [],
      created_by: userId,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("signature_templates")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { template: row };
    }

    const { data: row, error } = await supabase
      .from("signature_templates")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { template: row };
  });

export const deleteSignatureTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { companyId, role } = await getCompanyId(supabase, userId);
    if (!["admin", "editor"].includes(role)) {
      throw new Error("Sem permissão para remover templates.");
    }
    const { error } = await supabase
      .from("signature_templates")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { success: true };
  });
