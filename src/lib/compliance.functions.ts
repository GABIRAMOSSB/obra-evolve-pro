/**
 * Server functions for the Governança e Compliance module.
 *
 * Replaces what would otherwise be Supabase Edge Functions:
 *   - infosimples-adapter   → callInfosimples (compliance.server.ts)
 *   - update-certificate    → updateCertificate
 *   - update-all-certificates → updateAllCertificates
 *   - upload-manual-certificate → uploadManualCertificate
 *   - certificate-health-check → runComplianceHealthCheck
 *   - scheduled-certificate-check → runScheduledChecks (called by the public
 *     route src/routes/api.public.compliance-scheduled.ts)
 *
 * Security model:
 *   - Every fn validates that the caller is a member of the company.
 *   - Mutating fns require role admin/editor (compliance_manager).
 *   - INFOSIMPLES_TOKEN is read inside .handler() only; never sent to client.
 *   - Service-role client is loaded inside handlers (await import) so it never
 *     leaks into client bundles.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface ComplianceHealth {
  provider: string;
  sandbox_mode: boolean;
  production_enabled: boolean;
  token_configured: boolean;
  endpoint_base_url: string | null;
  last_health_check_at: string | null;
  last_health_check_status: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function resolveCompanyId(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  return data.company_id as string;
}

async function requireAdminEditor(
  supabase: AnySupabase,
  userId: string,
): Promise<{ companyId: string; role: string }> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  if (data.role !== "admin" && data.role !== "editor") {
    throw new Error("Permissão insuficiente. Apenas administradores e editores podem executar esta ação.");
  }
  return { companyId: data.company_id as string, role: data.role as string };
}


/* ----------------------------- HEALTH CHECK ----------------------------- */

export const runComplianceHealthCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ComplianceHealth> => {
    const { supabase } = context;
    await resolveCompanyId(supabase, context.userId);

    const tokenConfigured = Boolean(process.env.INFOSIMPLES_TOKEN);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("integration_settings")
      .select("*")
      .eq("provider", "infosimples")
      .maybeSingle();

    const sandboxMode = existing?.sandbox_mode ?? true;
    const productionEnabled = existing?.production_enabled ?? false;

    const status = sandboxMode
      ? "sandbox_ok"
      : tokenConfigured && productionEnabled
        ? "production_ok"
        : "production_token_missing";

    const { data: updated } = await supabaseAdmin
      .from("integration_settings")
      .update({
        token_configured: tokenConfigured,
        last_health_check_at: new Date().toISOString(),
        last_health_check_status: status,
      })
      .eq("provider", "infosimples")
      .select()
      .single();

    return {
      provider: "infosimples",
      sandbox_mode: updated?.sandbox_mode ?? sandboxMode,
      production_enabled: updated?.production_enabled ?? productionEnabled,
      token_configured: tokenConfigured,
      endpoint_base_url: updated?.endpoint_base_url ?? null,
      last_health_check_at: updated?.last_health_check_at ?? null,
      last_health_check_status: updated?.last_health_check_status ?? status,
    };
  });

export const getComplianceHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ComplianceHealth> => {
    const { supabase } = context;
    await resolveCompanyId(supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("integration_settings")
      .select("*")
      .eq("provider", "infosimples")
      .maybeSingle();

    return {
      provider: "infosimples",
      sandbox_mode: data?.sandbox_mode ?? true,
      production_enabled: data?.production_enabled ?? false,
      token_configured: Boolean(process.env.INFOSIMPLES_TOKEN),
      endpoint_base_url: data?.endpoint_base_url ?? null,
      last_health_check_at: data?.last_health_check_at ?? null,
      last_health_check_status: data?.last_health_check_status ?? null,
    };
  });

/* ------------------------- UPDATE INDIVIDUAL CERT ------------------------ */

