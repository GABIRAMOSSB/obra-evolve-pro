import { createFileRoute } from "@tanstack/react-router";
import { runReminderBatch } from "@/lib/zapsign-reminders.functions";

/**
 * Cron endpoint — called daily by pg_cron to send automatic reminders to
 * pending signers. Auth: ?secret=<ZAPSIGN_WEBHOOK_SECRET>.
 */
export const Route = createFileRoute("/api/public/zapsign-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const provided = url.searchParams.get("secret") ?? request.headers.get("x-cron-secret");
        const expected = process.env.ZAPSIGN_WEBHOOK_SECRET;
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        try {
          const result = await runReminderBatch();
          return Response.json({ ok: true, ...result });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () =>
        new Response("Use POST with ?secret=...", {
          status: 405,
          headers: { "Content-Type": "text/plain" },
        }),
    },
  },
});
