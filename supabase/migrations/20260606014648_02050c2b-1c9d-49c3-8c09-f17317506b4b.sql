
-- ============================================================
-- FASE 1 — FUNDAÇÃO SEGURA
-- ============================================================

-- 1. Helper: empresa ativa do usuário (usa joined_at, não created_at)
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.company_members
  WHERE user_id = auth.uid()
  ORDER BY joined_at ASC
  LIMIT 1
$$;

-- ============================================================
-- 2. OBRAS
-- ============================================================
CREATE TABLE public.obras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  legacy_obra_id text UNIQUE,
  codigo text,
  nome text NOT NULL,
  cliente text,
  cnpj_cliente text,
  endereco text,
  cidade text,
  uf text,
  data_inicio date,
  data_fim_prevista date,
  valor_contratado numeric(18,2),
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','paralisada','concluida','cancelada','planejamento')),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','workspace_sync','licitacao','importacao')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX obras_company_idx ON public.obras(company_id);
CREATE INDEX obras_legacy_idx ON public.obras(legacy_obra_id);
CREATE INDEX obras_status_idx ON public.obras(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT ALL ON public.obras TO service_role;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "obras_select_member" ON public.obras
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "obras_insert_editor" ON public.obras
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY "obras_update_editor" ON public.obras
  FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY "obras_delete_admin" ON public.obras
  FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin']));

CREATE TRIGGER obras_set_updated_at
  BEFORE UPDATE ON public.obras
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. CONTRATOS
-- ============================================================
CREATE TABLE public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id uuid REFERENCES public.obras(id) ON DELETE SET NULL,
  numero text NOT NULL,
  orgao_contratante text,
  cnpj_orgao text,
  processo_administrativo text,
  modalidade text,
  objeto text,
  data_assinatura date,
  data_inicio_vigencia date,
  data_fim_vigencia date,
  valor_original numeric(18,2),
  valor_atualizado numeric(18,2),
  regime_execucao text,
  data_base date,
  periodicidade_reajuste text CHECK (periodicidade_reajuste IN ('anual','mensal','trimestral','semestral','sem_reajuste') OR periodicidade_reajuste IS NULL),
  indice_principal text,
  formula_reajuste text,
  status text NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente','suspenso','encerrado','rescindido','em_elaboracao')),
  origem text NOT NULL DEFAULT 'manual',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, numero)
);
CREATE INDEX contratos_company_idx ON public.contratos(company_id);
CREATE INDEX contratos_obra_idx ON public.contratos(obra_id);
CREATE INDEX contratos_status_idx ON public.contratos(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT ALL ON public.contratos TO service_role;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_select_member" ON public.contratos
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "contratos_insert_editor" ON public.contratos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY "contratos_update_editor" ON public.contratos
  FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY "contratos_delete_admin" ON public.contratos
  FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin']));

CREATE TRIGGER contratos_set_updated_at
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. CONTRATO_EVENTOS
-- ============================================================
CREATE TABLE public.contrato_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN (
    'atraso','suspensao','paralisacao','prorrogacao','aditivo_prazo',
    'aditivo_valor','aditivo_qualitativo','reprogramacao','supressao',
    'acrescimo','ordem_servico','apostilamento','notificacao','resposta_orgao','outro'
  )),
  data_evento date NOT NULL,
  data_fim date,
  descricao text NOT NULL,
  responsabilidade text CHECK (responsabilidade IN ('orgao','contratada','compartilhada','indefinida') OR responsabilidade IS NULL),
  impacto_prazo_dias integer,
  impacto_valor numeric(18,2),
  documento_url text,
  documento_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX contrato_eventos_contrato_idx ON public.contrato_eventos(contrato_id, data_evento DESC);
CREATE INDEX contrato_eventos_company_idx ON public.contrato_eventos(company_id);
CREATE INDEX contrato_eventos_tipo_idx ON public.contrato_eventos(contrato_id, tipo);

GRANT SELECT, INSERT, UPDATE ON public.contrato_eventos TO authenticated;
GRANT ALL ON public.contrato_eventos TO service_role;
ALTER TABLE public.contrato_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contrato_eventos_select_member" ON public.contrato_eventos
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "contrato_eventos_insert_editor" ON public.contrato_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY "contrato_eventos_update_admin" ON public.contrato_eventos
  FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin']));

CREATE TRIGGER contrato_eventos_set_updated_at
  BEFORE UPDATE ON public.contrato_eventos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 5. AUDIT_LOGS_V2 (imutável)
-- ============================================================
CREATE TABLE public.audit_logs_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  modulo text NOT NULL,
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  versao text,
  payload_antes jsonb,
  payload_depois jsonb,
  ip text,
  user_agent text,
  resultado text NOT NULL DEFAULT 'sucesso' CHECK (resultado IN ('sucesso','erro','pendente','bloqueado')),
  erro text,
  justificativa text,
  payload_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_v2_company_idx ON public.audit_logs_v2(company_id, created_at DESC);
CREATE INDEX audit_logs_v2_modulo_idx ON public.audit_logs_v2(company_id, modulo, created_at DESC);
CREATE INDEX audit_logs_v2_entidade_idx ON public.audit_logs_v2(entidade, entidade_id);

GRANT SELECT, INSERT ON public.audit_logs_v2 TO authenticated;
GRANT ALL ON public.audit_logs_v2 TO service_role;
ALTER TABLE public.audit_logs_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_v2_select_member" ON public.audit_logs_v2
  FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY "audit_logs_v2_insert_member" ON public.audit_logs_v2
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_company_member(company_id)
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- ============================================================
-- 6. log_audit_event()
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _company_id uuid,
  _modulo text,
  _acao text,
  _entidade text DEFAULT NULL,
  _entidade_id text DEFAULT NULL,
  _payload_antes jsonb DEFAULT NULL,
  _payload_depois jsonb DEFAULT NULL,
  _resultado text DEFAULT 'sucesso',
  _erro text DEFAULT NULL,
  _justificativa text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _id uuid;
  _email text;
  _hash text;
BEGIN
  IF NOT public.is_company_member(_company_id) THEN
    RAISE EXCEPTION 'access denied: not a company member';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  _hash := encode(extensions.digest(
    COALESCE(_payload_antes::text,'') || '|' || COALESCE(_payload_depois::text,''),
    'sha256'
  ), 'hex');

  INSERT INTO public.audit_logs_v2 (
    company_id, user_id, user_email, modulo, acao, entidade, entidade_id,
    payload_antes, payload_depois, resultado, erro, justificativa, payload_hash
  ) VALUES (
    _company_id, auth.uid(), _email, _modulo, _acao, _entidade, _entidade_id,
    _payload_antes, _payload_depois, _resultado, _erro, _justificativa, _hash
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;
