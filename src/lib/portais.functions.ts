/**
 * F10 — Perfis de Portal, Simulador de Envio e Protocolos.
 *
 * Server functions:
 *   - listPortais(filters?)            → lista perfis cadastrados
 *   - upsertPortal(payload)            → cria/atualiza perfil de portal
 *   - excluirPortal(id)
 *   - simularEnvioProposta({proposta_id, portal_id}) → formata itens conforme regra do portal
 *   - listProtocolos(filters?)
 *   - upsertProtocolo(payload)
 *   - excluirProtocolo(id)
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

async function resolveCompanyId(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members").select("company_id").eq("user_id", userId).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  return data.company_id as string;
}

async function requireEditor(supabase: AnySupabase, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("company_members").select("company_id, role").eq("user_id", userId).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.company_id) throw new Error("Usuário não vinculado a uma empresa.");
  if (data.role !== "admin" && data.role !== "editor") throw new Error("Permissão insuficiente.");
  return data.company_id as string;
}

/* ============================== Catálogo padrão ============================== */

export const PORTAIS_SUGERIDOS = [
  { nome: "Comprasnet / Compras.gov.br", codigo: "compras-gov", formato_preferido: "xlsx", url_portal: "https://www.gov.br/compras", max_chars_descricao: 1024 },
  { nome: "PNCP", codigo: "pncp", formato_preferido: "xlsx", url_portal: "https://pncp.gov.br" },
  { nome: "BEC-SP", codigo: "bec-sp", formato_preferido: "csv", url_portal: "https://www.bec.sp.gov.br", separador_decimal: ",", encoding: "ISO-8859-1" },
  { nome: "Licitações-e (BB)", codigo: "licitacoes-e", formato_preferido: "xlsx", url_portal: "https://www.licitacoes-e.com.br" },
  { nome: "BLL Compras", codigo: "bll", formato_preferido: "xlsx", url_portal: "https://bll.org.br" },
  { nome: "Comprasnet Caixa", codigo: "caixa", formato_preferido: "pdf", url_portal: "https://compras.caixa.gov.br" },
] as const;

/* ============================== Perfis ============================== */

export const listPortais = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ativo: z.boolean().optional() }).optional().parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);
    let q = supabase
      .from("portal_perfis")
      .select("*")
      .eq("company_id", companyId)
      .order("nome", { ascending: true })
      .limit(500);
    if (data?.ativo !== undefined) q = q.eq("ativo", data.ativo);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

const portalSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().min(1).max(120),
  codigo: z.string().max(60).optional(),
  formato_preferido: z.enum(["xlsx", "csv", "pdf", "txt", "json", "outro"]).default("xlsx"),
  separador_decimal: z.enum([",", "."]).default(","),
  separador_milhar: z.enum([",", ".", ""]).default("."),
  casas_decimais_qtd: z.number().int().min(0).max(8).default(4),
  casas_decimais_preco: z.number().int().min(0).max(8).default(2),
  encoding: z.string().max(20).default("UTF-8"),
  max_chars_descricao: z.number().int().min(0).max(10000).nullable().optional(),
  exige_assinatura_digital: z.boolean().default(false),
  exige_planilha_modelo: z.boolean().default(false),
  url_portal: z.string().max(500).nullable().optional(),
  observacoes: z.string().max(4000).nullable().optional(),
  ativo: z.boolean().default(true),
});

export const upsertPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => portalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const payload = { ...data, company_id: companyId, created_by: userId };
    if (data.id) {
      const { error } = await supabase
        .from("portal_perfis").update(payload).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("portal_perfis").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const excluirPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { error } = await supabase
      .from("portal_perfis").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============================== Simulador ============================== */

function formatNumero(
  n: number,
  casas: number,
  sepDec: string,
  sepMil: string,
): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const fixed = abs.toFixed(casas);
  const [intPart, decPart] = fixed.split(".");
  const intFmt = sepMil ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sepMil) : intPart;
  return casas > 0 ? `${sign}${intFmt}${sepDec}${decPart}` : `${sign}${intFmt}`;
}

