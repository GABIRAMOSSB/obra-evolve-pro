
-- F8: Cronograma físico-financeiro
CREATE TABLE public.cronogramas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  data_inicio date,
  prazo_dias integer,
  numero_periodos integer NOT NULL DEFAULT 1,
  unidade_periodo text NOT NULL DEFAULT 'mes',
  is_baseline boolean NOT NULL DEFAULT false,
  versao integer NOT NULL DEFAULT 1,
  parent_id uuid REFERENCES public.cronogramas(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'rascunho',
  valor_total numeric(18,2) NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cronograma_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cronograma_id uuid NOT NULL REFERENCES public.cronogramas(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  codigo text,
  descricao text NOT NULL,
  valor_etapa numeric(18,2) NOT NULL DEFAULT 0,
  peso_percent numeric(9,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cronograma_periodos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cronograma_id uuid NOT NULL REFERENCES public.cronogramas(id) ON DELETE CASCADE,
  etapa_id uuid NOT NULL REFERENCES public.cronograma_etapas(id) ON DELETE CASCADE,
  periodo_idx integer NOT NULL,
  percent_fisico numeric(9,6) NOT NULL DEFAULT 0,
  valor_financeiro numeric(18,2) NOT NULL DEFAULT 0,
  percent_realizado numeric(9,6),
  valor_realizado numeric(18,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (etapa_id, periodo_idx)
);

CREATE INDEX idx_cronogramas_company ON public.cronogramas(company_id);
CREATE INDEX idx_cronogramas_obra ON public.cronogramas(obra_id);
CREATE INDEX idx_cronogramas_proposta ON public.cronogramas(proposta_id);
CREATE INDEX idx_cron_etapas_cron ON public.cronograma_etapas(cronograma_id);
CREATE INDEX idx_cron_periodos_cron ON public.cronograma_periodos(cronograma_id);
CREATE INDEX idx_cron_periodos_etapa ON public.cronograma_periodos(etapa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronogramas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_etapas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cronograma_periodos TO authenticated;
GRANT ALL ON public.cronogramas TO service_role;
GRANT ALL ON public.cronograma_etapas TO service_role;
GRANT ALL ON public.cronograma_periodos TO service_role;

ALTER TABLE public.cronogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_periodos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cron_select" ON public.cronogramas FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "cron_insert" ON public.cronogramas FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "cron_update" ON public.cronogramas FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "cron_delete" ON public.cronogramas FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));

CREATE POLICY "cron_et_select" ON public.cronograma_etapas FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "cron_et_insert" ON public.cronograma_etapas FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "cron_et_update" ON public.cronograma_etapas FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "cron_et_delete" ON public.cronograma_etapas FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));

CREATE POLICY "cron_pe_select" ON public.cronograma_periodos FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "cron_pe_insert" ON public.cronograma_periodos FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "cron_pe_update" ON public.cronograma_periodos FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));
CREATE POLICY "cron_pe_delete" ON public.cronograma_periodos FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid() AND role IN ('admin','editor')));

-- Recalcula valores agregados do cronograma e da etapa
CREATE OR REPLACE FUNCTION public.recalc_cronograma_totals(p_cronograma_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric(18,2);
BEGIN
  -- atualiza valor_financeiro de cada período = valor_etapa * percent_fisico/100
  UPDATE public.cronograma_periodos p
     SET valor_financeiro = round(coalesce(e.valor_etapa,0) * coalesce(p.percent_fisico,0) / 100.0, 2),
         updated_at = now()
    FROM public.cronograma_etapas e
   WHERE p.etapa_id = e.id
     AND p.cronograma_id = p_cronograma_id;

  SELECT coalesce(sum(valor_etapa),0) INTO v_total
    FROM public.cronograma_etapas WHERE cronograma_id = p_cronograma_id;

  UPDATE public.cronogramas SET valor_total = v_total, updated_at = now()
   WHERE id = p_cronograma_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalc_cronograma_totals(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.recalc_cronograma_totals(uuid) TO authenticated;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_cron_upd BEFORE UPDATE ON public.cronogramas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cron_et_upd BEFORE UPDATE ON public.cronograma_etapas
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_cron_pe_upd BEFORE UPDATE ON public.cronograma_periodos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
