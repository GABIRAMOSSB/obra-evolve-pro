
-- Fase 7 — Propostas com itens, readequação e carta proposta

-- 1) Extensões em propostas
ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'original',
  ADD COLUMN IF NOT EXISTS proposta_origem_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bdi_percent numeric(7,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS encargos_percent numeric(7,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_referencia date,
  ADD COLUMN IF NOT EXISTS valor_itens numeric(18,2),
  ADD COLUMN IF NOT EXISTS valor_total numeric(18,2);

DO $$ BEGIN
  ALTER TABLE public.propostas DROP CONSTRAINT IF EXISTS propostas_tipo_check;
  ALTER TABLE public.propostas ADD CONSTRAINT propostas_tipo_check CHECK (tipo IN ('original','readequada'));
END $$;

CREATE INDEX IF NOT EXISTS propostas_origem_idx ON public.propostas(proposta_origem_id);

-- 2) proposta_itens
CREATE TABLE IF NOT EXISTS public.proposta_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  item_pai_id uuid REFERENCES public.proposta_itens(id) ON DELETE CASCADE,
  codigo text,
  descricao text NOT NULL,
  unidade text,
  quantidade numeric(18,4) NOT NULL DEFAULT 0,
  preco_unitario numeric(18,4) NOT NULL DEFAULT 0,
  preco_total numeric(18,2) GENERATED ALWAYS AS (round(quantidade * preco_unitario, 2)) STORED,
  insumo_id uuid REFERENCES public.insumos_mestre(id) ON DELETE SET NULL,
  composicao_id uuid REFERENCES public.composicoes_proprias(id) ON DELETE SET NULL,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_itens TO authenticated;
GRANT ALL ON public.proposta_itens TO service_role;

ALTER TABLE public.proposta_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY proposta_itens_select ON public.proposta_itens FOR SELECT TO authenticated
  USING (is_company_member(company_id));
CREATE POLICY proposta_itens_insert ON public.proposta_itens FOR INSERT TO authenticated
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY proposta_itens_update ON public.proposta_itens FOR UPDATE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY proposta_itens_delete ON public.proposta_itens FOR DELETE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']));

CREATE INDEX IF NOT EXISTS proposta_itens_proposta_idx ON public.proposta_itens(proposta_id, ordem);
CREATE INDEX IF NOT EXISTS proposta_itens_company_idx ON public.proposta_itens(company_id);

CREATE TRIGGER proposta_itens_set_updated_at
  BEFORE UPDATE ON public.proposta_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) proposta_readequacao_residuos
CREATE TABLE IF NOT EXISTS public.proposta_readequacao_residuos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_readequada_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  proposta_origem_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_origem_id uuid REFERENCES public.proposta_itens(id) ON DELETE SET NULL,
  item_readequado_id uuid REFERENCES public.proposta_itens(id) ON DELETE SET NULL,
  codigo text,
  descricao text NOT NULL,
  unidade text,
  qtd_origem numeric(18,4) NOT NULL DEFAULT 0,
  qtd_readequada numeric(18,4) NOT NULL DEFAULT 0,
  preco_origem numeric(18,4) NOT NULL DEFAULT 0,
  preco_readequado numeric(18,4) NOT NULL DEFAULT 0,
  delta_valor numeric(18,2) GENERATED ALWAYS AS (
    round((qtd_readequada * preco_readequado) - (qtd_origem * preco_origem), 2)
  ) STORED,
  justificativa text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_readequacao_residuos TO authenticated;
GRANT ALL ON public.proposta_readequacao_residuos TO service_role;

ALTER TABLE public.proposta_readequacao_residuos ENABLE ROW LEVEL SECURITY;

CREATE POLICY prr_select ON public.proposta_readequacao_residuos FOR SELECT TO authenticated
  USING (is_company_member(company_id));
CREATE POLICY prr_insert ON public.proposta_readequacao_residuos FOR INSERT TO authenticated
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY prr_update ON public.proposta_readequacao_residuos FOR UPDATE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY prr_delete ON public.proposta_readequacao_residuos FOR DELETE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']));

CREATE INDEX IF NOT EXISTS prr_readequada_idx ON public.proposta_readequacao_residuos(proposta_readequada_id);
CREATE INDEX IF NOT EXISTS prr_company_idx ON public.proposta_readequacao_residuos(company_id);

-- 4) cartas_proposta
CREATE TABLE IF NOT EXISTS public.cartas_proposta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  versao integer NOT NULL DEFAULT 1,
  conteudo_md text NOT NULL,
  conteudo_html text,
  hash_sha256 text,
  validade_dias integer DEFAULT 60,
  condicoes_pagamento text,
  prazo_execucao_dias integer,
  storage_path text,
  signature_request_id uuid REFERENCES public.signature_requests(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartas_proposta TO authenticated;
GRANT ALL ON public.cartas_proposta TO service_role;

ALTER TABLE public.cartas_proposta ENABLE ROW LEVEL SECURITY;

CREATE POLICY cartas_select ON public.cartas_proposta FOR SELECT TO authenticated
  USING (is_company_member(company_id));
CREATE POLICY cartas_insert ON public.cartas_proposta FOR INSERT TO authenticated
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY cartas_update ON public.cartas_proposta FOR UPDATE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY cartas_delete ON public.cartas_proposta FOR DELETE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin']));

CREATE INDEX IF NOT EXISTS cartas_proposta_idx ON public.cartas_proposta(proposta_id, versao DESC);
CREATE INDEX IF NOT EXISTS cartas_company_idx ON public.cartas_proposta(company_id);

CREATE TRIGGER cartas_proposta_set_updated_at
  BEFORE UPDATE ON public.cartas_proposta
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) função para recalcular valores agregados da proposta
CREATE OR REPLACE FUNCTION public.recalc_proposta_totals(p_proposta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_itens numeric(18,2);
  v_bdi numeric(7,4);
  v_total numeric(18,2);
BEGIN
  SELECT COALESCE(SUM(preco_total), 0) INTO v_itens
  FROM public.proposta_itens WHERE proposta_id = p_proposta_id;

  SELECT COALESCE(bdi_percent, 0) INTO v_bdi
  FROM public.propostas WHERE id = p_proposta_id;

  v_total := round(v_itens * (1 + v_bdi/100), 2);

  UPDATE public.propostas
     SET valor_itens = v_itens,
         valor_total = v_total,
         valor_proposto = v_total,
         updated_at = now()
   WHERE id = p_proposta_id;
END $$;

GRANT EXECUTE ON FUNCTION public.recalc_proposta_totals(uuid) TO authenticated, service_role;
