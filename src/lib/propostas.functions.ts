/**
 * Propostas assistidas (IA) — Fase 7.
 *
 * Rascunho técnico-comercial gerado a partir de um edital + biblioteca,
 * com auxílio do Lovable AI Gateway (Gemini 2.5 Flash).
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

export type PropostaStatus =
  | "rascunho"
  | "em_revisao"
  | "aprovada"
  | "enviada"
  | "perdida"
  | "ganha";

export interface PropostaRow {
  id: string;
  titulo: string;
  status: PropostaStatus;
  valor_proposto: number | null;
  prazo_execucao_dias: number | null;
  edital_id: string | null;
  edital_titulo: string | null;
  resumo_executivo: string | null;
  metodologia: string | null;
  equipe_tecnica: string | null;
  cronograma: string | null;
  diferenciais: string | null;
  observacoes: string | null;
  ai_meta_gerado_em: string | null;
  ai_meta_modelo: string | null;
  created_at: string;
  updated_at: string;
}

export const listPropostas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PropostaRow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("propostas")
      .select(
        "id, titulo, status, valor_proposto, prazo_execucao_dias, edital_id, resumo_executivo, metodologia, equipe_tecnica, cronograma, diferenciais, observacoes, ai_meta, created_at, updated_at, editais(titulo)"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown> & { editais?: { titulo?: string } | null }>).map(
      (r) => ({
        id: r.id as string,
        titulo: r.titulo as string,
        status: r.status as PropostaStatus,
        valor_proposto: r.valor_proposto == null ? null : Number(r.valor_proposto),
        prazo_execucao_dias: (r.prazo_execucao_dias as number) ?? null,
        edital_id: (r.edital_id as string) ?? null,
        edital_titulo: r.editais?.titulo ?? null,
        resumo_executivo: (r.resumo_executivo as string) ?? null,
        metodologia: (r.metodologia as string) ?? null,
        equipe_tecnica: (r.equipe_tecnica as string) ?? null,
        cronograma: (r.cronograma as string) ?? null,
        diferenciais: (r.diferenciais as string) ?? null,
        observacoes: (r.observacoes as string) ?? null,
        ai_meta: (r.ai_meta as Record<string, unknown>) ?? {},
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      })
    );
  });

const createSchema = z.object({
  titulo: z.string().min(1).max(255),
  edital_id: z.string().uuid().nullable().optional(),
});

export const createProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: ins, error } = await supabase
      .from("propostas")
      .insert({
        company_id: companyId,
        edital_id: data.edital_id ?? null,
        titulo: data.titulo,
        status: "rascunho",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  titulo: z.string().min(1).max(255).optional(),
  status: z
    .enum(["rascunho", "em_revisao", "aprovada", "enviada", "perdida", "ganha"])
    .optional(),
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
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const patch: Record<string, unknown> = {};
    for (const k of [
      "titulo",
      "status",
      "valor_proposto",
      "prazo_execucao_dias",
      "resumo_executivo",
      "metodologia",
      "equipe_tecnica",
      "cronograma",
      "diferenciais",
      "observacoes",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k];
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("propostas")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("propostas")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface EditalOpcao {
  id: string;
  titulo: string;
  objeto: string | null;
  orgao: string | null;
  modalidade: string | null;
  valor_estimado: number | null;
}

export const listEditaisParaSelect = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EditalOpcao[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("editais")
      .select("id, titulo, objeto, orgao, modalidade, valor_estimado")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      titulo: (r.titulo as string) ?? "(sem título)",
      objeto: (r.objeto as string) ?? null,
      orgao: (r.orgao as string) ?? null,
      modalidade: (r.modalidade as string) ?? null,
      valor_estimado: r.valor_estimado == null ? null : Number(r.valor_estimado),
    }));
  });

interface DraftResult {
  resumo_executivo: string;
  metodologia: string;
  equipe_tecnica: string;
  cronograma: string;
  diferenciais: string;
}

export const gerarRascunho = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        proposta_id: z.string().uuid(),
        instrucoes: z.string().max(2000).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: prop, error: pErr } = await supabase
      .from("propostas")
      .select("id, titulo, edital_id")
      .eq("id", data.proposta_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Proposta não encontrada.");

    let editalCtx = "";
    let checklistCtx = "";
    if (prop.edital_id) {
      const { data: ed } = await supabase
        .from("editais")
        .select("titulo, objeto, orgao, modalidade, valor_estimado, data_abertura")
        .eq("id", prop.edital_id)
        .maybeSingle();
      if (ed) {
        editalCtx = `Edital: ${ed.titulo ?? ""}
Órgão: ${ed.orgao ?? "—"}
Modalidade: ${ed.modalidade ?? "—"}
Objeto: ${ed.objeto ?? "—"}
Valor estimado: ${ed.valor_estimado ?? "—"}
Abertura: ${ed.data_abertura ?? "—"}`;
      }
      const { data: ck } = await supabase
        .from("edital_checklist")
        .select("categoria, requisito")
        .eq("edital_id", prop.edital_id)
        .limit(40);
      if (ck && ck.length > 0) {
        checklistCtx =
          "Requisitos do edital:\n" +
          (ck as Array<{ categoria: string; requisito: string }>)
            .map((c) => `- [${c.categoria}] ${c.requisito}`)
            .join("\n");
      }
    }

    const { data: bib } = await supabase
      .from("biblioteca_documentos")
      .select("titulo, categoria, descricao")
      .eq("company_id", companyId)
      .limit(30);
    const bibCtx =
      bib && bib.length > 0
        ? "Documentos disponíveis na biblioteca da empresa:\n" +
          (bib as Array<{ titulo: string; categoria: string; descricao: string | null }>)
            .map((b) => `- ${b.titulo} (${b.categoria})${b.descricao ? ` — ${b.descricao}` : ""}`)
            .join("\n")
        : "";

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const systemPrompt = `Você é um redator técnico especialista em propostas para licitações públicas brasileiras (Lei 14.133/2021).
Produza um RASCUNHO de proposta em português, objetivo e formal, pronto para revisão humana.
Retorne SOMENTE um JSON válido (sem markdown) com as chaves:
- resumo_executivo (string, 2-4 parágrafos)
- metodologia (string, 3-6 parágrafos descrevendo abordagem técnica)
- equipe_tecnica (string, descrever perfis-chave necessários)
- cronograma (string, fases macro com prazos relativos)
- diferenciais (string, 3-6 bullets em texto corrido começando com "- ")`;

    const userPrompt = `Título da proposta: ${prop.titulo}

${editalCtx || "Sem edital vinculado — gere conteúdo genérico aplicável a obras públicas."}

${checklistCtx}

${bibCtx}

${data.instrucoes ? `Instruções adicionais do usuário:\n${data.instrucoes}` : ""}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos do Lovable AI Gateway esgotados.");
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`AI Gateway: ${resp.status} ${t.slice(0, 200)}`);
    }
    const payload = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? "{}";

    let draft: DraftResult;
    try {
      draft = JSON.parse(content) as DraftResult;
    } catch {
      throw new Error("Resposta da IA não pôde ser interpretada.");
    }

    const { error: uErr } = await supabase
      .from("propostas")
      .update({
        resumo_executivo: draft.resumo_executivo ?? null,
        metodologia: draft.metodologia ?? null,
        equipe_tecnica: draft.equipe_tecnica ?? null,
        cronograma: draft.cronograma ?? null,
        diferenciais: draft.diferenciais ?? null,
        ai_meta: {
          gerado_em: new Date().toISOString(),
          modelo: "google/gemini-2.5-flash",
          instrucoes: data.instrucoes ?? null,
        },
      })
      .eq("id", data.proposta_id)
      .eq("company_id", companyId);
    if (uErr) throw new Error(uErr.message);
    return { ok: true };
  });
