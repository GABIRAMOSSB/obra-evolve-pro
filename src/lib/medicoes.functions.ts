/**
 * Medições / boletins de obra — Fase 10.
 *
 * Gera e mantém medições mensais por contrato, consolidando valor
 * executado no período (a partir de notas fiscais apropriadas e mão de
 * obra apontada vinculada à obra do contrato).
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

export const listMedicoes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId);

    const [medRes, contratosRes] = await Promise.all([
      supabase
        .from("medicoes")
        .select("id, contrato_id, obra_id, numero, periodo_inicio, periodo_fim, valor_executado, valor_acumulado, percentual_fisico, status, observacoes, created_at")
        .eq("company_id", companyId)
        .order("periodo_inicio", { ascending: false }),
      supabase
        .from("contratos")
        .select("id, numero, objeto, orgao_contratante, obra_id, valor_atualizado, valor_original, status")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);
    if (medRes.error) throw new Error(medRes.error.message);
    if (contratosRes.error) throw new Error(contratosRes.error.message);

    const contratos = contratosRes.data ?? [];
    const medicoes = medRes.data ?? [];
    const byContrato = new Map<string, typeof medicoes>();
    for (const m of medicoes) {
      const arr = byContrato.get(m.contrato_id) ?? [];
      arr.push(m);
      byContrato.set(m.contrato_id, arr);
    }

    return { contratos, medicoes, byContrato: Object.fromEntries(byContrato) };
  });

const gerarSchema = z.object({
  contrato_id: z.string().uuid(),
  periodo_inicio: z.string().min(8),
  periodo_fim: z.string().min(8),
  observacoes: z.string().max(2000).optional(),
});

export const gerarMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => gerarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);

    const { data: contrato, error: cErr } = await supabase
      .from("contratos")
      .select("id, obra_id, valor_atualizado, valor_original")
      .eq("id", data.contrato_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!contrato) throw new Error("Contrato não encontrado.");

    const obraId: string | null = contrato.obra_id;

    // Soma NFe apropriadas no período (por obra do contrato)
    let nfeTotal = 0;
    let moTotal = 0;
    if (obraId) {
      const { data: nfeRows } = await supabase
        .from("nfe_item_apropriacoes")
        .select("valor_apropriado, created_at")
        .eq("company_id", companyId)
        .eq("obra_id", obraId)
        .gte("created_at", data.periodo_inicio)
        .lte("created_at", `${data.periodo_fim}T23:59:59`);
      nfeTotal = (nfeRows ?? []).reduce((s: number, r: { valor_apropriado: number | string }) => s + Number(r.valor_apropriado || 0), 0);

      const { data: moRows } = await supabase
        .from("apontamentos_mao_obra")
        .select("custo_total, data")
        .eq("company_id", companyId)
        .eq("obra_id", obraId)
        .gte("data", data.periodo_inicio)
        .lte("data", data.periodo_fim);
      moTotal = (moRows ?? []).reduce((s: number, r: { custo_total: number | string | null }) => s + Number(r.custo_total || 0), 0);
    }

    const valorExecutado = Number((nfeTotal + moTotal).toFixed(2));

    // Acumulado = soma das medições anteriores + esta
    const { data: anteriores } = await supabase
      .from("medicoes")
      .select("valor_executado, numero")
      .eq("company_id", companyId)
      .eq("contrato_id", data.contrato_id);
    const acumuladoAnterior = (anteriores ?? []).reduce(
      (s: number, r: { valor_executado: number | string }) => s + Number(r.valor_executado || 0),
      0,
    );
    const proximoNumero = ((anteriores ?? []).reduce((m: number, r: { numero: number }) => Math.max(m, r.numero), 0) ?? 0) + 1;
    const valorAcumulado = Number((acumuladoAnterior + valorExecutado).toFixed(2));

    const base = Number(contrato.valor_atualizado || contrato.valor_original || 0);
    const percentualFisico = base > 0 ? Number(((valorAcumulado / base) * 100).toFixed(3)) : 0;

    const { data: created, error } = await supabase
      .from("medicoes")
      .insert({
        company_id: companyId,
        contrato_id: data.contrato_id,
        obra_id: obraId,
        numero: proximoNumero,
        periodo_inicio: data.periodo_inicio,
        periodo_fim: data.periodo_fim,
        valor_executado: valorExecutado,
        valor_acumulado: valorAcumulado,
        percentual_fisico: percentualFisico,
        observacoes: data.observacoes ?? null,
        metadata: { nfe: nfeTotal, mao_obra: moTotal },
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id as string, valor_executado: valorExecutado, valor_acumulado: valorAcumulado, percentual_fisico: percentualFisico };
  });

const statusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["rascunho", "enviada", "aprovada", "paga", "rejeitada"]),
});

export const atualizarStatusMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => statusSchema.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("medicoes")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);

    if (data.status === "aprovada" || data.status === "paga" || data.status === "rejeitada") {
      const { data: med } = await supabase
        .from("medicoes")
        .select("numero, obra_id")
        .eq("id", data.id)
        .maybeSingle();
      const numero = med?.numero ?? "";
      const titleMap: Record<string, string> = {
        aprovada: `Medição ${numero} aprovada`,
        paga: `Medição ${numero} marcada como paga`,
        rejeitada: `Medição ${numero} rejeitada`,
      };
      await supabase.from("notifications").insert({
        company_id: companyId,
        kind: `medicao_${data.status}`,
        title: titleMap[data.status],
        body: null,
        link: `/medicoes/${data.id}`,
      });
    }
    return { ok: true };
  });


export const excluirMedicao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as AnySupabase;
    const companyId = await resolveCompany(supabase, context.userId, true);
    const { error } = await supabase
      .from("medicoes")
      .delete()
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
