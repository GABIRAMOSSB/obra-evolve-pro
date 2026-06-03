import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const signerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).optional().or(z.literal("")),
  cpf: z.string().max(20).optional().or(z.literal("")),
  phone_country: z.string().max(4).optional().or(z.literal("")),
  phone_number: z.string().max(20).optional().or(z.literal("")),
  role: z.string().max(64).optional().or(z.literal("")),
  company: z.string().max(255).optional().or(z.literal("")),
  auth_mode: z.string().max(64).optional(),
  signing_order: z.number().int().min(0).max(50).optional(),
  send_automatic_email: z.boolean().optional(),
  send_automatic_whatsapp: z.boolean().optional(),
});

const sendSchema = z.object({
  documentPath: z.string().min(1),
  documentName: z.string().min(1).max(255),
  documentFolder: z.string().max(120).optional(),
  obraId: z.string().min(1).max(64),
  signers: z.array(signerSchema).min(1).max(20),
  lang: z.enum(["pt-br", "en", "es"]).optional(),
  expirationDays: z.number().int().min(1).max(365).optional(),
  customMessage: z.string().max(2000).optional(),
});

const BUCKET = "obra-documentos";

interface ZapSignCreateResponse {
  token: string;
  open_id?: number;
  name?: string;
  status?: string;
  signers?: Array<{
    token: string;
    name?: string;
    email?: string;
    sign_url?: string;
  }>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  // Worker runtime: Buffer is available with nodejs_compat
  return Buffer.from(buf).toString("base64");
}

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const sendDocumentForSignature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => sendSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { zapsignRequest, ZapSignConfigError } = await import(
      "@/lib/zapsign.server"
    );

    // Identify user's company + role
    const { data: membership, error: memberErr } = await supabase
      .from("company_members")
      .select("company_id, role")
      .maybeSingle();
    if (memberErr) throw new Error(memberErr.message);
    if (!membership?.company_id) throw new Error("Sem empresa vinculada.");
    if (!["admin", "editor"].includes(membership.role)) {
      throw new Error("Sem permissão para enviar documentos para assinatura.");
    }
    const companyId = membership.company_id;

    // Validate path scope (defense in depth — RLS also protects)
    if (!data.documentPath.startsWith(`${companyId}/${data.obraId}/`)) {
      throw new Error("Documento fora do escopo da obra/empresa.");
    }
    if (!data.documentName.toLowerCase().endsWith(".pdf")) {
      throw new Error("Apenas arquivos PDF podem ser enviados para assinatura.");
    }

    // Load settings (environment / defaults)
    const { data: settings } = await supabase
      .from("signature_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    const sandbox = (settings?.environment ?? "sandbox") === "sandbox";
    const defaultAuth = settings?.default_auth_mode || "assinaturaTela";

    // Download PDF from storage
    const { data: file, error: dlErr } = await supabase.storage
      .from(BUCKET)
      .download(data.documentPath);
    if (dlErr || !file) {
      throw new Error(`Falha ao baixar documento: ${dlErr?.message || "vazio"}`);
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new Error("PDF maior que 20MB não suportado pelo envio via base64.");
    }

    const base64 = await blobToBase64(file);
    const originalHash = await sha256Hex(file);

    // Prepare insert row (status awaiting_placement, will create on ZapSign)
    const { data: requestRow, error: reqErr } = await supabase
      .from("signature_requests")
      .insert({
        company_id: companyId,
        obra_id: data.obraId,
        document_path: data.documentPath,
        document_name: data.documentName,
        document_folder: data.documentFolder ?? "Outros Documentos",
        status: "preparing",
        authentication_mode: defaultAuth,
        sandbox,
        original_file_hash: originalHash,
        created_by: userId,
      })
      .select("*")
      .single();
    if (reqErr || !requestRow) {
      throw new Error(`Falha ao criar registro: ${reqErr?.message}`);
    }

    let zapDoc: ZapSignCreateResponse;
    try {
      const expirationDate: string | undefined = data.expirationDays
        ? new Date(Date.now() + data.expirationDays * 86400000)
            .toISOString()
            .slice(0, 10)
        : undefined;

      zapDoc = await zapsignRequest<ZapSignCreateResponse>({
        method: "POST",
        path: "/docs/",
        body: {
          name: data.documentName.replace(/\.pdf$/i, ""),
          base64_pdf: base64,
          lang: data.lang ?? "pt-br",
          disable_signer_emails: false,
          brand_logo: "",
          brand_primary_color: "",
          external_id: requestRow.id,
          folder_path: data.documentFolder ?? "/",
          created_by: "",
          date_limit_to_sign: expirationDate,
          signature_order_active: false,
          observers: [],
          signers: data.signers.map((s, i) => ({
            name: s.name,
            email: s.email || undefined,
            auth_mode: s.auth_mode || defaultAuth,
            send_automatic_email: s.send_automatic_email ?? Boolean(s.email),
            send_automatic_whatsapp:
              s.send_automatic_whatsapp ?? Boolean(s.phone_number),
            phone_country: s.phone_country || undefined,
            phone_number: s.phone_number || undefined,
            cpf: s.cpf || undefined,
            qualification: s.role || undefined,
            external_id: `s${i}`,
          })),
        },
      });
    } catch (e) {
      const msg =
        e instanceof ZapSignConfigError
          ? e.message
          : (e as Error).message || "Erro ZapSign";
      await supabase
        .from("signature_requests")
        .update({ status: "error", error_message: msg })
        .eq("id", requestRow.id);
      throw new Error(msg);
    }

    // Update request with ZapSign tokens + signers
    await supabase
      .from("signature_requests")
      .update({
        status: "awaiting_signature",
        zapsign_document_token: zapDoc.token,
        zapsign_open_id: zapDoc.open_id != null ? String(zapDoc.open_id) : null,
      })
      .eq("id", requestRow.id);

    if (Array.isArray(zapDoc.signers) && zapDoc.signers.length > 0) {
      const rows = zapDoc.signers.map((zs, i) => {
        const original = data.signers[i] || {};
        return {
          signature_request_id: requestRow.id,
          name: zs.name || original.name || `Signatário ${i + 1}`,
          email: zs.email || original.email || null,
          cpf: original.cpf || null,
          phone_country: original.phone_country || null,
          phone_number: original.phone_number || null,
          role: original.role || null,
          company: original.company || null,
          signing_order: i,
          mandatory: true,
          auth_mode: original.auth_mode || defaultAuth,
          zapsign_signer_token: zs.token,
          zapsign_sign_url: zs.sign_url || null,
          status: "sent",
          last_shared_at: new Date().toISOString(),
        };
      });
      await supabase.from("signature_signers").insert(rows);
    }

    await supabase.from("signature_events").insert({
      signature_request_id: requestRow.id,
      event_type: "request_created",
      event_description: `Documento enviado para ${data.signers.length} signatário(s)`,
      payload: { zapsign_token: zapDoc.token },
    });

    return {
      ok: true,
      requestId: requestRow.id,
      zapsignToken: zapDoc.token,
      signers:
        zapDoc.signers?.map((s) => ({
          name: s.name,
          email: s.email,
          signUrl: s.sign_url,
        })) ?? [],
    };
  });

export const listSignatureRequestsForObra = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { obraId: string }) =>
    z.object({ obraId: z.string().min(1).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("signature_requests")
      .select(
        "id, document_path, document_name, document_folder, status, created_at, signed_at, zapsign_document_token, sandbox",
      )
      .eq("obra_id", data.obraId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
