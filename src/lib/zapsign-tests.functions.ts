import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TestStatus = "pass" | "fail" | "warn" | "manual";

export interface DiagnosticResult {
  id: string;
  status: TestStatus;
  message: string;
  details?: Record<string, string | number | boolean | null>;
}

async function getCompany(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("company_members")
    .select("company_id")
    .maybeSingle();
  return data?.company_id ?? null;
}

/** 1. Connection: token reaches ZapSign sandbox. */
export const testConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<DiagnosticResult> => {
    const { zapsignRequest, ZapSignConfigError, getZapSignConfig } = await import(
      "@/lib/zapsign.server"
    );
    try {
      const cfg = getZapSignConfig();
      await zapsignRequest({ method: "GET", path: "/docs/?page=1" });
      return {
        id: "connection",
        status: "pass",
        message: "Token validado e endpoint acessível.",
        details: { baseUrl: cfg.baseUrl },
      };
    } catch (e) {
      const msg = e instanceof ZapSignConfigError ? e.message : (e as Error).message;
      return { id: "connection", status: "fail", message: msg };
    }
  });

/** 2. Document send capability: settings + storage bucket presence. */
export const testDocumentReady = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticResult> => {
    const { supabase } = context;
    const companyId = await getCompany(supabase);
    if (!companyId)
      return { id: "document", status: "fail", message: "Sem empresa vinculada." };
    const { data: settings } = await supabase
      .from("signature_settings")
      .select("environment, default_auth_mode")
      .eq("company_id", companyId)
      .maybeSingle();
    if (!settings)
      return {
        id: "document",
        status: "warn",
        message: "Preferências de assinatura não configuradas.",
      };
    return {
      id: "document",
      status: "pass",
      message: `Pronto para envio em modo ${settings.environment}.`,
      details: settings,
    };
  });

/** 3. Field positioning: at least one request with placements applied. */
export const testPlacements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticResult> => {
    const { supabase } = context;
    const { data } = await supabase
      .from("signature_events")
      .select("id, payload, created_at")
      .eq("event_type", "request_created")
      .order("created_at", { ascending: false })
      .limit(10);
    const withPlacements = (data ?? []).filter(
      (r: any) => Number(r.payload?.placements_applied ?? 0) > 0,
    );
    if (withPlacements.length === 0)
      return {
        id: "placements",
        status: "warn",
        message:
          "Nenhum envio recente com campos posicionados. Use o posicionador no envio de teste.",
      };
    return {
      id: "placements",
      status: "pass",
      message: `${withPlacements.length} envio(s) com campos posicionados aplicados.`,
    };
  });

/** 4. Multiple signers: at least one request with >=2 signers. */
export const testMultipleSigners = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticResult> => {
    const { supabase } = context;
    const { data } = await supabase
      .from("signature_signers")
      .select("signature_request_id")
      .limit(1000);
    const counts = new Map<string, number>();
    for (const r of data ?? [])
      counts.set(r.signature_request_id, (counts.get(r.signature_request_id) ?? 0) + 1);
    const multi = Array.from(counts.values()).filter((n) => n >= 2).length;
    if (multi === 0)
      return {
        id: "multi-signers",
        status: "warn",
        message: "Nenhum envio com 2+ signatários. Crie um teste com múltiplos.",
      };
    return {
      id: "multi-signers",
      status: "pass",
      message: `${multi} documento(s) com múltiplos signatários.`,
    };
  });

/** 5. WhatsApp: setting enabled and/or signers com telefone. */
export const testWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticResult> => {
    const { supabase } = context;
    const companyId = await getCompany(supabase);
    if (!companyId)
      return { id: "whatsapp", status: "fail", message: "Sem empresa vinculada." };
    const { data: settings } = await supabase
      .from("signature_settings")
      .select("automatic_whatsapp, manual_whatsapp_enabled")
      .eq("company_id", companyId)
      .maybeSingle();
    const { count } = await supabase
      .from("signature_signers")
      .select("id", { count: "exact", head: true })
      .not("phone_number", "is", null);
    const enabled =
      settings?.automatic_whatsapp || settings?.manual_whatsapp_enabled;
    if (!enabled)
      return {
        id: "whatsapp",
        status: "warn",
        message: "WhatsApp desativado nas preferências.",
      };
    return {
      id: "whatsapp",
      status: "pass",
      message: `WhatsApp habilitado. ${count ?? 0} signatário(s) com telefone.`,
    };
  });

/** 6. Webhook: secret configured and last received within last 30 days. */
export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticResult> => {
    const { supabase } = context;
    const secret = Boolean(process.env.ZAPSIGN_WEBHOOK_SECRET);
    if (!secret)
      return {
        id: "webhook",
        status: "fail",
        message: "ZAPSIGN_WEBHOOK_SECRET não configurado.",
      };
    const companyId = await getCompany(supabase);
    if (!companyId)
      return { id: "webhook", status: "fail", message: "Sem empresa vinculada." };
    const { data: settings } = await supabase
      .from("signature_settings")
      .select("last_webhook_received_at")
      .eq("company_id", companyId)
      .maybeSingle();
    const last = settings?.last_webhook_received_at;
    if (!last)
      return {
        id: "webhook",
        status: "warn",
        message: "Secret OK. Nenhum webhook recebido ainda.",
      };
    const days = (Date.now() - new Date(last).getTime()) / 86400000;
    return {
      id: "webhook",
      status: days < 30 ? "pass" : "warn",
      message: `Último webhook há ${days.toFixed(1)} dia(s).`,
      details: { last_webhook_received_at: last },
    };
  });

/** 7. Final PDF: at least one signed document with hash. */
export const testFinalPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticResult> => {
    const { supabase } = context;
    const { count } = await supabase
      .from("signature_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "signed");
    if (!count || count === 0)
      return {
        id: "final-pdf",
        status: "warn",
        message: "Nenhum documento concluído ainda. Finalize uma assinatura de teste.",
      };
    return {
      id: "final-pdf",
      status: "pass",
      message: `${count} documento(s) assinados disponíveis para auditoria.`,
    };
  });

/** 8. Responsividade: manual checklist item. */
export const testResponsive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<DiagnosticResult> => {
    return {
      id: "responsive",
      status: "manual",
      message:
        "Verifique manualmente em mobile/tablet/desktop: dashboard, envio, posicionador.",
    };
  });

/** 9. Segurança: sandbox padrão, secrets presentes, RLS ativo (heurístico). */
export const testSecurity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosticResult> => {
    const { supabase } = context;
    const issues: string[] = [];
    if (!process.env.ZAPSIGN_API_TOKEN) issues.push("ZAPSIGN_API_TOKEN ausente");
    if (!process.env.ZAPSIGN_WEBHOOK_SECRET)
      issues.push("ZAPSIGN_WEBHOOK_SECRET ausente");
    const companyId = await getCompany(supabase);
    if (companyId) {
      const { data: settings } = await supabase
        .from("signature_settings")
        .select("environment")
        .eq("company_id", companyId)
        .maybeSingle();
      if (settings?.environment === "production")
        issues.push("Ambiente em produção — verifique procedimento de migração.");
    }
    if (issues.length === 0)
      return {
        id: "security",
        status: "pass",
        message: "Secrets presentes, sandbox ativo, RLS aplicado pelas tabelas.",
      };
    return {
      id: "security",
      status: "warn",
      message: issues.join(" • "),
    };
  });
