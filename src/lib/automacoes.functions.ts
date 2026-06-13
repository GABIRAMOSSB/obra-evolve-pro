import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AnySupabase = any;

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

type CountKey =
  | "obras"
  | "oportunidades"
  | "editais"
  | "propostas"
  | "assinaturas"
  | "contratos"
  | "rdo"
  | "notas"
  | "certidoes";

const COUNT_TABLES: Array<{ key: CountKey; table: string }> = [
  { key: "obras", table: "obras" },
  { key: "oportunidades", table: "oportunidades" },
  { key: "editais", table: "editais" },
  { key: "propostas", table: "propostas" },
  { key: "assinaturas", table: "signature_requests" },
  { key: "contratos", table: "contratos" },
  { key: "rdo", table: "rdo_entries" },
  { key: "notas", table: "nfe_notas" },
  { key: "certidoes", table: "company_certificates" },
];

async function resolveCompanyId(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuario nao vinculado a uma empresa.");
  return data.company_id as string;
}

async function countRows(supabase: AnySupabase, table: string, companyId: string): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (error) return null;
  return count ?? 0;
}

export type AutomationSnapshot = {
  generatedAt: string;
  companyId: string;
  counts: Record<CountKey, number | null>;
  integrations: {
    supabase: boolean;
    lovableAi: boolean;
    infosimples: boolean;
    zapsignWebhook: boolean;
    cronSecret: boolean;
  };
  recommendations: Array<{
    id: string;
    priority: "alta" | "media" | "baixa";
    title: string;
    reason: string;
    route: string;
  }>;
  alerts: AutomationAlert[];
};

export type AutomationAlert = {
  id: string;
  severity: "critica" | "alta" | "media" | "baixa";
  area: "licitacoes" | "obra" | "financeiro" | "governanca" | "contratos";
  title: string;
  description: string;
  route: string;
  action: string;
};

