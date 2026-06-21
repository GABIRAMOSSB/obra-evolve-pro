
-- =========================================================================
-- ENUMs
-- =========================================================================
DO $$ BEGIN
  CREATE TYPE public.atividade_status AS ENUM ('nao_iniciada','em_andamento','concluida','paralisada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.atividade_prioridade AS ENUM ('baixa','media','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.analise_risco AS ENUM ('baixo','moderado','alto','critico');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================================
-- obra_atividades
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.obra_atividades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  item_codigo TEXT NOT NULL,
  etapa TEXT,
  descricao TEXT NOT NULL,
  unidade TEXT,
  quantidade NUMERIC(18,4) DEFAULT 0,
  peso NUMERIC(18,6) DEFAULT 0,
  valor NUMERIC(18,2) DEFAULT 0,
  percentual_concluido NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (percentual_concluido >= 0 AND percentual_concluido <= 100),
  status public.atividade_status NOT NULL DEFAULT 'nao_iniciada',
  data_prevista_inicio DATE,
  data_prevista_fim DATE,
  data_real_inicio DATE,
  data_real_fim DATE,
  responsavel_id UUID,
  responsavel_nome TEXT,
  prioridade public.atividade_prioridade NOT NULL DEFAULT 'media',
  impedimento TEXT,
  bloqueia_atividades UUID[] DEFAULT ARRAY[]::UUID[],
  observacoes TEXT,
  ordem INTEGER DEFAULT 0,
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, item_codigo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obra_atividades TO authenticated;
GRANT ALL ON public.obra_atividades TO service_role;
ALTER TABLE public.obra_atividades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obra_atividades_select" ON public.obra_atividades
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "obra_atividades_insert" ON public.obra_atividades
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "obra_atividades_update" ON public.obra_atividades
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "obra_atividades_delete" ON public.obra_atividades
  FOR DELETE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_obra_atividades_obra ON public.obra_atividades(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_atividades_company ON public.obra_atividades(company_id);
CREATE INDEX IF NOT EXISTS idx_obra_atividades_status ON public.obra_atividades(obra_id, status);

-- =========================================================================
-- obra_atividade_eventos (auditoria)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.obra_atividade_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  atividade_id UUID REFERENCES public.obra_atividades(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  autor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.obra_atividade_eventos TO authenticated;
GRANT ALL ON public.obra_atividade_eventos TO service_role;
ALTER TABLE public.obra_atividade_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obra_atividade_eventos_select" ON public.obra_atividade_eventos
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "obra_atividade_eventos_insert" ON public.obra_atividade_eventos
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_obra_atividade_eventos_obra ON public.obra_atividade_eventos(obra_id, created_at DESC);

-- =========================================================================
-- obra_analise_snapshots
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.obra_analise_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data_snapshot DATE NOT NULL DEFAULT CURRENT_DATE,
  avanco NUMERIC(7,3) NOT NULL DEFAULT 0,
  prazo_consumido NUMERIC(7,3),
  desvio NUMERIC(7,3),
  ritmo_atual NUMERIC(10,5),
  ritmo_necessario NUMERIC(10,5),
  fator_aceleracao NUMERIC(10,4),
  saldo_executar NUMERIC(18,2),
  valor_executado NUMERIC(18,2),
  data_projetada DATE,
  num_criticas INTEGER NOT NULL DEFAULT 0,
  risco public.analise_risco NOT NULL DEFAULT 'baixo',
  confiabilidade TEXT NOT NULL DEFAULT 'media',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, data_snapshot)
);

GRANT SELECT, INSERT, UPDATE ON public.obra_analise_snapshots TO authenticated;
GRANT ALL ON public.obra_analise_snapshots TO service_role;
ALTER TABLE public.obra_analise_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obra_analise_snapshots_select" ON public.obra_analise_snapshots
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "obra_analise_snapshots_insert" ON public.obra_analise_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "obra_analise_snapshots_update" ON public.obra_analise_snapshots
  FOR UPDATE TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_obra_analise_snapshots_obra ON public.obra_analise_snapshots(obra_id, data_snapshot DESC);

-- =========================================================================
-- Trigger: updated_at + evento + snapshot rápido
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_obra_atividades_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_obra_atividades_updated_at ON public.obra_atividades;
CREATE TRIGGER trg_obra_atividades_updated_at
  BEFORE UPDATE ON public.obra_atividades
  FOR EACH ROW EXECUTE FUNCTION public.tg_obra_atividades_updated_at();

CREATE OR REPLACE FUNCTION public.tg_obra_atividades_evento()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obra UUID;
  v_company UUID;
  v_atividade UUID;
  v_tipo TEXT;
  v_payload JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_obra := NEW.obra_id; v_company := NEW.company_id; v_atividade := NEW.id;
    v_tipo := 'criada';
    v_payload := jsonb_build_object('descricao', NEW.descricao, 'percentual', NEW.percentual_concluido);
  ELSIF TG_OP = 'UPDATE' THEN
    v_obra := NEW.obra_id; v_company := NEW.company_id; v_atividade := NEW.id;
    v_tipo := 'atualizada';
    v_payload := jsonb_build_object(
      'antes', jsonb_build_object(
        'percentual', OLD.percentual_concluido, 'status', OLD.status,
        'prioridade', OLD.prioridade, 'impedimento', OLD.impedimento
      ),
      'depois', jsonb_build_object(
        'percentual', NEW.percentual_concluido, 'status', NEW.status,
        'prioridade', NEW.prioridade, 'impedimento', NEW.impedimento
      )
    );
  ELSE
    v_obra := OLD.obra_id; v_company := OLD.company_id; v_atividade := OLD.id;
    v_tipo := 'removida';
    v_payload := jsonb_build_object('descricao', OLD.descricao);
  END IF;

  INSERT INTO public.obra_atividade_eventos (company_id, obra_id, atividade_id, tipo, payload, autor_id)
  VALUES (v_company, v_obra, v_atividade, v_tipo, v_payload, auth.uid());

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_obra_atividades_evento ON public.obra_atividades;
CREATE TRIGGER trg_obra_atividades_evento
  AFTER INSERT OR UPDATE OR DELETE ON public.obra_atividades
  FOR EACH ROW EXECUTE FUNCTION public.tg_obra_atividades_evento();

-- updated_at for snapshots
CREATE OR REPLACE FUNCTION public.tg_obra_analise_snapshots_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_obra_analise_snapshots_updated_at ON public.obra_analise_snapshots;
CREATE TRIGGER trg_obra_analise_snapshots_updated_at
  BEFORE UPDATE ON public.obra_analise_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.tg_obra_analise_snapshots_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.obra_atividades;
