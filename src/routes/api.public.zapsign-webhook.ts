import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * ZapSign webhook receiver.
 *
 * Security: ZapSign does not sign payloads with HMAC by default. We require
 * a shared secret to be present either:
 *   - as ?secret=<ZAPSIGN_WEBHOOK_SECRET> query string, OR
 *   - as the `x-zapsign-secret` request header.
 * Use the same secret when configuring the webhook URL inside ZapSign.
 *
 * Idempotency: events are inserted into signature_events with a unique
 * external_event_id when ZapSign provides one; duplicates are ignored.
 */

const BUCKET = "obra-documentos";

function timingEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

type ZapSignSigner = {
  token?: string;
  external_id?: string;
  status?: string;
  name?: string;
  email?: string;
  times_viewed?: number;
  last_view_at?: string;
  signed_at?: string;
  refused_at?: string;
  refusal_reason?: string;
};

type ZapSignPayload = {
  event_type?: string;
  event_id?: string;
  token?: string; // document token
  open_id?: number | string;
  external_id?: string;
  status?: string;
  signed_file?: string;
  original_file?: string;
  signers?: ZapSignSigner[];
  signer?: ZapSignSigner;
  rejected_reason?: string;
  [k: string]: unknown;
};

function mapDocStatus(eventType?: string, payloadStatus?: string): string | null {
  const t = (eventType || "").toLowerCase();
  if (t.includes("doc_signed") || t === "signed") return "signed";
  if (t.includes("refused")) return "refused";
  if (t.includes("expired")) return "expired";
  if (t.includes("deleted") || t.includes("canceled")) return "canceled";
  if (t.includes("partial")) return "partially_signed";
  if (t.includes("signer_signed")) return "partially_signed";
  if (payloadStatus) {
    const s = payloadStatus.toLowerCase();
    if (s === "signed") return "signed";
    if (s === "refused") return "refused";
    if (s === "pending") return "awaiting_signature";
  }
  return null;
}

function mapSignerStatus(signer: ZapSignSigner): string {
  if (signer.signed_at) return "signed";
  if (signer.refused_at) return "refused";
  const s = (signer.status || "").toLowerCase();
  if (s.includes("sign")) return "signed";
  if (s.includes("refus")) return "refused";
  if (s.includes("view")) return "viewed";
  if (s.includes("sent")) return "sent";
  return s || "pending";
}

