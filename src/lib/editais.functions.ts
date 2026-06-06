/**
 * Fase 4 — Editais (IA Gateway)
 *
 * Fluxo:
 *  1. Usuário cria um Edital (manualmente, a partir de uma Oportunidade do
 *     Radar PNCP, ou via upload de PDF).
 *  2. Server function `analyzeEdital` envia metadados + (quando houver) trecho
 *     do PDF ao Lovable AI Gateway (Gemini) e devolve:
 *        - resumo executivo
 *        - checklist de habilitação/qualificação tailored ao objeto/modalidade
 *  3. UI permite marcar cada item do checklist como OK / faltante / N.A. e
 *     adicionar observações.
 *
 * Storage:
 *  - bucket privado `editais`, pasta `{company_id}/{edital_id}/{arquivo}`.
 *
 * IA:
 *  - usa LOVABLE_API_KEY (sem custo de configuração) via gateway:
 *    https://ai.gateway.lovable.dev/v1/chat/completions
 *  - modelo padrão: google/gemini-2.5-flash (rápido e barato; "pro" disponível
 *    via parâmetro `modelo`).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

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

/* ============================ LIST ============================ */

export interface EditalRow {
  id: string;
  titulo: string;
  orgao: string | null;
  numero_edital: string | null;
  modalidade: string | null;
  objeto: string | null;
  valor_estimado: number | null;
  data_abertura: string | null;
  url_origem: string | null;
  origem: string;
  status: string;
  resumo_ia: string | null;
  ia_processado_em: string | null;
  ia_modelo: string | null;
  oportunidade_id: string | null;
  created_at: string;
  updated_at: string;
  checklist_count: number;
}

