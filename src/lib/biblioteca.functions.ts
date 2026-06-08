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


/* ===================== SUGESTAO DE ATESTADOS PARA EDITAL ===================== */

type SugestaoAtestadoRow = {
  id: string;
  titulo: string;
  contratante_nome: string | null;
  objeto: string | null;
  valor: number | null;
  data_emissao: string | null;
  storage_path: string | null;
  responsavel?: { nome: string; conselho: string | null; numero_registro: string | null } | null;
};

const STOPWORDS = new Set([
  "para", "pela", "pelo", "com", "sem", "das", "dos", "uma", "como", "mais", "ser", "sua", "seu",
  "que", "por", "em", "de", "da", "do", "a", "o", "e", "ou", "no", "na", "os", "as", "ao", "aos",
  "execucao", "servico", "servicos", "obra", "obras", "contratacao", "empresa", "publica", "publico",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined): string[] {
  const normalized = normalizeText(value ?? "");
  if (!normalized) return [];
  return normalized
    .split(" ")
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

function topKeywords(parts: Array<string | null | undefined>, limit = 28): string[] {
  const counts = new Map<string, number>();
  for (const token of parts.flatMap(tokenize)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([token]) => token);
}

function atestadoDateIsRecent(date: string | null, years: number): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const limit = new Date();
  limit.setFullYear(limit.getFullYear() - years);
  return d >= limit;
}

function atestadoHasResponsavel(atestado: SugestaoAtestadoRow): boolean {
  return Boolean(atestado.responsavel?.nome || atestado.responsavel?.numero_registro);
}

function scoreAtestado(
  atestado: SugestaoAtestadoRow,
  editalKeywords: string[],
  editalValor: number | null,
): { score: number; matched: string[]; reasons: string[] } {
  const text = normalizeText([atestado.titulo, atestado.objeto, atestado.contratante_nome, atestado.responsavel?.nome].filter(Boolean).join(" "));
  const matched = editalKeywords.filter((kw) => text.includes(kw));
  const keywordScore = editalKeywords.length ? (matched.length / editalKeywords.length) * 72 : 0;

  let valueScore = 0;
  if (editalValor && atestado.valor) {
    const ratio = Number(atestado.valor) / editalValor;
    if (ratio >= 1) valueScore = 18;
    else if (ratio >= 0.5) valueScore = 12;
    else if (ratio >= 0.25) valueScore = 7;
    else valueScore = 3;
  }

  let recencyScore = 0;
  if (atestadoDateIsRecent(atestado.data_emissao, 5)) recencyScore = 6;
  else if (atestadoDateIsRecent(atestado.data_emissao, 10)) recencyScore = 3;

  const pdfScore = atestado.storage_path ? 4 : 0;
  const score = Math.min(100, Math.round(keywordScore + valueScore + recencyScore + pdfScore));
  const reasons: string[] = [];
  if (matched.length) reasons.push("Termos aderentes: " + matched.slice(0, 8).join(", "));
  if (editalValor && atestado.valor) reasons.push("Valor do atestado equivale a " + ((Number(atestado.valor) / editalValor) * 100).toFixed(0) + "% do edital");
  if (recencyScore) reasons.push("Emissao recente para comprovar experiencia");
  if (atestadoHasResponsavel(atestado)) reasons.push("Possui responsavel tecnico vinculado");
  if (atestado.storage_path) reasons.push("PDF anexado na biblioteca");
  if (!reasons.length) reasons.push("Baixa aderencia textual; revisar manualmente antes de usar");
  return { score, matched, reasons };
}

export const listEditaisParaSugestaoAtestados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("editais")
      .select("id, titulo, orgao, valor_estimado, data_abertura")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; titulo: string; orgao: string | null; valor_estimado: number | null; data_abertura: string | null }>;
  });

export const sugerirAtestadosParaEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ edital_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const [{ data: edital, error: eErr }, { data: checklist, error: cErr }, { data: atestados, error: aErr }] = await Promise.all([
      supabase
        .from("editais")
        .select("id, titulo, orgao, objeto, resumo_ia, valor_estimado")
        .eq("id", data.edital_id)
        .eq("company_id", companyId)
        .maybeSingle(),
      supabase
        .from("edital_checklist")
        .select("categoria, requisito")
        .eq("edital_id", data.edital_id),
      supabase
        .from("atestados")
        .select("id, titulo, contratante_nome, objeto, valor, data_emissao, storage_path, responsavel:responsaveis_tecnicos(nome, conselho, numero_registro)")
        .eq("company_id", companyId),
    ]);
    if (eErr) throw new Error(eErr.message);
    if (cErr) throw new Error(cErr.message);
    if (aErr) throw new Error(aErr.message);
    if (!edital) throw new Error("Edital nao encontrado.");

    const checklistText = ((checklist ?? []) as Array<{ categoria: string | null; requisito: string | null }>)
      .map((item) => (item.categoria ?? "") + " " + (item.requisito ?? ""));
    const keywords = topKeywords([edital.titulo, edital.objeto, edital.resumo_ia, ...checklistText]);
    const rows = ((atestados ?? []) as SugestaoAtestadoRow[])
      .map((atestado) => ({ atestado, ...scoreAtestado(atestado, keywords, edital.valor_estimado == null ? null : Number(edital.valor_estimado)) }))
      .sort((a, b) => b.score - a.score || (b.atestado.valor ?? 0) - (a.atestado.valor ?? 0))
      .slice(0, 12)
      .map((item) => ({
        id: item.atestado.id,
        titulo: item.atestado.titulo,
        contratante_nome: item.atestado.contratante_nome,
        objeto: item.atestado.objeto,
        valor: item.atestado.valor == null ? null : Number(item.atestado.valor),
        data_emissao: item.atestado.data_emissao,
        storage_path: item.atestado.storage_path,
        responsavel: item.atestado.responsavel ?? null,
        score: item.score,
        matched_keywords: item.matched.slice(0, 12),
        reasons: item.reasons,
      }));

    return {
      edital: {
        id: edital.id as string,
        titulo: edital.titulo as string,
        orgao: (edital.orgao as string | null) ?? null,
        valor_estimado: edital.valor_estimado == null ? null : Number(edital.valor_estimado),
      },
      keywords,
      sugestoes: rows,
    };
  });
