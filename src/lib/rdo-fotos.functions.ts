/**
 * Fotos do RDO (Fase 14).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function resolveCompany(supabase: AnySupabase, userId: string, requireEditor = false) {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  if (requireEditor && data.role !== "admin" && data.role !== "editor") {
    throw new Error("Permissão insuficiente.");
  }
  return data.company_id as string;
}

export type FotoRDO = {
  id: string;
  rdo_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  legenda: string | null;
  categoria: string;
  uploaded_by: string | null;
  created_at: string;
  signed_url: string | null;
};

export const listarFotosRDO = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rdo_id: string }) => z.object({ rdo_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ fotos: FotoRDO[] }> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("rdo_fotos")
      .select("*")
      .eq("rdo_id", data.rdo_id)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const paths = (rows ?? []).map((r: { storage_path: string }) => r.storage_path);
    let signedMap = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from("rdo-fotos")
        .createSignedUrls(paths, 3600);
      signedMap = new Map(
        (signed ?? []).map((s: { path: string; signedUrl: string }) => [s.path, s.signedUrl]),
      );
    }
    return {
      fotos: (rows ?? []).map((r: FotoRDO) => ({
        ...r,
        signed_url: signedMap.get(r.storage_path) ?? null,
      })),
    };
  });

const registrarSchema = z.object({
  rdo_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().max(120).optional().nullable(),
  size_bytes: z.number().int().min(0).max(50_000_000).optional().nullable(),
  legenda: z.string().max(500).optional().nullable(),
  categoria: z.enum(["geral", "antes", "depois", "seguranca", "qualidade", "ocorrencia"]).default("geral"),
});

export const registrarFotoRDO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registrarSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    if (!data.storage_path.startsWith(`${companyId}/`)) {
      throw new Error("Caminho do arquivo inválido.");
    }
    const { data: row, error } = await supabase
      .from("rdo_fotos")
      .insert({
        rdo_id: data.rdo_id,
        company_id: companyId,
        storage_path: data.storage_path,
        file_name: data.file_name,
        mime_type: data.mime_type ?? null,
        size_bytes: data.size_bytes ?? null,
        legenda: data.legenda ?? null,
        categoria: data.categoria,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const excluirFotoRDO = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { data: foto, error: e1 } = await supabase
      .from("rdo_fotos")
      .select("storage_path")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!foto) throw new Error("Foto não encontrada.");
    await supabase.storage.from("rdo-fotos").remove([foto.storage_path]);
    const { error: e2 } = await supabase
      .from("rdo_fotos")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

export const getCompanyIdAtual = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);
    return { company_id: companyId };
  });
