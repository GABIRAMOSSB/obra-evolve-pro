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
  { key: "certidoes", table: "compliance_certificates" },
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
};

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
