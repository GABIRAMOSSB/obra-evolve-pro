/**
 * Financeiro de obra — Fase 9.
 *
 * Agrega custos de NFe (nfe_item_apropriacoes) e mão de obra
 * (apontamentos_mao_obra) por obra e por centro de custo, para um
 * painel financeiro consolidado.
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

export type ObraFinanceira = {
  obra_id: string;
  nome: string;
  status: string | null;
  valor_contratado: number;
  total_nfe: number;
  total_mao_obra: number;
  total_geral: number;
  saldo: number | null;
  percentual_consumido: number | null;
};

export const listObrasFinanceiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ObraFinanceira[]> => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);

    const [obrasRes, nfeRes, moRes] = await Promise.all([
      supabase
        .from("obras")
        .select("id, legacy_obra_id, codigo, nome, status, valor_contratado")
        .eq("company_id", companyId),
      supabase
        .from("nfe_item_apropriacoes")
        .select("obra_id, valor_total")
        .eq("company_id", companyId),
      supabase
        .from("apontamentos_mao_obra")
        .select("obra_id, custo_total")
        .eq("company_id", companyId),
    ]);
    if (obrasRes.error) throw new Error(obrasRes.error.message);
    if (nfeRes.error) throw new Error(nfeRes.error.message);
    if (moRes.error) throw new Error(moRes.error.message);

    const nfeMap = new Map<string, number>();
    for (const r of nfeRes.data ?? []) {
      const k = String(r.obra_id ?? "");
      if (!k) continue;
      nfeMap.set(k, (nfeMap.get(k) ?? 0) + Number(r.valor_total ?? 0));
    }
    const moMap = new Map<string, number>();
    for (const r of moRes.data ?? []) {
      const k = String(r.obra_id ?? "");
      if (!k) continue;
      moMap.set(k, (moMap.get(k) ?? 0) + Number(r.custo_total ?? 0));
    }

    const result: ObraFinanceira[] = [];
    const seenKeys = new Set<string>();

    for (const o of obrasRes.data ?? []) {
      // matching keys: id, legacy_obra_id, codigo
      const candidates = [o.id, o.legacy_obra_id, o.codigo].filter(Boolean) as string[];
      let nfe = 0;
      let mo = 0;
      for (const c of candidates) {
        nfe += nfeMap.get(c) ?? 0;
        mo += moMap.get(c) ?? 0;
        seenKeys.add(c);
      }
      const total = nfe + mo;
      const vc = Number(o.valor_contratado ?? 0);
      result.push({
        obra_id: o.id,
        nome: o.nome,
        status: o.status,
        valor_contratado: vc,
        total_nfe: nfe,
        total_mao_obra: mo,
        total_geral: total,
        saldo: vc > 0 ? vc - total : null,
        percentual_consumido: vc > 0 ? (total / vc) * 100 : null,
      });
    }

    // Obras "fantasma" (chaves de NFe/MO não vinculadas a uma obra cadastrada)
    const orphanKeys = new Set<string>();
    for (const k of nfeMap.keys()) if (!seenKeys.has(k)) orphanKeys.add(k);
    for (const k of moMap.keys()) if (!seenKeys.has(k)) orphanKeys.add(k);
    for (const k of orphanKeys) {
      const nfe = nfeMap.get(k) ?? 0;
      const mo = moMap.get(k) ?? 0;
      result.push({
        obra_id: k,
        nome: `(não vinculada) ${k}`,
        status: null,
        valor_contratado: 0,
        total_nfe: nfe,
        total_mao_obra: mo,
        total_geral: nfe + mo,
        saldo: null,
        percentual_consumido: null,
      });
    }

    result.sort((a, b) => b.total_geral - a.total_geral);
    return result;
  });

export type CentroCustoFinanceiro = {
  centro_custo_id: string | null;
  codigo: string | null;
  nome: string;
  tipo: string | null;
  total_nfe: number;
  total_mao_obra: number;
  total_geral: number;
};

export type DetalheObraFinanceiro = {
  obra: ObraFinanceira;
  centros: CentroCustoFinanceiro[];
  ultimas_nfe: Array<{
    id: string;
    descricao: string;
    valor: number;
    centro_nome: string | null;
    created_at: string;
  }>;
  ultimos_apontamentos: Array<{
    id: string;
    data: string | null;
    recurso: string;
    horas: number;
    custo: number;
    centro_nome: string | null;
  }>;
};

export const getDetalheObraFinanceiro = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obraKey: string }) =>
    z.object({ obraKey: z.string().min(1) }).parse(d),
  )
  .handler(async ({ context, data }): Promise<DetalheObraFinanceiro> => {
    const { supabase, userId } = context;
    const companyId = await resolveCompanyId(supabase, userId);

    // Resolve obra + chaves possíveis
    const { data: obraRow } = await supabase
      .from("obras")
      .select("id, legacy_obra_id, codigo, nome, status, valor_contratado")
      .eq("company_id", companyId)
      .eq("id", data.obraKey)
      .maybeSingle();

    const chaves: string[] = obraRow
      ? ([obraRow.id, obraRow.legacy_obra_id, obraRow.codigo].filter(Boolean) as string[])
      : [data.obraKey];

    const [nfeRes, moRes, ccRes, nfeRecRes, moRecRes] = await Promise.all([
      supabase
        .from("nfe_item_apropriacoes")
        .select("centro_custo_id, valor_total")
        .eq("company_id", companyId)
        .in("obra_id", chaves),
      supabase
        .from("apontamentos_mao_obra")
        .select("centro_custo_id, custo_total")
        .eq("company_id", companyId)
        .in("obra_id", chaves),
      supabase
        .from("centros_custo")
        .select("id, codigo, nome, tipo")
        .eq("company_id", companyId),
      supabase
        .from("nfe_item_apropriacoes")
        .select("id, descricao_insumo, valor_total, centro_custo_id, created_at")
        .eq("company_id", companyId)
        .in("obra_id", chaves)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("apontamentos_mao_obra")
        .select("id, data, recurso_nome, horas_normais, horas_extras, custo_total, centro_custo_id")
        .eq("company_id", companyId)
        .in("obra_id", chaves)
        .order("data", { ascending: false })
        .limit(10),
    ]);
    if (nfeRes.error) throw new Error(nfeRes.error.message);
    if (moRes.error) throw new Error(moRes.error.message);
    if (ccRes.error) throw new Error(ccRes.error.message);

    const ccMap = new Map<string, { codigo: string | null; nome: string; tipo: string | null }>();
    for (const c of ccRes.data ?? []) ccMap.set(c.id, { codigo: c.codigo, nome: c.nome, tipo: c.tipo });

    const agg = new Map<string, { nfe: number; mo: number }>();
    const keyOf = (id: string | null) => id ?? "__sem_centro__";
    for (const r of nfeRes.data ?? []) {
      const k = keyOf(r.centro_custo_id);
      const cur = agg.get(k) ?? { nfe: 0, mo: 0 };
      cur.nfe += Number(r.valor_total ?? 0);
      agg.set(k, cur);
    }
    for (const r of moRes.data ?? []) {
      const k = keyOf(r.centro_custo_id);
      const cur = agg.get(k) ?? { nfe: 0, mo: 0 };
      cur.mo += Number(r.custo_total ?? 0);
      agg.set(k, cur);
    }

    const centros: CentroCustoFinanceiro[] = [];
    for (const [k, v] of agg) {
      const info = k === "__sem_centro__" ? null : ccMap.get(k) ?? null;
      centros.push({
        centro_custo_id: k === "__sem_centro__" ? null : k,
        codigo: info?.codigo ?? null,
        nome: info?.nome ?? "(Sem centro de custo)",
        tipo: info?.tipo ?? null,
        total_nfe: v.nfe,
        total_mao_obra: v.mo,
        total_geral: v.nfe + v.mo,
      });
    }
    centros.sort((a, b) => b.total_geral - a.total_geral);

    const ultimas_nfe = (nfeRecRes.data ?? []).map((r: { id: string; descricao_insumo: string | null; valor_total: number | string; centro_custo_id: string | null; created_at: string }) => ({
      id: r.id,
      descricao: r.descricao_insumo ?? "—",
      valor: Number(r.valor_total ?? 0),
      centro_nome: r.centro_custo_id ? ccMap.get(r.centro_custo_id)?.nome ?? null : null,
      created_at: r.created_at,
    }));
    const ultimos_apontamentos = (moRecRes.data ?? []).map((r: { id: string; data: string | null; recurso_nome: string | null; horas_normais: number | string | null; horas_extras: number | string | null; custo_total: number | string | null; centro_custo_id: string | null }) => ({
      id: r.id,
      data: r.data,
      recurso: r.recurso_nome ?? "—",
      horas: Number(r.horas_normais ?? 0) + Number(r.horas_extras ?? 0),
      custo: Number(r.custo_total ?? 0),
      centro_nome: r.centro_custo_id ? ccMap.get(r.centro_custo_id)?.nome ?? null : null,
    }));

    const totalNfe = centros.reduce((s, c) => s + c.total_nfe, 0);
    const totalMo = centros.reduce((s, c) => s + c.total_mao_obra, 0);
    const totalGeral = totalNfe + totalMo;
    const vc = Number(obraRow?.valor_contratado ?? 0);

    return {
      obra: {
        obra_id: obraRow?.id ?? data.obraKey,
        nome: obraRow?.nome ?? `(não vinculada) ${data.obraKey}`,
        status: obraRow?.status ?? null,
        valor_contratado: vc,
        total_nfe: totalNfe,
        total_mao_obra: totalMo,
        total_geral: totalGeral,
        saldo: vc > 0 ? vc - totalGeral : null,
        percentual_consumido: vc > 0 ? (totalGeral / vc) * 100 : null,
      },
      centros,
      ultimas_nfe,
      ultimos_apontamentos,
    };
  });