export const simularEnvioProposta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      proposta_id: z.string().uuid(),
      portal_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);

    const [{ data: portal, error: e1 }, { data: prop, error: e2 }, { data: itens, error: e3 }] =
      await Promise.all([
        supabase.from("portal_perfis").select("*").eq("id", data.portal_id).eq("company_id", companyId).maybeSingle(),
        supabase.from("propostas").select("id, titulo, valor_total").eq("id", data.proposta_id).eq("company_id", companyId).maybeSingle(),
        supabase.from("proposta_itens")
          .select("ordem, codigo, descricao, unidade, quantidade, preco_unitario, valor_total")
          .eq("proposta_id", data.proposta_id)
          .order("ordem", { ascending: true })
          .limit(5000),
      ]);

    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    if (e3) throw new Error(e3.message);
    if (!portal) throw new Error("Portal não encontrado.");
    if (!prop) throw new Error("Proposta não encontrada.");

    const sepDec = portal.separador_decimal as string;
    const sepMil = portal.separador_milhar as string;
    const casasQtd = portal.casas_decimais_qtd as number;
    const casasPreco = portal.casas_decimais_preco as number;
    const maxChars = portal.max_chars_descricao as number | null;

    type Item = {
      ordem: number | null; codigo: string | null; descricao: string | null;
      unidade: string | null; quantidade: number | string | null;
      preco_unitario: number | string | null; valor_total: number | string | null;
    };

    const alerts: Array<{ ordem: number | null; tipo: string; mensagem: string }> = [];
    const linhas = ((itens ?? []) as Item[]).map((it) => {
      const desc = it.descricao ?? "";
      let descFmt = desc;
      if (maxChars && desc.length > maxChars) {
        descFmt = desc.slice(0, maxChars - 1) + "…";
        alerts.push({
          ordem: it.ordem,
          tipo: "descricao_truncada",
          mensagem: `Descrição do item ${it.ordem} truncada de ${desc.length} para ${maxChars} caracteres.`,
        });
      }
      const qtd = Number(it.quantidade ?? 0);
      const preco = Number(it.preco_unitario ?? 0);
      const total = Number(it.valor_total ?? qtd * preco);

      if (preco > 0 && Number(preco.toFixed(casasPreco)) !== preco) {
        alerts.push({
          ordem: it.ordem,
          tipo: "arredondamento_preco",
          mensagem: `Preço unitário do item ${it.ordem} será arredondado para ${casasPreco} casas.`,
        });
      }

      return {
        ordem: it.ordem,
        codigo: it.codigo ?? "",
        descricao: descFmt,
        unidade: it.unidade ?? "",
        quantidade: formatNumero(qtd, casasQtd, sepDec, sepMil),
        preco_unitario: formatNumero(preco, casasPreco, sepDec, sepMil),
        valor_total: formatNumero(total, casasPreco, sepDec, sepMil),
      };
    });

    // CSV preview (top 50)
    const headerCsv = ["ordem", "codigo", "descricao", "unidade", "quantidade", "preco_unitario", "valor_total"].join(";");
    const preview = [headerCsv]
      .concat(
        linhas.slice(0, 50).map((l) =>
          [l.ordem, l.codigo, `"${(l.descricao ?? "").replace(/"/g, '""')}"`, l.unidade, l.quantidade, l.preco_unitario, l.valor_total].join(";"),
        ),
      )
      .join("\n");

    const totalGeralNum = linhas.reduce((acc, l) => {
      const parsed = Number(String(l.valor_total).replace(sepMil, "").replace(sepDec, "."));
      return acc + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);

    return {
      portal: {
        nome: portal.nome,
        formato_preferido: portal.formato_preferido,
        encoding: portal.encoding,
        regras: {
          separador_decimal: sepDec,
          separador_milhar: sepMil,
          casas_decimais_qtd: casasQtd,
          casas_decimais_preco: casasPreco,
          max_chars_descricao: maxChars,
        },
      },
      proposta: { id: prop.id, nome: prop.titulo, valor_total: prop.valor_total },
      linhas_total: linhas.length,
      total_geral: formatNumero(totalGeralNum, casasPreco, sepDec, sepMil),
      alertas: alerts,
      preview_csv: preview,
      linhas_preview: linhas.slice(0, 20),
    };
  });

/* ============================== Protocolos ============================== */

export const listProtocolos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      status: z.string().optional(),
      proposta_id: z.string().uuid().optional(),
      portal_id: z.string().uuid().optional(),
    }).optional().parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await resolveCompanyId(supabase, userId);
    let q = supabase
      .from("portal_protocolos")
      .select("id, portal_id, proposta_id, edital_id, oportunidade_id, numero_protocolo, data_envio, status, comprovante_path, observacoes, created_at")
      .eq("company_id", companyId)
      .order("data_envio", { ascending: false })
      .limit(500);
    if (data?.status) q = q.eq("status", data.status);
    if (data?.proposta_id) q = q.eq("proposta_id", data.proposta_id);
    if (data?.portal_id) q = q.eq("portal_id", data.portal_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const upsertProtocolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      portal_id: z.string().uuid().nullable().optional(),
      proposta_id: z.string().uuid().nullable().optional(),
      edital_id: z.string().uuid().nullable().optional(),
      oportunidade_id: z.string().uuid().nullable().optional(),
      numero_protocolo: z.string().max(120).nullable().optional(),
      data_envio: z.string().optional(),
      status: z.enum(["rascunho", "enviado", "aceito", "recusado", "cancelado"]).default("enviado"),
      comprovante_path: z.string().max(500).nullable().optional(),
      observacoes: z.string().max(4000).nullable().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const payload = { ...data, company_id: companyId, created_by: userId };
    if (data.id) {
      const { error } = await supabase
        .from("portal_protocolos").update(payload).eq("id", data.id).eq("company_id", companyId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("portal_protocolos").insert(payload).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const excluirProtocolo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { error } = await supabase
      .from("portal_protocolos").delete().eq("id", data.id).eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Seed sugerido: insere portais padrões que ainda não existem */
export const seedPortaisSugeridos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as { supabase: AnySupabase; userId: string };
    const companyId = await requireEditor(supabase, userId);
    const { data: existing } = await supabase
      .from("portal_perfis").select("nome").eq("company_id", companyId);
    const existentes = new Set(((existing ?? []) as Array<{ nome: string }>).map((r) => r.nome));
    const novos = PORTAIS_SUGERIDOS.filter((p) => !existentes.has(p.nome)).map((p) => ({
      company_id: companyId,
      nome: p.nome,
      codigo: p.codigo,
      formato_preferido: p.formato_preferido,
      separador_decimal: "separador_decimal" in p ? p.separador_decimal : ",",
      encoding: "encoding" in p ? p.encoding : "UTF-8",
      url_portal: p.url_portal,
      max_chars_descricao: "max_chars_descricao" in p ? p.max_chars_descricao : null,
      created_by: userId,
    }));
    if (novos.length === 0) return { inseridos: 0 };
    const { error } = await supabase.from("portal_perfis").insert(novos);
    if (error) throw new Error(error.message);
    return { inseridos: novos.length };
  });
