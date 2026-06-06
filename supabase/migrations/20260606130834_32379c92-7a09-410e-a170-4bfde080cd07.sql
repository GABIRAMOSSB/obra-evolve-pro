
-- Perfis de portal (regras de submissão por plataforma)
CREATE TABLE public.portal_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  codigo text,
  formato_preferido text NOT NULL DEFAULT 'xlsx' CHECK (formato_preferido IN ('xlsx','csv','pdf','txt','json','outro')),
  separador_decimal text NOT NULL DEFAULT ',' CHECK (separador_decimal IN (',','.')),
  separador_milhar text NOT NULL DEFAULT '.' CHECK (separador_milhar IN (',','.','')),
  casas_decimais_qtd int NOT NULL DEFAULT 4 CHECK (casas_decimais_qtd BETWEEN 0 AND 8),
  casas_decimais_preco int NOT NULL DEFAULT 2 CHECK (casas_decimais_preco BETWEEN 0 AND 8),
  encoding text NOT NULL DEFAULT 'UTF-8',
  max_chars_descricao int,
  exige_assinatura_digital boolean NOT NULL DEFAULT false,
  exige_planilha_modelo boolean NOT NULL DEFAULT false,
  url_portal text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, nome)
);
CREATE INDEX portal_perfis_company_idx ON public.portal_perfis(company_id, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_perfis TO authenticated;
GRANT ALL ON public.portal_perfis TO service_role;
ALTER TABLE public.portal_perfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select portal_perfis" ON public.portal_perfis FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_perfis.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert portal_perfis" ON public.portal_perfis FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_perfis.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update portal_perfis" ON public.portal_perfis FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_perfis.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete portal_perfis" ON public.portal_perfis FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_perfis.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

-- Protocolos de envio
CREATE TABLE public.portal_protocolos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  portal_id uuid REFERENCES public.portal_perfis(id) ON DELETE SET NULL,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  edital_id uuid REFERENCES public.editais(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  numero_protocolo text,
  data_envio timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('rascunho','enviado','aceito','recusado','cancelado')),
  comprovante_path text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX portal_protocolos_company_idx ON public.portal_protocolos(company_id, status, data_envio DESC);
CREATE INDEX portal_protocolos_proposta_idx ON public.portal_protocolos(proposta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_protocolos TO authenticated;
GRANT ALL ON public.portal_protocolos TO service_role;
ALTER TABLE public.portal_protocolos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select portal_protocolos" ON public.portal_protocolos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_protocolos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert portal_protocolos" ON public.portal_protocolos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_protocolos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update portal_protocolos" ON public.portal_protocolos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_protocolos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete portal_protocolos" ON public.portal_protocolos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = portal_protocolos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE TRIGGER trg_portal_perfis_updated BEFORE UPDATE ON public.portal_perfis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_portal_protocolos_updated BEFORE UPDATE ON public.portal_protocolos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