async function archiveSignedPdf(params: {
  signedUrl: string;
  companyId: string;
  obraId: string;
  folder: string;
  originalName: string;
  requestId: string;
}): Promise<{ path: string; hash: string } | null> {
  try {
    const res = await fetch(params.signedUrl);
    if (!res.ok) {
      console.error("[zapsign-webhook] download signed_file failed", res.status);
      return null;
    }
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const hash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const baseName = params.originalName.replace(/\.pdf$/i, "");
    const safeFolder = params.folder
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\-() ]+/g, "_");
    const fileName = `${Date.now()}-${baseName}-assinado.pdf`;
    const path = `${params.companyId}/${params.obraId}/${safeFolder}/${fileName}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        upsert: false,
        contentType: "application/pdf",
      });
    if (error) {
      console.error("[zapsign-webhook] upload signed_file failed", error.message);
      return null;
    }
    return { path, hash };
  } catch (e) {
    console.error("[zapsign-webhook] archive error", (e as Error).message);
    return null;
  }
}

export const Route = createFileRoute("/api/public/zapsign-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // --- Auth: shared secret ---
        const expected = process.env.ZAPSIGN_WEBHOOK_SECRET;
        if (!expected) {
          console.error("[zapsign-webhook] ZAPSIGN_WEBHOOK_SECRET not configured");
          return new Response("Webhook secret not configured", { status: 503 });
        }
        const url = new URL(request.url);
        const provided =
          url.searchParams.get("secret") ||
          request.headers.get("x-zapsign-secret") ||
          "";
        if (!provided || !timingEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }

        // --- Parse payload ---
        let raw = "";
        let payload: ZapSignPayload;
        try {
          raw = await request.text();
          payload = JSON.parse(raw) as ZapSignPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const docToken = payload.token;
        if (!docToken) {
          console.warn("[zapsign-webhook] payload without token", payload.event_type);
          return new Response("ok", { status: 200 });
        }

        // --- Locate request row ---
        const { data: req, error: reqErr } = await supabaseAdmin
          .from("signature_requests")
          .select("*")
          .eq("zapsign_document_token", docToken)
          .maybeSingle();
        if (reqErr) {
          console.error("[zapsign-webhook] lookup error", reqErr.message);
          return new Response("DB error", { status: 500 });
        }
        if (!req) {
          console.warn("[zapsign-webhook] unknown document token", docToken);
          return new Response("ok", { status: 200 });
        }

        // --- Idempotency on event_id when provided ---
        const eventId = payload.event_id ? String(payload.event_id) : null;
        if (eventId) {
          const { data: existing } = await supabaseAdmin
            .from("signature_events")
            .select("id")
            .eq("external_event_id", eventId)
            .maybeSingle();
          if (existing) {
            return new Response("duplicate", { status: 200 });
          }
        }

        // --- Update signers ---
        const signerList: ZapSignSigner[] = [
          ...(payload.signers ?? []),
          ...(payload.signer ? [payload.signer] : []),
        ];

        for (const sg of signerList) {
          if (!sg.token) continue;
          const patch: Record<string, unknown> = {
            status: mapSignerStatus(sg),
          };
          if (sg.signed_at) patch.signed_at = sg.signed_at;
          if (sg.refused_at) patch.refused_at = sg.refused_at;
          if (sg.refusal_reason) patch.refusal_reason = sg.refusal_reason;
          await supabaseAdmin
            .from("signature_signers")
            .update(patch)
            .eq("zapsign_signer_token", sg.token);
        }

        // --- Determine new doc status ---
        const newStatus = mapDocStatus(payload.event_type, payload.status);

        // For partially_signed, check if all signed
        let finalStatus = newStatus;
        if (newStatus === "partially_signed" || newStatus === "signed") {
          const { data: allSigners } = await supabaseAdmin
            .from("signature_signers")
            .select("status, mandatory")
            .eq("signature_request_id", req.id);
          const mand = (allSigners ?? []).filter((s) => s.mandatory);
          if (mand.length > 0 && mand.every((s) => s.status === "signed")) {
            finalStatus = "signed";
          } else if (newStatus !== "signed") {
            finalStatus = "partially_signed";
          }
        }

        const updates: Record<string, unknown> = {};
        if (finalStatus) updates.status = finalStatus;

        // --- Archive signed PDF on fully signed ---
        if (
          finalStatus === "signed" &&
          payload.signed_file &&
          !req.signed_file_path
        ) {
          const archived = await archiveSignedPdf({
            signedUrl: payload.signed_file,
            companyId: req.company_id,
            obraId: req.obra_id,
            folder: req.document_folder,
            originalName: req.document_name,
            requestId: req.id,
          });
          if (archived) {
            updates.signed_file_path = archived.path;
            updates.signed_file_hash = archived.hash;
            updates.signed_at = new Date().toISOString();
          }
        }

        if (finalStatus === "refused") {
          updates.cancellation_reason = payload.rejected_reason || null;
        }

        if (Object.keys(updates).length > 0) {
          await supabaseAdmin
            .from("signature_requests")
            .update(updates)
            .eq("id", req.id);
        }

        // --- Log event ---
        await supabaseAdmin.from("signature_events").insert({
          signature_request_id: req.id,
          event_type: payload.event_type || "webhook",
          event_description: `Webhook: ${payload.event_type || "unknown"} → ${finalStatus || "no-status-change"}`,
          external_event_id: eventId,
          payload: payload as unknown as Record<string, unknown>,
        });

        // Touch settings last_webhook_received_at
        await supabaseAdmin
          .from("signature_settings")
          .update({ last_webhook_received_at: new Date().toISOString() })
          .eq("company_id", req.company_id);

        return new Response(JSON.stringify({ ok: true, status: finalStatus }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },

      // Allow ZapSign verification pings
      GET: async () =>
        new Response(JSON.stringify({ ok: true, service: "zapsign-webhook" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    },
  },
});
