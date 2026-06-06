/**
 * Fase 7 — Itens da proposta, readequação e carta proposta.
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
    .from("company_members").select("company_id").eq("user_id", userId)
    .limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  return data.company_id as string;
}
async function requireEditor(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members").select("company_id, role").eq("user_id", userId)
    .limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  if (data.role !== "admin" && data.role !== "editor") throw new Error("Permissão insuficiente.");
  return data.company_id as string;
}

/* ============================ PROPOSTA HEADER ============================ */

export interface PropostaDetail {
  id: string;
  company_id: string;
  edital_id: string | null;
  titulo: string;
  status: string;
  tipo: "original" | "readequada";
  proposta_origem_id: string | null;
  valor_proposto: number | null;
  valor_itens: number | null;
  valor_total: number | null;
  bdi_percent: number | null;
  encargos_percent: number | null;
  data_referencia: string | null;
  prazo_execucao_dias: number | null;
  resumo_executivo: string | null;
  metodologia: string | null;
  equipe_tecnica: string | null;
  cronograma: string | null;
  diferenciais: string | null;
  observacoes: string | null;
  edital_titulo: string | null;
}

export const getPropostaDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<PropostaDetail> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: row, error } = await supabase
      .from("propostas")
      .select("id, company_id, edital_id, titulo, status, tipo, proposta_origem_id, valor_proposto, valor_itens, valor_total, bdi_percent, encargos_percent, data_referencia, prazo_execucao_dias, resumo_executivo, metodologia, equipe_tecnica, cronograma, diferenciais, observacoes, edital:editais(titulo)")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Proposta não encontrada.");
    return { ...row, edital_titulo: row.edital?.titulo ?? null } as PropostaDetail;
  });

export const updatePropostaHeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid(),
    bdi_percent: z.number().min(0).max(200).nullable().optional(),
    encargos_percent: z.number().min(0).max(200).nullable().optional(),
    data_referencia: z.string().nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { id, ...patch } = data;
    const { error } = await supabase.from("propostas").update(patch).eq("id", id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    // recalcula totais
    await supabase.rpc("recalc_proposta_totals", { p_proposta_id: id });
    return { ok: true };
  });

/* ============================ ITENS ============================ */

export interface PropostaItemRow {
  id: string;
  proposta_id: string;
  ordem: number;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  quantidade: number;
  preco_unitario: number;
  preco_total: number;
  observacao: string | null;
}

export const listPropostaItens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ proposta_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<PropostaItemRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("proposta_itens")
      .select("id, proposta_id, ordem, codigo, descricao, unidade, quantidade, preco_unitario, preco_total, observacao")
      .eq("proposta_id", data.proposta_id).eq("company_id", companyId)
      .order("ordem", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as PropostaItemRow[];
  });

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  proposta_id: z.string().uuid(),
  ordem: z.number().int().min(0).default(0),
  codigo: z.string().max(60).nullable().optional(),
  descricao: z.string().min(1).max(500),
  unidade: z.string().max(20).nullable().optional(),
  quantidade: z.number().min(0),
  preco_unitario: z.number().min(0),
  observacao: z.string().max(500).nullable().optional(),
});

export const savePropostaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => itemSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const payload = {
      company_id: companyId,
      proposta_id: data.proposta_id,
      ordem: data.ordem,
      codigo: data.codigo ?? null,
      descricao: data.descricao,
      unidade: data.unidade ?? null,
      quantidade: data.quantidade,
      preco_unitario: data.preco_unitario,
      observacao: data.observacao ?? null,
    };
    if (data.id) {
      const { error } = await supabase.from("proposta_itens").update(payload).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("proposta_itens").insert(payload);
      if (error) throw new Error(error.message);
    }
    await supabase.rpc("recalc_proposta_totals", { p_proposta_id: data.proposta_id });
    return { ok: true };
  });

