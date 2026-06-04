import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const PENDING_REQUEST_STATUSES = [
  "awaiting_signature",
  "partially_signed",
  "placement_done",
] as const;

const channelSchema = z.enum(["whatsapp", "email", "sms"]);

/** Manually resend the signature link to a single pending signer. */
export const resendSignerLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { signerId: string; channel?: "whatsapp" | "email" | "sms" }) =>
    z
      .object({
        signerId: z.string().uuid(),
        channel: channelSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { zapsignRequest } = await import("@/lib/zapsign.server");

    const { data: signer, error } = await supabase
      .from("signature_signers")
      .select(
        "id, status, email, phone_number, zapsign_signer_token, signature_request_id",
      )
      .eq("id", data.signerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!signer) throw new Error("Signatário não encontrado.");
    if (signer.status === "signed") throw new Error("Signatário já assinou.");
    if (!signer.zapsign_signer_token)
      throw new Error("Token do signatário ausente — pedido ainda não enviado.");

    const channel: "whatsapp" | "email" | "sms" =
      data.channel ?? (signer.phone_number ? "whatsapp" : "email");

    try {
      await zapsignRequest({
        method: "POST",
        path: `/signer/${signer.zapsign_signer_token}/resend/`,
        body: { type: channel },
      });
    } catch (e) {
      throw new Error(`Falha ao reenviar via ${channel}: ${(e as Error).message}`);
    }

    const nowIso = new Date().toISOString();
    await supabase
      .from("signature_signers")
      .update({
        last_reminder_at: nowIso,
        reminder_count: ((signer as { reminder_count?: number }).reminder_count ?? 0) + 1,
        last_shared_at: nowIso,
      })
      .eq("id", signer.id);

    await supabase.from("signature_events").insert({
      signature_request_id: signer.signature_request_id,
      signer_id: signer.id,
      event_type: "reminder_sent",
      event_description: `Lembrete enviado manualmente via ${channel}`,
    });

    return { ok: true, channel };
  });

interface ReminderRunResult {
  scanned: number;
  sent: number;
  skipped: number;
  errors: Array<{ signerId: string; message: string }>;
}

/**
 * Internal helper used by the cron route. Sends reminders for every signer
 * whose request is still pending, based on each company's reminder_interval_days
 * and reminder_max_count. Uses the admin Supabase client (bypasses RLS).
 */
export async function runReminderBatch(): Promise<ReminderRunResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { zapsignRequest } = await import("@/lib/zapsign.server");

  const result: ReminderRunResult = { scanned: 0, sent: 0, skipped: 0, errors: [] };

  const { data: settingsRows } = await supabaseAdmin
    .from("signature_settings")
    .select(
      "company_id, reminder_enabled, reminder_interval_days, reminder_max_count, reminder_channel",
    )
    .eq("reminder_enabled", true);

  if (!settingsRows || settingsRows.length === 0) return result;

  for (const cfg of settingsRows) {
    const { data: pendingRequests } = await supabaseAdmin
      .from("signature_requests")
      .select("id")
      .eq("company_id", cfg.company_id)
      .in("status", PENDING_REQUEST_STATUSES as unknown as string[]);
    if (!pendingRequests || pendingRequests.length === 0) continue;

    const requestIds = pendingRequests.map((r) => r.id);
    const { data: signers } = await supabaseAdmin
      .from("signature_signers")
      .select(
        "id, signature_request_id, status, email, phone_number, zapsign_signer_token, last_reminder_at, reminder_count, last_shared_at, created_at",
      )
      .in("signature_request_id", requestIds)
      .neq("status", "signed")
      .neq("status", "refused")
      .not("zapsign_signer_token", "is", null);

    if (!signers) continue;

    const intervalMs = (cfg.reminder_interval_days ?? 3) * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const signer of signers) {
      result.scanned++;
      const count = signer.reminder_count ?? 0;
      if (count >= (cfg.reminder_max_count ?? 3)) {
        result.skipped++;
        continue;
      }
      const lastTs = signer.last_reminder_at
        ? new Date(signer.last_reminder_at).getTime()
        : signer.last_shared_at
          ? new Date(signer.last_shared_at).getTime()
          : new Date(signer.created_at).getTime();
      if (now - lastTs < intervalMs) {
        result.skipped++;
        continue;
      }

      const channel =
        (cfg.reminder_channel as "whatsapp" | "email" | "sms" | undefined) ??
        (signer.phone_number ? "whatsapp" : "email");

      try {
        await zapsignRequest({
          method: "POST",
          path: `/signer/${signer.zapsign_signer_token}/resend/`,
          body: { type: channel },
        });
        const nowIso = new Date().toISOString();
        await supabaseAdmin
          .from("signature_signers")
          .update({
            last_reminder_at: nowIso,
            reminder_count: count + 1,
          })
          .eq("id", signer.id);
        await supabaseAdmin.from("signature_events").insert({
          signature_request_id: signer.signature_request_id,
          signer_id: signer.id,
          event_type: "reminder_sent",
          event_description: `Lembrete automático via ${channel} (${count + 1}/${cfg.reminder_max_count})`,
        });
        result.sent++;
      } catch (e) {
        result.errors.push({ signerId: signer.id, message: (e as Error).message });
      }
    }
  }

  return result;
}

/** Optional manual trigger from the dashboard (admin only). */
export const runRemindersNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: membership } = await supabase
      .from("company_members")
      .select("role")
      .maybeSingle();
    if (membership?.role !== "admin")
      throw new Error("Apenas administradores podem disparar lembretes.");
    return runReminderBatch();
  });
