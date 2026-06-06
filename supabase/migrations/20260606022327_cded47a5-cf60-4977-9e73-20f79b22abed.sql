
CREATE TABLE public.propostas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  edital_id UUID REFERENCES public.editais(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','em_revisao','aprovada','enviada','perdida','ganha')),
  valor_proposto NUMERIC(18,2),
  prazo_execucao_dias INTEGER,
  resumo_executivo TEXT,
  metodologia TEXT,
  equipe_tecnica TEXT,
  cronograma TEXT,
  diferenciais TEXT,
  observacoes TEXT,
  ai_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX propostas_company_idx ON public.propostas(company_id);
CREATE INDEX propostas_edital_idx ON public.propostas(edital_id);
CREATE INDEX propostas_status_idx ON public.propostas(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO authenticated;
GRANT ALL ON public.propostas TO service_role;

ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "propostas_select_member" ON public.propostas
  FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "propostas_insert_editor" ON public.propostas
  FOR INSERT TO authenticated
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "propostas_update_editor" ON public.propostas
  FOR UPDATE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "propostas_delete_admin" ON public.propostas
  FOR DELETE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin']));

CREATE TRIGGER propostas_set_updated_at
  BEFORE UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
