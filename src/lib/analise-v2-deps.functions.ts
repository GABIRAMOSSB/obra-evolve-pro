/**
 * CRUD de dependências entre atividades (Fase 2 — Análise Gerencial V2).
 * Read/write apenas em obra_atividade_dependencias.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompany } from "./analise-v2.helpers.server";

const tipoEnum = z.enum(["TI", "II", "TT", "IT"]);

const listSchema = z.object({ obraId: z.string().uuid() });
const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  obraId: z.string().uuid(),
  predecessora_id: z.string().uuid(),
  sucessora_id: z.string().uuid(),
  tipo: tipoEnum.default("TI"),
  defasagem_dias: z.number().int().default(0),
  percentual_minimo: z.number().min(0).max(100).default(100),
});
const deleteSchema = z.object({ id: z.string().uuid() });

export const listDependencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);
    const { data: rows, error } = await supabase
      .from("obra_atividade_dependencias")
      .select("id, predecessora_id, sucessora_id, tipo, defasagem_dias, percentual_minimo")
      .eq("company_id", companyId)
      .eq("obra_id", data.obraId);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertDependencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);
    if (data.predecessora_id === data.sucessora_id) {
      throw new Error("Predecessora e sucessora não podem ser a mesma atividade.");
    }
    const payload = {
      company_id: companyId,
      obra_id: data.obraId,
      predecessora_id: data.predecessora_id,
      sucessora_id: data.sucessora_id,
      tipo: data.tipo,
      defasagem_dias: data.defasagem_dias,
      percentual_minimo: data.percentual_minimo,
    };
    const q = data.id
      ? supabase.from("obra_atividade_dependencias").update(payload).eq("id", data.id).eq("company_id", companyId).select().single()
      : supabase.from("obra_atividade_dependencias").insert(payload).select().single();
    const { data: row, error } = await q;
    if (error) throw new Error(error.message);
    return { row };
  });

export const deleteDependencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const companyId = await resolveCompany(supabase, userId);
    const { error } = await supabase
      .from("obra_atividade_dependencias")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