export const deletePropostaItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), proposta_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase.from("proposta_itens").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    await supabase.rpc("recalc_proposta_totals", { p_proposta_id: data.proposta_id });
    return { ok: true };
  });

/* ============================ READEQUAÇÃO ============================ */

export const criarPropostaReadequada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ proposta_origem_id: z.string().uuid(), titulo: z.string().min(2).max(300) }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: origem, error: oErr } = await supabase.from("propostas")
      .select("*").eq("id", data.proposta_origem_id).eq("company_id", companyId).maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!origem) throw new Error("Proposta de origem não encontrada.");

    const { data: novaProp, error: nErr } = await supabase.from("propostas").insert({
      company_id: companyId,
      edital_id: origem.edital_id,
      titulo: data.titulo,
      status: "rascunho",
      tipo: "readequada",
      proposta_origem_id: origem.id,
      bdi_percent: origem.bdi_percent,
      encargos_percent: origem.encargos_percent,
      data_referencia: new Date().toISOString().slice(0, 10),
      prazo_execucao_dias: origem.prazo_execucao_dias,
      resumo_executivo: origem.resumo_executivo,
      metodologia: origem.metodologia,
      equipe_tecnica: origem.equipe_tecnica,
      cronograma: origem.cronograma,
      diferenciais: origem.diferenciais,
      created_by: context.userId,
    }).select("id").single();
    if (nErr) throw new Error(nErr.message);

    // Copia itens da origem
    const { data: itens } = await supabase.from("proposta_itens")
      .select("ordem, codigo, descricao, unidade, quantidade, preco_unitario, observacao")
      .eq("proposta_id", origem.id).eq("company_id", companyId);

    if (itens && itens.length > 0) {
      const insertRows = (itens as Array<Record<string, unknown>>).map((it) => ({
        ...it,
        company_id: companyId,
        proposta_id: novaProp.id,
      }));
      const { error: itErr } = await supabase.from("proposta_itens").insert(insertRows);
      if (itErr) throw new Error(itErr.message);
    }

    await supabase.rpc("recalc_proposta_totals", { p_proposta_id: novaProp.id });
    return { id: novaProp.id as string };
  });

export interface ResiduoRow {
  id: string;
  codigo: string | null;
  descricao: string;
  unidade: string | null;
  qtd_origem: number;
  qtd_readequada: number;
  preco_origem: number;
  preco_readequado: number;
  delta_valor: number;
  justificativa: string | null;
}

export const computarResiduosReadequacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ proposta_readequada_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: prop, error: pErr } = await supabase.from("propostas")
      .select("id, proposta_origem_id").eq("id", data.proposta_readequada_id)
      .eq("company_id", companyId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop?.proposta_origem_id) throw new Error("Proposta não é uma readequação.");

    // limpa anteriores
    await supabase.from("proposta_readequacao_residuos")
      .delete().eq("proposta_readequada_id", data.proposta_readequada_id).eq("company_id", companyId);

    const { data: orig } = await supabase.from("proposta_itens")
      .select("id, codigo, descricao, unidade, quantidade, preco_unitario")
      .eq("proposta_id", prop.proposta_origem_id).eq("company_id", companyId);
    const { data: read } = await supabase.from("proposta_itens")
      .select("id, codigo, descricao, unidade, quantidade, preco_unitario")
      .eq("proposta_id", prop.id).eq("company_id", companyId);

    type It = { id: string; codigo: string | null; descricao: string; unidade: string | null; quantidade: number; preco_unitario: number };
    const origList = (orig ?? []) as It[];
    const readList = (read ?? []) as It[];

    const keyOf = (i: It) => (i.codigo ?? i.descricao).trim().toLowerCase();
    const origMap = new Map<string, It>(origList.map((i) => [keyOf(i), i]));
    const readMap = new Map<string, It>(readList.map((i) => [keyOf(i), i]));
    const allKeys = new Set([...origMap.keys(), ...readMap.keys()]);

    const rows: Array<Record<string, unknown>> = [];
    for (const k of allKeys) {
      const o = origMap.get(k);
      const r = readMap.get(k);
      const base = r ?? o!;
      rows.push({
        company_id: companyId,
        proposta_readequada_id: prop.id,
        proposta_origem_id: prop.proposta_origem_id,
        item_origem_id: o?.id ?? null,
        item_readequado_id: r?.id ?? null,
        codigo: base.codigo,
        descricao: base.descricao,
        unidade: base.unidade,
        qtd_origem: o?.quantidade ?? 0,
        qtd_readequada: r?.quantidade ?? 0,
        preco_origem: o?.preco_unitario ?? 0,
        preco_readequado: r?.preco_unitario ?? 0,
      });
    }
    if (rows.length > 0) {
      const { error } = await supabase.from("proposta_readequacao_residuos").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { count: rows.length };
  });

