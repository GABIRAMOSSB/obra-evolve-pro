/**
 * F9 — Dossiês e Templates.
 *
 * Server functions:
 *   - listDossies(filters?)             → lista dossiês da empresa
 *   - getDossie(id)                     → dossiê + itens ordenados
 *   - criarDossie(payload)              → cria dossiê
 *   - atualizarDossie(payload)          → atualiza campos
 *   - excluirDossie(id)
 *   - adicionarItemDossie(payload)
 *   - removerItemDossie(id)
 *   - reordenarItensDossie({dossie_id, ordem:[{id,ordem}]})
 *
 * Templates:
 *   - listTemplates(filters?)
 *   - upsertTemplate(payload)
 *   - excluirTemplate(id)
 *   - renderTemplate({template_id, variaveis})  → substitui {{var}}
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

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

/* ============================== DOSSIÊS ============================== */

export const listDossies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        status: z.string().optional(),
        edital_id: z.string().uuid().optional(),
        oportunidade_id: z.string().uuid().optional(),
        contrato_id: z.string().uuid().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);

    let q = supabase
      .from("dossies")
      .select("id, nome, descricao, escopo, status, edital_id, oportunidade_id, contrato_id, created_at, updated_at")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (data?.status) q = q.eq("status", data.status);
    if (data?.edital_id) q = q.eq("edital_id", data.edital_id);
    if (data?.oportunidade_id) q = q.eq("oportunidade_id", data.oportunidade_id);
    if (data?.contrato_id) q = q.eq("contrato_id", data.contrato_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);

    const { data: dossie, error: e1 } = await supabase
      .from("dossies")
      .select("*")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (e1) throw new Error(e1.message);
    if (!dossie) throw new Error("Dossiê não encontrado.");

    const { data: itens, error: e2 } = await supabase
      .from("dossie_itens")
      .select("*")
      .eq("dossie_id", data.id)
      .order("ordem", { ascending: true });
    if (e2) throw new Error(e2.message);

    return { dossie, itens: itens ?? [] };
  });

export const criarDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        nome: z.string().min(1).max(200),
        descricao: z.string().max(2000).optional(),
        escopo: z.string().max(60).optional(),
        edital_id: z.string().uuid().optional(),
        oportunidade_id: z.string().uuid().optional(),
        contrato_id: z.string().uuid().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { data: row, error } = await supabase
      .from("dossies")
      .insert({
        company_id: companyId,
        nome: data.nome,
        descricao: data.descricao ?? null,
        escopo: data.escopo ?? "habilitacao",
        edital_id: data.edital_id ?? null,
        oportunidade_id: data.oportunidade_id ?? null,
        contrato_id: data.contrato_id ?? null,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const atualizarDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        nome: z.string().min(1).max(200).optional(),
        descricao: z.string().max(2000).nullable().optional(),
        escopo: z.string().max(60).optional(),
        status: z.enum(["rascunho", "finalizado", "arquivado"]).optional(),
        observacoes: z.string().max(4000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { id, ...rest } = data;
    const { error } = await supabase
      .from("dossies")
      .update(rest)
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { error } = await supabase
      .from("dossies")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Itens do dossiê --------------------------- */

const TIPOS = ["certidao", "biblioteca", "procuracao", "proposta", "contrato", "template", "arquivo"] as const;

export const adicionarItemDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dossie_id: z.string().uuid(),
        tipo: z.enum(TIPOS),
        titulo: z.string().min(1).max(200),
        descricao: z.string().max(2000).optional(),
        ref_id: z.string().uuid().optional(),
        ref_table: z.string().max(60).optional(),
        storage_path: z.string().max(500).optional(),
        ordem: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);

    // calcula próxima ordem
    let ordem = data.ordem ?? 0;
    if (data.ordem === undefined) {
      const { data: last } = await supabase
        .from("dossie_itens")
        .select("ordem")
        .eq("dossie_id", data.dossie_id)
        .order("ordem", { ascending: false })
        .limit(1)
        .maybeSingle();
      ordem = ((last?.ordem as number | undefined) ?? -1) + 1;
    }

    const { data: row, error } = await supabase
      .from("dossie_itens")
      .insert({
        dossie_id: data.dossie_id,
        company_id: companyId,
        tipo: data.tipo,
        titulo: data.titulo,
        descricao: data.descricao ?? null,
        ref_id: data.ref_id ?? null,
        ref_table: data.ref_table ?? null,
        storage_path: data.storage_path ?? null,
        ordem,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const removerItemDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { error } = await supabase
      .from("dossie_itens")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reordenarItensDossie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        dossie_id: z.string().uuid(),
        ordem: z.array(z.object({ id: z.string().uuid(), ordem: z.number().int() })).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    for (const it of data.ordem) {
      const { error } = await supabase
        .from("dossie_itens")
        .update({ ordem: it.ordem })
        .eq("id", it.id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/* ============================== TEMPLATES ============================== */

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function extractVars(conteudo: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = VAR_RE.exec(conteudo)) !== null) set.add(m[1]);
  return Array.from(set);
}

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        categoria: z.string().optional(),
        ativo: z.boolean().optional(),
      })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);
    let q = supabase
      .from("document_templates")
      .select("id, nome, categoria, descricao, variaveis, ativo, updated_at")
      .eq("company_id", companyId)
      .order("categoria", { ascending: true })
      .order("nome", { ascending: true })
      .limit(500);
    if (data?.categoria) q = q.eq("categoria", data.categoria);
    if (data?.ativo !== undefined) q = q.eq("ativo", data.ativo);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);
    const { data: row, error } = await supabase
      .from("document_templates")
      .select("*")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Template não encontrado.");
    return row;
  });

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nome: z.string().min(1).max(200),
        categoria: z.string().min(1).max(60).default("declaracao"),
        descricao: z.string().max(2000).optional(),
        conteudo: z.string().max(200000).default(""),
        ativo: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const variaveis = extractVars(data.conteudo);
    const payload = {
      company_id: companyId,
      nome: data.nome,
      categoria: data.categoria,
      descricao: data.descricao ?? null,
      conteudo: data.conteudo,
      variaveis,
      ativo: data.ativo,
      created_by: userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("document_templates")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("document_templates")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const excluirTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { error } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renderTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        template_id: z.string().uuid(),
        variaveis: z.record(z.string(), z.string()).default({}),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);
    const { data: tpl, error } = await supabase
      .from("document_templates")
      .select("conteudo, variaveis, nome")
      .eq("id", data.template_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!tpl) throw new Error("Template não encontrado.");
    const rendered = (tpl.conteudo as string).replace(
      VAR_RE,
      (_m: string, name: string) => data.variaveis[name] ?? `{{${name}}}`,
    );
    return { nome: tpl.nome as string, conteudo: rendered, variaveis: tpl.variaveis ?? [] };
  });
