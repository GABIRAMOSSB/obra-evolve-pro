/**
 * Reajustes contratuais por índice — Fase 12.
 *
 * Mantém séries de índices (IPCA/INCC/IGP-M…) e calcula reajustes
 * acumulados para o período entre dois meses de referência, aplicando
 * (1+i1)*(1+i2)*…-1 sobre o valor atualizado do contrato.
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

export type IndiceRow = {
  id: string;
  indice: string;
  mes_referencia: string;
  valor_percentual: number | string;
  fonte: string | null;
};

export type ReajusteRow = {
  id: string;
  contrato_id: string;
  numero: number;
  indice: string;
  periodo_inicio: string;
  periodo_fim: string;
  percentual_acumulado: number | string;
  valor_base: number | string;
  valor_reajuste: number | string;
  data_aplicacao: string | null;
  status: "rascunho" | "aplicado" | "cancelado";
  aplicado_em: string | null;
  observacoes: string | null;
  created_at: string;
};

export type ContratoLite = {
  id: string;
  numero: string;
  objeto: string | null;
  valor_original: number | string | null;
  valor_atualizado: number | string | null;
  indice_principal: string | null;
  periodicidade_reajuste: string | null;
  data_base: string | null;
  status: string | null;
};

export const listReajustes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    indices: IndiceRow[];
    reajustes: ReajusteRow[];
    contratos: ContratoLite[];
  }> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);

    const [iRes, rRes, cRes] = await Promise.all([
      supabase
        .from("indices_economicos")
        .select("id, indice, mes_referencia, valor_percentual, fonte")
        .eq("company_id", companyId)
        .order("mes_referencia", { ascending: false }),
      supabase
        .from("reajustes_contratuais")
        .select("id, contrato_id, numero, indice, periodo_inicio, periodo_fim, percentual_acumulado, valor_base, valor_reajuste, data_aplicacao, status, aplicado_em, observacoes, created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("contratos")
        .select("id, numero, objeto, valor_original, valor_atualizado, indice_principal, periodicidade_reajuste, data_base, status")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);
    if (iRes.error) throw new Error(iRes.error.message);
    if (rRes.error) throw new Error(rRes.error.message);
    if (cRes.error) throw new Error(cRes.error.message);
    return {
      indices: (iRes.data ?? []) as IndiceRow[],
      reajustes: (rRes.data ?? []) as ReajusteRow[],
      contratos: (cRes.data ?? []) as ContratoLite[],
    };
  });

const indiceSchema = z.object({
  indice: z.string().min(1).max(40),
  mes_referencia: z.string().min(7), // YYYY-MM ou YYYY-MM-DD
  valor_percentual: z.number().finite(),
  fonte: z.string().max(200).optional().nullable(),
});

export const upsertIndice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => indiceSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const mes = data.mes_referencia.length === 7 ? `${data.mes_referencia}-01` : data.mes_referencia;
    const { error } = await supabase
      .from("indices_economicos")
      .upsert(
        {
          company_id: companyId,
          indice: data.indice.toUpperCase(),
          mes_referencia: mes,
          valor_percentual: data.valor_percentual,
          fonte: data.fonte ?? null,
          created_by: context.userId,
        },
        { onConflict: "company_id,indice,mes_referencia" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirIndice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("indices_economicos")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const calcSchema = z.object({
  contrato_id: z.string().uuid(),
  indice: z.string().min(1),
  periodo_inicio: z.string().min(7),
  periodo_fim: z.string().min(7),
  status: z.enum(["rascunho", "aplicado"]).default("rascunho"),
  observacoes: z.string().max(2000).optional().nullable(),
  base_modo: z.enum(["contrato", "medicoes"]).optional().default("contrato"),
});

export const calcularReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => calcSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);

    const ini = data.periodo_inicio.length === 7 ? `${data.periodo_inicio}-01` : data.periodo_inicio;
    const fim = data.periodo_fim.length === 7 ? `${data.periodo_fim}-01` : data.periodo_fim;

    const { data: contrato, error: cErr } = await supabase
      .from("contratos")
      .select("id, valor_original, valor_atualizado")
      .eq("id", data.contrato_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contrato) throw new Error("Contrato não encontrado.");

    // Quantos meses esperados no período (inclusivo)
    const [iy, im] = ini.split("-").map(Number);
    const [fy, fm] = fim.split("-").map(Number);
    const mesesEsperados = (fy - iy) * 12 + (fm - im) + 1;

    const fetchSerie = async () =>
      supabase
        .from("indices_economicos")
        .select("mes_referencia, valor_percentual")
        .eq("company_id", companyId)
        .eq("indice", data.indice.toUpperCase())
        .gte("mes_referencia", ini)
        .lte("mes_referencia", fim)
        .order("mes_referencia", { ascending: true });

    let { data: indices, error: iErr } = await fetchSerie();
    if (iErr) throw new Error(iErr.message);

    // Auto-sync no BCB se faltar dado e o índice for suportado pela SGS
    if (!indices || indices.length < mesesEsperados) {
      try {
        const { CATALOGO_INDICES } = await import("@/lib/indices.functions");
        const entry = CATALOGO_INDICES.find(
          (c) => c.codigo === data.indice.toUpperCase(),
        );
        if (entry) {
          const toBcb = (iso: string) => {
            const [y, m, d] = iso.split("-");
            return `${d}/${m}/${y}`;
          };
          const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${entry.sgs}/dados?formato=json&dataInicial=${toBcb(ini)}&dataFinal=${toBcb(fim)}`;
          const res = await fetch(url, { headers: { Accept: "application/json" } });
          if (res.ok) {
            const serie = (await res.json()) as Array<{ data: string; valor: string }>;
            if (Array.isArray(serie) && serie.length > 0) {
              const rows = serie.map((p) => {
                const [d, mo, y] = p.data.split("/");
                return {
                  company_id: companyId,
                  indice: entry.codigo,
                  mes_referencia: `${y}-${mo}-01`,
                  valor_percentual: Number(p.valor),
                  fonte: entry.fonte,
                  created_by: context.userId,
                };
              });
              await supabase
                .from("indices_economicos")
                .upsert(rows, { onConflict: "company_id,indice,mes_referencia" });
              const retry = await fetchSerie();
              if (!retry.error) indices = retry.data;
            }
          }
        }
      } catch {
        // segue com o que tiver
      }
    }


    if (!indices || indices.length === 0) {
      throw new Error(
        "Sem índices para o período. Sincronize em /indices ou lance manualmente.",
      );
    }
    if (indices.length < mesesEsperados) {
      throw new Error(
        `Série incompleta: ${indices.length}/${mesesEsperados} meses encontrados para ${data.indice.toUpperCase()}.`,
      );
    }


    const fator = (indices as Array<{ valor_percentual: number | string }>).reduce(
      (acc, r) => acc * (1 + Number(r.valor_percentual) / 100),
      1,
    );
    const percentual = Number(((fator - 1) * 100).toFixed(6));

    let valorBase = Number(contrato.valor_atualizado || contrato.valor_original || 0);
    let baseDetalhe: { modo: string; medicoes?: number; periodo?: [string, string] } = { modo: "contrato" };

    if (data.base_modo === "medicoes") {
      const { data: bms, error: bmErr } = await supabase
        .from("medicoes")
        .select("numero, valor_executado, status, periodo_inicio, periodo_fim")
        .eq("company_id", companyId)
        .eq("contrato_id", data.contrato_id)
        .in("status", ["aprovada", "paga"])
        .gte("periodo_inicio", ini)
        .lte("periodo_fim", fim);
      if (bmErr) throw new Error(bmErr.message);
      const soma = (bms ?? []).reduce((s: number, m: { valor_executado: number | string }) => s + Number(m.valor_executado || 0), 0);
      if (soma <= 0) {
        throw new Error("Sem medições aprovadas/pagas no período para usar como base elegível.");
      }
      valorBase = Number(soma.toFixed(2));
      baseDetalhe = { modo: "medicoes", medicoes: (bms ?? []).length, periodo: [ini, fim] };
    }

    const valorReajuste = Number((valorBase * (fator - 1)).toFixed(2));

    const { data: anteriores } = await supabase
      .from("reajustes_contratuais")
      .select("numero")
      .eq("company_id", companyId)
      .eq("contrato_id", data.contrato_id);
    const proximoNumero =
      ((anteriores ?? []).reduce((m: number, r: { numero: number }) => Math.max(m, r.numero), 0) ?? 0) + 1;

    const { data: created, error } = await supabase
      .from("reajustes_contratuais")
      .insert({
        company_id: companyId,
        contrato_id: data.contrato_id,
        numero: proximoNumero,
        indice: data.indice.toUpperCase(),
        periodo_inicio: ini,
        periodo_fim: fim,
        percentual_acumulado: percentual,
        valor_base: valorBase,
        valor_reajuste: valorReajuste,
        status: data.status,
        observacoes: data.observacoes ?? null,
        metadata: { meses: indices.length, base: baseDetalhe },
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return {
      id: created.id as string,
      numero: proximoNumero,
      percentual_acumulado: percentual,
      valor_base: valorBase,
      valor_reajuste: valorReajuste,
      meses: indices.length,
    };
  });

export const atualizarStatusReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["rascunho", "aplicado", "cancelado"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("reajustes_contratuais")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const excluirReajuste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { data: cur } = await supabase
      .from("reajustes_contratuais")
      .select("status")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cur?.status === "aplicado") {
      const { error: rErr } = await supabase
        .from("reajustes_contratuais")
        .update({ status: "cancelado" })
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (rErr) throw new Error(rErr.message);
    }
    const { error } = await supabase
      .from("reajustes_contratuais")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================ F12.x — Extração de cláusula de reajuste por IA ============================ */

