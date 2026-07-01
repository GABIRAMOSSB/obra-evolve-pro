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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingByCode = new Map<string, any>();
    for (const e of (itensExistentes ?? []) as any[]) existingByCode.set(e.item_codigo, e);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (itensExistentes ?? []) as any[]) {
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

async function logAudit(
  supabase: AnySupabase,
  companyId: string,
  medicaoId: string,
  acao: "create" | "update" | "delete" | "approve" | "reject" | "snapshot" | "import",
  atorId: string,
  extra?: { campo?: string; valor_anterior?: unknown; valor_novo?: unknown; justificativa?: string },
) {
  try {
    await supabase.from("boletim_audit_logs").insert({
      company_id: companyId,
      medicao_id: medicaoId,
      entidade: "medicao",
      entidade_id: medicaoId,
      acao,
      campo: extra?.campo ?? null,
      valor_anterior: extra?.valor_anterior ?? null,
      valor_novo: extra?.valor_novo ?? null,
      justificativa: extra?.justificativa ?? null,
      ator_id: atorId,
    });
  } catch {
    /* trilha nunca bloqueia workflow */
  }
}

export const enviarMedicaoParaConferencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);
    const { data: med } = await supabase
      .from("medicoes")
      .select("id, status")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!med) throw new Error("Medição não encontrada.");
    if (!["rascunho", "revisao_solicitada", "enviada"].includes(med.status)) {
      throw new Error(`Não é possível enviar para conferência a partir do status "${med.status}".`);
    }
    const { error } = await supabase
      .from("medicoes")
      .update({ status: "em_conferencia", enviada_em: new Date().toISOString(), enviada_por: context.userId })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    await logAudit(supabase, companyId, data.id, "update", context.userId, {
      campo: "status", valor_anterior: med.status, valor_novo: "em_conferencia",
    });
    return { ok: true };
  });

export const aprovarMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      papel: z.enum(["responsavel_tecnico", "fiscal", "gerente", "aprovador", "contratante"]).default("aprovador"),
      observacao: z.string().max(2000).optional(),
    }).parse(data),
  )
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
      item_codigo: string; descricao: string; unidade: string | null;
      qtd_acum_atual: number | string; valor_acum_atual: number | string;
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

    await supabase.from("boletim_aprovacoes").insert({
      company_id: companyId,
      medicao_id: data.id,
      aprovador_id: context.userId,
      papel: data.papel,
      decisao: "aprovada",
      justificativa: data.observacao ?? null,
    });
    await logAudit(supabase, companyId, data.id, "approve", context.userId, { justificativa: data.observacao });
    return { ok: true };
  });

export const rejeitarMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      motivo: z.string().min(10, "Motivo deve ter ao menos 10 caracteres.").max(2000),
      papel: z.enum(["responsavel_tecnico", "fiscal", "gerente", "aprovador", "contratante"]).default("aprovador"),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);
    const { data: med } = await supabase
      .from("medicoes").select("id, status").eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!med) throw new Error("Medição não encontrada.");
    if (med.status === "aprovada" || med.status === "paga") throw new Error("Medição já aprovada.");
    const { error } = await supabase.from("medicoes").update({
      status: "rejeitada",
      rejeitada_em: new Date().toISOString(),
      rejeitada_por: context.userId,
      motivo_rejeicao: data.motivo,
    }).eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    await supabase.from("boletim_aprovacoes").insert({
      company_id: companyId, medicao_id: data.id, aprovador_id: context.userId,
      papel: data.papel, decisao: "reprovada", justificativa: data.motivo,
    });
    await logAudit(supabase, companyId, data.id, "reject", context.userId, { justificativa: data.motivo });
    return { ok: true };
  });

export const solicitarRevisaoMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      observacao: z.string().min(10).max(2000),
      papel: z.enum(["responsavel_tecnico", "fiscal", "gerente", "aprovador", "contratante"]).default("aprovador"),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);
    const { data: med } = await supabase
      .from("medicoes").select("id, status").eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!med) throw new Error("Medição não encontrada.");
    if (med.status === "aprovada" || med.status === "paga") throw new Error("Medição já aprovada.");
    const { error } = await supabase.from("medicoes")
      .update({ status: "revisao_solicitada" })
      .eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    await supabase.from("boletim_aprovacoes").insert({
      company_id: companyId, medicao_id: data.id, aprovador_id: context.userId,
      papel: data.papel, decisao: "solicita_revisao", justificativa: data.observacao,
    });
    await logAudit(supabase, companyId, data.id, "update", context.userId, {
      campo: "status", valor_anterior: med.status, valor_novo: "revisao_solicitada", justificativa: data.observacao,
    });
    return { ok: true };
  });

