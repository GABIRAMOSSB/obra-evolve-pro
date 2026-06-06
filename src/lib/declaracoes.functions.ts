/**
 * Declarações de Licitação — Fase 5.x.
 *
 * Catálogo de declarações formais (habilitação, ME/EPP, menor, idoneidade,
 * elaboração independente etc.) com templates pré-definidos baseados na
 * Lei 14.133/2021 e CF/88.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  return data.company_id as string;
}

export type TipoDeclaracao =
  | "habilitacao"
  | "me_epp"
  | "menor"
  | "idoneidade"
  | "elaboracao_independente"
  | "cumprimento_requisitos"
  | "reserva_cargos"
  | "nepotismo"
  | "outro";

export const TIPOS_DECLARACAO: { value: TipoDeclaracao; label: string; titulo: string }[] = [
  { value: "habilitacao", label: "Habilitação (art. 63, Lei 14.133/21)", titulo: "Declaração de Habilitação" },
  { value: "me_epp", label: "Microempresa / EPP (LC 123/06)", titulo: "Declaração de Enquadramento como ME/EPP" },
  { value: "menor", label: "Inexistência de menor (art. 7º, XXXIII, CF)", titulo: "Declaração de Inexistência de Trabalho de Menor" },
  { value: "idoneidade", label: "Idoneidade (art. 63, I, Lei 14.133/21)", titulo: "Declaração de Idoneidade" },
  { value: "elaboracao_independente", label: "Elaboração independente de proposta", titulo: "Declaração de Elaboração Independente de Proposta" },
  { value: "cumprimento_requisitos", label: "Cumprimento dos requisitos de habilitação", titulo: "Declaração de Cumprimento dos Requisitos de Habilitação" },
  { value: "reserva_cargos", label: "Reserva de cargos (art. 63, IV, Lei 14.133/21)", titulo: "Declaração de Reserva de Cargos para Pessoa com Deficiência" },
  { value: "nepotismo", label: "Inexistência de nepotismo", titulo: "Declaração de Inexistência de Nepotismo" },
  { value: "outro", label: "Outra (texto livre)", titulo: "Declaração" },
];

export interface TemplateCtx {
  empresa: { nome: string; cnpj: string };
  signatario: { nome: string; cpf: string | null; cargo: string | null };
  edital?: { titulo: string | null; numero: string | null; orgao: string | null } | null;
  oportunidade?: { titulo: string | null; orgao: string | null } | null;
  data: string;
}

function header(ctx: TemplateCtx, titulo: string) {
  const ref = ctx.edital
    ? `referente ao Edital ${ctx.edital.numero ?? ""}${ctx.edital.orgao ? ` — ${ctx.edital.orgao}` : ""}`.trim()
    : ctx.oportunidade
      ? `referente à oportunidade "${ctx.oportunidade.titulo ?? ""}"${ctx.oportunidade.orgao ? ` — ${ctx.oportunidade.orgao}` : ""}`
      : "";
  return `${titulo.toUpperCase()}\n\n${ctx.empresa.nome}, inscrita no CNPJ sob nº ${ctx.empresa.cnpj}, por meio de seu representante legal abaixo assinado, ${ref ? `\n${ref},` : ""} DECLARA, sob as penas da lei, que:\n\n`;
}

function footer(ctx: TemplateCtx) {
  const sig = ctx.signatario;
  return `\n\n${ctx.data}\n\n\n_____________________________________________\n${sig.nome}\n${sig.cargo ?? "Representante Legal"}${sig.cpf ? `\nCPF: ${sig.cpf}` : ""}\n${ctx.empresa.nome}`;
}

export function gerarTextoDeclaracao(tipo: TipoDeclaracao, ctx: TemplateCtx): { titulo: string; conteudo: string } {
  const meta = TIPOS_DECLARACAO.find((t) => t.value === tipo) ?? TIPOS_DECLARACAO[TIPOS_DECLARACAO.length - 1];
  const body = (() => {
    switch (tipo) {
      case "habilitacao":
        return `Cumpre plenamente os requisitos de habilitação exigidos no edital, nos termos do art. 63, I, da Lei nº 14.133/2021, comprometendo-se a manter tal situação durante todo o procedimento licitatório e a vigência do eventual contrato.`;
      case "me_epp":
        return `Encontra-se enquadrada como Microempresa (ME) ou Empresa de Pequeno Porte (EPP), nos termos da Lei Complementar nº 123/2006, fazendo jus aos benefícios e tratamento diferenciado nela previstos, não estando incursa em nenhuma das vedações do § 4º do art. 3º da referida Lei.`;
      case "menor":
        return `Não emprega menor de 18 (dezoito) anos em trabalho noturno, perigoso ou insalubre, nem menor de 16 (dezesseis) anos em qualquer trabalho, salvo na condição de aprendiz a partir dos 14 (quatorze) anos, em cumprimento ao disposto no art. 7º, XXXIII, da Constituição Federal e no art. 63, IV, da Lei nº 14.133/2021.`;
      case "idoneidade":
        return `Não foi declarada inidônea por ato do Poder Público, nem está suspensa de licitar ou impedida de contratar com a Administração Pública, em qualquer de suas esferas, nos termos do art. 14, da Lei nº 14.133/2021.`;
      case "elaboracao_independente":
        return `A presente proposta foi elaborada de maneira independente, sem qualquer consulta, comunicação ou acordo com qualquer outro participante potencial ou de fato do certame, nos termos da legislação vigente e dos princípios da livre concorrência e da moralidade administrativa.`;
      case "cumprimento_requisitos":
        return `Cumpre integralmente todos os requisitos de habilitação jurídica, fiscal, social, trabalhista, econômico-financeira e técnico-profissional exigidos no edital, estando ciente das sanções aplicáveis em caso de declaração falsa.`;
      case "reserva_cargos":
        return `Cumpre a reserva de cargos prevista em lei para pessoa com deficiência e para reabilitado da Previdência Social, conforme exigido pelo art. 63, IV, da Lei nº 14.133/2021, e reserva o percentual mínimo legal, sempre que aplicável.`;
      case "nepotismo":
        return `Nenhum de seus dirigentes, gerentes, sócios, responsáveis técnicos ou demais profissionais possui vínculo de parentesco — em linha reta, colateral ou por afinidade até o terceiro grau — com agentes públicos da Administração contratante, em observância à Súmula Vinculante nº 13 do STF.`;
      case "outro":
      default:
        return `[Texto livre — edite o conteúdo desta declaração conforme necessidade.]`;
    }
  })();
  return { titulo: meta.titulo, conteudo: header(ctx, meta.titulo) + body + footer(ctx) };
}

export type DeclaracaoRow = {
  id: string;
  tipo: TipoDeclaracao;
  titulo: string;
  conteudo: string;
  signatario_id: string | null;
  procuracao_id: string | null;
  oportunidade_id: string | null;
  edital_id: string | null;
  data_emissao: string;
  observacoes: string | null;
  created_at: string;
  signatario?: { id: string; nome: string; cargo: string | null } | null;
  oportunidade?: { id: string; titulo: string | null } | null;
  edital?: { id: string; titulo: string | null; numero_edital: string | null } | null;
};

export const listDeclaracoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ declaracoes: DeclaracaoRow[] }> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);
    const { data, error } = await supabase
      .from("declaracoes_licitacao")
      .select(
        `id, tipo, titulo, conteudo, signatario_id, procuracao_id, oportunidade_id, edital_id, data_emissao, observacoes, created_at,
         signatario:company_signatarios(id, nome, cargo),
         oportunidade:oportunidades(id, titulo),
         edital:editais(id, titulo, numero_edital)`,
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { declaracoes: (data ?? []) as DeclaracaoRow[] };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum([
    "habilitacao", "me_epp", "menor", "idoneidade", "elaboracao_independente",
    "cumprimento_requisitos", "reserva_cargos", "nepotismo", "outro",
  ]),
  titulo: z.string().min(3).max(300),
  conteudo: z.string().min(10).max(20000),
  signatario_id: z.string().uuid().optional().nullable(),
  procuracao_id: z.string().uuid().optional().nullable(),
  oportunidade_id: z.string().uuid().optional().nullable(),
  edital_id: z.string().uuid().optional().nullable(),
  data_emissao: z.string().min(10).optional(),
  observacoes: z.string().max(2000).optional().nullable(),
});

export const upsertDeclaracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const row = {
      company_id: companyId,
      tipo: data.tipo,
      titulo: data.titulo.trim(),
      conteudo: data.conteudo,
      signatario_id: data.signatario_id || null,
      procuracao_id: data.procuracao_id || null,
      oportunidade_id: data.oportunidade_id || null,
      edital_id: data.edital_id || null,
      data_emissao: data.data_emissao || new Date().toISOString().slice(0, 10),
      observacoes: data.observacoes || null,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await supabase
        .from("declaracoes_licitacao").update(row).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("declaracoes_licitacao").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const excluirDeclaracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("declaracoes_licitacao").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const previewSchema = z.object({
  tipo: z.enum([
    "habilitacao", "me_epp", "menor", "idoneidade", "elaboracao_independente",
    "cumprimento_requisitos", "reserva_cargos", "nepotismo", "outro",
  ]),
  signatario_id: z.string().uuid().optional().nullable(),
  oportunidade_id: z.string().uuid().optional().nullable(),
  edital_id: z.string().uuid().optional().nullable(),
});

export const previewDeclaracao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => previewSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ titulo: string; conteudo: string }> => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);

    const { data: comp } = await supabase
      .from("companies").select("razao_social, cnpj").eq("id", companyId).maybeSingle();
    const empresa = {
      nome: (comp?.razao_social as string) || "[Razão Social]",
      cnpj: (comp?.cnpj as string) || "[CNPJ]",
    };

    let signatario = { nome: "[Nome do signatário]", cpf: null as string | null, cargo: null as string | null };
    if (data.signatario_id) {
      const { data: s } = await supabase
        .from("company_signatarios").select("nome, cpf, cargo").eq("id", data.signatario_id).eq("company_id", companyId).maybeSingle();
      if (s) signatario = { nome: s.nome, cpf: s.cpf ?? null, cargo: s.cargo ?? null };
    }

    let edital: TemplateCtx["edital"] = null;
    if (data.edital_id) {
      const { data: e } = await supabase
        .from("editais").select("titulo, numero_edital, orgao").eq("id", data.edital_id).eq("company_id", companyId).maybeSingle();
      if (e) edital = { titulo: e.titulo ?? null, numero: e.numero_edital ?? null, orgao: e.orgao ?? null };
    }

    let oportunidade: TemplateCtx["oportunidade"] = null;
    if (data.oportunidade_id) {
      const { data: o } = await supabase
        .from("oportunidades").select("titulo, orgao").eq("id", data.oportunidade_id).eq("company_id", companyId).maybeSingle();
      if (o) oportunidade = { titulo: o.titulo ?? null, orgao: o.orgao ?? null };
    }

    const dataFmt = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    return gerarTextoDeclaracao(data.tipo, { empresa, signatario, edital, oportunidade, data: dataFmt });
  });
