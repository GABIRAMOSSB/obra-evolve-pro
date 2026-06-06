/**
 * Fase 15 — Índices Econômicos Automáticos.
 *
 * Integra com a API pública do Banco Central (BCB SGS) — sem credencial:
 *   https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados?formato=json
 *
 * Catálogo de índices suportados (códigos SGS):
 *   - IPCA   (433)  · IBGE — Variação % mensal
 *   - INPC   (188)  · IBGE
 *   - IGP-M  (189)  · FGV
 *   - IGP-DI (190)  · FGV
 *   - INCC   (192)  · FGV (INCC-DI)
 *   - SELIC  (4390) · BCB (mensal)
 *   - CDI    (4391) · CETIP (mensal)
 *
 * Server functions:
 *   - listCatalogoIndices()             → catálogo estático
 *   - listIndicesEconomicos(filters?)   → lê tabela `indices_economicos`
 *   - sincronizarIndiceBCB({indice,from,to}) → busca BCB e faz upsert
 *   - upsertIndiceManual(payload)       → entrada manual (fallback p/ FGV/outras fontes)
 *   - excluirIndice(id)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type IndiceCodigo = "IPCA" | "INPC" | "IGP-M" | "IGP-DI" | "INCC" | "SELIC" | "CDI";

export const CATALOGO_INDICES: Array<{
  codigo: IndiceCodigo;
  nome: string;
  sgs: number;
  fonte: string;
  descricao: string;
}> = [
  { codigo: "IPCA", nome: "IPCA", sgs: 433, fonte: "IBGE/BCB-SGS", descricao: "Índice de Preços ao Consumidor Amplo" },
  { codigo: "INPC", nome: "INPC", sgs: 188, fonte: "IBGE/BCB-SGS", descricao: "Índice Nacional de Preços ao Consumidor" },
  { codigo: "IGP-M", nome: "IGP-M", sgs: 189, fonte: "FGV/BCB-SGS", descricao: "Índice Geral de Preços do Mercado" },
  { codigo: "IGP-DI", nome: "IGP-DI", sgs: 190, fonte: "FGV/BCB-SGS", descricao: "Índice Geral de Preços - Disponibilidade Interna" },
  { codigo: "INCC", nome: "INCC", sgs: 192, fonte: "FGV/BCB-SGS", descricao: "Índice Nacional de Custo da Construção (DI)" },
  { codigo: "SELIC", nome: "SELIC", sgs: 4390, fonte: "BCB-SGS", descricao: "Taxa SELIC mensal" },
  { codigo: "CDI", nome: "CDI", sgs: 4391, fonte: "CETIP/BCB-SGS", descricao: "Taxa CDI mensal acumulada" },
];

function getSgsCode(indice: string): number {
  const found = CATALOGO_INDICES.find((c) => c.codigo === indice.toUpperCase());
  if (!found) throw new Error(`Índice não suportado: ${indice}`);
  return found.sgs;
}

function getCatalogEntry(indice: string) {
  return CATALOGO_INDICES.find((c) => c.codigo === indice.toUpperCase());
}

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

/* ------------------------------ Catálogo ------------------------------ */

export const listCatalogoIndices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => CATALOGO_INDICES);

/* ------------------------------ Listagem ------------------------------ */

const listFiltersSchema = z
  .object({
    indice: z.string().optional(),
    from: z.string().optional(), // YYYY-MM-DD
    to: z.string().optional(),
  })
  .optional();

