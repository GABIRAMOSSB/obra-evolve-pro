import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_oportunidades",
  title: "Listar oportunidades (PNCP)",
  description: "Lista oportunidades de licitação coletadas do PNCP para a empresa do usuário.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Máximo a retornar (padrão 20)."),
    uf: z.string().optional().describe("Filtro opcional por UF (ex: 'SP')."),
    situacao: z.string().optional().describe("Filtro opcional por situação (ex: 'triagem')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, uf, situacao }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("oportunidades")
      .select(
        "id, pncp_id, orgao_nome, uf, municipio, modalidade, objeto, valor_estimado, data_encerramento_propostas, situacao, prioridade, link_sistema_origem",
      )
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .limit(limit ?? 20);
    if (uf) q = q.eq("uf", uf);
    if (situacao) q = q.eq("situacao", situacao);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { oportunidades: data ?? [] },
    };
  },
});
