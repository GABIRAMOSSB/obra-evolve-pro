
ALTER TABLE public.company_certificates
  ADD COLUMN IF NOT EXISTS obra_id uuid NULL REFERENCES public.obras(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contrato_id uuid NULL REFERENCES public.contratos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS company_certificates_obra_idx
  ON public.company_certificates(obra_id) WHERE obra_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS company_certificates_contrato_idx
  ON public.company_certificates(contrato_id) WHERE contrato_id IS NOT NULL;

-- Validação: vínculo deve pertencer à mesma empresa do certificado
CREATE OR REPLACE FUNCTION public.validate_certificate_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_obra_company uuid;
  v_contrato_company uuid;
BEGIN
  IF NEW.obra_id IS NOT NULL THEN
    SELECT company_id INTO v_obra_company FROM public.obras WHERE id = NEW.obra_id;
    IF v_obra_company IS NULL OR v_obra_company <> NEW.company_id THEN
      RAISE EXCEPTION 'Obra vinculada não pertence à mesma empresa do certificado';
    END IF;
  END IF;
  IF NEW.contrato_id IS NOT NULL THEN
    SELECT company_id INTO v_contrato_company FROM public.contratos WHERE id = NEW.contrato_id;
    IF v_contrato_company IS NULL OR v_contrato_company <> NEW.company_id THEN
      RAISE EXCEPTION 'Contrato vinculado não pertence à mesma empresa do certificado';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_certificate_scope ON public.company_certificates;
CREATE TRIGGER trg_validate_certificate_scope
  BEFORE INSERT OR UPDATE OF obra_id, contrato_id, company_id
  ON public.company_certificates
  FOR EACH ROW EXECUTE FUNCTION public.validate_certificate_scope();
