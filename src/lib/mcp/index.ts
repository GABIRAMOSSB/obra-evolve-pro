import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listObras from "./tools/list-obras";
import listOportunidades from "./tools/list-oportunidades";
import listContratos from "./tools/list-contratos";

// The OAuth issuer must be the direct Supabase host. Read the project ref
// from VITE_SUPABASE_PROJECT_ID (Vite inlines it as a build-time literal);
// the fallback keeps the issuer well-formed during manifest extraction.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "solv-gestao-mcp",
  title: "SOLV Gestão",
  version: "0.1.0",
  instructions:
    "Ferramentas de leitura sobre obras, contratos e oportunidades de licitação (PNCP) do SOLV Gestão. Todas as consultas respeitam a empresa e as permissões (RLS) do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listObras, listOportunidades, listContratos],
});
