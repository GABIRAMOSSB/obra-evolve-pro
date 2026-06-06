/**
 * Fase 3 — Radar PNCP.
 *
 * O PNCP (Portal Nacional de Contratações Públicas) expõe uma API pública,
 * SEM credencial, em https://pncp.gov.br/api/consulta/v1/.
 * Este módulo apenas LÊ — o envio de proposta continua manual nos portais
 * específicos (Comprasnet/BLL/BNC etc.), conforme decisão Q4.
 *
 * Server functions:
 *   - searchPncp(filters)         → busca no PNCP (passthrough autenticado)
 *   - importOportunidade(item)    → grava como `oportunidades` (idempotente por pncp_id)
 *   - listOportunidades(filters)  → lista do pipeline interno
 *   - updateOportunidadeSituacao  → muda etapa (gera evento via trigger)
 *   - updateOportunidade          → edita campos básicos
 *   - listPipelineEventos(opId)   → histórico
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1";

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

/* ----------------------------- PNCP SEARCH ----------------------------- */

// Modalidades PNCP (id da tabela oficial)
export const MODALIDADES_PNCP: Array<{ id: number; nome: string }> = [
  { id: 1, nome: "Leilão (eletrônico)" },
  { id: 2, nome: "Diálogo Competitivo" },
  { id: 3, nome: "Concurso" },
  { id: 4, nome: "Concorrência (eletrônica)" },
  { id: 5, nome: "Concorrência (presencial)" },
  { id: 6, nome: "Pregão (eletrônico)" },
  { id: 7, nome: "Pregão (presencial)" },
  { id: 8, nome: "Dispensa" },
  { id: 9, nome: "Inexigibilidade" },
  { id: 10, nome: "Manifestação de Interesse" },
  { id: 11, nome: "Pré-qualificação" },
  { id: 12, nome: "Credenciamento" },
];

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

const searchSchema = z.object({
  // janela de propostas em aberto
  dataInicial: z.string().regex(/^\d{8}$/).optional(),      // yyyyMMdd
  dataFinal: z.string().regex(/^\d{8}$/),                    // yyyyMMdd (obrigatório PNCP)
  codigoModalidadeContratacao: z.number().int().min(1).max(12),
  uf: z.enum(UFS).optional(),
  codigoMunicipioIbge: z.string().optional(),
  cnpj: z.string().optional(),
  pagina: z.number().int().min(1).default(1),
  tamanhoPagina: z.number().int().min(10).max(50).default(50),
  palavraChave: z.string().max(120).optional(),
});

export interface PncpItem {
  numeroControlePNCP: string;
  numeroCompra: string | null;
  anoCompra: number | null;
  modalidadeNome: string | null;
  modoDisputaNome: string | null;
  objetoCompra: string | null;
  valorTotalEstimado: number | null;
  dataPublicacaoPncp: string | null;
  dataAberturaProposta: string | null;
  dataEncerramentoProposta: string | null;
  orgaoEntidade: {
    cnpj: string | null;
    razaoSocial: string | null;
  };
  unidadeOrgao: {
    nomeUnidade: string | null;
    municipioNome: string | null;
    ufSigla: string | null;
  };
  linkSistemaOrigem: string | null;
  // outros campos podem existir; mantemos tudo em `raw`
}

export interface PncpSearchResult {
  total: number;
  pagina: number;
  totalPaginas: number;
  items: Array<PncpItem & { raw: Record<string, any> }>;
}

