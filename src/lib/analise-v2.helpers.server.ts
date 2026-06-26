// Helpers para getAnaliseV2 — separados do .functions.ts para evitar
// ReferenceError do tss-serverfn-split (handlers não podem usar siblings).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

export type EvolInfo = { somaQtd: number; dataInicio: string | null; dataFim: string | null };

export async function resolveCompany(supabase: AnySupabase, userId: string): Promise<string> {
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

export async function loadEvolutionsMap(
  supabase: AnySupabase,
  companyId: string,
  legacyObraId: string,
): Promise<Map<string, EvolInfo>> {
  const map = new Map<string, EvolInfo>();
  try {
    const { data: ws } = await supabase
      .from("company_workspaces")
      .select("workspace")
      .eq("company_id", companyId)
      .maybeSingle();
    const obras = (ws?.workspace?.obras ?? []) as Array<{
      id?: string;
      evolutions?: Record<string, { measurements?: Array<{ quantExec?: number; dataExec?: string; closed?: boolean }> }>;
    }>;
    const obra = obras.find((o) => String(o?.id) === legacyObraId);
    const evolutions = obra?.evolutions ?? {};
    for (const [item, ev] of Object.entries(evolutions)) {
      const meas = ev?.measurements ?? [];
      if (!meas.length) continue;
      let soma = 0;
      let dMin: string | null = null;
      let dMax: string | null = null;
      for (const m of meas) {
        soma += Number(m?.quantExec) || 0;
        const d = m?.dataExec ?? null;
        if (d) {
          if (!dMin || d < dMin) dMin = d;
          if (!dMax || d > dMax) dMax = d;
        }
      }
      map.set(String(item), { somaQtd: soma, dataInicio: dMin, dataFim: dMax });
    }
  } catch {
    // degrada silenciosamente
  }
  return map;
}