const extrairClausulaSchema = z.object({
  contrato_id: z.string().uuid(),
  texto: z.string().min(50).max(60000),
  aplicar: z.boolean().optional().default(false),
});

export type ClausulaReajusteExtraida = {
  indice: string | null;
  periodicidade: "anual" | "mensal" | "trimestral" | "semestral" | "sem_reajuste" | null;
  data_base: string | null; // YYYY-MM-DD
  formula: string | null;
  trecho_citado: string | null;
  observacoes: string | null;
  confianca: number; // 0-1
};

export const extrairClausulaReajusteIA = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => extrairClausulaSchema.parse(d))
  .handler(async ({ data, context }): Promise<{
    extraido: ClausulaReajusteExtraida;
    aplicado: boolean;
  }> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada.");

    const { data: contrato, error: cErr } = await supabase
      .from("contratos")
      .select("id")
      .eq("id", data.contrato_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contrato) throw new Error("Contrato não encontrado.");

    const tool = {
      type: "function" as const,
      function: {
        name: "registrar_clausula_reajuste",
        description:
          "Registra a cláusula de reajuste contratual identificada no texto. " +
          "Use null quando a informação não estiver explícita.",
        parameters: {
          type: "object",
          properties: {
            indice: {
              type: ["string", "null"],
              description:
                "Índice econômico (ex.: IPCA, INCC, IGP-M, INPC). Maiúsculo, sem aspas.",
            },
            periodicidade: {
              type: ["string", "null"],
              enum: ["anual", "mensal", "trimestral", "semestral", "sem_reajuste", null],
              description: "Periodicidade da revisão.",
            },
            data_base: {
              type: ["string", "null"],
              description: "Data-base do reajuste no formato YYYY-MM-DD.",
            },
            formula: {
              type: ["string", "null"],
              description: "Fórmula matemática literal, se citada (ex.: V1 = V0 * (I1/I0)).",
            },
            trecho_citado: {
              type: ["string", "null"],
              description: "Trecho exato da cláusula identificada (máx. 500 caracteres).",
            },
            observacoes: {
              type: ["string", "null"],
              description: "Notas relevantes (ex.: anualidade, gatilho, exceções).",
            },
            confianca: {
              type: "number",
              description: "Confiança 0-1 da extração.",
            },
          },
          required: ["indice", "periodicidade", "data_base", "formula", "trecho_citado", "observacoes", "confianca"],
          additionalProperties: false,
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é especialista em contratos administrativos brasileiros (Lei 14.133/2021 e Lei 8.666/1993). " +
              "Sua tarefa é identificar a cláusula de reajuste/reequilíbrio econômico-financeiro num texto e extrair os campos estruturados. " +
              "Responda SEMPRE chamando a tool registrar_clausula_reajuste.",
          },
          {
            role: "user",
            content: `Texto do contrato (pode conter ruído de OCR):\n\n${data.texto}`,
          },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "registrar_clausula_reajuste" } },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 402) throw new Error("Créditos da IA esgotados. Adicione créditos.");
      if (res.status === 429) throw new Error("Limite da IA atingido. Tente novamente em instantes.");
      throw new Error(`Falha na IA (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices: Array<{
        message: { tool_calls?: Array<{ function: { arguments: string } }> };
      }>;
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("IA não retornou estrutura. Tente colar um trecho menor com a cláusula.");

    let parsed: ClausulaReajusteExtraida;
    try {
      const obj = JSON.parse(args) as ClausulaReajusteExtraida;
      parsed = {
        indice: obj.indice ? String(obj.indice).toUpperCase().trim() : null,
        periodicidade: obj.periodicidade ?? null,
        data_base: obj.data_base ?? null,
        formula: obj.formula ?? null,
        trecho_citado: obj.trecho_citado ? String(obj.trecho_citado).slice(0, 500) : null,
        observacoes: obj.observacoes ?? null,
        confianca: typeof obj.confianca === "number" ? obj.confianca : 0,
      };
    } catch {
      throw new Error("IA retornou resposta inválida.");
    }

    let aplicado = false;
    if (data.aplicar) {
      const patch: Record<string, unknown> = {};
      if (parsed.indice) patch.indice_principal = parsed.indice;
      if (parsed.periodicidade) patch.periodicidade_reajuste = parsed.periodicidade;
      if (parsed.data_base) patch.data_base = parsed.data_base;
      if (parsed.formula) patch.formula_reajuste = parsed.formula;
      if (Object.keys(patch).length > 0) {
        const { error: upErr } = await supabase
          .from("contratos")
          .update(patch)
          .eq("id", data.contrato_id)
          .eq("company_id", companyId);
        if (upErr) throw new Error(upErr.message);
        aplicado = true;
      }
    }

    return { extraido: parsed, aplicado };
  });