export const listIndicesEconomicos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listFiltersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);

    let q = supabase
      .from("indices_economicos")
      .select("id, indice, mes_referencia, valor_percentual, fonte, created_at")
      .eq("company_id", companyId)
      .order("indice", { ascending: true })
      .order("mes_referencia", { ascending: false })
      .limit(1000);

    if (data?.indice) q = q.eq("indice", data.indice.toUpperCase());
    if (data?.from) q = q.gte("mes_referencia", data.from);
    if (data?.to) q = q.lte("mes_referencia", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Resumo: último valor por índice + acumulado 12m
    const byIndice = new Map<string, typeof rows>();
    (rows ?? []).forEach((r: { indice: string }) => {
      const arr = byIndice.get(r.indice) ?? [];
      arr.push(r);
      byIndice.set(r.indice, arr);
    });

    const resumo = Array.from(byIndice.entries()).map(([indice, arr]) => {
      const ordered = [...(arr ?? [])].sort((a, b) =>
        (a.mes_referencia as string).localeCompare(b.mes_referencia as string),
      );
      const ult12 = ordered.slice(-12);
      const acum12 =
        ult12.reduce((acc, r) => acc * (1 + Number(r.valor_percentual) / 100), 1) - 1;
      const ultimo = ordered[ordered.length - 1];
      return {
        indice,
        ultimo_mes: ultimo?.mes_referencia ?? null,
        ultimo_valor: ultimo ? Number(ultimo.valor_percentual) : null,
        acumulado_12m_pct: Number((acum12 * 100).toFixed(4)),
        total_registros: ordered.length,
      };
    });

    return { rows: rows ?? [], resumo };
  });

/* --------------------------- Sincronização BCB --------------------------- */

const syncSchema = z.object({
  indice: z.string().min(1),
  /** dd/mm/yyyy ou yyyy-mm-dd; opcional (padrão últimos 36 meses) */
  from: z.string().optional(),
  to: z.string().optional(),
});

function toBcbDate(s?: string): string | undefined {
  if (!s) return undefined;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return undefined;
}

function fromBcbDate(s: string): string {
  // BCB devolve "dd/mm/yyyy"; converte para primeiro dia do mês (mes_referencia)
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) throw new Error(`Data BCB inválida: ${s}`);
  return `${m[3]}-${m[2]}-01`;
}

export const sincronizarIndiceBCB = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => syncSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);

    const sgs = getSgsCode(data.indice);
    const entry = getCatalogEntry(data.indice)!;

    // Default: últimos 36 meses
    let from = toBcbDate(data.from);
    let to = toBcbDate(data.to);
    if (!from) {
      const now = new Date();
      const past = new Date(now.getFullYear() - 3, now.getMonth(), 1);
      from = `${String(past.getDate()).padStart(2, "0")}/${String(past.getMonth() + 1).padStart(2, "0")}/${past.getFullYear()}`;
    }
    if (!to) {
      const now = new Date();
      to = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
    }

    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${sgs}/dados?formato=json&dataInicial=${from}&dataFinal=${to}`;

    let serie: Array<{ data: string; valor: string }>;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        throw new Error(`BCB SGS HTTP ${res.status}`);
      }
      serie = (await res.json()) as Array<{ data: string; valor: string }>;
    } catch (e) {
      throw new Error(
        `Falha ao consultar BCB SGS (${entry.codigo}/${sgs}): ${(e as Error).message}`,
      );
    }

    if (!Array.isArray(serie) || serie.length === 0) {
      return { inseridos: 0, atualizados: 0, total: 0 };
    }

    const rows = serie.map((p) => ({
      company_id: companyId,
      indice: entry.codigo,
      mes_referencia: fromBcbDate(p.data),
      valor_percentual: Number(p.valor),
      fonte: entry.fonte,
      created_by: userId,
    }));

    const { error: upErr, count } = await supabase
      .from("indices_economicos")
      .upsert(rows, {
        onConflict: "company_id,indice,mes_referencia",
        count: "exact",
      });
    if (upErr) throw new Error(upErr.message);

    return {
      indice: entry.codigo,
      sgs,
      periodo: { from, to },
      total: rows.length,
      gravados: count ?? rows.length,
    };
  });

/* --------------------------- Upsert manual --------------------------- */

const manualSchema = z.object({
  indice: z.string().min(1).max(40),
  mes_referencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  valor_percentual: z.number().min(-100).max(1000),
  fonte: z.string().max(120).optional(),
});

export const upsertIndiceManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => manualSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);

    const { error } = await supabase
      .from("indices_economicos")
      .upsert(
        {
          company_id: companyId,
          indice: data.indice.toUpperCase(),
          mes_referencia: data.mes_referencia,
          valor_percentual: data.valor_percentual,
          fonte: data.fonte ?? "manual",
          created_by: userId,
        },
        { onConflict: "company_id,indice,mes_referencia" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- Exclusão --------------------------- */

export const excluirIndice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { error } = await supabase
      .from("indices_economicos")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
