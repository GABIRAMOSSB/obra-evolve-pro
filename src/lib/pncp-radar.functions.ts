/**
 * Fase 3 — Radar PNCP (server functions chamadas pela UI).
 *
 * CRUD da configuração do Radar, dos filtros salvos, listagem de histórico
 * de coletas e alertas, e gatilho manual "Coletar agora".
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

async function requireRole(
  supabase: AnySupabase,
  userId: string,
  roles: Array<"admin" | "editor" | "member">,
): Promise<string> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  if (!roles.includes(data.role as "admin" | "editor" | "member")) {
    throw new Error("Permissão insuficiente.");
  }
  return data.company_id as string;
}

/* ----------------------- CONFIGURAÇÃO ----------------------- */

export interface PncpConfig {
  id: string | null;
  status: string;
  frequencia_coleta_horas: number;
  ultima_coleta: string | null;
  proxima_coleta: string | null;
  filtro_estado: string | null;
  filtro_modalidade: string | null;
  alertar_via_email: boolean;
  alertar_via_whatsapp: boolean;
  emails_alerta: string | null;
  criar_proposta_automatico: boolean;
  observacoes: string | null;
}

export const getPncpConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PncpConfig> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("pncp_configuracoes")
      .select(
        "id, status, frequencia_coleta_horas, ultima_coleta, proxima_coleta, filtro_estado, filtro_modalidade, alertar_via_email, alertar_via_whatsapp, emails_alerta, criar_proposta_automatico, observacoes",
      )
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      return {
        id: null,
        status: "nao_configurado",
        frequencia_coleta_horas: 6,
        ultima_coleta: null,
        proxima_coleta: null,
        filtro_estado: "todos",
        filtro_modalidade: null,
        alertar_via_email: true,
        alertar_via_whatsapp: false,
        emails_alerta: null,
        criar_proposta_automatico: false,
        observacoes: null,
      };
    }
    return data as PncpConfig;
  });

const upsertConfigSchema = z.object({
  frequencia_coleta_horas: z.number().int().min(1).max(168),
  filtro_estado: z.string().max(20).nullable().optional(),
  filtro_modalidade: z.string().max(20).nullable().optional(),
  alertar_via_email: z.boolean(),
  alertar_via_whatsapp: z.boolean(),
  emails_alerta: z.string().max(1000).nullable().optional(),
  observacoes: z.string().max(2000).nullable().optional(),
  ativar: z.boolean().optional(),
});

export const upsertPncpConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => upsertConfigSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireRole(supabase, context.userId, ["admin"]);

    const proxima = new Date(Date.now() + data.frequencia_coleta_horas * 3600 * 1000).toISOString();
    const payload = {
      company_id: companyId,
      frequencia_coleta_horas: data.frequencia_coleta_horas,
      filtro_estado: data.filtro_estado ?? "todos",
      filtro_modalidade: data.filtro_modalidade ?? null,
      alertar_via_email: data.alertar_via_email,
      alertar_via_whatsapp: data.alertar_via_whatsapp,
      emails_alerta: data.emails_alerta ?? null,
      observacoes: data.observacoes ?? null,
      status: data.ativar ? "ativo" : "configurado",
      proxima_coleta: proxima,
    };
    const { error } = await supabase
      .from("pncp_configuracoes")
      .upsert(payload, { onConflict: "company_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------- FILTROS SALVOS ----------------------- */

export interface PncpFiltro {
  id: string;
  nome: string;
  palavras_chave: string[];
  ufs: string[];
  modalidades: string[];
  valor_min: number | null;
  valor_max: number | null;
  ativo: boolean;
}

export const listPncpFiltros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PncpFiltro[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("oportunidade_filtros")
      .select("id, nome, palavras_chave, ufs, modalidades, valor_min, valor_max, ativo")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PncpFiltro[];
  });

const filtroSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  nome: z.string().min(1).max(120),
  palavras_chave: z.array(z.string().min(1).max(60)).max(20).default([]),
  ufs: z.array(z.string().length(2)).max(27).default([]),
  modalidades: z.array(z.string().max(4)).max(12).default([]),
  valor_min: z.number().nullable().optional(),
  valor_max: z.number().nullable().optional(),
  ativo: z.boolean().default(true),
});

export const upsertPncpFiltro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => filtroSchema.parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireRole(supabase, context.userId, ["admin", "editor"]);
    const payload = {
      company_id: companyId,
      nome: data.nome,
      palavras_chave: data.palavras_chave,
      ufs: data.ufs,
      modalidades: data.modalidades,
      valor_min: data.valor_min ?? null,
      valor_max: data.valor_max ?? null,
      ativo: data.ativo,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("oportunidade_filtros")
        .update(payload)
        .eq("id", data.id)
        .eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await supabase
      .from("oportunidade_filtros")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string };
  });

export const deletePncpFiltro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireRole(supabase, context.userId, ["admin", "editor"]);
    const { error } = await supabase
      .from("oportunidade_filtros")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------- HISTÓRICO ----------------------- */

export interface ColetaHistorico {
  id: string;
  data_coleta: string;
  total_encontrados: number;
  total_novos: number;
  total_atualizados: number;
  novos_alertas: number;
  status: string;
  mensagem_erro: string | null;
  tempo_execucao_ms: number | null;
}

export const listColetaHistorico = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ColetaHistorico[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("pncp_coleta_historico")
      .select(
        "id, data_coleta, total_encontrados, total_novos, total_atualizados, novos_alertas, status, mensagem_erro, tempo_execucao_ms",
      )
      .eq("company_id", companyId)
      .order("data_coleta", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    return (data ?? []) as ColetaHistorico[];
  });

/* ----------------------- ALERTAS ----------------------- */

export interface OpAlerta {
  id: string;
  oportunidade_id: string | null;
  tipo: string;
  titulo: string;
  descricao: string | null;
  urgencia: string;
  status: string;
  created_at: string;
  lido_em: string | null;
}

export const listOportunidadeAlertas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OpAlerta[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data, error } = await supabase
      .from("oportunidade_alertas")
      .select("id, oportunidade_id, tipo, titulo, descricao, urgencia, status, created_at, lido_em")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as OpAlerta[];
  });

export const markAlertaLido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { error } = await supabase
      .from("oportunidade_alertas")
      .update({ status: "resolvido", lido_em: new Date().toISOString() })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------- COLETAR AGORA ----------------------- */

export const coletarAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireRole(supabase, context.userId, ["admin", "editor"]);

    const { data: config } = await supabase
      .from("pncp_configuracoes")
      .select(
        "id, company_id, frequencia_coleta_horas, filtro_estado, filtro_modalidade, status",
      )
      .eq("company_id", companyId)
      .maybeSingle();

    const { runCollection } = await import("./pncp-radar.server");
    const result = await runCollection({
      client: supabase,
      companyId,
      config: config ?? null,
    });
    if (!result.ok) throw new Error(result.erro ?? "Falha na coleta");
    return result;
  });