export const searchPncp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data, context }): Promise<PncpSearchResult> => {
    // Garante que o caller é membro de alguma empresa (mesmo só lendo PNCP, evita exposição pública)
    await resolveCompanyId(context.supabase as AnySupabase, context.userId);

    const params = new URLSearchParams();
    if (data.dataInicial) params.set("dataInicial", data.dataInicial);
    params.set("dataFinal", data.dataFinal);
    params.set("codigoModalidadeContratacao", String(data.codigoModalidadeContratacao));
    if (data.uf) params.set("uf", data.uf);
    if (data.codigoMunicipioIbge) params.set("codigoMunicipioIbge", data.codigoMunicipioIbge);
    if (data.cnpj) params.set("cnpj", data.cnpj.replace(/\D/g, ""));
    params.set("pagina", String(data.pagina));
    params.set("tamanhoPagina", String(data.tamanhoPagina));

    const url = `${PNCP_BASE}/contratacoes/proposta?${params.toString()}`;
    const resp = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      throw new Error(`PNCP ${resp.status}: ${await resp.text().catch(() => resp.statusText)}`);
    }
    const json = (await resp.json()) as {
      data?: Array<Record<string, any>>;
      totalRegistros?: number;
      totalPaginas?: number;
      numeroPagina?: number;
    };
    const rawItems = Array.isArray(json.data) ? json.data : [];

    // Filtro local por palavra-chave (PNCP não tem filtro full-text)
    const kw = data.palavraChave?.trim().toLowerCase();
    const filtered = kw
      ? rawItems.filter((it) => {
          const obj = String(it.objetoCompra ?? "").toLowerCase();
          const org = String(
            (it.orgaoEntidade as { razaoSocial?: string } | undefined)?.razaoSocial ?? "",
          ).toLowerCase();
          return obj.includes(kw) || org.includes(kw);
        })
      : rawItems;

    return {
      total: json.totalRegistros ?? rawItems.length,
      pagina: json.numeroPagina ?? data.pagina,
      totalPaginas: json.totalPaginas ?? 1,
      items: filtered.map((it) => ({
        numeroControlePNCP: String(it.numeroControlePNCP ?? ""),
        numeroCompra: (it.numeroCompra as string | null) ?? null,
        anoCompra: (it.anoCompra as number | null) ?? null,
        modalidadeNome: (it.modalidadeNome as string | null) ?? null,
        modoDisputaNome: (it.modoDisputaNome as string | null) ?? null,
        objetoCompra: (it.objetoCompra as string | null) ?? null,
        valorTotalEstimado:
          typeof it.valorTotalEstimado === "number"
            ? (it.valorTotalEstimado as number)
            : it.valorTotalEstimado != null
              ? Number(it.valorTotalEstimado)
              : null,
        dataPublicacaoPncp: (it.dataPublicacaoPncp as string | null) ?? null,
        dataAberturaProposta: (it.dataAberturaProposta as string | null) ?? null,
        dataEncerramentoProposta: (it.dataEncerramentoProposta as string | null) ?? null,
        orgaoEntidade: {
          cnpj:
            ((it.orgaoEntidade as { cnpj?: string } | undefined)?.cnpj as string | null) ?? null,
          razaoSocial:
            ((it.orgaoEntidade as { razaoSocial?: string } | undefined)?.razaoSocial as
              | string
              | null) ?? null,
        },
        unidadeOrgao: {
          nomeUnidade:
            ((it.unidadeOrgao as { nomeUnidade?: string } | undefined)?.nomeUnidade as
              | string
              | null) ?? null,
          municipioNome:
            ((it.unidadeOrgao as { municipioNome?: string } | undefined)?.municipioNome as
              | string
              | null) ?? null,
          ufSigla:
            ((it.unidadeOrgao as { ufSigla?: string } | undefined)?.ufSigla as
              | string
              | null) ?? null,
        },
        linkSistemaOrigem: (it.linkSistemaOrigem as string | null) ?? null,
        raw: it,
      })),
    };
  });

/* ----------------------------- IMPORT ----------------------------- */

const importSchema = z.object({
  numeroControlePNCP: z.string().min(1).max(80),
  numeroCompra: z.string().nullable().optional(),
  anoCompra: z.number().int().nullable().optional(),
  orgaoCnpj: z.string().nullable().optional(),
  orgaoNome: z.string().nullable().optional(),
  unidadeNome: z.string().nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  municipio: z.string().nullable().optional(),
  modalidade: z.string().nullable().optional(),
  modoDisputa: z.string().nullable().optional(),
  objeto: z.string().nullable().optional(),
  valorEstimado: z.number().nullable().optional(),
  dataPublicacao: z.string().nullable().optional(),
  dataAberturaPropostas: z.string().nullable().optional(),
  dataEncerramentoPropostas: z.string().nullable().optional(),
  linkSistemaOrigem: z.string().nullable().optional(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: z.record(z.string(), z.any()).optional(),
});

export const importOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => importSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: existing } = await supabase
      .from("oportunidades")
      .select("id")
      .eq("company_id", companyId)
      .eq("pncp_id", data.numeroControlePNCP)
      .maybeSingle();
    if (existing?.id) {
      return { id: existing.id, created: false };
    }

    const insertPayload = {
      company_id: companyId,
      pncp_id: data.numeroControlePNCP,
      fonte: "pncp",
      numero_compra: data.numeroCompra ?? null,
      ano_compra: data.anoCompra ?? null,
      orgao_cnpj: data.orgaoCnpj ?? null,
      orgao_nome: data.orgaoNome ?? null,
      unidade_nome: data.unidadeNome ?? null,
      uf: data.uf ?? null,
      municipio: data.municipio ?? null,
      modalidade: data.modalidade ?? null,
      modo_disputa: data.modoDisputa ?? null,
      objeto: data.objeto ?? null,
      valor_estimado: data.valorEstimado ?? null,
      data_publicacao: data.dataPublicacao ?? null,
      data_abertura_propostas: data.dataAberturaPropostas ?? null,
      data_encerramento_propostas: data.dataEncerramentoPropostas ?? null,
      link_sistema_origem: data.linkSistemaOrigem ?? null,
      situacao: "triagem" as const,
      raw: data.raw ?? {},
      created_by: context.userId,
    };
    const { data: ins, error } = await supabase
      .from("oportunidades")
      .insert(insertPayload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: ins.id as string, created: true };
  });

