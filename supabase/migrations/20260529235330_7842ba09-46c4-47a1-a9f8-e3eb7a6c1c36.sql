ALTER TABLE public.nota_fiscal_itens
  ADD COLUMN IF NOT EXISTS obra_id text,
  ADD COLUMN IF NOT EXISTS item_codigo text,
  ADD COLUMN IF NOT EXISTS item_descricao text;

CREATE INDEX IF NOT EXISTS idx_nfi_obra_item
  ON public.nota_fiscal_itens (company_id, obra_id, item_codigo);