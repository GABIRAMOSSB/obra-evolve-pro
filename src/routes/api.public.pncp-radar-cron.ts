/**
 * Cron endpoint — coleta automática do Radar PNCP.
 *
 * Roda a cada hora (pg_cron). Seleciona apenas configurações cuja
 * `proxima_coleta <= now()` e status in (configurado, ativo). Cada empresa
 * recebe a sua janela de coleta de acordo com `frequencia_coleta_horas`.
 *
 * Autenticação: header `apikey` com o publishable key.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runCollection } from "@/lib/pncp-radar.server";

export const Route = createFileRoute("/api/public/pncp-radar-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? "";
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
        if (!apiKey || apiKey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const nowIso = new Date().toISOString();
        const { data: due, error } = await supabaseAdmin
          .from("pncp_configuracoes")
          .select("id, company_id, frequencia_coleta_horas, filtro_estado, filtro_modalidade, status")
          .lte("proxima_coleta", nowIso)
          .in("status", ["configurado", "ativo"])
          .limit(20);
        if (error) {
          return Response.json({ ok: false, error: error.message }, { status: 500 });
        }

        const results: Array<{ company_id: string; ok: boolean; novos: number; erro?: string }> = [];
        for (const cfg of due ?? []) {
          try {
            const r = await runCollection({
              client: supabaseAdmin,
              companyId: cfg.company_id as string,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              config: cfg as any,
            });
            results.push({
              company_id: cfg.company_id as string,
              ok: r.ok,
              novos: r.totalNovos,
              erro: r.erro,
            });
          } catch (e) {
            results.push({
              company_id: cfg.company_id as string,
              ok: false,
              novos: 0,
              erro: (e as Error).message,
            });
          }
        }
        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
