/**
 * F11 — Manifestação do Destinatário (interna)
 *
 * Registra o posicionamento da empresa destinatária da NF-e no fluxo interno:
 *  - ciencia: Ciência da Operação (recebeu mas ainda não decidiu)
 *  - confirmacao: Confirmação da Operação (mercadoria/serviço aceito)
 *  - desconhecimento: Desconhecimento da Operação (requer justificativa)
 *  - nao_realizada: Operação Não Realizada (requer justificativa)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

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

const tipoEnum = z.enum(["ciencia", "confirmacao", "desconhecimento", "nao_realizada"]);

const schema = z.object({
  nota_id: z.string().uuid(),
  tipo: tipoEnum,
  justificativa: z.string().max(2000).optional().nullable(),
});

export const registrarManifestacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => schema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    if ((data.tipo === "desconhecimento" || data.tipo === "nao_realizada") &&
        !(data.justificativa && data.justificativa.trim().length >= 15)) {
      throw new Error("Justificativa de no mínimo 15 caracteres é obrigatória para Desconhecimento ou Não Realizada.");
    }

    const { error } = await supabase
      .from("notas_fiscais")
      .update({
        manifestacao_tipo: data.tipo,
        manifestacao_data: new Date().toISOString(),
        manifestacao_justificativa: data.justificativa?.trim() || null,
        manifestacao_por: context.userId,
      })
      .eq("id", data.nota_id)
      .eq("company_id", companyId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const limparManifestacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ nota_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("notas_fiscais")
      .update({
        manifestacao_tipo: null,
        manifestacao_data: null,
        manifestacao_justificativa: null,
        manifestacao_por: null,
      })
      .eq("id", data.nota_id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const MANIFESTACAO_LABELS: Record<string, string> = {
  ciencia: "Ciência da Operação",
  confirmacao: "Confirmação da Operação",
  desconhecimento: "Desconhecimento",
  nao_realizada: "Operação Não Realizada",
};
