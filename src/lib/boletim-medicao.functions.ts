/**
 * Server functions do Boletim de Medição — fluxo detalhado com itens,
 * snapshot congelado entre BMs e workflow de aprovação.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeItem,
  computeTotais,
  sanitizeDescricao,
  validateItem,
} from "./boletim-medicao.calc";

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
  return { companyId: data.company_id as string, role: data.role as string };
}

export const getMedicaoDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId);

    const { data: medicao, error: mErr } = await supabase
      .from("medicoes")
      .select("*")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!medicao) throw new Error("Medição não encontrada.");

    const { data: contrato } = await supabase
      .from("contratos")
      .select("*")
      .eq("id", medicao.contrato_id)
      .maybeSingle();

    const obraId = medicao.obra_id ?? contrato?.obra_id ?? null;
    const { data: obra } = obraId
      ? await supabase.from("obras").select("*").eq("id", obraId).maybeSingle()
      : { data: null };

    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();

    // Responsáveis técnicos + fiscais cadastrados (best-effort)
    const { data: responsaveis } = await supabase
      .from("responsaveis_tecnicos")
      .select("*")
      .eq("company_id", companyId);

    // Itens já salvos deste BM
    const { data: itensExistentes } = await supabase
      .from("medicao_itens")
      .select("*")
      .eq("medicao_id", data.id)
      .eq("company_id", companyId)
      .order("ordem", { ascending: true });

    // Snapshot congelado da última medição aprovada anterior (mesmo contrato)
    const { data: ultimaAprovada } = await supabase
      .from("medicoes")
      .select("id, numero, numero_bm, snapshot_itens")
      .eq("company_id", companyId)
      .eq("contrato_id", medicao.contrato_id)
      .eq("status", "aprovada")
      .lt("numero", medicao.numero)
      .order("numero", { ascending: false })
      .limit(1)
      .maybeSingle();

    const snapshotAnterior: Record<
      string,
      { qtd_acum: number; valor_acum: number }
    > = {};
    if (ultimaAprovada?.snapshot_itens && Array.isArray(ultimaAprovada.snapshot_itens)) {
      for (const it of ultimaAprovada.snapshot_itens as Array<{
        item_codigo: string;
        qtd_acum_atual?: number;
        valor_acum_atual?: number;
      }>) {
        snapshotAnterior[it.item_codigo] = {
          qtd_acum: Number(it.qtd_acum_atual ?? 0),
          valor_acum: Number(it.valor_acum_atual ?? 0),
        };
      }
    }

    // Itens base = atividades da obra (orçamento)
    let atividades: Array<{
      id: string;
      item_codigo: string;
      descricao: string;
      unidade: string | null;
      quantidade: number | null;
      valor: number | null;
      is_group: boolean;
      ordem: number | null;
    }> = [];
    if (obraId) {
      const { data: atRows } = await supabase
        .from("obra_atividades")
        .select("id, item_codigo, descricao, unidade, quantidade, valor, is_group, ordem")
        .eq("company_id", companyId)
        .eq("obra_id", obraId)
        .order("ordem", { ascending: true });
      atividades = atRows ?? [];
    }

    // Merge: se já existem itens salvos, prevalecem; senão gera a partir das atividades.
    const existingByCode = new Map<string, NonNullable<typeof itensExistentes>[number]>();
    for (const e of itensExistentes ?? []) existingByCode.set(e.item_codigo, e);

    const itens = atividades.map((a, idx) => {
      const codigo = a.item_codigo;
      const existing = existingByCode.get(codigo);
      const qtdContratada = Number(a.quantidade ?? 0);
      const valorTotal = Number(a.valor ?? 0);
      const valorUnitario = qtdContratada > 0 && valorTotal > 0
        ? Number((valorTotal / qtdContratada).toFixed(4))
        : Number(existing?.valor_unitario ?? 0);
      const snap = snapshotAnterior[codigo];
      const qtd_acum_anterior = existing
        ? Number(existing.qtd_acum_anterior)
        : Number(snap?.qtd_acum ?? 0);
      const valor_acum_anterior = existing
        ? Number(existing.valor_acum_anterior)
        : Number(snap?.valor_acum ?? 0);

      return {
        id: existing?.id ?? null,
        obra_atividade_id: a.id,
        item_codigo: codigo,
        descricao: sanitizeDescricao(a.descricao),
        unidade: a.unidade,
        is_etapa: a.is_group || qtdContratada === 0 || valorUnitario === 0,
        qtd_contratada: qtdContratada,
        valor_unitario: valorUnitario,
        qtd_acum_anterior,
        valor_acum_anterior,
        qtd_periodo: Number(existing?.qtd_periodo ?? 0),
        ordem: existing?.ordem ?? a.ordem ?? idx,
      };
    });

    // Itens salvos que não têm atividade correspondente (mantém histórico)
    for (const e of itensExistentes ?? []) {
      if (!atividades.some((a) => a.item_codigo === e.item_codigo)) {
        itens.push({
          id: e.id,
          obra_atividade_id: e.obra_atividade_id,
          item_codigo: e.item_codigo,
          descricao: sanitizeDescricao(e.descricao),
          unidade: e.unidade,
          is_etapa: e.is_etapa,
          qtd_contratada: Number(e.qtd_contratada),
          valor_unitario: Number(e.valor_unitario),
          qtd_acum_anterior: Number(e.qtd_acum_anterior),
          valor_acum_anterior: Number(e.valor_acum_anterior),
          qtd_periodo: Number(e.qtd_periodo),
          ordem: e.ordem,
        });
      }
    }

    itens.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

    const totais = computeTotais(itens);

    return {
      medicao,
      contrato,
      obra,
      company,
      responsaveis: responsaveis ?? [],
      itens,
      totais,
      ultimaAprovada: ultimaAprovada
        ? { id: ultimaAprovada.id, numero: ultimaAprovada.numero, numero_bm: ultimaAprovada.numero_bm }
        : null,
    };
  });

const salvarSchema = z.object({
  medicao_id: z.string().uuid(),
  numero_bm: z.string().min(1).max(20).optional(),
  data_medicao: z.string().optional(),
  periodo_inicio: z.string().optional(),
  periodo_fim: z.string().optional(),
  observacoes: z.string().max(2000).optional(),
  itens: z.array(
    z.object({
      obra_atividade_id: z.string().uuid().nullable().optional(),
      item_codigo: z.string(),
      descricao: z.string(),
      unidade: z.string().nullable().optional(),
      is_etapa: z.boolean(),
      qtd_contratada: z.number(),
      valor_unitario: z.number(),
      qtd_acum_anterior: z.number(),
      valor_acum_anterior: z.number(),
      qtd_periodo: z.number(),
      ordem: z.number().optional(),
    }),
  ),
});

export const salvarRascunhoMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => salvarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);

    const { data: medicao, error: mErr } = await supabase
      .from("medicoes")
      .select("id, status, contrato_id, numero")
      .eq("id", data.medicao_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!medicao) throw new Error("Medição não encontrada.");
    if (medicao.status === "aprovada" || medicao.status === "paga") {
      throw new Error("Medição já aprovada — não pode ser editada.");
    }

    // Validação por item
    const erros: string[] = [];
    for (const i of data.itens) {
      erros.push(...validateItem(i));
    }
    if (erros.length) throw new Error(erros.slice(0, 5).join(" • "));

    const totais = computeTotais(data.itens);

    // Update cabeçalho
    const updates: Record<string, unknown> = {
      valor_executado: totais.valor_medicao_atual,
      valor_acumulado: totais.valor_acumulado,
      percentual_fisico: Number((totais.percentual_executado * 100).toFixed(3)),
    };
    if (data.numero_bm) updates.numero_bm = data.numero_bm;
    if (data.data_medicao) updates.data_medicao = data.data_medicao;
    if (data.periodo_inicio) updates.periodo_inicio = data.periodo_inicio;
    if (data.periodo_fim) updates.periodo_fim = data.periodo_fim;
    if (data.observacoes !== undefined) updates.observacoes = data.observacoes;

    const { error: uErr } = await supabase
      .from("medicoes")
      .update(updates)
      .eq("id", data.medicao_id)
      .eq("company_id", companyId);
    if (uErr) throw new Error(uErr.message);

    // Upsert itens: apagar e reinserir (transação simples)
    await supabase.from("medicao_itens").delete().eq("medicao_id", data.medicao_id).eq("company_id", companyId);

    const rows = data.itens.map((i, idx) => {
      const c = computeItem(i);
      return {
        medicao_id: data.medicao_id,
        company_id: companyId,
        obra_atividade_id: i.obra_atividade_id ?? null,
        item_codigo: i.item_codigo,
        descricao: sanitizeDescricao(i.descricao),
        unidade: i.unidade ?? null,
        is_etapa: i.is_etapa,
        qtd_contratada: i.qtd_contratada,
        valor_unitario: i.valor_unitario,
        qtd_acum_anterior: i.qtd_acum_anterior,
        valor_acum_anterior: i.valor_acum_anterior,
        qtd_periodo: i.qtd_periodo,
        valor_periodo: c.valor_periodo,
        qtd_acum_atual: c.qtd_acum_atual,
        valor_acum_atual: c.valor_acum_atual,
        pct_executado: c.pct_executado,
        status_calc: c.status_calc,
        ordem: i.ordem ?? idx,
      };
    });
    if (rows.length) {
      const { error: iErr } = await supabase.from("medicao_itens").insert(rows);
      if (iErr) throw new Error(iErr.message);
    }
    return { ok: true, totais };
  });

export const aprovarMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);

    const { data: itens } = await supabase
      .from("medicao_itens")
      .select("item_codigo, qtd_acum_atual, valor_acum_atual, descricao, unidade")
      .eq("medicao_id", data.id)
      .eq("company_id", companyId);
    if (!itens || itens.length === 0) throw new Error("Não há itens para aprovar.");

    const snapshot = itens.map((it: {
      item_codigo: string;
      descricao: string;
      unidade: string | null;
      qtd_acum_atual: number | string;
      valor_acum_atual: number | string;
    }) => ({
      item_codigo: it.item_codigo,
      descricao: it.descricao,
      unidade: it.unidade,
      qtd_acum_atual: Number(it.qtd_acum_atual),
      valor_acum_atual: Number(it.valor_acum_atual),
    }));

    const { error } = await supabase
      .from("medicoes")
      .update({
        status: "aprovada",
        snapshot_itens: snapshot,
        aprovada_em: new Date().toISOString(),
        aprovada_por: context.userId,
      })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
