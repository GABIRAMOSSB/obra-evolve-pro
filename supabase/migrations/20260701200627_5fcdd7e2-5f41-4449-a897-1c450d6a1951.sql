
-- Fase 1: Estender medicoes com número BM, data medição, workflow status e snapshot congelado
ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS numero_bm text,
  ADD COLUMN IF NOT EXISTS data_medicao date,
  ADD COLUMN IF NOT EXISTS snapshot_itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS aprovada_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Preencher numero_bm retroativo a partir do numero, formato BM-XX
UPDATE public.medicoes
   SET numero_bm = 'BM-' || lpad(numero::text, 2, '0')
 WHERE numero_bm IS NULL;

-- Unique por contrato+numero_bm (evita duplicidade textual)
CREATE UNIQUE INDEX IF NOT EXISTS medicoes_contrato_numero_bm_key
  ON public.medicoes (contrato_id, numero_bm) WHERE numero_bm IS NOT NULL;

-- Nova tabela de itens da medição
CREATE TABLE IF NOT EXISTS public.medicao_itens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  medicao_id uuid NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_atividade_id uuid REFERENCES public.obra_atividades(id) ON DELETE SET NULL,
  item_codigo text NOT NULL,
  descricao text NOT NULL,
  unidade text,
  is_etapa boolean NOT NULL DEFAULT false,
  qtd_contratada numeric(18,4) NOT NULL DEFAULT 0,
  valor_unitario numeric(18,4) NOT NULL DEFAULT 0,
  qtd_acum_anterior numeric(18,4) NOT NULL DEFAULT 0,
  valor_acum_anterior numeric(18,2) NOT NULL DEFAULT 0,
  qtd_periodo numeric(18,4) NOT NULL DEFAULT 0,
  valor_periodo numeric(18,2) NOT NULL DEFAULT 0,
  qtd_acum_atual numeric(18,4) NOT NULL DEFAULT 0,
  valor_acum_atual numeric(18,2) NOT NULL DEFAULT 0,
  pct_executado numeric(7,4) NOT NULL DEFAULT 0,
  status_calc text NOT NULL DEFAULT 'nao_iniciada',
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicao_id, item_codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medicao_itens TO authenticated;
GRANT ALL ON public.medicao_itens TO service_role;

ALTER TABLE public.medicao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select medicao_itens" ON public.medicao_itens
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM company_members cm
                 WHERE cm.company_id = medicao_itens.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "Members insert medicao_itens" ON public.medicao_itens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM company_members cm
                      WHERE cm.company_id = medicao_itens.company_id
                        AND cm.user_id = auth.uid()
                        AND cm.role = ANY (ARRAY['admin'::company_role, 'editor'::company_role])));

CREATE POLICY "Members update medicao_itens" ON public.medicao_itens
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM company_members cm
                 WHERE cm.company_id = medicao_itens.company_id
                   AND cm.user_id = auth.uid()
                   AND cm.role = ANY (ARRAY['admin'::company_role, 'editor'::company_role])));

CREATE POLICY "Members delete medicao_itens" ON public.medicao_itens
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM company_members cm
                 WHERE cm.company_id = medicao_itens.company_id
                   AND cm.user_id = auth.uid()
                   AND cm.role = 'admin'::company_role));

CREATE INDEX IF NOT EXISTS medicao_itens_medicao_idx ON public.medicao_itens (medicao_id);
CREATE INDEX IF NOT EXISTS medicao_itens_company_idx ON public.medicao_itens (company_id);

CREATE TRIGGER medicao_itens_updated_at
  BEFORE UPDATE ON public.medicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