/* ----------------------------- LIST ----------------------------- */

const listSchema = z.object({
  situacao: z
    .enum([
      "triagem",
      "analise",
      "preparando_proposta",
      "enviada",
      "resultado_aguardando",
      "ganha",
      "perdida",
      "arquivada",
    ])
    .optional(),
  uf: z.string().length(2).optional(),
  q: z.string().max(120).optional(),
});

export interface OportunidadeRow {
  id: string;
  pncp_id: string | null;
  numero_compra: string | null;
  orgao_nome: string | null;
  unidade_nome: string | null;
  uf: string | null;
  municipio: string | null;
  modalidade: string | null;
  objeto: string | null;
  valor_estimado: number | null;
  data_abertura_propostas: string | null;
  data_encerramento_propostas: string | null;
  link_sistema_origem: string | null;
  situacao: string;
  prioridade: string | null;
  escore_aderencia: number | null;
  created_at: string;
  updated_at: string;
}

export const listOportunidades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<OportunidadeRow[]> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);

    let q = supabase
      .from("oportunidades")
      .select(
        "id, pncp_id, numero_compra, orgao_nome, unidade_nome, uf, municipio, modalidade, objeto, valor_estimado, data_abertura_propostas, data_encerramento_propostas, link_sistema_origem, situacao, prioridade, escore_aderencia, created_at, updated_at",
      )
      .eq("company_id", companyId)
      .order("data_encerramento_propostas", { ascending: true, nullsFirst: false });

    if (data.situacao) q = q.eq("situacao", data.situacao);
    if (data.uf) q = q.eq("uf", data.uf);
    if (data.q) {
      const kw = `%${data.q}%`;
      q = q.or(`objeto.ilike.${kw},orgao_nome.ilike.${kw},numero_compra.ilike.${kw}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as OportunidadeRow[];
  });

const updateSituacaoSchema = z.object({
  id: z.string().uuid(),
  situacao: z.enum([
    "triagem",
    "analise",
    "preparando_proposta",
    "enviada",
    "resultado_aguardando",
    "ganha",
    "perdida",
    "arquivada",
  ]),
});

export const updateOportunidadeSituacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSituacaoSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const { error } = await supabase
      .from("oportunidades")
      .update({ situacao: data.situacao })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateOportunidadeSchema = z.object({
  id: z.string().uuid(),
  prioridade: z.enum(["baixa", "media", "alta", "urgente"]).nullable().optional(),
  escore_aderencia: z.number().int().min(0).max(100).nullable().optional(),
  anotacoes: z.string().max(5000).nullable().optional(),
  responsavel_user_id: z.string().uuid().nullable().optional(),
});

export const updateOportunidade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateOportunidadeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await requireEditor(supabase, context.userId);
    const patch: Record<string, any> = {};
    if (data.prioridade !== undefined) patch.prioridade = data.prioridade;
    if (data.escore_aderencia !== undefined) patch.escore_aderencia = data.escore_aderencia;
    if (data.anotacoes !== undefined) patch.anotacoes = data.anotacoes;
    if (data.responsavel_user_id !== undefined) patch.responsavel_user_id = data.responsavel_user_id;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("oportunidades")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPipelineEventos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ oportunidade_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("oportunidade_pipeline_eventos")
      .select("id, situacao_anterior, situacao_nova, motivo, created_at, actor_user_id")
      .eq("company_id", companyId)
      .eq("oportunidade_id", data.oportunidade_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
