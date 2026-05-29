
-- ============ ESTOQUE ============

CREATE TABLE public.estoque_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id text,
  insumo_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('entrada', 'saida', 'ajuste', 'transferencia')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'nfe', 'apontamento', 'inventario')),
  data_movimento timestamptz NOT NULL DEFAULT now(),
  quantidade numeric NOT NULL,
  valor_unitario numeric NOT NULL DEFAULT 0,
  valor_total numeric NOT NULL DEFAULT 0,
  nota_fiscal_id uuid,
  nota_fiscal_item_id uuid,
  apontamento_id uuid,
  item_codigo text,
  item_descricao text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_estoque_mov_company_insumo ON public.estoque_movimentos(company_id, insumo_id);
CREATE INDEX idx_estoque_mov_obra ON public.estoque_movimentos(obra_id);
CREATE INDEX idx_estoque_mov_nfi ON public.estoque_movimentos(nota_fiscal_item_id);
CREATE INDEX idx_estoque_mov_data ON public.estoque_movimentos(data_movimento DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentos TO authenticated;
GRANT ALL ON public.estoque_movimentos TO service_role;

ALTER TABLE public.estoque_movimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view movimentos" ON public.estoque_movimentos
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert movimentos" ON public.estoque_movimentos
  FOR INSERT WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Editors update movimentos" ON public.estoque_movimentos
  FOR UPDATE USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Admins delete movimentos" ON public.estoque_movimentos
  FOR DELETE USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE TRIGGER trg_estoque_mov_updated
  BEFORE UPDATE ON public.estoque_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RPC: registrar entrada de NF-e ============
CREATE OR REPLACE FUNCTION public.registrar_entrada_nfe(_nota_id uuid, _obra_id text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company uuid;
  _count integer := 0;
  _item record;
BEGIN
  SELECT company_id INTO _company FROM notas_fiscais WHERE id = _nota_id;
  IF _company IS NULL THEN RAISE EXCEPTION 'nota_not_found'; END IF;
  IF NOT (has_company_role(auth.uid(), _company, 'admin'::company_role)
       OR has_company_role(auth.uid(), _company, 'editor'::company_role)) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR _item IN
    SELECT i.* FROM nota_fiscal_itens i
    WHERE i.nota_fiscal_id = _nota_id
      AND i.insumo_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM estoque_movimentos m
        WHERE m.nota_fiscal_item_id = i.id AND m.tipo = 'entrada'
      )
  LOOP
    INSERT INTO estoque_movimentos (
      company_id, obra_id, insumo_id, tipo, origem,
      quantidade, valor_unitario, valor_total,
      nota_fiscal_id, nota_fiscal_item_id,
      item_descricao, created_by
    ) VALUES (
      _company, COALESCE(_obra_id, (SELECT obra_id FROM notas_fiscais WHERE id = _nota_id)),
      _item.insumo_id, 'entrada', 'nfe',
      _item.quantidade, _item.valor_unitario, _item.valor_total,
      _nota_id, _item.id,
      _item.descricao, auth.uid()
    );
    _count := _count + 1;
  END LOOP;

  RETURN _count;
END $$;

-- ============ RPC: calcular saldo ============
CREATE OR REPLACE FUNCTION public.calcular_saldo_insumo(_company uuid, _insumo uuid, _obra text DEFAULT NULL)
RETURNS TABLE(saldo numeric, valor_medio numeric, ultimo_movimento timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN tipo IN ('entrada','ajuste') THEN quantidade
                      WHEN tipo IN ('saida','transferencia') THEN -quantidade END), 0) as saldo,
    CASE WHEN SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE 0 END) > 0
         THEN SUM(CASE WHEN tipo='entrada' THEN valor_total ELSE 0 END)
            / SUM(CASE WHEN tipo='entrada' THEN quantidade ELSE 0 END)
         ELSE 0 END as valor_medio,
    MAX(data_movimento) as ultimo_movimento
  FROM estoque_movimentos
  WHERE company_id = _company
    AND insumo_id = _insumo
    AND (_obra IS NULL OR obra_id = _obra)
    AND is_company_member(auth.uid(), _company);
$$;
