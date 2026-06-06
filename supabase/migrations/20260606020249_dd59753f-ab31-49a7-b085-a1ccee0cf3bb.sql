
-- ============= oportunidades =============
CREATE TABLE public.oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Identificação PNCP
  pncp_id text NULL,                      -- numeroControlePNCP
  fonte text NOT NULL DEFAULT 'pncp',     -- pncp | manual | importacao
  numero_compra text NULL,
  ano_compra integer NULL,
  orgao_cnpj text NULL,
  orgao_nome text NULL,
  unidade_nome text NULL,
  uf text NULL,
  municipio text NULL,

  -- Conteúdo
  modalidade text NULL,
  modo_disputa text NULL,
  objeto text NULL,
  valor_estimado numeric(18,2) NULL,

  -- Datas
  data_publicacao timestamptz NULL,
  data_abertura_propostas timestamptz NULL,
  data_encerramento_propostas timestamptz NULL,

  -- Links
  link_sistema_origem text NULL,
  link_edital text NULL,

  -- Pipeline interno
  situacao text NOT NULL DEFAULT 'triagem'
    CHECK (situacao IN (
      'triagem','analise','preparando_proposta','enviada',
      'resultado_aguardando','ganha','perdida','arquivada'
    )),
  prioridade text NULL CHECK (prioridade IN ('baixa','media','alta','urgente') OR prioridade IS NULL),
  escore_aderencia integer NULL CHECK (escore_aderencia IS NULL OR (escore_aderencia BETWEEN 0 AND 100)),
  responsavel_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  anotacoes text NULL,

  raw jsonb NOT NULL DEFAULT '{}'::jsonb,  -- payload original do PNCP

  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (company_id, pncp_id)
);

CREATE INDEX oportunidades_company_idx ON public.oportunidades(company_id);
CREATE INDEX oportunidades_situacao_idx ON public.oportunidades(company_id, situacao);
CREATE INDEX oportunidades_abertura_idx ON public.oportunidades(company_id, data_abertura_propostas);
CREATE INDEX oportunidades_uf_idx ON public.oportunidades(company_id, uf) WHERE uf IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO authenticated;
GRANT ALL ON public.oportunidades TO service_role;

ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oportunidades_select_member" ON public.oportunidades
  FOR SELECT TO authenticated
  USING (is_company_member(company_id));

CREATE POLICY "oportunidades_insert_editor" ON public.oportunidades
  FOR INSERT TO authenticated
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "oportunidades_update_editor" ON public.oportunidades
  FOR UPDATE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "oportunidades_delete_admin" ON public.oportunidades
  FOR DELETE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin']));

CREATE TRIGGER oportunidades_set_updated_at
  BEFORE UPDATE ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============= oportunidade_filtros =============
CREATE TABLE public.oportunidade_filtros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  palavras_chave text[] NOT NULL DEFAULT '{}',
  ufs text[] NOT NULL DEFAULT '{}',
  modalidades text[] NOT NULL DEFAULT '{}',
  valor_min numeric(18,2) NULL,
  valor_max numeric(18,2) NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX oportunidade_filtros_company_idx ON public.oportunidade_filtros(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidade_filtros TO authenticated;
GRANT ALL ON public.oportunidade_filtros TO service_role;

ALTER TABLE public.oportunidade_filtros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "oportunidade_filtros_select_member" ON public.oportunidade_filtros
  FOR SELECT TO authenticated USING (is_company_member(company_id));
CREATE POLICY "oportunidade_filtros_insert_editor" ON public.oportunidade_filtros
  FOR INSERT TO authenticated WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY "oportunidade_filtros_update_editor" ON public.oportunidade_filtros
  FOR UPDATE TO authenticated
  USING (has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY "oportunidade_filtros_delete_editor" ON public.oportunidade_filtros
  FOR DELETE TO authenticated USING (has_company_role(company_id, ARRAY['admin','editor']));

CREATE TRIGGER oportunidade_filtros_set_updated_at
  BEFORE UPDATE ON public.oportunidade_filtros
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============= oportunidade_pipeline_eventos =============
CREATE TABLE public.oportunidade_pipeline_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  oportunidade_id uuid NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  situacao_anterior text NULL,
  situacao_nova text NOT NULL,
  motivo text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX op_pipeline_eventos_op_idx ON public.oportunidade_pipeline_eventos(oportunidade_id, created_at DESC);

GRANT SELECT, INSERT ON public.oportunidade_pipeline_eventos TO authenticated;
GRANT ALL ON public.oportunidade_pipeline_eventos TO service_role;

ALTER TABLE public.oportunidade_pipeline_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "op_pipeline_select_member" ON public.oportunidade_pipeline_eventos
  FOR SELECT TO authenticated USING (is_company_member(company_id));
-- INSERT só via trigger SECURITY DEFINER (sem policy de INSERT direto para clientes,
-- exceto pelo service_role que já bypassa RLS).
CREATE POLICY "op_pipeline_insert_system" ON public.oportunidade_pipeline_eventos
  FOR INSERT TO authenticated WITH CHECK (false);

-- Trigger: registra evento sempre que situacao muda (e ao criar)
CREATE OR REPLACE FUNCTION public.log_oportunidade_pipeline_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.oportunidade_pipeline_eventos(
      company_id, oportunidade_id, situacao_anterior, situacao_nova, actor_user_id
    ) VALUES (NEW.company_id, NEW.id, NULL, NEW.situacao, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.situacao IS DISTINCT FROM OLD.situacao THEN
    INSERT INTO public.oportunidade_pipeline_eventos(
      company_id, oportunidade_id, situacao_anterior, situacao_nova, actor_user_id
    ) VALUES (NEW.company_id, NEW.id, OLD.situacao, NEW.situacao, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_oportunidades_pipeline_event
  AFTER INSERT OR UPDATE OF situacao ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.log_oportunidade_pipeline_event();