async function safeSelect<T>(
  supabase: AnySupabase,
  table: string,
  select: string,
  companyId: string,
  build?: (query: AnySupabase) => AnySupabase,
): Promise<T[]> {
  let q = supabase.from(table).select(select).eq("company_id", companyId);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as T[];
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  target.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

async function buildAutomationAlerts(supabase: AnySupabase, companyId: string): Promise<AutomationAlert[]> {
  const alerts: AutomationAlert[] = [];
  const nowIso = new Date().toISOString();
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const last3Days = new Date(Date.now() - 3 * 86_400_000).toISOString();

  const propostas = await safeSelect<{ id: string; titulo: string; status: string; updated_at: string }>(
    supabase,
    "propostas",
    "id, titulo, status, updated_at",
    companyId,
    (q) => q.in("status", ["rascunho", "em_revisao"]).order("updated_at", { ascending: true }).limit(5),
  );
  for (const proposta of propostas) {
    alerts.push({
      id: `proposta-${proposta.id}`,
      severity: proposta.status === "rascunho" ? "alta" : "media",
      area: "licitacoes",
      title: `Proposta em ${proposta.status === "rascunho" ? "rascunho" : "revisao"}`,
      description: proposta.titulo,
      route: "/propostas",
      action: "Abrir proposta",
    });
  }

  const assinaturas = await safeSelect<{
    id: string;
    document_name: string;
    status: string;
    expiration_date: string | null;
  }>(
    supabase,
    "signature_requests",
    "id, document_name, status, expiration_date",
    companyId,
    (q) =>
      q
        .not("status", "in", "(signed,canceled,refused,expired)")
        .or(`expiration_date.is.null,expiration_date.lte.${in30}`)
        .order("expiration_date", { ascending: true, nullsFirst: false })
        .limit(5),
  );
  for (const assinatura of assinaturas) {
    const days = daysUntil(assinatura.expiration_date);
    alerts.push({
      id: `assinatura-${assinatura.id}`,
      severity: days != null && days <= 3 ? "critica" : "alta",
      area: "contratos",
      title: days == null ? "Assinatura sem vencimento definido" : `Assinatura vence em ${days} dia(s)`,
      description: assinatura.document_name,
      route: "/assinaturas",
      action: "Acompanhar assinatura",
    });
  }

  const certidoes = await safeSelect<{
    id: string;
    status: string | null;
    expiration_date: string | null;
    certificate_types?: { short_name?: string | null; name?: string | null } | null;
  }>(
    supabase,
    "company_certificates",
    "id, status, expiration_date, certificate_types(short_name, name)",
    companyId,
    (q) =>
      q
        .or(`status.in.(expired,expiring_soon),expiration_date.lte.${in30}`)
        .order("expiration_date", { ascending: true, nullsFirst: false })
        .limit(5),
  );
  for (const cert of certidoes) {
    const days = daysUntil(cert.expiration_date);
    const name = cert.certificate_types?.short_name ?? cert.certificate_types?.name ?? "Certidao";
    alerts.push({
      id: `certidao-${cert.id}`,
      severity: cert.status === "expired" || (days != null && days < 0) ? "critica" : "alta",
      area: "governanca",
      title: days == null ? "Certidao pendente" : days < 0 ? "Certidao vencida" : `Certidao vence em ${days} dia(s)`,
      description: name,
      route: "/compliance",
      action: "Ver compliance",
    });
  }

  const oportunidades = await safeSelect<{
    id: string;
    objeto: string | null;
    situacao: string;
    data_encerramento_proposta: string | null;
  }>(
    supabase,
    "oportunidades",
    "id, objeto, situacao, data_encerramento_proposta",
    companyId,
    (q) =>
      q
        .in("situacao", ["triagem", "analise", "preparando_proposta"])
        .gte("data_encerramento_proposta", nowIso)
        .lte("data_encerramento_proposta", in30)
        .order("data_encerramento_proposta", { ascending: true })
        .limit(5),
  );
  for (const oportunidade of oportunidades) {
    const days = daysUntil(oportunidade.data_encerramento_proposta);
    alerts.push({
      id: `oportunidade-${oportunidade.id}`,
      severity: days != null && days <= 5 ? "critica" : "alta",
      area: "licitacoes",
      title: `Prazo de proposta em ${days ?? "?"} dia(s)`,
      description: oportunidade.objeto ?? "Oportunidade PNCP",
      route: "/oportunidades",
      action: "Priorizar edital",
    });
  }

  const rdos = await safeSelect<{ id: string; data: string | null; titulo: string | null; created_at: string }>(
    supabase,
    "rdo_entries",
    "id, data, titulo, created_at",
    companyId,
    (q) => q.gte("created_at", last3Days).order("created_at", { ascending: false }).limit(3),
  );
  if (rdos.length === 0) {
    alerts.push({
      id: "rdo-recente",
      severity: "media",
      area: "obra",
      title: "Nenhum RDO recente encontrado",
      description: "Acompanhe diarios e evidencias para manter historico operacional atualizado.",
      route: "/rdo",
      action: "Criar RDO",
    });
  }

  const severityOrder = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]).slice(0, 12);
}