export const listEditais = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EditalRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const { data, error } = await supabase
      .from("editais")
      .select(
        "id, titulo, orgao, numero_edital, modalidade, objeto, valor_estimado, data_abertura, url_origem, origem, status, resumo_ia, ia_processado_em, ia_modelo, oportunidade_id, created_at, updated_at",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((r: { id: string }) => r.id);
    let counts: Record<string, number> = {};
    if (ids.length) {
      const { data: cl } = await supabase
        .from("edital_checklist")
        .select("edital_id")
        .in("edital_id", ids);
      counts = ((cl ?? []) as Array<{ edital_id: string }>).reduce(
        (acc, r) => {
          acc[r.edital_id] = (acc[r.edital_id] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
    }
    return (data ?? []).map((r: Record<string, unknown>) => ({
      ...(r as unknown as EditalRow),
      checklist_count: counts[(r as { id: string }).id] ?? 0,
    }));

  });

/* ============================ CREATE ============================ */

const createEditalSchema = z.object({
  titulo: z.string().min(2).max(500),
  orgao: z.string().max(300).nullable().optional(),
  numero_edital: z.string().max(120).nullable().optional(),
  modalidade: z.string().max(120).nullable().optional(),
  objeto: z.string().max(5000).nullable().optional(),
  valor_estimado: z.number().nullable().optional(),
  data_abertura: z.string().nullable().optional(),
  url_origem: z.string().url().max(2000).nullable().optional(),
  oportunidade_id: z.string().uuid().nullable().optional(),
  origem: z.enum(["manual", "pncp", "upload"]).default("manual"),
});

export const createEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createEditalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: row, error } = await supabase
      .from("editais")
      .insert({
        company_id: companyId,
        titulo: data.titulo,
        orgao: data.orgao ?? null,
        numero_edital: data.numero_edital ?? null,
        modalidade: data.modalidade ?? null,
        objeto: data.objeto ?? null,
        valor_estimado: data.valor_estimado ?? null,
        data_abertura: data.data_abertura ?? null,
        url_origem: data.url_origem ?? null,
        oportunidade_id: data.oportunidade_id ?? null,
        origem: data.origem,
        status: "novo",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/* ============================ CREATE FROM PNCP OPORTUNIDADE ============================ */

export const createEditalFromOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ oportunidade_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: op, error: opErr } = await supabase
      .from("oportunidades")
      .select(
        "id, pncp_id, numero_compra, orgao_nome, modalidade, objeto, valor_estimado, data_abertura_propostas, link_sistema_origem",
      )
      .eq("company_id", companyId)
      .eq("id", data.oportunidade_id)
      .maybeSingle();
    if (opErr) throw new Error(opErr.message);
    if (!op) throw new Error("Oportunidade não encontrada.");

    // idempotente: se já existe edital ligado a essa oportunidade, retorna-o
    const { data: existing } = await supabase
      .from("editais")
      .select("id")
      .eq("company_id", companyId)
      .eq("oportunidade_id", data.oportunidade_id)
      .maybeSingle();
    if (existing?.id) return { id: existing.id as string, created: false };

    const { data: row, error } = await supabase
      .from("editais")
      .insert({
        company_id: companyId,
        oportunidade_id: op.id,
        titulo:
          op.objeto?.slice(0, 200) ||
          `Edital ${op.numero_compra ?? op.pncp_id ?? ""}`.trim() ||
          "Edital",
        orgao: op.orgao_nome,
        numero_edital: op.numero_compra,
        modalidade: op.modalidade,
        objeto: op.objeto,
        valor_estimado: op.valor_estimado,
        data_abertura: op.data_abertura_propostas,
        url_origem: op.link_sistema_origem,
        origem: "pncp",
        status: "novo",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, created: true };
  });

/* ============================ UPLOAD ============================ */

const uploadSchema = z.object({
  edital_id: z.string().uuid(),
  nome_arquivo: z.string().min(1).max(300),
  mime_type: z.string().max(120).default("application/pdf"),
  tipo: z.enum(["edital", "anexo", "termo_referencia", "planilha"]).default("edital"),
  // base64 sem o prefixo "data:..."
  base64: z.string().min(1).max(40 * 1024 * 1024), // ~30 MB texto base64
});

export const uploadEditalDocumento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => uploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    // valida vínculo
    const { data: ed } = await supabase
      .from("editais")
      .select("id")
      .eq("id", data.edital_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!ed) throw new Error("Edital não encontrado.");

    const safeName = data.nome_arquivo.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${companyId}/${data.edital_id}/${Date.now()}_${safeName}`;

    // decode base64
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));

    const { error: upErr } = await supabase.storage
      .from("editais")
      .upload(path, bytes, { contentType: data.mime_type, upsert: false });
    if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

    const { data: row, error } = await supabase
      .from("edital_documentos")
      .insert({
        edital_id: data.edital_id,
        company_id: companyId,
        nome_arquivo: data.nome_arquivo,
        mime_type: data.mime_type,
        tamanho_bytes: bytes.byteLength,
        storage_path: path,
        tipo: data.tipo,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string, storage_path: path };
  });

export const listEditalDocumentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ edital_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("edital_documentos")
      .select("id, nome_arquivo, mime_type, tamanho_bytes, storage_path, tipo, paginas, created_at")
      .eq("edital_id", data.edital_id)
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getEditalDocumentoUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ documento_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: doc, error } = await supabase
      .from("edital_documentos")
      .select("storage_path")
      .eq("id", data.documento_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado.");
    const { data: signed, error: sigErr } = await supabase.storage
      .from("editais")
      .createSignedUrl(doc.storage_path, 60 * 10);
    if (sigErr) throw new Error(sigErr.message);
    return { url: signed.signedUrl as string };
  });

/* ============================ AI ANALYSIS ============================ */

const analyzeSchema = z.object({
  edital_id: z.string().uuid(),
  modelo: z.string().optional(),
});

interface ChecklistItem {
  categoria: string;
  requisito: string;
  obrigatorio: boolean;
  pagina_referencia: number | null;
  trecho_edital: string | null;
}

interface AIAnalysisResult {
  resumo: string;
  checklist: ChecklistItem[];
}

const CHECKLIST_CATEGORIAS = [
  "habilitacao_juridica",
  "regularidade_fiscal",
  "qualificacao_tecnica",
  "qualificacao_economica",
  "documentos_proposta",
  "outros",
] as const;

function buildPrompt(args: {
  titulo: string;
  orgao: string | null;
  modalidade: string | null;
  objeto: string | null;
  valor: number | null;
  trecho: string | null;
}): string {
  return `Você é um especialista em licitações públicas brasileiras (Lei 14.133/21 e Lei 8.666/93).

A partir das informações abaixo sobre o edital, produza:
  1. Um RESUMO executivo (máx. 8 linhas) cobrindo: objeto, modalidade, prazo, valor estimado, principais riscos/atenções.
  2. Um CHECKLIST de habilitação e documentos para a proposta, com itens objetivos, agrupados por categoria.
     Categorias permitidas (use EXATAMENTE estes códigos): ${CHECKLIST_CATEGORIAS.join(", ")}.
     Para cada item informe:
        - categoria
        - requisito (texto curto, imperativo: "Apresentar...", "Comprovar...")
        - obrigatorio (boolean — true se exigido pela Lei/edital, false se condicional)
        - pagina_referencia (inteiro ou null)
        - trecho_edital (citação literal curta do edital, ou null se inferido)

Inclua entre 8 e 25 itens, priorizando os realmente exigidos.

Dados do edital:
  Título: ${args.titulo}
  Órgão: ${args.orgao ?? "(não informado)"}
  Modalidade: ${args.modalidade ?? "(não informada)"}
  Valor estimado: ${args.valor != null ? `R$ ${args.valor.toLocaleString("pt-BR")}` : "(não informado)"}
  Objeto: ${args.objeto ?? "(não informado)"}

${args.trecho ? `Trecho do edital (extraído do PDF):\n"""\n${args.trecho.slice(0, 12000)}\n"""` : "Observação: o PDF do edital não foi processado; baseie-se na modalidade e no objeto para inferir o checklist padrão."}

Responda SOMENTE com JSON válido seguindo a tool schema fornecida.`;
}

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "registrar_analise_edital",
    description: "Registra o resumo executivo e a checklist de habilitação do edital.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        resumo: { type: "string", description: "Resumo executivo do edital (máx. 8 linhas)." },
        checklist: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              categoria: { type: "string", enum: [...CHECKLIST_CATEGORIAS] },
              requisito: { type: "string" },
              obrigatorio: { type: "boolean" },
              pagina_referencia: { type: ["integer", "null"] },
              trecho_edital: { type: ["string", "null"] },
            },
            required: ["categoria", "requisito", "obrigatorio", "pagina_referencia", "trecho_edital"],
          },
        },
      },
      required: ["resumo", "checklist"],
    },
  },
} as const;

async function callAIGateway(args: {
  apiKey: string;
  modelo: string;
  prompt: string;
}): Promise<AIAnalysisResult> {
  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.modelo,
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente especializado em licitações públicas brasileiras. Responda chamando a tool fornecida com JSON estrito.",
        },
        { role: "user", content: args.prompt },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "registrar_analise_edital" } },
    }),
  });
  if (resp.status === 429) {
    throw new Error("Limite de requisições da IA atingido. Tente novamente em alguns instantes.");
  }
  if (resp.status === 402) {
    throw new Error("Créditos de IA insuficientes na workspace. Adicione créditos para continuar.");
  }
  if (!resp.ok) {
    throw new Error(`AI Gateway ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`);
  }
  const json = (await resp.json()) as {
    choices?: Array<{
      message?: {
        tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>;
        content?: string;
      };
    }>;
  };
  const call = json.choices?.[0]?.message?.tool_calls?.[0];
  const argsStr = call?.function?.arguments;
  if (!argsStr) {
    // fallback: tenta parsear content como JSON
    const c = json.choices?.[0]?.message?.content;
    if (c) {
      try {
        return JSON.parse(c) as AIAnalysisResult;
      } catch {
        /* ignore */
      }
    }
    throw new Error("Resposta da IA sem tool_call utilizável.");
  }
  return JSON.parse(argsStr) as AIAnalysisResult;
}

export const analyzeEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => analyzeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");
    const modelo = data.modelo ?? DEFAULT_MODEL;

    const { data: edital, error: edErr } = await supabase
      .from("editais")
      .select("id, titulo, orgao, modalidade, objeto, valor_estimado")
      .eq("id", data.edital_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (edErr) throw new Error(edErr.message);
    if (!edital) throw new Error("Edital não encontrado.");

    // marca como processando
    await supabase
      .from("editais")
      .update({ status: "processando", ia_erro: null })
      .eq("id", data.edital_id);

    // Agrega texto extraído dos documentos (Fase 4.1).
    const { data: docs } = await supabase
      .from("edital_documentos")
      .select("texto_extraido, nome_arquivo")
      .eq("edital_id", data.edital_id)
      .eq("company_id", companyId);
    const partes = ((docs ?? []) as Array<{ texto_extraido: string | null; nome_arquivo: string }>)
      .filter((d) => d.texto_extraido && d.texto_extraido.trim().length > 0)
      .map((d) => `# ${d.nome_arquivo}\n${d.texto_extraido}`);
    const trecho: string | null = partes.length ? partes.join("\n\n").slice(0, 60000) : null;

    try {
      const result = await callAIGateway({
        apiKey,
        modelo,
        prompt: buildPrompt({
          titulo: edital.titulo,
          orgao: edital.orgao,
          modalidade: edital.modalidade,
          objeto: edital.objeto,
          valor: edital.valor_estimado,
          trecho,
        }),
      });

      // limpa checklist anterior e insere o novo
      await supabase.from("edital_checklist").delete().eq("edital_id", data.edital_id);

      const rows = result.checklist.map((it, idx) => ({
        edital_id: data.edital_id,
        company_id: companyId,
        categoria: CHECKLIST_CATEGORIAS.includes(it.categoria as (typeof CHECKLIST_CATEGORIAS)[number])
          ? it.categoria
          : "outros",
        requisito: it.requisito.slice(0, 800),
        obrigatorio: !!it.obrigatorio,
        pagina_referencia: it.pagina_referencia ?? null,
        trecho_edital: it.trecho_edital?.slice(0, 2000) ?? null,
        status: "pendente",
        ordem: idx,
      }));
      if (rows.length) {
        const { error: insErr } = await supabase.from("edital_checklist").insert(rows);
        if (insErr) throw new Error(`Falha ao gravar checklist: ${insErr.message}`);
      }

      await supabase
        .from("editais")
        .update({
          status: "analisado",
          resumo_ia: result.resumo,
          ia_modelo: modelo,
          ia_processado_em: new Date().toISOString(),
          ia_erro: null,
        })
        .eq("id", data.edital_id);

      return { ok: true, itens: rows.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("editais")
        .update({ status: "erro", ia_erro: msg.slice(0, 1000) })
        .eq("id", data.edital_id);
      throw new Error(msg);
    }
  });

