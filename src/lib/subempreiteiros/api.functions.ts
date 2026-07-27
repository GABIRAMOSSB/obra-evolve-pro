/**
 * Módulo Subempreiteiros — server functions (backend).
 * Todas as mutações passam por `requireSupabaseAuth` e RLS. Triggers no
 * banco cuidam de: cap de quantidade, bloqueio pós-assinatura e validações
 * de pagamento.
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
  if (!data?.company_id) throw new Error("Usuário sem empresa vinculada.");
  return data.company_id as string;
}

// ============================================================
// EMPRESAS
// ============================================================
export const listSubempreiteiros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("subempreiteiros")
      .select("*")
      .eq("company_id", companyId)
      .order("razao_social");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const empresaSchema = z.object({
  id: z.string().uuid().optional(),
  razao_social: z.string().min(2).max(255),
  nome_fantasia: z.string().max(255).nullable().optional(),
  cnpj: z.string().max(20).nullable().optional(),
  responsavel: z.string().max(255).nullable().optional(),
  telefone: z.string().max(40).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  endereco: z.string().max(500).nullable().optional(),
  cidade: z.string().max(120).nullable().optional(),
  uf: z.string().max(2).nullable().optional(),
  cep: z.string().max(20).nullable().optional(),
  banco: z.string().max(120).nullable().optional(),
  agencia: z.string().max(20).nullable().optional(),
  conta: z.string().max(40).nullable().optional(),
  pix: z.string().max(200).nullable().optional(),
  observacoes: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const saveSubempreiteiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => empresaSchema.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const payload = {
      ...data,
      email: data.email === "" ? null : data.email,
      company_id: companyId,
      created_by: context.userId,
    };
    if (data.id) {
      const { id, ...patch } = payload;
      const { error } = await context.supabase
        .from("subempreiteiros").update(patch).eq("id", id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("subempreiteiros").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteSubempreiteiro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("subempreiteiros").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// CONTRATOS
// ============================================================
export const listSubContratos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { obraId?: string } | undefined) =>
    z.object({ obraId: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    let q = context.supabase
      .from("sub_contratos")
      .select("*, obra:obras(id,nome,codigo), sub:subempreiteiros(id,razao_social,cnpj)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (data.obraId) q = q.eq("obra_id", data.obraId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const contratoSchema = z.object({
  id: z.string().uuid().optional(),
  numero: z.string().min(1).max(120),
  obra_id: z.string().uuid(),
  subempreiteiro_id: z.string().uuid(),
  data_inicio: z.string().nullable().optional(),
  data_fim: z.string().nullable().optional(),
  valor_maximo: z.number().min(0),
  objeto: z.string().nullable().optional(),
  responsavel: z.string().nullable().optional(),
  status: z.enum(["em_andamento", "suspenso", "finalizado", "cancelado"]).optional(),
  pdf_storage_path: z.string().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const saveSubContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => contratoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const payload = { ...data, company_id: companyId, created_by: context.userId };
    if (data.id) {
      const { id, ...patch } = payload;
      const { error } = await context.supabase
        .from("sub_contratos").update(patch).eq("id", id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("sub_contratos").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteSubContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sub_contratos").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSubContratoDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { data: contrato, error } = await context.supabase
      .from("sub_contratos")
      .select("*, obra:obras(id,nome,codigo,cliente), sub:subempreiteiros(*)")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!contrato) throw new Error("Contrato não encontrado.");
    const { data: servicos } = await context.supabase
      .from("sub_contrato_servicos").select("*").eq("contrato_id", data.id).order("ordem");
    const { data: medicoes } = await context.supabase
      .from("sub_medicoes").select("*").eq("contrato_id", data.id).order("numero", { ascending: false });
    return { contrato, servicos: servicos ?? [], medicoes: medicoes ?? [] };
  });

// ============================================================
// SERVIÇOS
// ============================================================
const servicoSchema = z.object({
  id: z.string().uuid().optional(),
  contrato_id: z.string().uuid(),
  codigo: z.string().nullable().optional(),
  descricao: z.string().min(1),
  unidade: z.string().nullable().optional(),
  qtd_contratada: z.number().min(0),
  preco_unitario: z.number().min(0),
  preco_venda_cliente: z.number().nullable().optional(),
  ordem: z.number().int().optional(),
});

export const saveSubServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => servicoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const payload = { ...data, company_id: companyId };
    if (data.id) {
      const { id, ...patch } = payload;
      const { error } = await context.supabase
        .from("sub_contrato_servicos").update(patch).eq("id", id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("sub_contrato_servicos").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteSubServico = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sub_contrato_servicos").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Importa serviços do orçamento vigente da obra
export const importarServicosDoOrcamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contrato_id: string }) => z.object({ contrato_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { data: contrato } = await context.supabase
      .from("sub_contratos").select("obra_id").eq("id", data.contrato_id).eq("company_id", companyId).single();
    if (!contrato) throw new Error("Contrato não encontrado.");
    // Pega versão vigente
    const { data: versao } = await context.supabase
      .from("orcamento_versoes").select("id").eq("obra_id", contrato.obra_id)
      .eq("company_id", companyId).eq("vigente", true).maybeSingle();
    if (!versao) throw new Error("Obra não possui orçamento vigente.");
    const { data: itens } = await context.supabase
      .from("orcamento_itens").select("id,codigo,descricao,unidade,quantidade,preco_unitario")
      .eq("versao_id", versao.id).order("ordem", { ascending: true });
    if (!itens || itens.length === 0) throw new Error("Orçamento vazio.");
    const payload = itens.map((it: { id: string; codigo: string | null; descricao: string; unidade: string | null; quantidade: number | string; preco_unitario: number | string }, idx: number) => ({
      company_id: companyId,
      contrato_id: data.contrato_id,
      origem_orcamento_item_id: it.id,
      codigo: it.codigo,
      descricao: it.descricao,
      unidade: it.unidade,
      qtd_contratada: Number(it.quantidade ?? 0),
      preco_unitario: 0,
      preco_venda_cliente: Number(it.preco_unitario ?? 0),
      ordem: idx,
    }));
    const { error } = await context.supabase.from("sub_contrato_servicos").insert(payload);
    if (error) throw new Error(error.message);
    return { imported: payload.length };
  });

// ============================================================
// MEDIÇÕES
// ============================================================
export const listSubMedicoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("sub_medicoes")
      .select("*, contrato:sub_contratos(id,numero,obra:obras(nome), sub:subempreiteiros(razao_social))")
      .eq("company_id", companyId)
      .order("data_medicao", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSubMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { contrato_id: string; competencia?: string; data_medicao?: string }) =>
    z.object({
      contrato_id: z.string().uuid(),
      competencia: z.string().optional(),
      data_medicao: z.string().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    // Próximo número
    const { data: last } = await context.supabase
      .from("sub_medicoes").select("numero")
      .eq("contrato_id", data.contrato_id).order("numero", { ascending: false }).limit(1).maybeSingle();
    const numero = (last?.numero ?? 0) + 1;

    const { data: med, error } = await context.supabase
      .from("sub_medicoes").insert({
        company_id: companyId,
        contrato_id: data.contrato_id,
        numero,
        competencia: data.competencia ?? null,
        data_medicao: data.data_medicao ?? new Date().toISOString().slice(0, 10),
        status: "rascunho",
        created_by: context.userId,
      }).select("id").single();
    if (error) throw new Error(error.message);

    // Cria itens em branco a partir dos serviços do contrato
    const { data: servicos } = await context.supabase
      .from("sub_contrato_servicos").select("id,preco_unitario,qtd_executada,ordem")
      .eq("contrato_id", data.contrato_id).order("ordem");
    if (servicos && servicos.length) {
      const itens = servicos.map((s: { id: string; preco_unitario: number | string; qtd_executada: number | string; ordem: number }) => ({
        company_id: companyId,
        medicao_id: med.id,
        servico_id: s.id,
        qtd_anterior: Number(s.qtd_executada ?? 0),
        qtd_periodo: 0,
        preco_unitario: Number(s.preco_unitario ?? 0),
        valor: 0,
        ordem: s.ordem,
      }));
      const { error: eIt } = await context.supabase.from("sub_medicao_itens").insert(itens);
      if (eIt) throw new Error(eIt.message);
    }
    return { id: med.id, numero };
  });

export const getSubMedicaoDetalhe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { data: med, error } = await context.supabase
      .from("sub_medicoes")
      .select("*, contrato:sub_contratos(*, obra:obras(id,nome,codigo,cliente,cnpj_cliente,endereco,cidade,uf), sub:subempreiteiros(*))")
      .eq("id", data.id).eq("company_id", companyId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!med) throw new Error("Medição não encontrada.");
    const { data: itens } = await context.supabase
      .from("sub_medicao_itens")
      .select("*, servico:sub_contrato_servicos(id,codigo,descricao,unidade,qtd_contratada)")
      .eq("medicao_id", data.id).order("ordem");
    const { data: pagamentos } = await context.supabase
      .from("sub_pagamentos").select("*").eq("medicao_id", data.id).order("data_pagamento");
    return { medicao: med, itens: itens ?? [], pagamentos: pagamentos ?? [] };
  });

export const updateSubMedicaoItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; qtd_periodo: number; preco_unitario?: number }) =>
    z.object({
      id: z.string().uuid(),
      qtd_periodo: z.number().min(0),
      preco_unitario: z.number().min(0).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const patch: Record<string, unknown> = { qtd_periodo: data.qtd_periodo };
    if (data.preco_unitario !== undefined) patch.preco_unitario = data.preco_unitario;
    const { error } = await context.supabase
      .from("sub_medicao_itens").update(patch).eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recalcSubMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; ret_inss?: number; ret_iss?: number; ret_irrf?: number; ret_outras?: number; observacoes?: string; responsavel_conferencia?: string }) =>
    z.object({
      id: z.string().uuid(),
      ret_inss: z.number().min(0).optional(),
      ret_iss: z.number().min(0).optional(),
      ret_irrf: z.number().min(0).optional(),
      ret_outras: z.number().min(0).optional(),
      observacoes: z.string().nullable().optional(),
      responsavel_conferencia: z.string().nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    // Soma itens
    const { data: itens } = await context.supabase
      .from("sub_medicao_itens").select("valor").eq("medicao_id", data.id).eq("company_id", companyId);
    const bruto = (itens ?? []).reduce((s: number, r: { valor: number | string }) => s + Number(r.valor ?? 0), 0);
    const inss = data.ret_inss ?? 0;
    const iss = data.ret_iss ?? 0;
    const irrf = data.ret_irrf ?? 0;
    const outras = data.ret_outras ?? 0;
    const liquido = Math.max(0, Number((bruto - inss - iss - irrf - outras).toFixed(2)));
    const { error } = await context.supabase.from("sub_medicoes").update({
      valor_bruto: Number(bruto.toFixed(2)),
      valor_liquido: liquido,
      ret_inss: inss, ret_iss: iss, ret_irrf: irrf, ret_outras: outras,
      observacoes: data.observacoes ?? null,
      responsavel_conferencia: data.responsavel_conferencia ?? null,
    }).eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { valor_bruto: bruto, valor_liquido: liquido };
  });

export const setSubMedicaoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "rascunho" | "em_conferencia" | "aguardando_assinatura" | "liberada_pagamento" }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["rascunho", "em_conferencia", "aguardando_assinatura", "liberada_pagamento"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sub_medicoes").update({ status: data.status })
      .eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signSubMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; assinatura_base64: string; assinatura_nome: string }) =>
    z.object({
      id: z.string().uuid(),
      assinatura_base64: z.string().min(50),
      assinatura_nome: z.string().min(2).max(255),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const now = new Date().toISOString();
    const { error } = await context.supabase.from("sub_medicoes").update({
      status: "assinada",
      assinatura_base64: data.assinatura_base64,
      assinatura_nome: data.assinatura_nome,
      signed_at: now,
      signed_by: context.userId,
      locked_at: now,
    }).eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSubMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sub_medicoes").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// PAGAMENTOS
// ============================================================
const pagamentoSchema = z.object({
  id: z.string().uuid().optional(),
  medicao_id: z.string().uuid(),
  data_pagamento: z.string(),
  forma: z.enum(["pix", "ted", "doc", "transferencia", "cheque", "dinheiro"]),
  conta_bancaria: z.string().nullable().optional(),
  numero_comprovante: z.string().nullable().optional(),
  comprovante_storage_path: z.string().nullable().optional(),
  valor_pago: z.number().positive(),
  observacoes: z.string().nullable().optional(),
});

export const saveSubPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pagamentoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const payload = { ...data, company_id: companyId, created_by: context.userId };
    if (data.id) {
      const { id, ...patch } = payload;
      const { error } = await context.supabase
        .from("sub_pagamentos").update(patch).eq("id", id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: ins, error } = await context.supabase
      .from("sub_pagamentos").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteSubPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sub_pagamentos").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSubPagamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("sub_pagamentos")
      .select("*, medicao:sub_medicoes(id,numero,valor_liquido,contrato:sub_contratos(numero,obra:obras(nome),sub:subempreiteiros(razao_social)))")
      .eq("company_id", companyId)
      .order("data_pagamento", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============================================================
// DASHBOARD / LUCRO
// ============================================================
export const getSubDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const [ctRes, svcRes, medRes, pgRes] = await Promise.all([
      context.supabase.from("sub_contratos").select("id,valor_maximo,status,obra_id").eq("company_id", companyId),
      context.supabase.from("sub_contrato_servicos").select("qtd_contratada,qtd_executada,preco_unitario,preco_venda_cliente,contrato_id").eq("company_id", companyId),
      context.supabase.from("sub_medicoes").select("valor_bruto,valor_liquido,status,contrato_id").eq("company_id", companyId),
      context.supabase.from("sub_pagamentos").select("valor_pago,medicao_id").eq("company_id", companyId),
    ]);
    const contratos = ctRes.data ?? [];
    const svcs = svcRes.data ?? [];
    const meds = medRes.data ?? [];
    const pgs = pgRes.data ?? [];

    const total_contratado = contratos.reduce((s, r) => s + Number(r.valor_maximo ?? 0), 0);
    const total_medido = meds.reduce((s, r) => s + Number(r.valor_bruto ?? 0), 0);
    const total_aprovado = meds
      .filter((m) => ["assinada", "liberada_pagamento", "paga"].includes(m.status))
      .reduce((s, r) => s + Number(r.valor_liquido ?? 0), 0);
    const total_pago = pgs.reduce((s, r) => s + Number(r.valor_pago ?? 0), 0);

    // Lucro: soma (qtd_executada * (preco_venda - preco_unit))
    let receita = 0;
    let custo = 0;
    for (const s of svcs) {
      const qtd = Number(s.qtd_executada ?? 0);
      const venda = Number(s.preco_venda_cliente ?? 0);
      const cst = Number(s.preco_unitario ?? 0);
      receita += qtd * venda;
      custo += qtd * cst;
    }
    const lucro = receita - custo;
    const margem = receita > 0 ? (lucro / receita) * 100 : 0;

    return {
      total_contratado, total_medido, total_aprovado, total_pago,
      saldo_contratual: total_contratado - total_aprovado,
      saldo_a_pagar: total_aprovado - total_pago,
      contratos_count: contratos.length,
      medicoes_count: meds.length,
      receita, custo, lucro, margem,
    };
  });
