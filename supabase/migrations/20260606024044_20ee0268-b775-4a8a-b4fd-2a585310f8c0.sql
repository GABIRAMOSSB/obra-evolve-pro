CREATE TABLE public.medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  numero int NOT NULL,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  valor_executado numeric(18,2) NOT NULL DEFAULT 0,
  valor_acumulado numeric(18,2) NOT NULL DEFAULT 0,
  percentual_fisico numeric(6,3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','aprovada','paga','rejeitada')),
  observacoes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero)
);

CREATE INDEX medicoes_company_idx ON public.medicoes(company_id);
CREATE INDEX medicoes_contrato_idx ON public.medicoes(contrato_id);
CREATE INDEX medicoes_periodo_idx ON public.medicoes(company_id, periodo_inicio, periodo_fim);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicoes TO authenticated;
GRANT ALL ON public.medicoes TO service_role;

ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select medicoes" ON public.medicoes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = medicoes.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "Members insert medicoes" ON public.medicoes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = medicoes.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "Members update medicoes" ON public.medicoes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = medicoes.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "Members delete medicoes" ON public.medicoes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = medicoes.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

CREATE TRIGGER update_medicoes_updated_at BEFORE UPDATE ON public.medicoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();