export const listResiduos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ proposta_readequada_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<ResiduoRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("proposta_readequacao_residuos")
      .select("id, codigo, descricao, unidade, qtd_origem, qtd_readequada, preco_origem, preco_readequado, delta_valor, justificativa")
      .eq("proposta_readequada_id", data.proposta_readequada_id).eq("company_id", companyId)
      .order("descricao", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as ResiduoRow[];
  });

/* ============================ CARTA PROPOSTA ============================ */

export interface CartaRow {
  id: string;
  versao: number;
  conteudo_md: string;
  hash_sha256: string | null;
  validade_dias: number | null;
  condicoes_pagamento: string | null;
  prazo_execucao_dias: number | null;
  created_at: string;
}

export const listCartas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ proposta_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<CartaRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: rows, error } = await supabase.from("cartas_proposta")
      .select("id, versao, conteudo_md, hash_sha256, validade_dias, condicoes_pagamento, prazo_execucao_dias, created_at")
      .eq("proposta_id", data.proposta_id).eq("company_id", companyId)
      .order("versao", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as CartaRow[];
  });

async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const CARTA_TOOL = {
  type: "function",
  function: {
    name: "registrar_carta_proposta",
    description: "Carta proposta formal.",
    parameters: {
      type: "object", additionalProperties: false,
      properties: {
        conteudo_md: { type: "string", description: "Carta completa em markdown" },
        condicoes_pagamento: { type: "string" },
        validade_dias: { type: "integer" },
      },
      required: ["conteudo_md", "condicoes_pagamento", "validade_dias"],
    },
  },
} as const;

export const gerarCartaPropostaIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    proposta_id: z.string().uuid(),
    modelo: z.string().optional(),
    instrucoes_extra: z.string().max(2000).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");
    const modelo = data.modelo ?? DEFAULT_MODEL;

    const { data: prop, error: pErr } = await supabase.from("propostas")
      .select("id, titulo, valor_total, valor_proposto, prazo_execucao_dias, bdi_percent, data_referencia, edital:editais(titulo, orgao, modalidade, objeto)")
      .eq("id", data.proposta_id).eq("company_id", companyId).maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!prop) throw new Error("Proposta não encontrada.");

    const { data: comp } = await supabase.from("companies").select("name, cnpj, endereco").eq("id", companyId).maybeSingle();

    const valor = prop.valor_total ?? prop.valor_proposto;
    const prompt = `Você é um redator jurídico/comercial especializado em licitações públicas (Lei 14.133/21). Redija uma CARTA PROPOSTA formal em markdown contendo:
- Cabeçalho com dados da empresa proponente
- Identificação do edital/órgão
- Objeto da proposta
- Valor global por extenso e numérico
- Prazo de execução
- Prazo de validade da proposta
- Condições de pagamento (sugira padrão de medição mensal)
- Declarações obrigatórias (aceitação dos termos do edital, inexistência de fato impeditivo, cumprimento da legislação trabalhista)
- Local, data e assinatura do representante legal (placeholder [Representante Legal])

Empresa: ${comp?.name ?? "[Empresa]"} — CNPJ ${comp?.cnpj ?? "[CNPJ]"}
${comp?.endereco ? `Endereço: ${comp.endereco}` : ""}
Edital: ${prop.edital?.titulo ?? prop.titulo}
Órgão: ${prop.edital?.orgao ?? "[Órgão]"}
Modalidade: ${prop.edital?.modalidade ?? "[Modalidade]"}
Objeto: ${prop.edital?.objeto ?? prop.titulo}
Valor: ${valor != null ? `R$ ${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "[Valor]"}
Prazo execução: ${prop.prazo_execucao_dias ?? "[Prazo]"} dias
${data.instrucoes_extra ? `\nInstruções extras: ${data.instrucoes_extra}` : ""}

