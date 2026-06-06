
-- Dossiês: bundle de documentos para habilitação
CREATE TABLE public.dossies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  escopo text NOT NULL DEFAULT 'habilitacao',
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','finalizado','arquivado')),
  edital_id uuid REFERENCES public.editais(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dossies_company_idx ON public.dossies(company_id, status);
CREATE INDEX dossies_edital_idx ON public.dossies(edital_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossies TO authenticated;
GRANT ALL ON public.dossies TO service_role;
ALTER TABLE public.dossies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select dossies" ON public.dossies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossies.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert dossies" ON public.dossies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossies.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update dossies" ON public.dossies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossies.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete dossies" ON public.dossies FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossies.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

-- Itens do dossiê
CREATE TABLE public.dossie_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossie_id uuid NOT NULL REFERENCES public.dossies(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('certidao','biblioteca','procuracao','proposta','contrato','template','arquivo')),
  ref_id uuid,
  ref_table text,
  titulo text NOT NULL,
  descricao text,
  storage_path text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX dossie_itens_dossie_idx ON public.dossie_itens(dossie_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossie_itens TO authenticated;
GRANT ALL ON public.dossie_itens TO service_role;
ALTER TABLE public.dossie_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select dossie_itens" ON public.dossie_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossie_itens.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert dossie_itens" ON public.dossie_itens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossie_itens.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update dossie_itens" ON public.dossie_itens FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossie_itens.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete dossie_itens" ON public.dossie_itens FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = dossie_itens.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

-- Templates de documento
CREATE TABLE public.document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT 'declaracao',
  descricao text,
  conteudo text NOT NULL DEFAULT '',
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_templates_company_idx ON public.document_templates(company_id, categoria, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_templates TO authenticated;
GRANT ALL ON public.document_templates TO service_role;
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select document_templates" ON public.document_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = document_templates.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert document_templates" ON public.document_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = document_templates.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update document_templates" ON public.document_templates FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = document_templates.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete document_templates" ON public.document_templates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = document_templates.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

-- updated_at triggers
CREATE TRIGGER trg_dossies_updated BEFORE UPDATE ON public.dossies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_dossie_itens_updated BEFORE UPDATE ON public.dossie_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_document_templates_updated BEFORE UPDATE ON public.document_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
