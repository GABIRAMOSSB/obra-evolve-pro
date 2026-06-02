CREATE TABLE public.parametros_financeiros (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL UNIQUE,
  iss_percent numeric NOT NULL DEFAULT 5.00,
  pis_percent numeric NOT NULL DEFAULT 0.65,
  cofins_percent numeric NOT NULL DEFAULT 3.00,
  irpj_percent numeric NOT NULL DEFAULT 4.80,
  csll_percent numeric NOT NULL DEFAULT 2.88,
  lucro_pretendido_percent numeric NOT NULL DEFAULT 25.00,
  encargos_mao_obra_percent numeric NOT NULL DEFAULT 100.00,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametros_financeiros TO authenticated;
GRANT ALL ON public.parametros_financeiros TO service_role;

ALTER TABLE public.parametros_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view parametros_financeiros"
ON public.parametros_financeiros FOR SELECT
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert parametros_financeiros"
ON public.parametros_financeiros FOR INSERT
WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE POLICY "Editors update parametros_financeiros"
ON public.parametros_financeiros FOR UPDATE
USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE POLICY "Admins delete parametros_financeiros"
ON public.parametros_financeiros FOR DELETE
USING (has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE OR REPLACE FUNCTION public.tg_parametros_financeiros_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_parametros_financeiros_updated_at
BEFORE UPDATE ON public.parametros_financeiros
FOR EACH ROW
EXECUTE FUNCTION public.tg_parametros_financeiros_updated_at();