Responda chamando a tool fornecida.`;

    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        messages: [
          { role: "system", content: "Redator jurídico de cartas proposta brasileiras." },
          { role: "user", content: prompt },
        ],
        tools: [CARTA_TOOL],
        tool_choice: { type: "function", function: { name: "registrar_carta_proposta" } },
      }),
    });
    if (resp.status === 429) throw new Error("Limite de requisições da IA atingido.");
    if (resp.status === 402) throw new Error("Créditos de IA insuficientes.");
    if (!resp.ok) throw new Error(`AI Gateway ${resp.status}`);
    const json = await resp.json();
    const argsStr = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("Resposta da IA sem tool_call.");
    const parsed = JSON.parse(argsStr) as { conteudo_md: string; condicoes_pagamento: string; validade_dias: number };

    const { data: last } = await supabase.from("cartas_proposta")
      .select("versao").eq("proposta_id", data.proposta_id).eq("company_id", companyId)
      .order("versao", { ascending: false }).limit(1).maybeSingle();
    const proxVersao = (last?.versao ?? 0) + 1;

    const hash = await sha256(parsed.conteudo_md);
    const { data: novaCarta, error: cErr } = await supabase.from("cartas_proposta").insert({
      company_id: companyId,
      proposta_id: data.proposta_id,
      versao: proxVersao,
      conteudo_md: parsed.conteudo_md,
      hash_sha256: hash,
      validade_dias: parsed.validade_dias,
      condicoes_pagamento: parsed.condicoes_pagamento,
      prazo_execucao_dias: prop.prazo_execucao_dias,
      created_by: context.userId,
    }).select("id, versao").single();
    if (cErr) throw new Error(cErr.message);

    return { id: novaCarta.id as string, versao: novaCarta.versao as number };
  });

export const salvarCartaManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({
    id: z.string().uuid().optional(),
    proposta_id: z.string().uuid(),
    conteudo_md: z.string().min(20),
    condicoes_pagamento: z.string().max(2000).nullable().optional(),
    validade_dias: z.number().int().min(1).max(365).nullable().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const hash = await sha256(data.conteudo_md);
    if (data.id) {
      const { error } = await supabase.from("cartas_proposta").update({
        conteudo_md: data.conteudo_md,
        condicoes_pagamento: data.condicoes_pagamento ?? null,
        validade_dias: data.validade_dias ?? null,
        hash_sha256: hash,
      }).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: last } = await supabase.from("cartas_proposta")
      .select("versao").eq("proposta_id", data.proposta_id).eq("company_id", companyId)
      .order("versao", { ascending: false }).limit(1).maybeSingle();
    const versao = (last?.versao ?? 0) + 1;
    const { data: nova, error } = await supabase.from("cartas_proposta").insert({
      company_id: companyId,
      proposta_id: data.proposta_id,
      versao,
      conteudo_md: data.conteudo_md,
      hash_sha256: hash,
      condicoes_pagamento: data.condicoes_pagamento ?? null,
      validade_dias: data.validade_dias ?? null,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: nova.id as string };
  });

export const deleteCarta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase.from("cartas_proposta").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
