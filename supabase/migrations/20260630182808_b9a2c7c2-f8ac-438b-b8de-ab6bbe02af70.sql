-- Fase 2: Baseline planejada + dependências editáveis para Análise Gerencial V2

-- 1) Colunas adicionais em obra_atividades (idempotente)
ALTER TABLE public.obra_atividades
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS item_hierarquico text,
  ADD COLUMN IF NOT EXISTS prontidao jsonb,
  ADD COLUMN IF NOT EXISTS baseline_inicio date,
  ADD COLUMN IF NOT EXISTS baseline_fim date,
  ADD COLUMN IF NOT EXISTS predecessoras jsonb;

CREATE INDEX IF NOT EXISTS obra_atividades_item_hierarquico_idx
  ON public.obra_atividades(obra_id, item_hierarquico);

-- 2) Tabela de dependências editáveis
CREATE TABLE IF NOT EXISTS public.obra_atividade_dependencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  predecessora_id uuid NOT NULL REFERENCES public.obra_atividades(id) ON DELETE CASCADE,
  sucessora_id uuid NOT NULL REFERENCES public.obra_atividades(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'TI' CHECK (tipo IN ('TI','II','TT','IT')),
  defasagem_dias integer NOT NULL DEFAULT 0,
  percentual_minimo numeric(5,2) NOT NULL DEFAULT 100 CHECK (percentual_minimo BETWEEN 0 AND 100),
  obrigatoria boolean NOT NULL DEFAULT true,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (predecessora_id, sucessora_id)
);

CREATE INDEX IF NOT EXISTS obra_atividade_dependencias_obra_idx
  ON public.obra_atividade_dependencias(obra_id);
CREATE INDEX IF NOT EXISTS obra_atividade_dependencias_sucessora_idx
  ON public.obra_atividade_dependencias(sucessora_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_atividade_dependencias TO authenticated;
GRANT ALL ON public.obra_atividade_dependencias TO service_role;

ALTER TABLE public.obra_atividade_dependencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dep_select_company" ON public.obra_atividade_dependencias
  FOR SELECT TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor','member']));

CREATE POLICY "dep_insert_company" ON public.obra_atividade_dependencias
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "dep_update_company" ON public.obra_atividade_dependencias
  FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "dep_delete_company" ON public.obra_atividade_dependencias
  FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE TRIGGER set_obra_atividade_dependencias_updated_at
  BEFORE UPDATE ON public.obra_atividade_dependencias
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
