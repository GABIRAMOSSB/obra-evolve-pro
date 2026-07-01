/**
 * Server functions do Orçamento (versões e itens).
 * Fase E — importador Excel/CSV com preview e mapeamento.
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
  return { companyId: data.company_id as string, role: data.role as string };
}

// ---------------- LIST / GET ----------------

export const listOrcamentoVersoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ obra_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId);
    const { data: rows, error } = await supabase
      .from("orcamento_versoes")
      .select("*")
      .eq("company_id", companyId)
      .eq("obra_id", data.obra_id)
      .order("numero_versao", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getOrcamentoVersao = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId);
    const { data: versao, error } = await supabase
      .from("orcamento_versoes")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!versao) throw new Error("Versão não encontrada.");
    const { data: itens } = await supabase
      .from("orcamento_itens")
      .select("*")
      .eq("company_id", companyId)
      .eq("versao_id", data.id)
      .order("ordem", { ascending: true });
    return { versao, itens: itens ?? [] };
  });

// ---------------- IMPORT ----------------

const itemSchema = z.object({
  item_codigo: z.string().min(1).max(64),
  descricao: z.string().min(1).max(1000),
  unidade: z.string().max(20).nullable().optional(),
  qtd_contratada: z.number().nonnegative(),
  valor_unitario: z.number().nonnegative(),
  tipo: z.enum(["etapa", "subetapa", "grupo", "item"]).optional(),
  sinapi_codigo: z.string().max(32).nullable().optional(),
});

const importSchema = z.object({
  obra_id: z.string().uuid(),
  contrato_id: z.string().uuid().nullable().optional(),
  descricao: z.string().max(200).optional(),
  origem: z.enum(["import_excel", "import_csv", "manual"]).default("import_excel"),
  origem_arquivo: z.string().max(200).optional(),
  itens: z.array(itemSchema).min(1).max(20000),
});

function inferNivel(codigo: string): number {
  // "1", "1.1", "1.1.1", "1.1.1.1" → 1..4
  const parts = String(codigo).split(".").filter(Boolean);
  return Math.min(Math.max(parts.length, 1), 4);
}

function inferCodigoPai(codigo: string): string | null {
  const parts = String(codigo).split(".").filter(Boolean);
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join(".");
}

function inferTipo(codigo: string, temQtd: boolean, temValor: boolean): "etapa" | "subetapa" | "grupo" | "item" {
  const nivel = inferNivel(codigo);
  if (temQtd && temValor) return "item";
  if (nivel === 1) return "etapa";
  if (nivel === 2) return "subetapa";
  return "grupo";
}

export const criarOrcamentoVersaoDeImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => importSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);

    // Valida obra
    const { data: obra } = await supabase
      .from("obras")
      .select("id, company_id")
      .eq("id", data.obra_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!obra) throw new Error("Obra não encontrada.");

    // Deduplica códigos mantendo o último ocorrido
    const dedupe = new Map<string, (typeof data.itens)[number]>();
    for (const it of data.itens) dedupe.set(it.item_codigo, it);
    const itensLimpos = Array.from(dedupe.values());

    // Próximo número de versão
    const { data: ultima } = await supabase
      .from("orcamento_versoes")
      .select("numero_versao")
      .eq("company_id", companyId)
      .eq("obra_id", data.obra_id)
      .order("numero_versao", { ascending: false })
      .limit(1)
      .maybeSingle();
    const proximoNumero = (ultima?.numero_versao ?? 0) + 1;

    // Cria versão em rascunho
    const { data: versao, error: vErr } = await supabase
      .from("orcamento_versoes")
      .insert({
        company_id: companyId,
        obra_id: data.obra_id,
        contrato_id: data.contrato_id ?? null,
        numero_versao: proximoNumero,
        descricao: data.descricao ?? `Importação ${new Date().toLocaleString("pt-BR")}`,
        status: "rascunho",
        origem: data.origem,
        origem_arquivo: data.origem_arquivo ?? null,
        created_by: context.userId,
        valor_total_cents: 0,
      })
      .select("id, numero_versao")
      .single();
    if (vErr) throw new Error(vErr.message);

    // Prepara itens
    let totalCents = 0;
    const rows = itensLimpos.map((it, idx) => {
      const qtd = Number(it.qtd_contratada) || 0;
      const vuCents = Math.round((Number(it.valor_unitario) || 0) * 100);
      const totalItemCents = Math.round(qtd * vuCents);
      const tipo = it.tipo ?? inferTipo(it.item_codigo, qtd > 0, vuCents > 0);
      if (tipo === "item") totalCents += totalItemCents;
      return {
        company_id: companyId,
        versao_id: versao.id,
        obra_id: data.obra_id,
        item_codigo: it.item_codigo,
        item_codigo_pai: inferCodigoPai(it.item_codigo),
        nivel: inferNivel(it.item_codigo),
        tipo,
        descricao: it.descricao.trim().slice(0, 1000),
        unidade: it.unidade ?? null,
        qtd_contratada: qtd,
        valor_unitario_cents: vuCents,
        total_contratado_cents: totalItemCents,
        ordem: idx,
        sinapi_codigo: it.sinapi_codigo ?? null,
      };
    });

    // Insere em chunks
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error: iErr } = await supabase.from("orcamento_itens").insert(chunk);
      if (iErr) throw new Error(iErr.message);
    }

    // Atualiza total
    await supabase
      .from("orcamento_versoes")
      .update({ valor_total_cents: totalCents })
      .eq("id", versao.id);

    return {
      ok: true,
      versao_id: versao.id as string,
      numero_versao: versao.numero_versao as number,
      total_itens: rows.length,
      valor_total_cents: totalCents,
    };
  });

// ---------------- CONGELAR ----------------

export const congelarOrcamentoVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), sincronizar_atividades: z.boolean().default(true) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);

    const { data: versao, error: vErr } = await supabase
      .from("orcamento_versoes")
      .select("id, obra_id, status")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (vErr) throw new Error(vErr.message);
    if (!versao) throw new Error("Versão não encontrada.");
    if (versao.status !== "rascunho") throw new Error("Somente rascunho pode ser congelado.");

    // Marca versões anteriores como substituídas
    await supabase
      .from("orcamento_versoes")
      .update({ status: "substituida" })
      .eq("company_id", companyId)
      .eq("obra_id", versao.obra_id)
      .eq("status", "congelada");

    const { error: uErr } = await supabase
      .from("orcamento_versoes")
      .update({
        status: "congelada",
        congelada_em: new Date().toISOString(),
        congelada_por: context.userId,
      })
      .eq("id", data.id);
    if (uErr) throw new Error(uErr.message);

    // Sincroniza obra_atividades (para o BM consumir)
    if (data.sincronizar_atividades) {
      const { data: itens } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("company_id", companyId)
        .eq("versao_id", data.id)
        .order("ordem", { ascending: true });

      if (itens && itens.length > 0) {
        // Remove atividades antigas da obra
        await supabase
          .from("obra_atividades")
          .delete()
          .eq("company_id", companyId)
          .eq("obra_id", versao.obra_id);

        const atividadeRows = itens.map((it: {
          item_codigo: string;
          descricao: string;
          unidade: string | null;
          qtd_contratada: number | string;
          valor_unitario_cents: number | string;
          total_contratado_cents: number | string;
          tipo: string;
          ordem: number;
        }, idx: number) => {
          const qtd = Number(it.qtd_contratada);
          const valorTotal = Number(it.total_contratado_cents) / 100;
          const isGroup = it.tipo !== "item";
          return {
            company_id: companyId,
            obra_id: versao.obra_id,
            item_codigo: it.item_codigo,
            descricao: it.descricao,
            unidade: it.unidade,
            quantidade: qtd,
            valor: valorTotal,
            is_group: isGroup,
            ordem: it.ordem ?? idx,
          };
        });

        const chunkSize = 500;
        for (let i = 0; i < atividadeRows.length; i += chunkSize) {
          const chunk = atividadeRows.slice(i, i + chunkSize);
          const { error: aErr } = await supabase.from("obra_atividades").insert(chunk);
          if (aErr) throw new Error(aErr.message);
        }
      }
    }

    return { ok: true };
  });

export const excluirOrcamentoVersao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const { companyId } = await resolveCompany(supabase, context.userId, true);
    const { data: versao } = await supabase
      .from("orcamento_versoes")
      .select("id, status")
      .eq("id", data.id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (!versao) throw new Error("Versão não encontrada.");
    if (versao.status !== "rascunho") throw new Error("Somente rascunho pode ser excluído.");
    const { error } = await supabase
      .from("orcamento_versoes")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
