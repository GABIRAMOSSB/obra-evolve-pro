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
    const valorBase = Number(contrato.valor_atualizado || contrato.valor_original || 0);
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
        metadata: { meses: indices.length },
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