export const getBoletimHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId);
    const [apr, logs] = await Promise.all([
      supabase.from("boletim_aprovacoes")
        .select("id, aprovador_id, aprovador_nome, papel, decisao, justificativa, decidido_em")
        .eq("company_id", companyId).eq("medicao_id", data.id)
        .order("decidido_em", { ascending: false }),
      supabase.from("boletim_audit_logs")
        .select("id, acao, campo, valor_anterior, valor_novo, justificativa, ator_id, ator_nome, created_at")
        .eq("company_id", companyId).eq("medicao_id", data.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return { aprovacoes: apr.data ?? [], logs: logs.data ?? [] };
  });


/**
 * Visão Executiva — histórico do contrato para montar Curva S,
 * projeção de encerramento e ranking de ofensores.
 */
export const getVisaoExecutivaMedicao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId);

    const { data: medicao } = await supabase
      .from("medicoes")
      .select("id, contrato_id, numero, numero_bm, data_medicao, periodo_inicio, periodo_fim, valor_acumulado, valor_executado, status")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!medicao) throw new Error("Medição não encontrada.");

    const { data: historico } = await supabase
      .from("medicoes")
      .select("id, numero, numero_bm, data_medicao, periodo_fim, valor_acumulado, valor_executado, percentual_fisico, status")
      .eq("company_id", companyId)
      .eq("contrato_id", medicao.contrato_id)
      .order("numero", { ascending: true });

    const { data: contrato } = await supabase
      .from("contratos")
      .select("valor_total, prazo_execucao_dias, data_inicio")
      .eq("id", medicao.contrato_id)
      .maybeSingle();

    return {
      medicao,
      contrato,
      historico: historico ?? [],
    };
  });

// ============================================================================
// FASE G — ANEXOS DO BOLETIM (fotos, memórias de cálculo, ARTs)
// ============================================================================

const CATEGORIAS_ANEXO = [
  "foto",
  "memoria_calculo",
  "art",
  "planilha",
  "documento",
  "outro",
] as const;

export const listarAnexosMedicao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ medicao_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("boletim_anexos")
      .select("id, nome, descricao, categoria, mime_type, tamanho_bytes, storage_path, created_at, created_by")
      .eq("company_id", companyId)
      .eq("medicao_id", data.medicao_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const registrarAnexoMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      medicao_id: z.string().uuid(),
      storage_path: z.string().min(3),
      nome: z.string().min(1).max(240),
      descricao: z.string().max(1000).optional(),
      categoria: z.enum(CATEGORIAS_ANEXO).default("documento"),
      mime_type: z.string().max(160).optional(),
      tamanho_bytes: z.number().int().nonnegative().optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);
    // valida caminho: {company_id}/{medicao_id}/...
    const prefix = `${companyId}/${data.medicao_id}/`;
    if (!data.storage_path.startsWith(prefix)) {
      throw new Error("Caminho de armazenamento inválido para esta medição.");
    }
    const { data: med } = await supabase
      .from("medicoes").select("id, status").eq("id", data.medicao_id).eq("company_id", companyId).maybeSingle();
    if (!med) throw new Error("Medição não encontrada.");
    if (med.status === "aprovada" || med.status === "paga") {
      throw new Error("Medição já aprovada — não é possível anexar novos arquivos.");
    }
    const { data: row, error } = await supabase.from("boletim_anexos").insert({
      company_id: companyId,
      medicao_id: data.medicao_id,
      storage_path: data.storage_path,
      nome: data.nome,
      descricao: data.descricao ?? null,
      categoria: data.categoria,
      mime_type: data.mime_type ?? null,
      tamanho_bytes: data.tamanho_bytes ?? null,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    try {
      await supabase.from("boletim_audit_logs").insert({
        company_id: companyId, medicao_id: data.medicao_id,
        entidade: "anexo", entidade_id: row.id, acao: "create",
        campo: "anexo", valor_novo: data.nome, ator_id: context.userId,
      });
    } catch { /* trilha nunca bloqueia */ }
    return { ok: true, id: row.id };
  });

export const removerAnexoMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);
    const { data: anexo } = await supabase
      .from("boletim_anexos")
      .select("id, medicao_id, storage_path, nome")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!anexo) throw new Error("Anexo não encontrado.");
    const { data: med } = await supabase
      .from("medicoes").select("status").eq("id", anexo.medicao_id).eq("company_id", companyId).maybeSingle();
    if (med && (med.status === "aprovada" || med.status === "paga")) {
      throw new Error("Medição já aprovada — anexos não podem ser removidos.");
    }
    // remove do storage e do banco
    await supabase.storage.from("boletim-anexos").remove([anexo.storage_path]);
    const { error } = await supabase.from("boletim_anexos").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    try {
      await supabase.from("boletim_audit_logs").insert({
        company_id: companyId, medicao_id: anexo.medicao_id,
        entidade: "anexo", entidade_id: data.id, acao: "delete",
        campo: "anexo", valor_anterior: anexo.nome, ator_id: context.userId,
      });
    } catch { /* trilha */ }
    return { ok: true };
  });

export const getUrlAnexoMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId);
    const { data: anexo } = await supabase
      .from("boletim_anexos")
      .select("storage_path, nome")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (!anexo) throw new Error("Anexo não encontrado.");
    const { data: signed, error } = await supabase.storage
      .from("boletim-anexos")
      .createSignedUrl(anexo.storage_path, 60 * 10); // 10 min
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl, nome: anexo.nome };
  });

