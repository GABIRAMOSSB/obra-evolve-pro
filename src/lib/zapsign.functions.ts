import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface ZapSignSettings {
  id: string;
  company_id: string;
  environment: "sandbox" | "production";
  default_auth_mode: string;
  automatic_email: boolean;
  automatic_whatsapp: boolean;
  manual_whatsapp_enabled: boolean;
  webhook_configured: boolean;
  last_connection_test_at: string | null;
  last_connection_test_status: string | null;
  last_webhook_received_at: string | null;
  reminder_enabled: boolean;
  reminder_interval_days: number;
  reminder_max_count: number;
  reminder_channel: "whatsapp" | "email" | "sms";
}

export interface ZapSignStatus {
  configured: boolean;
  tokenMask: string | null;
  baseUrl: string | null;
  webhookSecretConfigured: boolean;
}

/** Returns whether the secrets are present, plus a masked preview of the token. */
export const getZapSignStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ZapSignStatus> => {
    const { maskToken } = await import("@/lib/zapsign.server");
    const token = process.env.ZAPSIGN_API_TOKEN;
    const baseUrl = process.env.ZAPSIGN_API_BASE_URL || null;
    const webhookSecret = process.env.ZAPSIGN_WEBHOOK_SECRET;
    return {
      configured: Boolean(token),
      tokenMask: token ? maskToken(token) : null,
      baseUrl,
      webhookSecretConfigured: Boolean(webhookSecret),
    };
  });

/** Pings ZapSign with a lightweight GET to verify token + endpoint. */
export const testZapSignConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { zapsignRequest, ZapSignConfigError } = await import("@/lib/zapsign.server");
    const { supabase } = context;

    let ok = false;
    let message = "";
    try {
      // List docs is a safe, cheap call that validates auth + reachability
      await zapsignRequest({ method: "GET", path: "/docs/?page=1" });
      ok = true;
      message = "Conexão bem-sucedida.";
    } catch (e) {
      if (e instanceof ZapSignConfigError) message = e.message;
      else message = (e as Error).message || "Falha desconhecida";
    }

    // Persist test result in signature_settings for the user's company
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .maybeSingle();
    if (membership?.company_id) {
      await supabase
        .from("signature_settings")
        .upsert(
          {
            company_id: membership.company_id,
            last_connection_test_at: new Date().toISOString(),
            last_connection_test_status: ok ? "success" : `error: ${message}`,
          },
          { onConflict: "company_id" },
        );
    }

    return { ok, message };
  });

/** Returns the settings row for the current company, creating it if absent. */
export const getOrCreateZapSignSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ZapSignSettings | null> => {
    const { supabase } = context;
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id")
      .maybeSingle();
    if (!membership?.company_id) return null;
    const companyId = membership.company_id;

    const { data: existing } = await supabase
      .from("signature_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (existing) return existing as ZapSignSettings;

    const { data: created, error } = await supabase
      .from("signature_settings")
      .insert({ company_id: companyId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created as ZapSignSettings;
  });

const updateSchema = z.object({
  environment: z.enum(["sandbox", "production"]).optional(),
  default_auth_mode: z.string().min(1).max(64).optional(),
  automatic_email: z.boolean().optional(),
  automatic_whatsapp: z.boolean().optional(),
  manual_whatsapp_enabled: z.boolean().optional(),
});

export const updateZapSignSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: membership } = await supabase
      .from("company_members")
      .select("company_id, role")
      .maybeSingle();
    if (!membership?.company_id) throw new Error("Sem empresa vinculada.");
    if (membership.role !== "admin") throw new Error("Apenas administradores podem alterar.");

    const { error } = await supabase
      .from("signature_settings")
      .upsert(
        { company_id: membership.company_id, ...data },
        { onConflict: "company_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
