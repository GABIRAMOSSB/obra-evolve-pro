/**
 * Cron endpoint — renovação automática de certidões.
 *
 * Executa diariamente (pg_cron). Busca apenas certificados onde
 * next_check_at <= now() — ou seja, a 3 dias do vencimento. Isso garante
 * que cada certidão consome créditos da InfoSimples apenas 1x próximo
 * ao vencimento (não há varredura diária por certidão).
 *
 * Autenticação: header `apikey` com o Supabase anon key (.env publishable).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callInfosimples, classifyExpiration } from "@/lib/compliance.server";

async function processOne(certId: string) {
  const { data: cert } = await supabaseAdmin
    .from("company_certificates")
    .select("*, certificate_types(code, automatic_enabled, provider_service_key), companies(cnpj, state, city)")
    .eq("id", certId)
    .single();
  if (!cert) return { id: certId, ok: false, error: "not_found" };
  const t = cert.certificate_types as { code: string; automatic_enabled: boolean; provider_service_key: string | null };
  if (!t?.automatic_enabled) return { id: certId, ok: false, error: "manual_only" };

  const { data: settings } = await supabaseAdmin.from("integration_settings").select("*").eq("provider", "infosimples").single();
  const companies = cert.companies as { cnpj: string | null; state: string | null; city: string | null } | null;
  const startedAt = new Date();
  const result = await callInfosimples(t.code, {
    cnpj: companies?.cnpj ?? "",
    state: companies?.state ?? null,
    city: companies?.city ?? null,
    provider_service_key: t.provider_service_key,
    sandbox: settings?.sandbox_mode ?? true,
    production_enabled: settings?.production_enabled ?? false,
  });
  const completedAt = new Date();

  await supabaseAdmin.from("certificate_checks").insert({
    company_id: cert.company_id,
    certificate_type_id: cert.certificate_type_id,
    company_certificate_id: cert.id,
    execution_mode: result.execution_mode,
    trigger_type: "scheduled",
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
    await supabaseAdmin.from("company_certificates").update({
      last_checked_at: completedAt.toISOString(),
      last_error_at: completedAt.toISOString(),
      last_error_message: result.error_message ?? result.status_message,
    }).eq("id", certId);
    return { id: certId, ok: false, error: result.error_message };
  }

  const { data: lastV } = await supabaseAdmin
    .from("certificate_versions")
    .select("version_number")
    .eq("company_certificate_id", certId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextV = (lastV?.version_number ?? 0) + 1;
  const finalStatus = classifyExpiration(result.expiration_date);

  const { data: version } = await supabaseAdmin.from("certificate_versions").insert({
    company_certificate_id: certId,
    version_number: nextV,
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
  }).select().single();

  // Próxima renovação: 3 dias antes da validade
  const nextCheckAt = result.expiration_date
    ? new Date(new Date(result.expiration_date).getTime() - 3 * 86400000)
    : (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d; })();

  await supabaseAdmin.from("company_certificates").update({
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
  }).eq("id", certId);

  return { id: certId, ok: true, status: finalStatus };
}

export const Route = createFileRoute("/api/public/compliance-scheduled")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? "";
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!apiKey || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("company_certificates")
          .select("id")
          .lte("next_check_at", nowIso)
          .eq("automatic_update_enabled", true)
          .limit(50);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results: { id: string; ok: boolean; status?: string; error?: string }[] = [];
        for (const row of due ?? []) {
          try {
            results.push(await processOne(row.id));
          } catch (e) {
            results.push({ id: row.id, ok: false, error: (e as Error).message });
          }
        }
        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