export const getAutomationSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationSnapshot> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const results = await Promise.all(
      COUNT_TABLES.map(async ({ key, table }) => [key, await countRows(supabase, table, companyId)] as const),
    );
    const counts = Object.fromEntries(results) as Record<CountKey, number | null>;

    const recommendations: AutomationSnapshot["recommendations"] = [];
    const alerts = await buildAutomationAlerts(supabase, companyId);
    if ((counts.oportunidades ?? 0) === 0) {
      recommendations.push({
        id: "radar-pncp",
        priority: "alta",
        title: "Ativar radar PNCP e importar oportunidades",
        reason: "Sem oportunidades no pipeline, a IA nao tem base para priorizar editais e propostas.",
        route: "/oportunidades",
      });
    }
    if ((counts.editais ?? 0) > 0 && (counts.propostas ?? 0) === 0) {
      recommendations.push({
        id: "propostas-ia",
        priority: "alta",
        title: "Gerar propostas assistidas por IA",
        reason: "Existem editais cadastrados sem propostas ligadas.",
        route: "/propostas",
      });
    }
    if ((counts.assinaturas ?? 0) === 0 && (counts.contratos ?? 0) > 0) {
      recommendations.push({
        id: "assinatura-zapsign",
        priority: "media",
        title: "Conectar contratos ao fluxo de assinatura",
        reason: "Contratos sem solicitações de assinatura reduzem rastreabilidade.",
        route: "/assinaturas",
      });
    }
    if ((counts.certidoes ?? 0) === 0) {
      recommendations.push({
        id: "compliance",
        priority: "media",
        title: "Carregar certidoes e regras de vencimento",
        reason: "A central de compliance ganha valor quando monitora documentos reais.",
        route: "/compliance",
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        id: "avancar-ia",
        priority: "baixa",
        title: "Avancar para agentes de IA por modulo",
        reason: "A base operacional ja existe; o proximo ganho e automatizar analise e priorizacao.",
        route: "/automacoes",
      });
    }

    return {
      generatedAt: new Date().toISOString(),
      companyId,
      counts,
      integrations: {
        supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
        lovableAi: Boolean(process.env.LOVABLE_API_KEY),
        infosimples: Boolean(process.env.INFOSIMPLES_TOKEN),
        zapsignWebhook: Boolean(process.env.ZAPSIGN_WEBHOOK_SECRET),
        cronSecret: Boolean(process.env.CRON_SECRET),
      },
      recommendations,
      alerts,
    };
  });

const planSchema = z.object({
  foco: z.enum(["licitacoes", "obra", "financeiro", "governanca", "geral"]).default("geral"),
  objetivo: z.string().max(500).optional(),
});

function fallbackPlan(snapshotHint: string, foco: string): string {
  return [
    `Plano inteligente para ${foco}:`,
    "1. Priorizar bases de dados: garantir obras, oportunidades, contratos e documentos com company_id consistente.",
    "2. Automatizar capturas: PNCP para oportunidades, ZapSign para assinaturas, compliance para vencimentos e NF-e para custos.",
    "3. Criar alertas: prazos de proposta, certidoes a vencer, contratos sem assinatura e RDOs sem foto/evidencia.",
    "4. Adicionar IA assistiva: resumo de edital, matriz de risco, sugestao de atestados, resumo de RDO e classificacao de notas.",
    "5. Medir resultado: tempo economizado, propostas geradas, pendencias resolvidas e eventos automatizados.",
    "",
    snapshotHint,
  ].join("\n");
}

export const generateAutomationPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => planSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompanyId(supabase, context.userId);
    const counts = await Promise.all(
      COUNT_TABLES.map(async ({ key, table }) => [key, await countRows(supabase, table, companyId)] as const),
    );
    const snapshotHint = `Snapshot: ${counts
      .map(([key, value]) => `${key}=${value ?? "indisponivel"}`)
      .join(", ")}.`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        model: "heuristico-local",
        plan: fallbackPlan(snapshotHint, data.foco),
      };
    }

    const prompt = [
      "Voce e um especialista senior em automacao para construtoras.",
      "Gere um plano pratico, curto e acionavel para evoluir o sistema SOLV Gestao.",
      `Foco: ${data.foco}.`,
      data.objetivo ? `Objetivo do usuario: ${data.objetivo}.` : "",
      snapshotHint,
      "Responda em portugues do Brasil, com 5 a 7 acoes concretas.",
    ].join("\n");

    const resp = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: "Seja objetivo, tecnico e orientado a produto SaaS de construcao civil." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!resp.ok) {
      return {
        model: "heuristico-local",
        plan: fallbackPlan(`Gateway IA indisponivel (${resp.status}). ${snapshotHint}`, data.foco),
      };
    }

    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return {
      model: DEFAULT_MODEL,
      plan: json.choices?.[0]?.message?.content?.trim() || fallbackPlan(snapshotHint, data.foco),
    };
  });
