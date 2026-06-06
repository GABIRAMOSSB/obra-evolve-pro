/**
 * Fase 5 — Biblioteca de documentos da empresa
 *
 * Documentos reutilizáveis (contrato social, atestados, balanços, certidões
 * institucionais, etc.) com vínculo opcional a itens do checklist de editais.
 *
 * Server functions:
 *   - listBiblioteca({categoria?, q?})
 *   - uploadDocumento(...)              → grava arquivo no bucket `biblioteca` e cria registro
 *   - updateDocumento({id, ...})
 *   - deleteDocumento({id})
 *   - getDocumentoUrl({id})             → URL assinada 10 min
 *   - listVinculos({checklist_item_id})
 *   - vincularDocumento({checklist_item_id, documento_id})
 *   - desvincularDocumento({id})
 *   - sugerirVinculosChecklist({edital_id}) → IA mapeia itens do checklist a docs da biblioteca
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const CATEGORIAS = [
  "habilitacao_juridica",
  "regularidade_fiscal",
  "qualificacao_tecnica",
  "qualificacao_economica",
  "documentos_proposta",
  "outros",
] as const;

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
  if (data.role !== "admin" && data.role !== "editor") throw new Error("Permissão insuficiente.");
  return data.company_id as string;
}

/* ============ LIST ============ */