export const updateCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_certificate_id: z.string().uuid(),
        trigger_type: z
          .enum(["manual", "scheduled", "initial_seed", "retry", "administrative_test"])
          .default("manual"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { companyId } = await requireAdminEditor(supabase, context.userId);

    const { callInfosimples, classifyExpiration } = await import("@/lib/compliance.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: cert, error: certErr } = await supabaseAdmin
      .from("company_certificates")
      .select("*, certificate_types(*), companies(cnpj, state, city)")
      .eq("id", data.company_certificate_id)
      .eq("company_id", companyId)
      .single();
    if (certErr || !cert) throw new Error("Certidão não encontrada");

    const t = (cert as { certificate_types: { automatic_enabled: boolean; code: string; provider_service_key: string | null } }).certificate_types;
    if (!t.automatic_enabled) {
      throw new Error("Esta certidão exige atualização manual (upload de PDF).");
    }

    const { data: settings } = await supabaseAdmin
      .from("integration_settings")
      .select("*")
      .eq("provider", "infosimples")
      .single();

    const startedAt = new Date();

    const result = await callInfosimples(t.code, {
      cnpj: (cert as { companies: { cnpj: string | null } }).companies?.cnpj ?? "",
      state: (cert as { companies: { state: string | null } }).companies?.state ?? null,
      city: (cert as { companies: { city: string | null } }).companies?.city ?? null,
      provider_service_key: t.provider_service_key,
      sandbox: settings?.sandbox_mode ?? true,
      production_enabled: settings?.production_enabled ?? false,
    });

    const completedAt = new Date();

    // Log check
    await supabaseAdmin.from("certificate_checks").insert({
      company_id: companyId,
      certificate_type_id: (cert as { certificate_type_id: string }).certificate_type_id,
      company_certificate_id: (cert as { id: string }).id,
      execution_mode: result.execution_mode,
      trigger_type: data.trigger_type,
      status: result.ok ? "success" : "error",
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
      duration_ms: completedAt.getTime() - startedAt.getTime(),
      provider: "infosimples",
      provider_service_key: t.provider_service_key,
      result_summary: result.status_message,
      error_code: result.error_code,
      error_message: result.error_message,
      raw_response_json: result.raw as never,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("company_certificates")
        .update({
          last_checked_at: completedAt.toISOString(),
          last_error_at: completedAt.toISOString(),
          last_error_message: result.error_message ?? result.status_message,
          status: result.status,
          status_message: result.status_message,
        })
        .eq("id", data.company_certificate_id);
      return { ok: false, message: result.status_message };
    }

    // Compute final status from expiration
    const finalStatus = classifyExpiration(result.expiration_date);

    // Create new version (no PDF dedupe yet for sandbox)
    const { data: lastVersion } = await supabaseAdmin
      .from("certificate_versions")
      .select("version_number")
      .eq("company_certificate_id", data.company_certificate_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (lastVersion?.version_number ?? 0) + 1;

    const { data: version } = await supabaseAdmin
      .from("certificate_versions")
      .insert({
        company_certificate_id: data.company_certificate_id,
        version_number: nextVersion,
        issue_date: result.issue_date,
        expiration_date: result.expiration_date,
        certificate_number: result.certificate_number,
        authentication_code: result.authentication_code,
        status: finalStatus,
        status_message: result.status_message,
        source_type: result.execution_mode,
        api_provider: "infosimples",
        provider_service_key: t.provider_service_key,
        raw_payload_json: result.raw as never,
        normalized_payload_json: result as never,
      })
      .select()
      .single();

    const nextCheckDays = 7;
    const nextCheckAt = new Date();
    nextCheckAt.setDate(nextCheckAt.getDate() + nextCheckDays);

    await supabaseAdmin
      .from("company_certificates")
      .update({
        current_version_id: version?.id,
        status: finalStatus,
        status_message: result.status_message,
        issue_date: result.issue_date,
        expiration_date: result.expiration_date,
        certificate_number: result.certificate_number,
        authentication_code: result.authentication_code,
        last_checked_at: completedAt.toISOString(),
        last_success_at: completedAt.toISOString(),
        next_check_at: nextCheckAt.toISOString(),
        source_type: result.execution_mode,
        api_provider: "infosimples",
        last_error_message: null,
      })
      .eq("id", data.company_certificate_id);

    // Audit
    await supabaseAdmin.from("compliance_audit_logs").insert({
      company_id: companyId,
      action: "certificate_updated",
      entity_type: "company_certificate",
      entity_id: data.company_certificate_id,
      description: `Certidão atualizada via ${result.execution_mode} (${t.code})`,
      metadata_json: { trigger_type: data.trigger_type, status: finalStatus },
    });

    return { ok: true, status: finalStatus, message: result.status_message };
  });

/* --------------------------- UPDATE ALL CERTS --------------------------- */

export const updateAllCertificates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { companyId } = await requireAdminEditor(supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { callInfosimples, classifyExpiration } = await import("@/lib/compliance.server");

    const { data: certs } = await supabaseAdmin
      .from("company_certificates")
      .select("id, certificate_type_id, certificate_types(*), companies(cnpj, state, city)")
      .eq("company_id", companyId)
      .eq("automatic_update_enabled", true);

    const { data: settings } = await supabaseAdmin
      .from("integration_settings")
      .select("*")
      .eq("provider", "infosimples")
      .single();

    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    let manualNeeded = 0;

    for (const cert of certs ?? []) {
      const c = cert as unknown as {
        id: string;
        certificate_type_id: string;
        certificate_types: { automatic_enabled: boolean; code: string; provider_service_key: string | null };
        companies: { cnpj: string | null; state: string | null; city: string | null };
      };
      if (!c.certificate_types?.automatic_enabled) {
        manualNeeded++;
        continue;
      }
      const startedAt = new Date();
      try {
        const result = await callInfosimples(c.certificate_types.code, {
          cnpj: c.companies?.cnpj ?? "",
          state: c.companies?.state ?? null,
          city: c.companies?.city ?? null,
          provider_service_key: c.certificate_types.provider_service_key,
          sandbox: settings?.sandbox_mode ?? true,
          production_enabled: settings?.production_enabled ?? false,
        });
        const completedAt = new Date();

        await supabaseAdmin.from("certificate_checks").insert({
          company_id: companyId,
          certificate_type_id: c.certificate_type_id,
          company_certificate_id: c.id,
          execution_mode: result.execution_mode,
          trigger_type: "manual",
          status: result.ok ? "success" : "error",
          started_at: startedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          duration_ms: completedAt.getTime() - startedAt.getTime(),
          provider: "infosimples",
          provider_service_key: c.certificate_types.provider_service_key,
          result_summary: result.status_message,
          error_code: result.error_code,
          error_message: result.error_message,
          raw_response_json: result.raw as never,
        });

        if (!result.ok) {
          failed++;
          await supabaseAdmin
            .from("company_certificates")
            .update({
              last_checked_at: completedAt.toISOString(),
              last_error_at: completedAt.toISOString(),
              last_error_message: result.error_message ?? result.status_message,
              status: result.status,
              status_message: result.status_message,
            })
            .eq("id", c.id);
          continue;
        }

        const { data: lastVersion } = await supabaseAdmin
          .from("certificate_versions")
          .select("certificate_number, version_number")
          .eq("company_certificate_id", c.id)
          .order("version_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        const isSameDoc =
          lastVersion?.certificate_number &&
          lastVersion.certificate_number === result.certificate_number;

        const finalStatus = classifyExpiration(result.expiration_date);

        if (isSameDoc) {
          unchanged++;
          await supabaseAdmin
            .from("company_certificates")
            .update({
              last_checked_at: completedAt.toISOString(),
              last_success_at: completedAt.toISOString(),
              status: finalStatus,
              status_message: result.status_message,
            })
            .eq("id", c.id);
        } else {
          const nextVersion = (lastVersion?.version_number ?? 0) + 1;
          const { data: version } = await supabaseAdmin
            .from("certificate_versions")
            .insert({
              company_certificate_id: c.id,
              version_number: nextVersion,
              issue_date: result.issue_date,
              expiration_date: result.expiration_date,
              certificate_number: result.certificate_number,
              authentication_code: result.authentication_code,
              status: finalStatus,
              status_message: result.status_message,
              source_type: result.execution_mode,
              api_provider: "infosimples",
              provider_service_key: c.certificate_types.provider_service_key,
              raw_payload_json: result.raw as never,
              normalized_payload_json: result as never,
            })
            .select()
            .single();

          updated++;

          const nextCheckAt = new Date();
          nextCheckAt.setDate(nextCheckAt.getDate() + 7);

          await supabaseAdmin
            .from("company_certificates")
            .update({
              current_version_id: version?.id,
              status: finalStatus,
              status_message: result.status_message,
              issue_date: result.issue_date,
              expiration_date: result.expiration_date,
              certificate_number: result.certificate_number,
              authentication_code: result.authentication_code,
              last_checked_at: completedAt.toISOString(),
              last_success_at: completedAt.toISOString(),
              next_check_at: nextCheckAt.toISOString(),
              source_type: result.execution_mode,
              api_provider: "infosimples",
              last_error_message: null,
            })
            .eq("id", c.id);
        }
      } catch (e) {
        failed++;
        await supabaseAdmin.from("certificate_checks").insert({
          company_id: companyId,
          certificate_type_id: c.certificate_type_id,
          company_certificate_id: c.id,
          execution_mode: settings?.sandbox_mode ? "sandbox" : "production",
          trigger_type: "manual",
          status: "error",
          started_at: startedAt.toISOString(),
          completed_at: new Date().toISOString(),
          provider: "infosimples",
          error_message: (e as Error).message,
        });
      }
    }

    await supabaseAdmin.from("compliance_audit_logs").insert({
      company_id: companyId,
      action: "bulk_update",
      entity_type: "company_certificates",
      description: `Atualização em lote: ${updated} atualizadas, ${unchanged} sem mudança, ${failed} falhas, ${manualNeeded} requerem upload manual.`,
      metadata_json: { updated, unchanged, failed, manualNeeded },
    });

    return { updated, unchanged, failed, manualNeeded };
  });

/* ------------------------- UPLOAD MANUAL CERT --------------------------- */

export const uploadManualCertificate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        company_certificate_id: z.string().uuid(),
        file_name: z.string().min(1).max(200),
        file_base64: z.string().min(10),
        mime_type: z.string().default("application/pdf"),
        issue_date: z.string().nullable().optional(),
        expiration_date: z.string().nullable().optional(),
        certificate_number: z.string().max(120).nullable().optional(),
        notes: z.string().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { companyId } = await requireAdminEditor(supabase, context.userId);

    if (data.mime_type !== "application/pdf") {
      throw new Error("Apenas arquivos PDF são aceitos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { classifyExpiration } = await import("@/lib/compliance.server");

    const { data: cert } = await supabaseAdmin
      .from("company_certificates")
      .select("id, certificate_type_id, certificate_types(code)")
      .eq("id", data.company_certificate_id)
      .eq("company_id", companyId)
      .single();
    if (!cert) throw new Error("Certidão não encontrada");

    const typeCode = (cert as { certificate_types: { code: string } }).certificate_types.code;

    const buffer = Buffer.from(data.file_base64, "base64");
    if (buffer.byteLength > 20 * 1024 * 1024) {
      throw new Error("Arquivo excede 20MB.");
    }
    const crypto = await import("crypto");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // Dedupe by hash
    const { data: dupe } = await supabaseAdmin
      .from("certificate_versions")
      .select("id, version_number")
      .eq("company_certificate_id", data.company_certificate_id)
      .eq("file_hash", hash)
      .maybeSingle();

    if (dupe) {
      await supabaseAdmin
        .from("company_certificates")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", data.company_certificate_id);
      return { ok: true, deduped: true, version_id: dupe.id };
    }

    const year = new Date().getFullYear();
    const safeName = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `companies/${companyId}/certificates/${typeCode}/${year}/${Date.now()}-${safeName}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from("company-certificates")
      .upload(path, buffer, { contentType: "application/pdf", upsert: false });
    if (upErr) throw new Error(`Falha no upload: ${upErr.message}`);

    const { data: lastVersion } = await supabaseAdmin
      .from("certificate_versions")
      .select("version_number")
      .eq("company_certificate_id", data.company_certificate_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (lastVersion?.version_number ?? 0) + 1;

    const finalStatus = classifyExpiration(data.expiration_date ?? null);

    const { data: version } = await supabaseAdmin
      .from("certificate_versions")
      .insert({
        company_certificate_id: data.company_certificate_id,
        version_number: nextVersion,
        issue_date: data.issue_date ?? null,
        expiration_date: data.expiration_date ?? null,
        certificate_number: data.certificate_number ?? null,
        status: finalStatus,
        status_message: data.notes ?? "Upload manual",
        storage_path: path,
        file_name: data.file_name,
        file_hash: hash,
        mime_type: "application/pdf",
        file_size: buffer.byteLength,
        source_type: "manual",
        api_provider: null,
      })
      .select()
      .single();

    await supabaseAdmin
      .from("company_certificates")
      .update({
        current_version_id: version?.id,
        status: finalStatus,
        status_message: data.notes ?? "Documento anexado manualmente",
        issue_date: data.issue_date ?? null,
        expiration_date: data.expiration_date ?? null,
        certificate_number: data.certificate_number ?? null,
        last_checked_at: new Date().toISOString(),
        last_success_at: new Date().toISOString(),
        source_type: "manual",
        file_available: true,
        manual_review_required: false,
        last_error_message: null,
      })
      .eq("id", data.company_certificate_id);

    await supabaseAdmin.from("compliance_audit_logs").insert({
      company_id: companyId,
      action: "manual_upload",
      entity_type: "company_certificate",
      entity_id: data.company_certificate_id,
      description: `Upload manual de PDF para ${typeCode}`,
      metadata_json: { file_name: data.file_name, file_size: buffer.byteLength, hash },
    });

    return { ok: true, deduped: false, version_id: version?.id };
  });

/* ----------------------- SIGNED URL FOR PDF DOWNLOAD --------------------- */

export const getSignedCertificateUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ version_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: version } = await supabaseAdmin
      .from("certificate_versions")
      .select("storage_path, company_certificate_id, company_certificates!inner(company_id)")
      .eq("id", data.version_id)
      .single();

    if (
      !version ||
      (version as unknown as { company_certificates: { company_id: string } })
        .company_certificates.company_id !== companyId
    ) {
      throw new Error("Versão não encontrada ou sem permissão.");
    }
    if (!version.storage_path) throw new Error("Esta versão não possui arquivo armazenado.");

    const { data: signed, error } = await supabaseAdmin.storage
      .from("company-certificates")
      .createSignedUrl(version.storage_path, 300);
    if (error || !signed) throw new Error(error?.message ?? "Falha ao gerar URL assinada");

    await supabaseAdmin.from("compliance_audit_logs").insert({
      company_id: companyId,
      action: "download",
      entity_type: "certificate_version",
      entity_id: data.version_id,
      description: "Download de certidão (URL assinada gerada)",
    });

    return { url: signed.signedUrl, expires_in_seconds: 300 };
  });

/* ----------------------- SANDBOX / PRODUCTION TOGGLES --------------------- */

export const requestProductionActivation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ confirm: z.literal(true) }).parse(input),
  )
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { companyId, role } = await requireAdminEditor(supabase, context.userId);
    if (role !== "admin") throw new Error("Apenas administradores podem solicitar ativação de produção.");

    const tokenConfigured = Boolean(process.env.INFOSIMPLES_TOKEN);
    if (!tokenConfigured) {
      throw new Error(
        "INFOSIMPLES_TOKEN ainda não foi cadastrado em Secrets. Cadastre o token e tente novamente.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("integration_settings")
      .update({
        sandbox_mode: false,
        production_enabled: true,
        token_configured: true,
      })
      .eq("provider", "infosimples");

    await supabaseAdmin.from("compliance_audit_logs").insert({
      company_id: companyId,
      action: "production_activated",
      entity_type: "integration_settings",
      description: "Produção ativada por administrador (sandbox desligado).",
    });

    return { ok: true };
  });

export const clearSandboxData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ confirm: z.literal(true) }).parse(input),
  )
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { companyId, role } = await requireAdminEditor(supabase, context.userId);
    if (role !== "admin") throw new Error("Apenas administradores podem limpar dados de teste.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("integration_settings")
      .select("sandbox_mode")
      .eq("provider", "infosimples")
      .single();
    if (!settings?.sandbox_mode) {
      throw new Error("Produção está ativa. A limpeza de dados de teste foi desabilitada por segurança.");
    }

    // Delete sandbox-only versions for this company
    const { data: certs } = await supabaseAdmin
      .from("company_certificates")
      .select("id")
      .eq("company_id", companyId);
    const ids = (certs ?? []).map((c) => c.id);
    if (ids.length === 0) return { ok: true, deleted: 0 };

    const { error: delErr } = await supabaseAdmin
      .from("certificate_versions")
      .delete()
      .in("company_certificate_id", ids)
      .eq("source_type", "sandbox");
    if (delErr) throw new Error(delErr.message);

    await supabaseAdmin
      .from("certificate_checks")
      .delete()
      .eq("company_id", companyId)
      .eq("execution_mode", "sandbox");

    await supabaseAdmin
      .from("company_certificates")
      .update({
        current_version_id: null,
        last_checked_at: null,
        last_success_at: null,
        issue_date: null,
        expiration_date: null,
        certificate_number: null,
        authentication_code: null,
        status: "sandbox",
        status_message: "Dados de teste limpos",
      })
      .in("id", ids);

    await supabaseAdmin.from("compliance_audit_logs").insert({
      company_id: companyId,
      action: "sandbox_cleared",
      entity_type: "company_certificates",
      description: `Dados simulados removidos para ${ids.length} certidões.`,
    });

    return { ok: true, deleted: ids.length };
  });

/* --------------------------- DATA FETCH HELPERS --------------------------- */

export const listCertificates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data } = await supabase
      .from("company_certificates")
      .select("*, certificate_types(*)")
      .eq("company_id", companyId);
    const rows = data ?? [];
    rows.sort((a, b) => {
      const da = (a as { certificate_types: { display_order: number } }).certificate_types?.display_order ?? 0;
      const db = (b as { certificate_types: { display_order: number } }).certificate_types?.display_order ?? 0;
      return da - db;
    });
    return rows;
  });

export const listVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: certs } = await supabase
      .from("company_certificates")
      .select("id")
      .eq("company_id", companyId);
    const ids = (certs ?? []).map((c) => c.id);
    if (ids.length === 0) return [];
    const { data } = await supabase
      .from("certificate_versions")
      .select("*, company_certificates!inner(id, certificate_types(name, short_name, code))")
      .in("company_certificate_id", ids)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const listAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data } = await supabase
      .from("compliance_alerts")
      .select("*, certificate_types(short_name, name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ alert_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    await requireAdminEditor(supabase, context.userId);
    const { error } = await supabase
      .from("compliance_alerts")
      .update({ resolved: true, resolved_at: new Date().toISOString(), read: true })
      .eq("id", data.alert_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data } = await supabase
      .from("certificate_checks")
      .select("*, certificate_types(short_name, name)")
      .eq("company_id", companyId)
      .order("started_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data } = await supabase
      .from("compliance_audit_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

/* ----------------------- CERTIFICATE DETAILS DRAWER ---------------------- */

export const getCertificateDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ company_certificate_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const { data: cert, error: certErr } = await supabase
      .from("company_certificates")
      .select("*, certificate_types(*)")
      .eq("id", data.company_certificate_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (certErr) throw new Error(certErr.message);
    if (!cert) throw new Error("Certidão não encontrada.");

    const { data: versions } = await supabase
      .from("certificate_versions")
      .select("*")
      .eq("company_certificate_id", data.company_certificate_id)
      .order("version_number", { ascending: false });

    const { data: checks } = await supabase
      .from("certificate_checks")
      .select("*")
      .eq("company_certificate_id", data.company_certificate_id)
      .order("started_at", { ascending: false })
      .limit(30);

    return { cert, versions: versions ?? [], checks: checks ?? [] };
  });

/* --------------------- NOTIFICATION RULES (CRUD) --------------------- */

export const listNotificationRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("notification_rules")
      .select("*, certificate_types(id, code, short_name, name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listCertificateTypesForRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("certificate_types")
      .select("id, code, short_name, name, display_order")
      .order("display_order", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertNotificationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid().optional(),
        certificate_type_id: z.string().uuid().nullable(),
        warning_days: z.number().int().min(0).max(365),
        notify_on_expired: z.boolean(),
        notify_on_error: z.boolean(),
        notify_on_status_change: z.boolean(),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { companyId } = await requireAdminEditor(supabase, context.userId);
    const payload = {
      company_id: companyId,
      certificate_type_id: data.certificate_type_id,
      warning_days: data.warning_days,
      notify_on_expired: data.notify_on_expired,
      notify_on_error: data.notify_on_error,
      notify_on_status_change: data.notify_on_status_change,
      active: data.active,
    };
    if (data.id) {
      const { error } = await supabase
        .from("notification_rules")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("notification_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: inserted!.id };
  });

export const deleteNotificationRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    const { supabase } = context;
    const { companyId } = await requireAdminEditor(supabase, context.userId);
    const { error } = await supabase
      .from("notification_rules")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

