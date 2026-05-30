
-- Tabela de apropriações de itens de NF-e a composições do orçamento.
-- Cada linha = uma fatia da quantidade de um item de NF-e que foi alocada
-- a uma composição específica (item_codigo) de uma obra. Permite rateio:
-- ex. 100 sacos de cimento → 60 para "1.1 Fundação" + 40 para "2.3 Alvenaria".
CREATE TABLE public.nfe_item_apropriacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nota_fiscal_id uuid NOT NULL,
  nota_fiscal_item_id uuid NOT NULL,
  obra_id text NOT NULL,
  item_codigo text NOT NULL,
  item_descricao text,
  insumo_id uuid,
  descricao_insumo text NOT NULL,
  unidade text,
  quantidade numeric NOT NULL DEFAULT 0,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nfe_item_apropriacoes TO authenticated;
GRANT ALL ON public.nfe_item_apropriacoes TO service_role;

ALTER TABLE public.nfe_item_apropriacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view apropriacoes" ON public.nfe_item_apropriacoes
  FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert apropriacoes" ON public.nfe_item_apropriacoes
  FOR INSERT WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors update apropriacoes" ON public.nfe_item_apropriacoes
  FOR UPDATE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors delete apropriacoes" ON public.nfe_item_apropriacoes
  FOR DELETE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));

CREATE TRIGGER trg_apropriacoes_updated_at
  BEFORE UPDATE ON public.nfe_item_apropriacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_apropriacoes_company ON public.nfe_item_apropriacoes(company_id);
CREATE INDEX idx_apropriacoes_obra_item ON public.nfe_item_apropriacoes(obra_id, item_codigo);
CREATE INDEX idx_apropriacoes_nota_item ON public.nfe_item_apropriacoes(nota_fiscal_item_id);