export interface DocumentoRow {
  id: string;
  categoria: string;
  nome: string;
  descricao: string | null;
  tags: string[];
  nome_arquivo: string;
  mime_type: string | null;
  tamanho_bytes: number | null;
  storage_path: string;
  data_emissao: string | null;
  data_validade: string | null;
  emissor: string | null;
  numero_documento: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export const listBiblioteca = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        categoria: z.enum(CATEGORIAS).optional(),
        q: z.string().max(120).optional(),
        ativo: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DocumentoRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    let q = supabase
      .from("biblioteca_documentos")
      .select(
        "id, categoria, nome, descricao, tags, nome_arquivo, mime_type, tamanho_bytes, storage_path, data_emissao, data_validade, emissor, numero_documento, ativo, created_at, updated_at",
      )
      .eq("company_id", companyId)
      .order("categoria", { ascending: true })
      .order("nome", { ascending: true });
    if (data.categoria) q = q.eq("categoria", data.categoria);
    if (data.ativo !== undefined) q = q.eq("ativo", data.ativo);
    if (data.q) {
      const kw = `%${data.q}%`;
      q = q.or(`nome.ilike.${kw},descricao.ilike.${kw},emissor.ilike.${kw},numero_documento.ilike.${kw}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as DocumentoRow[];
  });

/* ============ UPLOAD ============ */

const uploadSchema = z.object({
  categoria: z.enum(CATEGORIAS),
  nome: z.string().min(1).max(300),
  descricao: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  nome_arquivo: z.string().min(1).max(300),
  mime_type: z.string().max(120).default("application/octet-stream"),
  data_emissao: z.string().nullable().optional(),
  data_validade: z.string().nullable().optional(),
  emissor: z.string().max(200).nullable().optional(),
  numero_documento: z.string().max(120).nullable().optional(),
  base64: z.string().min(1).max(40 * 1024 * 1024),
});

export const uploadDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const safe = data.nome_arquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${companyId}/${data.categoria}/${Date.now()}_${safe}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error: upErr } = await supabase.storage
      .from("biblioteca")
      .upload(path, bytes, { contentType: data.mime_type, upsert: false });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);
    const { data: row, error } = await supabase
      .from("biblioteca_documentos")
      .insert({
        company_id: companyId,
        categoria: data.categoria,
        nome: data.nome,
        descricao: data.descricao ?? null,
        tags: data.tags ?? [],
        nome_arquivo: data.nome_arquivo,
        mime_type: data.mime_type,
        tamanho_bytes: bytes.byteLength,
        storage_path: path,
        data_emissao: data.data_emissao ?? null,
        data_validade: data.data_validade ?? null,
        emissor: data.emissor ?? null,
        numero_documento: data.numero_documento ?? null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  categoria: z.enum(CATEGORIAS).optional(),
  nome: z.string().min(1).max(300).optional(),
  descricao: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  data_emissao: z.string().nullable().optional(),
  data_validade: z.string().nullable().optional(),
  emissor: z.string().max(200).nullable().optional(),
  numero_documento: z.string().max(120).nullable().optional(),
  ativo: z.boolean().optional(),
});

export const updateDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const patch: Record<string, unknown> = {};
    for (const k of [
      "categoria",
      "nome",
      "descricao",
      "tags",
      "data_emissao",
      "data_validade",
      "emissor",
      "numero_documento",
      "ativo",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("biblioteca_documentos")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: doc } = await supabase
      .from("biblioteca_documentos")
      .select("storage_path")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (doc?.storage_path) {
      await supabase.storage.from("biblioteca").remove([doc.storage_path]);
    }
    const { error } = await supabase
      .from("biblioteca_documentos")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDocumentoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: doc, error } = await supabase
      .from("biblioteca_documentos")
      .select("storage_path")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado.");
    const { data: signed, error: sErr } = await supabase.storage
      .from("biblioteca")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (sErr) throw new Error(sErr.message);
    return { url: signed.signedUrl as string };
  });

/* ============ VÍNCULOS ============ */

export interface VinculoRow {
  id: string;
  checklist_item_id: string;
  documento_id: string;
  documento_nome: string;
  documento_categoria: string;
  data_validade: string | null;
}

export const listVinculosChecklistEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ edital_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<VinculoRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    // pega ids dos itens do edital
    const { data: items, error: itErr } = await supabase
      .from("edital_checklist")
      .select("id")
      .eq("edital_id", data.edital_id)
      .eq("company_id", companyId);
    if (itErr) throw new Error(itErr.message);
    const ids = (items ?? []).map((r: { id: string }) => r.id);
    if (!ids.length) return [];
    const { data: rows, error } = await supabase
      .from("edital_checklist_vinculos")
      .select(
        "id, checklist_item_id, documento_id, biblioteca_documentos:documento_id(nome, categoria, data_validade)",
      )
      .in("checklist_item_id", ids);
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Array<Record<string, unknown>>).map((r) => {
      const doc = (r.biblioteca_documentos ?? {}) as {
        nome?: string;
        categoria?: string;
        data_validade?: string | null;
      };
      return {
        id: r.id as string,
        checklist_item_id: r.checklist_item_id as string,
        documento_id: r.documento_id as string,
        documento_nome: doc.nome ?? "(documento removido)",
        documento_categoria: doc.categoria ?? "outros",
        data_validade: doc.data_validade ?? null,
      };
    });
  });

export const vincularDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        checklist_item_id: z.string().uuid(),
        documento_id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("edital_checklist_vinculos")
      .insert({
        checklist_item_id: data.checklist_item_id,
        documento_id: data.documento_id,
        company_id: companyId,
        created_by: context.userId,
      });
    if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const desvincularDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("edital_checklist_vinculos")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ IA: SUGESTÃO DE VÍNCULOS ============ */

const SUGGEST_TOOL = {
  type: "function",
  function: {
    name: "registrar_sugestoes",
    description: "Lista vínculos sugeridos entre itens do checklist e documentos da biblioteca.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        sugestoes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              checklist_item_id: { type: "string" },
              documento_id: { type: "string" },
              confianca: { type: "number" }, // 0..1
              justificativa: { type: "string" },
            },
            required: ["checklist_item_id", "documento_id", "confianca", "justificativa"],
          },
        },
      },
      required: ["sugestoes"],
    },
  },
} as const;

export const sugerirVinculosChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        edital_id: z.string().uuid(),
        confianca_minima: z.number().min(0).max(1).default(0.6),
        aplicar: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const { data: items, error: iErr } = await supabase
      .from("edital_checklist")
      .select("id, categoria, requisito")
      .eq("edital_id", data.edital_id)
      .eq("company_id", companyId);
    if (iErr) throw new Error(iErr.message);
    if (!items?.length) return { sugestoes: [], aplicadas: 0 };

    const { data: docs, error: dErr } = await supabase
      .from("biblioteca_documentos")
      .select("id, categoria, nome, descricao, tags, data_validade")
      .eq("company_id", companyId)
      .eq("ativo", true);
    if (dErr) throw new Error(dErr.message);
    if (!docs?.length) return { sugestoes: [], aplicadas: 0 };

    const prompt = `Você é um assistente de compliance em licitações. Receberá itens do checklist de habilitação de um edital e o catálogo de documentos da biblioteca da empresa. Sugira, para cada item, qual(is) documento(s) da biblioteca o atendem.

Regras:
- só sugira se houver alta correspondência semântica (não force vínculos);
- prefira documentos da MESMA categoria do item; mas pode cruzar categorias quando fizer sentido;
- atribua "confianca" entre 0 e 1.

ITENS DO CHECKLIST:
${JSON.stringify(items, null, 2)}

DOCUMENTOS DISPONÍVEIS:
${JSON.stringify(docs, null, 2)}

Responda chamando a tool "registrar_sugestoes".`;

    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: "Você responde sempre chamando a tool fornecida." },
          { role: "user", content: prompt },
        ],
        tools: [SUGGEST_TOOL],
        tool_choice: { type: "function", function: { name: "registrar_sugestoes" } },
      }),
    });
    if (resp.status === 429) throw new Error("Limite de requisições da IA atingido.");
    if (resp.status === 402) throw new Error("Créditos de IA insuficientes na workspace.");
    if (!resp.ok) throw new Error(`AI Gateway ${resp.status}: ${await resp.text().catch(() => "")}`);
    const json = (await resp.json()) as {
      choices?: Array<{
        message?: { tool_calls?: Array<{ function?: { arguments?: string } }> };
      }>;
    };
    const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("Resposta da IA inválida.");
    const parsed = JSON.parse(argsStr) as {
      sugestoes: Array<{
        checklist_item_id: string;
        documento_id: string;
        confianca: number;
        justificativa: string;
      }>;
    };

    const validItemIds = new Set((items ?? []).map((r: { id: string }) => r.id));
    const validDocIds = new Set((docs ?? []).map((r: { id: string }) => r.id));
    const filtradas = parsed.sugestoes.filter(
      (s) =>
        validItemIds.has(s.checklist_item_id) &&
        validDocIds.has(s.documento_id) &&
        s.confianca >= data.confianca_minima,
    );

    let aplicadas = 0;
    if (data.aplicar && filtradas.length) {
      const rows = filtradas.map((s) => ({
        checklist_item_id: s.checklist_item_id,
        documento_id: s.documento_id,
        company_id: companyId,
        created_by: context.userId,
      }));
      // upsert manual via insert ignorando duplicatas
      for (const r of rows) {
        const { error } = await supabase.from("edital_checklist_vinculos").insert(r);
        if (!error) aplicadas += 1;
      }
    }

    return { sugestoes: filtradas, aplicadas };
  });
