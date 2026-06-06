/**
 * Contratos & ciclo de vida — Fase 6.
 *
 * Gerencia contratos administrativos (lista, vínculo com obra/edital,
 * eventos de aditivo/prorrogação/etc.) usando as tabelas `contratos` e
 * `contrato_eventos`. Recalcula valor_atualizado a partir dos eventos.
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

export type ContratoStatus = "vigente" | "suspenso" | "encerrado" | "rescindido" | "em_elaboracao";
export type EventoTipo =
  | "atraso"
  | "suspensao"
  | "paralisacao"
  | "prorrogacao"
  | "aditivo_prazo"
  | "aditivo_valor"
  | "aditivo_qualitativo"
  | "reprogramacao"
  | "supressao"
  | "acrescimo"
  | "ordem_servico"
  | "apostilamento"
  | "notificacao"
  | "resposta_orgao"
  | "outro";

export interface ContratoRow {
  id: string;
  numero: string;
  obra_id: string | null;
  obra_nome: string | null;
  orgao_contratante: string | null;
  cnpj_orgao: string | null;
  processo_administrativo: string | null;
  modalidade: string | null;
  objeto: string | null;
  data_assinatura: string | null;
  data_inicio_vigencia: string | null;
  data_fim_vigencia: string | null;
  valor_original: number | null;
  valor_atualizado: number | null;
  status: ContratoStatus;
  origem: string;
  eventos_count: number;
  created_at: string;
  updated_at: string;
}

export interface EventoRow {
  id: string;
  contrato_id: string;
  tipo: EventoTipo;
  data_evento: string;
  data_fim: string | null;
  descricao: string;
  responsabilidade: string | null;
  impacto_prazo_dias: number | null;
  impacto_valor: number | null;
  documento_url: string | null;
  created_at: string;
}

export const listContratos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ContratoRow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const { data, error } = await supabase
      .from("contratos")
      .select(
        "id, numero, obra_id, orgao_contratante, cnpj_orgao, processo_administrativo, modalidade, objeto, data_assinatura, data_inicio_vigencia, data_fim_vigencia, valor_original, valor_atualizado, status, origem, created_at, updated_at, obras(nome)"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as Array<Record<string, unknown> & { obras?: { nome?: string } | null }>;
    const ids = rows.map((r) => r.id as string);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: ev } = await supabase
        .from("contrato_eventos")
        .select("contrato_id")
        .in("contrato_id", ids);
      for (const e of (ev ?? []) as Array<{ contrato_id: string }>) {
        counts.set(e.contrato_id, (counts.get(e.contrato_id) ?? 0) + 1);
      }
    }

    return rows.map((r) => ({
      id: r.id as string,
      numero: r.numero as string,
      obra_id: (r.obra_id as string) ?? null,
      obra_nome: r.obras?.nome ?? null,
      orgao_contratante: (r.orgao_contratante as string) ?? null,
      cnpj_orgao: (r.cnpj_orgao as string) ?? null,
      processo_administrativo: (r.processo_administrativo as string) ?? null,
      modalidade: (r.modalidade as string) ?? null,
      objeto: (r.objeto as string) ?? null,
      data_assinatura: (r.data_assinatura as string) ?? null,
      data_inicio_vigencia: (r.data_inicio_vigencia as string) ?? null,
      data_fim_vigencia: (r.data_fim_vigencia as string) ?? null,
      valor_original: r.valor_original == null ? null : Number(r.valor_original),
      valor_atualizado: r.valor_atualizado == null ? null : Number(r.valor_atualizado),
      status: r.status as ContratoStatus,
      origem: r.origem as string,
      eventos_count: counts.get(r.id as string) ?? 0,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
    }));
  });

const createContratoSchema = z.object({
  numero: z.string().min(1).max(120),
  obra_id: z.string().uuid().nullable().optional(),
  orgao_contratante: z.string().max(255).nullable().optional(),
  cnpj_orgao: z.string().max(20).nullable().optional(),
  processo_administrativo: z.string().max(120).nullable().optional(),
  modalidade: z.string().max(60).nullable().optional(),
  objeto: z.string().max(4000).nullable().optional(),
  data_assinatura: z.string().nullable().optional(),
  data_inicio_vigencia: z.string().nullable().optional(),
  data_fim_vigencia: z.string().nullable().optional(),
  valor_original: z.number().nullable().optional(),
  status: z
    .enum(["vigente", "suspenso", "encerrado", "rescindido", "em_elaboracao"])
    .default("vigente"),
});

export const createContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createContratoSchema.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const payload = {
      company_id: companyId,
      numero: data.numero,
      obra_id: data.obra_id ?? null,
      orgao_contratante: data.orgao_contratante ?? null,
      cnpj_orgao: data.cnpj_orgao ?? null,
      processo_administrativo: data.processo_administrativo ?? null,
      modalidade: data.modalidade ?? null,
      objeto: data.objeto ?? null,
      data_assinatura: data.data_assinatura ?? null,
      data_inicio_vigencia: data.data_inicio_vigencia ?? null,
      data_fim_vigencia: data.data_fim_vigencia ?? null,
      valor_original: data.valor_original ?? null,
      valor_atualizado: data.valor_original ?? null,
      status: data.status,
      origem: "manual",
      created_by: context.userId,
    };
    const { data: ins, error } = await supabase
      .from("contratos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

const updateContratoSchema = z.object({
  id: z.string().uuid(),
  status: z
    .enum(["vigente", "suspenso", "encerrado", "rescindido", "em_elaboracao"])
    .optional(),
  obra_id: z.string().uuid().nullable().optional(),
  data_fim_vigencia: z.string().nullable().optional(),
  objeto: z.string().max(4000).nullable().optional(),
  modalidade: z.string().max(60).nullable().optional(),
});

export const updateContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateContratoSchema.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.obra_id !== undefined) patch.obra_id = data.obra_id;
    if (data.data_fim_vigencia !== undefined) patch.data_fim_vigencia = data.data_fim_vigencia;
    if (data.objeto !== undefined) patch.objeto = data.objeto;
    if (data.modalidade !== undefined) patch.modalidade = data.modalidade;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("contratos")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("contratos")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEventos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ contrato_id: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data, context }): Promise<EventoRow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("contrato_eventos")
      .select(
        "id, contrato_id, tipo, data_evento, data_fim, descricao, responsabilidade, impacto_prazo_dias, impacto_valor, documento_url, created_at"
      )
      .eq("company_id", companyId)
      .eq("contrato_id", data.contrato_id)
      .order("data_evento", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      ...(r as unknown as EventoRow),
      impacto_valor: r.impacto_valor == null ? null : Number(r.impacto_valor),
    }));
  });

const eventoTipos = [
  "atraso",
  "suspensao",
  "paralisacao",
  "prorrogacao",
  "aditivo_prazo",
  "aditivo_valor",
  "aditivo_qualitativo",
  "reprogramacao",
  "supressao",
  "acrescimo",
  "ordem_servico",
  "apostilamento",
  "notificacao",
  "resposta_orgao",
  "outro",
] as const;

const createEventoSchema = z.object({
  contrato_id: z.string().uuid(),
  tipo: z.enum(eventoTipos),
  data_evento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  descricao: z.string().min(1).max(4000),
  responsabilidade: z.enum(["orgao", "contratada", "compartilhada", "indefinida"]).nullable().optional(),
  impacto_prazo_dias: z.number().int().nullable().optional(),
  impacto_valor: z.number().nullable().optional(),
  documento_url: z.string().url().nullable().optional(),
});

async function recomputeContrato(
  supabase: AnySupabase,
  companyId: string,
  contratoId: string
): Promise<void> {
  const { data: ct } = await supabase
    .from("contratos")
    .select("valor_original, data_fim_vigencia, data_inicio_vigencia")
    .eq("id", contratoId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!ct) return;
  const { data: evs } = await supabase
    .from("contrato_eventos")
    .select("impacto_valor, impacto_prazo_dias")
    .eq("contrato_id", contratoId)
    .eq("company_id", companyId);

  const somaValor = ((evs ?? []) as Array<{ impacto_valor: number | null }>).reduce(
    (acc, e) => acc + Number(e.impacto_valor ?? 0),
    0
  );
  const somaPrazo = ((evs ?? []) as Array<{ impacto_prazo_dias: number | null }>).reduce(
    (acc, e) => acc + Number(e.impacto_prazo_dias ?? 0),
    0
  );

  const novoValor =
    ct.valor_original == null ? null : Number(ct.valor_original) + somaValor;

  let novoFim: string | null = ct.data_fim_vigencia ?? null;
  const baseFim = ct.data_fim_vigencia ?? ct.data_inicio_vigencia;
  if (baseFim && somaPrazo !== 0) {
    const d = new Date(`${baseFim}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + somaPrazo);
    novoFim = d.toISOString().slice(0, 10);
  }

  await supabase
    .from("contratos")
    .update({ valor_atualizado: novoValor, data_fim_vigencia: novoFim })
    .eq("id", contratoId)
    .eq("company_id", companyId);
}

export const createEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createEventoSchema.parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: ct, error: ctErr } = await supabase
      .from("contratos")
      .select("id")
      .eq("id", data.contrato_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (ctErr) throw new Error(ctErr.message);
    if (!ct) throw new Error("Contrato não encontrado.");

    const { error } = await supabase.from("contrato_eventos").insert({
      company_id: companyId,
      contrato_id: data.contrato_id,
      tipo: data.tipo,
      data_evento: data.data_evento,
      data_fim: data.data_fim ?? null,
      descricao: data.descricao,
      responsabilidade: data.responsabilidade ?? null,
      impacto_prazo_dias: data.impacto_prazo_dias ?? null,
      impacto_valor: data.impacto_valor ?? null,
      documento_url: data.documento_url ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    await recomputeContrato(supabase, companyId, data.contrato_id);
    return { ok: true };
  });

export const deleteEvento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const { data: ev } = await supabase
      .from("contrato_eventos")
      .select("contrato_id")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    const { error } = await supabase
      .from("contrato_eventos")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    if (ev?.contrato_id) await recomputeContrato(supabase, companyId, ev.contrato_id);
    return { ok: true };
  });

export interface ObraOpcao {
  id: string;
  nome: string;
}

export const listObrasParaSelect = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ObraOpcao[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("obras")
      .select("id, nome")
      .eq("company_id", companyId)
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as ObraOpcao[];
  });

// ============================================================
// Fase 8 — Assinaturas eletrônicas vinculadas a contratos
// ============================================================

export interface ContratoSignatureRow {
  id: string;
  document_name: string;
  document_folder: string;
  status: string;
  signed_at: string | null;
  zapsign_document_token: string | null;
  sandbox: boolean;
  obra_id: string;
  created_at: string;
  signers_total: number;
  signers_signed: number;
}

export const listSignaturesByContrato = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ contrato_id: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data, context }): Promise<ContratoSignatureRow[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const { data: reqs, error } = await supabase
      .from("signature_requests")
      .select(
        "id, document_name, document_folder, status, signed_at, zapsign_document_token, sandbox, obra_id, created_at"
      )
      .eq("company_id", companyId)
      .eq("contrato_id", data.contrato_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = (reqs ?? []) as Array<Record<string, unknown>>;
    const ids = rows.map((r) => r.id as string);
    const totals = new Map<string, { total: number; signed: number }>();
    if (ids.length > 0) {
      const { data: signers } = await supabase
        .from("signature_signers")
        .select("signature_request_id, status")
        .in("signature_request_id", ids);
      for (const s of (signers ?? []) as Array<{ signature_request_id: string; status: string }>) {
        const cur = totals.get(s.signature_request_id) ?? { total: 0, signed: 0 };
        cur.total++;
        if (s.status === "signed") cur.signed++;
        totals.set(s.signature_request_id, cur);
      }
    }

    return rows.map((r) => {
      const t = totals.get(r.id as string) ?? { total: 0, signed: 0 };
      return {
        id: r.id as string,
        document_name: r.document_name as string,
        document_folder: r.document_folder as string,
        status: r.status as string,
        signed_at: (r.signed_at as string) ?? null,
        zapsign_document_token: (r.zapsign_document_token as string) ?? null,
        sandbox: Boolean(r.sandbox),
        obra_id: r.obra_id as string,
        created_at: r.created_at as string,
        signers_total: t.total,
        signers_signed: t.signed,
      };
    });
  });

export interface SignatureAvailable {
  id: string;
  document_name: string;
  status: string;
  created_at: string;
}

export const listSignaturesDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignatureAvailable[]> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("signature_requests")
      .select("id, document_name, status, created_at, contrato_id")
      .eq("company_id", companyId)
      .is("contrato_id", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id as string,
      document_name: r.document_name as string,
      status: r.status as string,
      created_at: r.created_at as string,
    }));
  });

export const linkSignatureToContrato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        signature_request_id: z.string().uuid(),
        contrato_id: z.string().uuid().nullable(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = context.supabase as any;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("signature_requests")
      .update({ contrato_id: data.contrato_id })
      .eq("id", data.signature_request_id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
