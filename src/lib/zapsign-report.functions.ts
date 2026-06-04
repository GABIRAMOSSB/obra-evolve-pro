import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export interface SignatureReportRow {
  id: string;
  obra_id: string;
  document_name: string;
  document_folder: string;
  status: string;
  sandbox: boolean;
  created_at: string;
  signed_at: string | null;
  expiration_date: string | null;
  signers_total: number;
  signers_signed: number;
  sign_duration_hours: number | null;
}

export interface SignatureReport {
  rows: SignatureReportRow[];
  totals: {
    total: number;
    signed: number;
    pending: number;
    refused: number;
    expired: number;
    canceled: number;
    avgSignDurationHours: number | null;
    completionRate: number;
  };
  byStatus: Array<{ status: string; count: number }>;
  byObra: Array<{ obra_id: string; total: number; signed: number }>;
  byDay: Array<{ day: string; created: number; signed: number }>;
}

const schema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.string().max(40).optional(),
  obraId: z.string().max(64).optional(),
});

export const getSignatureReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => schema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<SignatureReport> => {
    const { supabase } = context;

    let q = supabase
      .from("signature_requests")
      .select(
        "id, obra_id, document_name, document_folder, status, sandbox, created_at, signed_at, expiration_date",
      )
      .order("created_at", { ascending: false })
      .limit(2000);

    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.obraId) q = q.eq("obra_id", data.obraId);

    const { data: reqs, error } = await q;
    if (error) throw new Error(error.message);

    const ids = (reqs ?? []).map((r) => r.id);
    const signersAgg = new Map<string, { total: number; signed: number }>();
    if (ids.length) {
      const { data: signers } = await supabase
        .from("signature_signers")
        .select("signature_request_id, status")
        .in("signature_request_id", ids);
      for (const s of signers ?? []) {
        const cur = signersAgg.get(s.signature_request_id) ?? { total: 0, signed: 0 };
        cur.total += 1;
        if (s.status === "signed") cur.signed += 1;
        signersAgg.set(s.signature_request_id, cur);
      }
    }

    const rows: SignatureReportRow[] = (reqs ?? []).map((r) => {
      const a = signersAgg.get(r.id) ?? { total: 0, signed: 0 };
      let dur: number | null = null;
      if (r.signed_at && r.created_at) {
        const ms = new Date(r.signed_at).getTime() - new Date(r.created_at).getTime();
        if (ms > 0) dur = Math.round((ms / 36e5) * 10) / 10;
      }
      return {
        id: r.id,
        obra_id: r.obra_id,
        document_name: r.document_name,
        document_folder: r.document_folder,
        status: r.status,
        sandbox: r.sandbox,
        created_at: r.created_at,
        signed_at: r.signed_at,
        expiration_date: r.expiration_date,
        signers_total: a.total,
        signers_signed: a.signed,
        sign_duration_hours: dur,
      };
    });

    const totals = {
      total: rows.length,
      signed: 0,
      pending: 0,
      refused: 0,
      expired: 0,
      canceled: 0,
      avgSignDurationHours: null as number | null,
      completionRate: 0,
    };
    const byStatusMap = new Map<string, number>();
    const byObraMap = new Map<string, { total: number; signed: number }>();
    const byDayMap = new Map<string, { created: number; signed: number }>();
    let durSum = 0;
    let durCount = 0;

    for (const r of rows) {
      byStatusMap.set(r.status, (byStatusMap.get(r.status) ?? 0) + 1);
      const o = byObraMap.get(r.obra_id) ?? { total: 0, signed: 0 };
      o.total += 1;
      if (r.status === "signed") o.signed += 1;
      byObraMap.set(r.obra_id, o);

      const createdDay = r.created_at.slice(0, 10);
      const cd = byDayMap.get(createdDay) ?? { created: 0, signed: 0 };
      cd.created += 1;
      byDayMap.set(createdDay, cd);
      if (r.signed_at) {
        const sd = r.signed_at.slice(0, 10);
        const sdEntry = byDayMap.get(sd) ?? { created: 0, signed: 0 };
        sdEntry.signed += 1;
        byDayMap.set(sd, sdEntry);
      }

      if (r.status === "signed") totals.signed++;
      else if (r.status === "refused") totals.refused++;
      else if (r.status === "expired") totals.expired++;
      else if (r.status === "canceled") totals.canceled++;
      else totals.pending++;

      if (r.sign_duration_hours !== null) {
        durSum += r.sign_duration_hours;
        durCount++;
      }
    }
    if (durCount > 0) totals.avgSignDurationHours = Math.round((durSum / durCount) * 10) / 10;
    if (totals.total > 0) totals.completionRate = Math.round((totals.signed / totals.total) * 1000) / 10;

    return {
      rows,
      totals,
      byStatus: Array.from(byStatusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      byObra: Array.from(byObraMap.entries())
        .map(([obra_id, v]) => ({ obra_id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 20),
      byDay: Array.from(byDayMap.entries())
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day)),
    };
  });
