/**
 * Fase 5 — Propostas técnicas/comerciais com IA.
 *
 * - CRUD de propostas vinculadas a um edital (ou independentes).
 * - `generatePropostaIA` usa o checklist + texto extraído do edital para
 *   redigir resumo executivo, metodologia, equipe técnica, cronograma e
 *   diferenciais via Lovable AI Gateway.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

const STATUS = ["rascunho", "em_revisao", "aprovada", "enviada", "perdida", "ganha"] as const;
type Status = (typeof STATUS)[number];

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

/* ============================ TYPES ============================ */

export interface PropostaRow {
  id: string;
  edital_id: string | null;
  titulo: string;
  status: Status;
  valor_proposto: number | null;
  prazo_execucao_dias: number | null;
  resumo_executivo: string | null;
  metodologia: string | null;
  equipe_tecnica: string | null;
  cronograma: string | null;
  diferenciais: string | null;
  observacoes: string | null;
  ai_meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  edital_titulo?: string | null;
}

/* ============================ LIST ============================ */

export const listPropostas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PropostaRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id, edital_id, titulo, status, valor_proposto, prazo_execucao_dias, resumo_executivo, metodologia, equipe_tecnica, cronograma, diferenciais, observacoes, ai_meta, created_at, updated_at, edital:editais(titulo)",
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<PropostaRow & { edital?: { titulo: string } | null }>).map(
      (r) => ({ ...r, edital_titulo: r.edital?.titulo ?? null }),
    );
  });

/* ============================ CREATE ============================ */

const createSchema = z.object({
  titulo: z.string().min(2).max(300),
  edital_id: z.string().uuid().nullable().optional(),
  valor_proposto: z.number().nullable().optional(),
  prazo_execucao_dias: z.number().int().nullable().optional(),
});

export const createProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => createSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: row, error } = await supabase
      .from("propostas")
      .insert({
        company_id: companyId,
        titulo: data.titulo,
        edital_id: data.edital_id ?? null,
        valor_proposto: data.valor_proposto ?? null,
        prazo_execucao_dias: data.prazo_execucao_dias ?? null,
        status: "rascunho",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/* ============================ UPDATE ============================ */

const updateSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(2).max(300).optional(),
  status: z.enum(STATUS).optional(),
  valor_proposto: z.number().nullable().optional(),
  prazo_execucao_dias: z.number().int().nullable().optional(),
  resumo_executivo: z.string().nullable().optional(),
  metodologia: z.string().nullable().optional(),
  equipe_tecnica: z.string().nullable().optional(),
  cronograma: z.string().nullable().optional(),
  diferenciais: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const updateProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => updateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { id, ...patch } = data;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("propostas")
      .update(patch)
      .eq("id", id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("propostas")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ AI GENERATION ============================ */

const generateSchema = z.object({
  proposta_id: z.string().uuid(),
  modelo: z.string().optional(),
  instrucoes_extra: z.string().max(2000).nullable().optional(),
});

interface AIPropostaResult {
  resumo_executivo: string;
  metodologia: string;
  equipe_tecnica: string;
  cronograma: string;
  diferenciais: string;
}

const TOOL_SCHEMA = {
  type: "function",
  function: {
    name: "registrar_proposta",
    description: "Registra as seções da proposta técnica/comercial.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        resumo_executivo: { type: "string" },
        metodologia: { type: "string" },
        equipe_tecnica: { type: "string" },
        cronograma: { type: "string" },
        diferenciais: { type: "string" },
      },
      required: ["resumo_executivo", "metodologia", "equipe_tecnica", "cronograma", "diferenciais"],
    },
  },
} as const;

function buildPrompt(args: {
  titulo: string;
  edital?: {
    titulo: string;
    orgao: string | null;
    modalidade: string | null;
    objeto: string | null;
    valor: number | null;
    resumo: string | null;
  } | null;
  checklist?: Array<{ categoria: string; requisito: string; obrigatorio: boolean }>;
  trecho?: string | null;
  empresa?: { nome: string | null };
  instrucoes_extra?: string | null;
}): string {
  return `Você é um redator sênior de propostas para licitações públicas brasileiras (Lei 14.133/21).

Redija uma PROPOSTA TÉCNICA estruturada para a empresa "${args.empresa?.nome ?? "(empresa)"}" referente ao edital abaixo. Português formal, tom técnico, frases objetivas. NUNCA invente certificações, atestados ou nomes de profissionais — use placeholders entre colchetes (ex.: "[Engº Responsável Técnico — CREA xxx]") quando precisar referenciar dados que dependam da empresa.

As cinco seções (todas obrigatórias):
  - resumo_executivo (8-12 linhas): visão geral da solução, aderência ao objeto, prazo total, valor (se informado), compromissos-chave.
  - metodologia (15-30 linhas): fases, frentes de trabalho, controle de qualidade, segurança, gestão ambiental, gestão da obra (PDCA / ISO 9001 quando aplicável).
  - equipe_tecnica (10-20 linhas): cargos e responsabilidades, registros profissionais aplicáveis (CREA/CAU), encarregados, segurança do trabalho.
  - cronograma (lista em markdown): macroetapas com duração em dias/semanas; aderente ao prazo informado.
  - diferenciais (5-10 bullets em markdown): pontos fortes da empresa em relação ao objeto.

Proposta solicitada:
  Título interno: ${args.titulo}
${args.edital ? `
Edital:
  Título: ${args.edital.titulo}
  Órgão: ${args.edital.orgao ?? "(n/d)"}
  Modalidade: ${args.edital.modalidade ?? "(n/d)"}
  Valor estimado: ${args.edital.valor != null ? `R$ ${args.edital.valor.toLocaleString("pt-BR")}` : "(n/d)"}
  Objeto: ${args.edital.objeto ?? "(n/d)"}
${args.edital.resumo ? `\nResumo executivo do edital (IA):\n${args.edital.resumo}` : ""}
` : "(Sem edital vinculado — proposta genérica.)"}

${args.checklist?.length ? `Itens de habilitação/exigências relevantes (do checklist):
${args.checklist.slice(0, 30).map((c) => `  - [${c.obrigatorio ? "OBR" : "OPC"}] (${c.categoria}) ${c.requisito}`).join("\n")}` : ""}

${args.trecho ? `Trecho relevante do edital:\n"""\n${args.trecho.slice(0, 12000)}\n"""` : ""}

${args.instrucoes_extra ? `Instruções adicionais do usuário:\n${args.instrucoes_extra}` : ""}

Responda SOMENTE chamando a tool fornecida com JSON estrito.`;
}

async function callAIGateway(args: { apiKey: string; modelo: string; prompt: string }): Promise<AIPropostaResult> {
  const resp = await fetch(AI_GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${args.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: args.modelo,
      messages: [
        { role: "system", content: "Você é um redator técnico especialista em licitações brasileiras. Use a tool obrigatoriamente." },
        { role: "user", content: args.prompt },
      ],
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "function", function: { name: "registrar_proposta" } },
    }),
  });
  if (resp.status === 429) throw new Error("Limite de requisições da IA atingido. Tente novamente em alguns instantes.");
  if (resp.status === 402) throw new Error("Créditos de IA insuficientes na workspace.");
  if (!resp.ok) throw new Error(`AI Gateway ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`);
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }>; content?: string } }>;
  };
  const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argsStr) {
    const c = json.choices?.[0]?.message?.content;
    if (c) { try { return JSON.parse(c) as AIPropostaResult; } catch { /* ignore */ } }
    throw new Error("Resposta da IA sem tool_call utilizável.");
  }
  return JSON.parse(argsStr) as AIPropostaResult;
}

