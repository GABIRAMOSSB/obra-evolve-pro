/**
 * Obras (normalized) — Fase 2.
 *
 * Espelha as obras do JSONB legado (company_workspaces.workspace.obras)
 * para a tabela relacional `obras`, preservando 100% do BM atual (que
 * continua lendo o blob). Também lista contratos e obras já normalizados.
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
    throw new Error("Permissão insuficiente. Apenas admin/editor pode sincronizar obras.");
  }
  return data.company_id as string;
}

export interface ObraRow {
  id: string;
  legacy_obra_id: string | null;
  codigo: string | null;
  nome: string;
  cliente: string | null;
  cnpj_cliente: string | null;
  cidade: string | null;
  uf: string | null;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  valor_contratado: number | null;
  status: string;
  origem: string;
  contratos_count: number;
  created_at: string;
  updated_at: string;
}

export const listObras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ObraRow[]> => {
    const { supabase } = context;
    const companyId = await resolveCompanyId(supabase, context.userId);

    const { data: obras, error } = await supabase
      .from("obras")
      .select("id, legacy_obra_id, codigo, nome, cliente, cnpj_cliente, cidade, uf, data_inicio, data_fim_prevista, valor_contratado, status, origem, created_at, updated_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (obras ?? []).map((o: { id: string }) => o.id);
    let counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: ctos } = await supabase
        .from("contratos")
        .select("obra_id")
        .in("obra_id", ids);
      counts = new Map();
      for (const c of (ctos ?? []) as Array<{ obra_id: string | null }>) {
        if (c.obra_id) counts.set(c.obra_id, (counts.get(c.obra_id) ?? 0) + 1);
      }
    }
    return (obras ?? []).map((o: Record<string, unknown>) => ({
      ...(o as unknown as ObraRow),
      contratos_count: counts.get(o.id as string) ?? 0,
    }));
  });

interface SyncResult {
  total_jsonb: number;
  inserted: number;
  updated: number;
  contratos_inserted: number;
  contratos_updated: number;
  skipped: number;
  errors: string[];
}

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

function pickDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  return s.slice(0, 10);
}

function pickNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export const syncObrasFromWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SyncResult> => {
    const { supabase: supabaseTyped } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseTyped as any;
    const companyId = await requireEditor(supabase, context.userId);

    const { data: ws, error: wsErr } = await supabase
      .from("company_workspaces")
      .select("workspace")
      .eq("company_id", companyId)
      .maybeSingle();
    if (wsErr) throw new Error(wsErr.message);

    const obrasJson = (ws?.workspace as { obras?: unknown[] } | null)?.obras ?? [];
    const result: SyncResult = {
      total_jsonb: obrasJson.length,
      inserted: 0,
      updated: 0,
      contratos_inserted: 0,
      contratos_updated: 0,
      skipped: 0,
      errors: [],
    };

    for (const raw of obrasJson) {
      const obra = raw as Record<string, unknown>;
      const legacyId = typeof obra.id === "string" ? obra.id : null;
      const info = (obra.info ?? {}) as Record<string, unknown>;
      const nome = pickStr(obra.nome, info.nome, info.cliente, info.contratante, legacyId);
      if (!legacyId || !nome) {
        result.skipped += 1;
        continue;
      }

      const payload = {
        company_id: companyId,
        legacy_obra_id: legacyId,
        codigo: pickStr(info.codigo, obra.codigo),
        nome,
        cliente: pickStr(info.contratante, info.cliente),
        cnpj_cliente: pickStr(info.cnpj, info.cnpjCliente),
        endereco: pickStr(info.endereco),
        cidade: pickStr(info.municipio, info.cidade),
        uf: pickStr(info.estado, info.uf),
        data_inicio: pickDate(info.dataInicioObra),
        valor_contratado: pickNumber(info.valorContrato),
        origem: "workspace_sync" as const,
        status: "ativa" as const,
        created_by: context.userId,
        metadata: { info },
      };



      const { data: existing } = await supabase
        .from("obras")
        .select("id")
        .eq("company_id", companyId)
        .eq("legacy_obra_id", legacyId)
        .maybeSingle();

      let obraId: string | null = null;
      if (existing?.id) {
        const { error } = await supabase
          .from("obras")
          .update({
            codigo: payload.codigo,
            nome: payload.nome,
            cliente: payload.cliente,
            cnpj_cliente: payload.cnpj_cliente,
            endereco: payload.endereco,
            cidade: payload.cidade,
            uf: payload.uf,
            data_inicio: payload.data_inicio,
            valor_contratado: payload.valor_contratado,
            metadata: payload.metadata,
          })
          .eq("id", existing.id);
        if (error) {
          result.errors.push(`update ${legacyId}: ${error.message}`);
          continue;
        }
        obraId = existing.id;
        result.updated += 1;
      } else {
        const { data: ins, error } = await supabase
          .from("obras")
          .insert(payload)
          .select("id")
          .single();
        if (error) {
          result.errors.push(`insert ${legacyId}: ${error.message}`);
          continue;
        }
        obraId = ins.id;
        result.inserted += 1;
      }

      // Espelha contrato principal (se houver numeroContrato)
      const numeroContrato = pickStr(info.numeroContrato);
      if (obraId && numeroContrato) {
        const ctPayload = {
          company_id: companyId,
          obra_id: obraId,
          numero: numeroContrato,
          orgao_contratante: pickStr(info.contratante),
          cnpj_orgao: pickStr(info.cnpjContratante),
          processo_administrativo: pickStr(info.processoAdministrativo, info.numeroLicitacao),
          modalidade: pickStr(info.modalidade),
          objeto: pickStr(info.objeto),
          data_assinatura: pickDate(info.dataAssinatura),
          data_inicio_vigencia: pickDate(info.dataInicioObra),
          valor_original: pickNumber(info.valorContrato),
          origem: "manual" as const,
          status: "vigente" as const,
          created_by: context.userId,
        };
        const { data: existCt } = await supabase
          .from("contratos")
          .select("id")
          .eq("company_id", companyId)
          .eq("numero", numeroContrato)
          .maybeSingle();
        if (existCt?.id) {
          const { error } = await supabase
            .from("contratos")
            .update({
              obra_id: ctPayload.obra_id,
              orgao_contratante: ctPayload.orgao_contratante,
              cnpj_orgao: ctPayload.cnpj_orgao,
              processo_administrativo: ctPayload.processo_administrativo,
              modalidade: ctPayload.modalidade,
              objeto: ctPayload.objeto,
              data_assinatura: ctPayload.data_assinatura,
              data_inicio_vigencia: ctPayload.data_inicio_vigencia,
              valor_original: ctPayload.valor_original,
            })
            .eq("id", existCt.id);
          if (!error) result.contratos_updated += 1;
          else result.errors.push(`contrato update ${numeroContrato}: ${error.message}`);
        } else {
          const { error } = await supabase.from("contratos").insert(ctPayload);
          if (!error) result.contratos_inserted += 1;
          else result.errors.push(`contrato insert ${numeroContrato}: ${error.message}`);
        }
      }
    }

    return result;
  });

const updateObraSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["ativa", "paralisada", "concluida", "cancelada", "planejamento"]).optional(),
  codigo: z.string().max(64).nullable().optional(),
  cliente: z.string().max(255).nullable().optional(),
});

export const updateObra = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateObraSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase: supabaseTyped } = context;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = supabaseTyped as any;
    const companyId = await requireEditor(supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.status) patch.status = data.status;
    if (data.codigo !== undefined) patch.codigo = data.codigo;
    if (data.cliente !== undefined) patch.cliente = data.cliente;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("obras")
      .update(patch)
      .eq("id", data.id)
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
