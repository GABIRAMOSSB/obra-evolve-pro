/**
 * Fase 6 — Biblioteca Técnica
 *
 * Quatro entidades:
 *  - responsaveis_tecnicos: cadastro de engenheiros/arquitetos da empresa.
 *  - atestados: atestados de capacidade técnica emitidos por contratantes.
 *  - cats: Certidões de Acervo Técnico (CREA/CAU).
 *  - arts: Anotações de Responsabilidade Técnica.
 *
 * PDFs vão para o bucket privado `biblioteca-tecnica/{company_id}/{tipo}/{id}.pdf`.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const BUCKET = "biblioteca-tecnica";

async function resolveCompanyId(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  return data.company_id as string;
}

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

/* ===================== RESPONSÁVEIS TÉCNICOS ===================== */

const rtSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(2).max(200),
  cpf: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal("")),
  telefone: z.string().max(40).optional().nullable(),
  formacao: z.string().max(120).optional().nullable(),
  conselho: z.string().max(20).optional().nullable(),
  numero_registro: z.string().max(40).optional().nullable(),
  uf_registro: z.string().max(2).optional().nullable(),
  ativo: z.boolean().optional(),
  observacoes: z.string().max(2000).optional().nullable(),
});

export const listResponsaveisTecnicos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("responsaveis_tecnicos")
      .select("*")
      .eq("company_id", companyId)
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveResponsavelTecnico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => rtSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const row = {
      company_id: companyId,
      nome: data.nome,
      cpf: data.cpf || null,
      email: data.email || null,
      telefone: data.telefone || null,
      formacao: data.formacao || null,
      conselho: data.conselho || null,
      numero_registro: data.numero_registro || null,
      uf_registro: data.uf_registro || null,
      ativo: data.ativo ?? true,
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { error } = await supabase.from("responsaveis_tecnicos").update(row).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase.from("responsaveis_tecnicos").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteResponsavelTecnico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase.from("responsaveis_tecnicos").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ===================== ATESTADOS ===================== */

const atestadoSchema = z.object({
  id: z.string().uuid().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  titulo: z.string().min(2).max(300),
  contratante_nome: z.string().max(300).nullable().optional(),
  contratante_cnpj: z.string().max(20).nullable().optional(),
  objeto: z.string().max(3000).nullable().optional(),
  valor: z.number().nullable().optional(),
  data_emissao: z.string().nullable().optional(),
  periodo_inicio: z.string().nullable().optional(),
  periodo_fim: z.string().nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

export const listAtestados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("atestados")
      .select("*, responsavel:responsaveis_tecnicos(id, nome, numero_registro, conselho)")
      .eq("company_id", companyId)
      .order("data_emissao", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveAtestado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => atestadoSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const row = {
      company_id: companyId,
      responsavel_id: data.responsavel_id || null,
      titulo: data.titulo,
      contratante_nome: data.contratante_nome || null,
      contratante_cnpj: data.contratante_cnpj || null,
      objeto: data.objeto || null,
      valor: data.valor ?? null,
      data_emissao: data.data_emissao || null,
      periodo_inicio: data.periodo_inicio || null,
      periodo_fim: data.periodo_fim || null,
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { error } = await supabase.from("atestados").update(row).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase.from("atestados").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteAtestado = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: row } = await supabase.from("atestados").select("storage_path").eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (row?.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await supabase.from("atestados").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ===================== CATS ===================== */

const catSchema = z.object({
  id: z.string().uuid().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  atestado_id: z.string().uuid().nullable().optional(),
  numero_cat: z.string().min(1).max(80),
  conselho: z.string().max(20).nullable().optional(),
  uf: z.string().max(2).nullable().optional(),
  data_emissao: z.string().nullable().optional(),
  atividades: z.string().max(3000).nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

export const listCats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("cats")
      .select("*, responsavel:responsaveis_tecnicos(id, nome), atestado:atestados(id, titulo)")
      .eq("company_id", companyId)
      .order("data_emissao", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveCat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => catSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const row = {
      company_id: companyId,
      responsavel_id: data.responsavel_id || null,
      atestado_id: data.atestado_id || null,
      numero_cat: data.numero_cat,
      conselho: data.conselho || null,
      uf: data.uf || null,
      data_emissao: data.data_emissao || null,
      atividades: data.atividades || null,
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { error } = await supabase.from("cats").update(row).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase.from("cats").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteCat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: row } = await supabase.from("cats").select("storage_path").eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (row?.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await supabase.from("cats").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ===================== ARTS ===================== */

const artSchema = z.object({
  id: z.string().uuid().optional(),
  responsavel_id: z.string().uuid().nullable().optional(),
  numero_art: z.string().min(1).max(80),
  conselho: z.string().max(20).nullable().optional(),
  uf: z.string().max(2).nullable().optional(),
  tipo: z.enum(["execucao", "projeto", "fiscalizacao", "consultoria", "outros"]).optional(),
  contratante: z.string().max(300).nullable().optional(),
  objeto: z.string().max(3000).nullable().optional(),
  data_emissao: z.string().nullable().optional(),
  data_inicio: z.string().nullable().optional(),
  data_termino: z.string().nullable().optional(),
  valor_contrato: z.number().nullable().optional(),
  status: z.enum(["ativa", "baixada", "cancelada", "vencida"]).optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

export const listArts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("arts")
      .select("*, responsavel:responsaveis_tecnicos(id, nome)")
      .eq("company_id", companyId)
      .order("data_emissao", { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveArt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => artSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const row = {
      company_id: companyId,
      responsavel_id: data.responsavel_id || null,
      numero_art: data.numero_art,
      conselho: data.conselho || null,
      uf: data.uf || null,
      tipo: data.tipo || "execucao",
      contratante: data.contratante || null,
      objeto: data.objeto || null,
      data_emissao: data.data_emissao || null,
      data_inicio: data.data_inicio || null,
      data_termino: data.data_termino || null,
      valor_contrato: data.valor_contrato ?? null,
      status: data.status || "ativa",
      observacoes: data.observacoes || null,
    };
    if (data.id) {
      const { error } = await supabase.from("arts").update(row).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase.from("arts").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deleteArt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: row } = await supabase.from("arts").select("storage_path").eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (row?.storage_path) await supabase.storage.from(BUCKET).remove([row.storage_path]);
    const { error } = await supabase.from("arts").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ===================== UPLOAD / SIGNED URL ===================== */

const uploadSchema = z.object({
  entidade: z.enum(["atestado", "cat", "art"]),
  id: z.string().uuid(),
  nome_arquivo: z.string().min(1).max(255),
  mime_type: z.string().max(120),
  base64: z.string().min(1),
});

const TABLE_MAP = { atestado: "atestados", cat: "cats", art: "arts" } as const;

export const uploadBibliotecaPDF = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => uploadSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const table = TABLE_MAP[data.entidade];

    const { data: row, error: selErr } = await supabase
      .from(table)
      .select("id, storage_path")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Registro não encontrado.");

    if (row.storage_path) {
      await supabase.storage.from(BUCKET).remove([row.storage_path]);
    }

    const bin = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const safeName = data.nome_arquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${companyId}/${data.entidade}/${data.id}-${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bin, {
      contentType: data.mime_type || "application/pdf",
      upsert: true,
    });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    const { error: updErr } = await supabase
      .from(table)
      .update({
        storage_path: path,
        nome_arquivo: data.nome_arquivo,
        tamanho_bytes: bin.byteLength,
      })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (updErr) throw new Error(updErr.message);

    return { ok: true, path };
  });

export const getBibliotecaSignedUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      entidade: z.enum(["atestado", "cat", "art"]),
      id: z.string().uuid(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const table = TABLE_MAP[data.entidade];
    const { data: row, error } = await supabase
      .from(table)
      .select("storage_path")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.storage_path) throw new Error("Sem arquivo anexado.");
    const { data: signed, error: sErr } = await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path, 600);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl as string };
  });
