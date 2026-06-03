import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface SignatureRequestListItem {
  id: string;
  obra_id: string;
  document_path: string;
  document_name: string;
  document_folder: string;
  status: string;
  sandbox: boolean;
  created_at: string;
  updated_at: string;
  signed_at: string | null;
  expiration_date: string | null;
  signed_file_path: string | null;
  zapsign_document_token: string | null;
  error_message: string | null;
  signers_total: number;
  signers_signed: number;
}

export interface SignatureRequestDetail extends SignatureRequestListItem {
  authentication_mode: string;
  cancellation_reason: string | null;
  original_file_hash: string | null;
  signed_file_hash: string | null;
  signers: Array<{
    id: string;
    name: string;
    email: string | null;
    cpf: string | null;
    phone_country: string | null;
    phone_number: string | null;
    role: string | null;
    signing_order: number;
    auth_mode: string;
    status: string;
    signed_at: string | null;
    refused_at: string | null;
    refusal_reason: string | null;
    zapsign_sign_url: string | null;
  }>;
  events: Array<{
    id: string;
    event_type: string;
    event_description: string | null;
    created_at: string;
  }>;
}

const listSchema = z.object({
  status: z.string().max(40).optional(),
  obraId: z.string().max(64).optional(),
  search: z.string().max(120).optional(),
});

export const listSignatureRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<SignatureRequestListItem[]> => {
    const { supabase } = context;

    let q = supabase
      .from("signature_requests")
      .select(
        "id, obra_id, document_path, document_name, document_folder, status, sandbox, created_at, updated_at, signed_at, expiration_date, signed_file_path, zapsign_document_token, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    if (data.search) {
      q = q.ilike("document_name", `%${data.search}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    // Aggregate signers per request
    const ids = rows.map((r) => r.id);
    const { data: signers } = await supabase
      .from("signature_signers")
      .select("signature_request_id, status")
      .in("signature_request_id", ids);

    const agg = new Map<string, { total: number; signed: number }>();
    for (const s of signers ?? []) {
      const cur = agg.get(s.signature_request_id) ?? { total: 0, signed: 0 };
      cur.total += 1;
      if (s.status === "signed") cur.signed += 1;
      agg.set(s.signature_request_id, cur);
    }

    return rows.map((r) => {
      const a = agg.get(r.id) ?? { total: 0, signed: 0 };
      return {
        ...r,
        signers_total: a.total,
        signers_signed: a.signed,
      };
    });
  });

export const getSignatureRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SignatureRequestDetail | null> => {
    const { supabase } = context;
    const { data: req, error } = await supabase
      .from("signature_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!req) return null;

    const { data: signers } = await supabase
      .from("signature_signers")
      .select(
        "id, name, email, cpf, phone_country, phone_number, role, signing_order, auth_mode, status, signed_at, refused_at, refusal_reason, zapsign_sign_url",
      )
      .eq("signature_request_id", req.id)
      .order("signing_order", { ascending: true });

    const { data: events } = await supabase
      .from("signature_events")
      .select("id, event_type, event_description, created_at")
      .eq("signature_request_id", req.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const total = (signers ?? []).length;
    const signed = (signers ?? []).filter((s) => s.status === "signed").length;

    return {
      ...req,
      signers: signers ?? [],
      events: events ?? [],
      signers_total: total,
      signers_signed: signed,
    } as SignatureRequestDetail;
  });

export const cancelSignatureRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; reason?: string }) =>
    z
      .object({ id: z.string().uuid(), reason: z.string().max(500).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { zapsignRequest } = await import("@/lib/zapsign.server");

    const { data: req } = await supabase
      .from("signature_requests")
      .select("id, zapsign_document_token, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!req) throw new Error("Pedido não encontrado.");
    if (["signed", "canceled", "refused", "expired"].includes(req.status)) {
      throw new Error(`Não é possível cancelar um pedido ${req.status}.`);
    }

    if (req.zapsign_document_token) {
      try {
        await zapsignRequest({
          method: "DELETE",
          path: `/docs/${req.zapsign_document_token}/`,
        });
      } catch (e) {
        // ignore — record cancellation locally anyway
        console.warn("ZapSign delete failed:", (e as Error).message);
      }
    }

    await supabase
      .from("signature_requests")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancellation_reason: data.reason || "Cancelado pelo usuário",
      })
      .eq("id", req.id);

    await supabase.from("signature_events").insert({
      signature_request_id: req.id,
      event_type: "canceled",
      event_description: data.reason || "Cancelado pelo usuário",
    });

    return { ok: true };
  });

export const getSignedDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { supabase } = context;
    const { data: req } = await supabase
      .from("signature_requests")
      .select("signed_file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!req?.signed_file_path) return { url: null };
    const { data: signed, error } = await supabase.storage
      .from("obra-documentos")
      .createSignedUrl(req.signed_file_path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
