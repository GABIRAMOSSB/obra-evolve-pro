
CREATE TABLE public.indices_economicos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  indice TEXT NOT NULL,
  mes_referencia DATE NOT NULL,
  valor_percentual NUMERIC(10,6) NOT NULL,
  fonte TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, indice, mes_referencia)
);
CREATE INDEX indices_company_idx ON public.indices_economicos(company_id, indice);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.indices_economicos TO authenticated;
GRANT ALL ON public.indices_economicos TO service_role;
ALTER TABLE public.indices_economicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members select indices" ON public.indices_economicos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = indices_economicos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert indices" ON public.indices_economicos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = indices_economicos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update indices" ON public.indices_economicos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = indices_economicos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete indices" ON public.indices_economicos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = indices_economicos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE TRIGGER update_indices_updated_at BEFORE UPDATE ON public.indices_economicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.reajustes_contratuais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  indice TEXT NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  percentual_acumulado NUMERIC(10,6) NOT NULL,
  valor_base NUMERIC(18,2) NOT NULL,
  valor_reajuste NUMERIC(18,2) NOT NULL,
  data_aplicacao DATE,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aplicado','cancelado')),
  aplicado_em TIMESTAMPTZ,
  observacoes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero)
);
CREATE INDEX reajustes_company_idx ON public.reajustes_contratuais(company_id);
CREATE INDEX reajustes_contrato_idx ON public.reajustes_contratuais(contrato_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reajustes_contratuais TO authenticated;
GRANT ALL ON public.reajustes_contratuais TO service_role;
ALTER TABLE public.reajustes_contratuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members select reajustes" ON public.reajustes_contratuais FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = reajustes_contratuais.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert reajustes" ON public.reajustes_contratuais FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = reajustes_contratuais.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update reajustes" ON public.reajustes_contratuais FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = reajustes_contratuais.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete reajustes" ON public.reajustes_contratuais FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = reajustes_contratuais.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE TRIGGER update_reajustes_updated_at BEFORE UPDATE ON public.reajustes_contratuais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_reajuste_to_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_aplicado BOOLEAN := (TG_OP = 'UPDATE' AND OLD.status = 'aplicado');
  v_is_aplicado  BOOLEAN := (NEW.status = 'aplicado');
BEGIN
  IF NOT v_was_aplicado AND v_is_aplicado THEN
    UPDATE public.contratos
    SET valor_atualizado = COALESCE(valor_atualizado, valor_original, 0) + COALESCE(NEW.valor_reajuste, 0),
        updated_at = now()
    WHERE id = NEW.contrato_id;
    NEW.aplicado_em := now();
    NEW.data_aplicacao := COALESCE(NEW.data_aplicacao, CURRENT_DATE);
  ELSIF v_was_aplicado AND NOT v_is_aplicado THEN
    UPDATE public.contratos
    SET valor_atualizado = COALESCE(valor_atualizado, valor_original, 0) - COALESCE(OLD.valor_reajuste, 0),
        updated_at = now()
    WHERE id = NEW.contrato_id;
    NEW.aplicado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reajustes_apply_trigger
  BEFORE INSERT OR UPDATE OF status ON public.reajustes_contratuais
  FOR EACH ROW EXECUTE FUNCTION public.apply_reajuste_to_contrato();