export const generatePropostaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => generateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");
    const modelo = data.modelo ?? DEFAULT_MODEL;

    const { data: prop, error: pErr } = await supabase
      .from("propostas")
      .select("id, titulo, edital_id")
      .eq("id", data.proposta_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Proposta não encontrada.");

    // Empresa (nome)
    const { data: comp } = await supabase
      .from("companies")
      .select("name")
      .eq("id", companyId)
      .maybeSingle();

    // Edital + checklist + trecho (se houver)
    let edital: {
      titulo: string;
      orgao: string | null;
      modalidade: string | null;
      objeto: string | null;
      valor: number | null;
      resumo: string | null;
    } | null = null;
    let checklist: Array<{ categoria: string; requisito: string; obrigatorio: boolean }> = [];
    let trecho: string | null = null;
    if (prop.edital_id) {
      const { data: ed } = await supabase
        .from("editais")
        .select("titulo, orgao, modalidade, objeto, valor_estimado, resumo_ia")
        .eq("id", prop.edital_id)
        .eq("company_id", companyId)
        .maybeSingle();
      if (ed) {
        edital = {
          titulo: ed.titulo,
          orgao: ed.orgao,
          modalidade: ed.modalidade,
          objeto: ed.objeto,
          valor: ed.valor_estimado,
          resumo: ed.resumo_ia,
        };
      }
      const { data: cl } = await supabase
        .from("edital_checklist")
        .select("categoria, requisito, obrigatorio")
        .eq("edital_id", prop.edital_id)
        .eq("company_id", companyId);
      checklist = (cl ?? []) as typeof checklist;

      const { data: docs } = await supabase
        .from("edital_documentos")
        .select("texto_extraido")
        .eq("edital_id", prop.edital_id)
        .eq("company_id", companyId);
      const partes = ((docs ?? []) as Array<{ texto_extraido: string | null }>)
        .map((d) => d.texto_extraido)
        .filter((t): t is string => !!t && t.trim().length > 0);
      trecho = partes.length ? partes.join("\n\n").slice(0, 30000) : null;
    }

    const result = await callAIGateway({
      apiKey,
      modelo,
      prompt: buildPrompt({
        titulo: prop.titulo,
        edital,
        checklist,
        trecho,
        empresa: { nome: comp?.name ?? null },
        instrucoes_extra: data.instrucoes_extra ?? null,
      }),
    });

    const { error: upErr } = await supabase
      .from("propostas")
      .update({
        resumo_executivo: result.resumo_executivo,
        metodologia: result.metodologia,
        equipe_tecnica: result.equipe_tecnica,
        cronograma: result.cronograma,
        diferenciais: result.diferenciais,
        status: "em_revisao",
        ai_meta: {
          modelo,
          gerado_em: new Date().toISOString(),
          instrucoes_extra: data.instrucoes_extra ?? null,
        },
      })
      .eq("id", data.proposta_id)
      .eq("company_id", companyId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true };
  });

/* ============================ Editais (helper for select) ============================ */

export const listEditaisLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("editais")
      .select("id, titulo, orgao, valor_estimado")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ id: string; titulo: string; orgao: string | null; valor_estimado: number | null }>;
  });
