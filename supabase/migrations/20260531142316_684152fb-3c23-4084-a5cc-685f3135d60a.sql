-- Tabela de composições próprias (compostas pelo usuário, reutilizáveis no orçamento)
CREATE TABLE public.composicoes_proprias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'UN',
  custo_total NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicoes_proprias TO authenticated;
GRANT ALL ON public.composicoes_proprias TO service_role;

ALTER TABLE public.composicoes_proprias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view composicoes_proprias"
  ON public.composicoes_proprias FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert composicoes_proprias"
  ON public.composicoes_proprias FOR INSERT
  WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE POLICY "Editors update composicoes_proprias"
  ON public.composicoes_proprias FOR UPDATE
  USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE POLICY "Editors delete composicoes_proprias"
  ON public.composicoes_proprias FOR DELETE
  USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE TRIGGER trg_composicoes_proprias_updated
  BEFORE UPDATE ON public.composicoes_proprias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabela de insumos das composições próprias
CREATE TABLE public.composicoes_proprias_insumos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  composicao_id UUID NOT NULL REFERENCES public.composicoes_proprias(id) ON DELETE CASCADE,
  insumo_id UUID,
  descricao TEXT NOT NULL,
  unidade TEXT,
  coeficiente NUMERIC NOT NULL DEFAULT 1,
  custo_unitario NUMERIC NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.composicoes_proprias_insumos TO authenticated;
GRANT ALL ON public.composicoes_proprias_insumos TO service_role;

ALTER TABLE public.composicoes_proprias_insumos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view composicoes_proprias_insumos"
  ON public.composicoes_proprias_insumos FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert composicoes_proprias_insumos"
  ON public.composicoes_proprias_insumos FOR INSERT
  WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE POLICY "Editors update composicoes_proprias_insumos"
  ON public.composicoes_proprias_insumos FOR UPDATE
  USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE POLICY "Editors delete composicoes_proprias_insumos"
  ON public.composicoes_proprias_insumos FOR DELETE
  USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE TRIGGER trg_composicoes_proprias_insumos_updated
  BEFORE UPDATE ON public.composicoes_proprias_insumos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_composicoes_proprias_company ON public.composicoes_proprias(company_id);
CREATE INDEX idx_composicoes_proprias_insumos_comp ON public.composicoes_proprias_insumos(composicao_id);