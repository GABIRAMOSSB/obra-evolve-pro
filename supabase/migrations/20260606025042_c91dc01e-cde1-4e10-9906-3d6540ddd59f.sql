
CREATE TABLE public.aditivos_contratuais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('valor','prazo','escopo','misto')),
  valor_delta NUMERIC(18,2) NOT NULL DEFAULT 0,
  prazo_dias_delta INTEGER NOT NULL DEFAULT 0,
  data_assinatura DATE,
  justificativa TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','vigente','cancelado')),
  aplicado_em TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero)
);

CREATE INDEX aditivos_company_idx ON public.aditivos_contratuais(company_id);
CREATE INDEX aditivos_contrato_idx ON public.aditivos_contratuais(contrato_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.aditivos_contratuais TO authenticated;
GRANT ALL ON public.aditivos_contratuais TO service_role;

ALTER TABLE public.aditivos_contratuais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members select aditivos"
  ON public.aditivos_contratuais FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = aditivos_contratuais.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "editors insert aditivos"
  ON public.aditivos_contratuais FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = aditivos_contratuais.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "editors update aditivos"
  ON public.aditivos_contratuais FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = aditivos_contratuais.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "editors delete aditivos"
  ON public.aditivos_contratuais FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = aditivos_contratuais.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE TRIGGER update_aditivos_updated_at
  BEFORE UPDATE ON public.aditivos_contratuais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: aplicar/reverter efeito do aditivo no contrato quando status muda
CREATE OR REPLACE FUNCTION public.apply_aditivo_to_contrato()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_vigente BOOLEAN := (TG_OP = 'UPDATE' AND OLD.status = 'vigente');
  v_is_vigente  BOOLEAN := (NEW.status = 'vigente');
BEGIN
  IF NOT v_was_vigente AND v_is_vigente THEN
    UPDATE public.contratos
    SET valor_atualizado = COALESCE(valor_atualizado, valor_original, 0) + COALESCE(NEW.valor_delta, 0),
        data_fim_vigencia = CASE WHEN data_fim_vigencia IS NOT NULL AND NEW.prazo_dias_delta <> 0
                                 THEN data_fim_vigencia + NEW.prazo_dias_delta
                                 ELSE data_fim_vigencia END,
        updated_at = now()
    WHERE id = NEW.contrato_id;
    NEW.aplicado_em := now();
  ELSIF v_was_vigente AND NOT v_is_vigente THEN
    UPDATE public.contratos
    SET valor_atualizado = COALESCE(valor_atualizado, valor_original, 0) - COALESCE(OLD.valor_delta, 0),
        data_fim_vigencia = CASE WHEN data_fim_vigencia IS NOT NULL AND OLD.prazo_dias_delta <> 0
                                 THEN data_fim_vigencia - OLD.prazo_dias_delta
                                 ELSE data_fim_vigencia END,
        updated_at = now()
    WHERE id = NEW.contrato_id;
    NEW.aplicado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aditivos_apply_trigger
  BEFORE INSERT OR UPDATE OF status ON public.aditivos_contratuais
  FOR EACH ROW EXECUTE FUNCTION public.apply_aditivo_to_contrato();