/* ============================ CHECKLIST CRUD ============================ */

export interface ChecklistRow {
  id: string;
  categoria: string;
  requisito: string;
  obrigatorio: boolean;
  pagina_referencia: number | null;
  trecho_edital: string | null;
  status: string;
  observacoes: string | null;
  ordem: number;
}

export const listChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ edital_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ChecklistRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("edital_checklist")
      .select(
        "id, categoria, requisito, obrigatorio, pagina_referencia, trecho_edital, status, observacoes, ordem",
      )
      .eq("edital_id", data.edital_id)
      .eq("company_id", companyId)
      .order("categoria", { ascending: true })
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ChecklistRow[];
  });

const updateChecklistSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pendente", "ok", "faltante", "nao_aplicavel"]).optional(),
  observacoes: z.string().max(2000).nullable().optional(),
});

export const updateChecklistItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateChecklistSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.observacoes !== undefined) patch.observacoes = data.observacoes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("edital_checklist")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEdital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("editais")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ PDF TEXT EXTRACTION (Fase 4.1) ============================ */

const extractSchema = z.object({ documento_id: z.string().uuid() });

export const extractDocumentoTexto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => extractSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: doc, error } = await supabase
      .from("edital_documentos")
      .select("id, storage_path, mime_type, nome_arquivo")
      .eq("id", data.documento_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!doc) throw new Error("Documento não encontrado.");
    if (doc.mime_type && !doc.mime_type.includes("pdf")) {
      throw new Error("Extração de texto disponível apenas para PDFs.");
    }

    const { data: file, error: dlErr } = await supabase.storage
      .from("editais")
      .download(doc.storage_path);
    if (dlErr) throw new Error(`Download falhou: ${dlErr.message}`);

    const buf = new Uint8Array(await file.arrayBuffer());

    // unpdf é compatível com workers/edge (build sem deps nativas).
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const texto = (Array.isArray(text) ? text.join("\n") : text).trim();

    const { error: upErr } = await supabase
      .from("edital_documentos")
      .update({
        texto_extraido: texto.slice(0, 500000),
        paginas: totalPages,
      })
      .eq("id", doc.id)
      .eq("company_id", companyId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, paginas: totalPages, caracteres: texto.length };
  });
