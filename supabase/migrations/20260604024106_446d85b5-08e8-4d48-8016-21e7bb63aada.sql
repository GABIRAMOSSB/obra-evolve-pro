
-- ==================================================================
-- 1. AMPLIA TABELA companies (não-destrutivo)
-- ==================================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS trade_name TEXT,
  ADD COLUMN IF NOT EXISTS cnpj TEXT,
  ADD COLUMN IF NOT EXISTS state_registration TEXT,
  ADD COLUMN IF NOT EXISTS municipal_registration TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS companies_cnpj_unique
  ON public.companies (cnpj) WHERE cnpj IS NOT NULL;

-- Atualiza a empresa Solv (qualquer companhia existente com nome contendo "solv")
UPDATE public.companies
SET
  legal_name = COALESCE(legal_name, 'SOLV CONSTRUTORA E SOLUÇÕES LTDA'),
  trade_name = COALESCE(trade_name, 'Solv Construtora'),
  cnpj = COALESCE(cnpj, '36419348000165'),
  city = COALESCE(city, 'São Borja'),
  state = COALESCE(state, 'RS'),
  address = COALESCE(address, 'Rua General Marques, 208 — Centro')
WHERE LOWER(name) LIKE '%solv%' OR LOWER(COALESCE(legal_name,'')) LIKE '%solv%';

-- ==================================================================
-- 2. FUNÇÃO has_company_role (security definer)
-- ==================================================================
CREATE OR REPLACE FUNCTION public.has_company_role(_company_id UUID, _roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id
      AND user_id = auth.uid()
      AND role::text = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = _company_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ==================================================================
-- 3. certificate_types — catálogo
-- ==================================================================
CREATE TABLE public.certificate_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  category TEXT NOT NULL,
  scope TEXT NOT NULL,
  state TEXT,
  city TEXT,
  issuing_authority TEXT NOT NULL,
  provider TEXT,
  provider_service_key TEXT,
  automatic_enabled BOOLEAN NOT NULL DEFAULT false,
  manual_upload_enabled BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  official_portal_url TEXT,
  default_check_frequency_days INT NOT NULL DEFAULT 7,
  default_warning_days INT NOT NULL DEFAULT 30,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.certificate_types TO authenticated;
GRANT ALL ON public.certificate_types TO service_role;
ALTER TABLE public.certificate_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read certificate_types" ON public.certificate_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages certificate_types" ON public.certificate_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_certificate_types_updated
  BEFORE UPDATE ON public.certificate_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================================================================
-- 4. company_certificates — situação atual
-- ==================================================================
CREATE TABLE public.company_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_type_id UUID NOT NULL REFERENCES public.certificate_types(id) ON DELETE RESTRICT,
  current_version_id UUID,
  status TEXT NOT NULL DEFAULT 'api_not_configured',
  status_message TEXT,
  issue_date DATE,
  expiration_date DATE,
  certificate_number TEXT,
  authentication_code TEXT,
  last_checked_at TIMESTAMPTZ,
  next_check_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,
  source_type TEXT,
  api_provider TEXT,
  automatic_update_enabled BOOLEAN NOT NULL DEFAULT false,
  manual_review_required BOOLEAN NOT NULL DEFAULT false,
  file_available BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, certificate_type_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_certificates TO authenticated;
GRANT ALL ON public.company_certificates TO service_role;
ALTER TABLE public.company_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read company_certificates" ON public.company_certificates
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admin/editor write company_certificates" ON public.company_certificates
  FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE TRIGGER trg_company_certificates_updated
  BEFORE UPDATE ON public.company_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================================================================
-- 5. certificate_versions — histórico imutável
-- ==================================================================
CREATE TABLE public.certificate_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_certificate_id UUID NOT NULL REFERENCES public.company_certificates(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  issue_date DATE,
  expiration_date DATE,
  certificate_number TEXT,
  authentication_code TEXT,
  status TEXT,
  status_message TEXT,
  storage_path TEXT,
  file_name TEXT,
  file_hash TEXT,
  mime_type TEXT,
  file_size INT,
  source_type TEXT,
  api_provider TEXT,
  provider_service_key TEXT,
  raw_payload_json JSONB,
  normalized_payload_json JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_certificate_id, version_number)
);

ALTER TABLE public.company_certificates
  ADD CONSTRAINT company_certificates_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.certificate_versions(id) ON DELETE SET NULL;

CREATE INDEX idx_cert_versions_cert ON public.certificate_versions(company_certificate_id);
CREATE INDEX idx_cert_versions_hash ON public.certificate_versions(file_hash);

GRANT SELECT, INSERT ON public.certificate_versions TO authenticated;
GRANT ALL ON public.certificate_versions TO service_role;
ALTER TABLE public.certificate_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read versions" ON public.certificate_versions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.company_certificates cc
            WHERE cc.id = company_certificate_id
              AND public.is_company_member(cc.company_id))
  );
CREATE POLICY "Admin/editor insert versions" ON public.certificate_versions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.company_certificates cc
            WHERE cc.id = company_certificate_id
              AND public.has_company_role(cc.company_id, ARRAY['admin','editor']))
  );

-- ==================================================================
-- 6. certificate_checks — log de tentativas
-- ==================================================================
CREATE TABLE public.certificate_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_type_id UUID NOT NULL REFERENCES public.certificate_types(id) ON DELETE CASCADE,
  company_certificate_id UUID REFERENCES public.company_certificates(id) ON DELETE SET NULL,
  execution_mode TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL,
  request_reference TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  http_status INT,
  provider TEXT,
  provider_service_key TEXT,
  result_summary TEXT,
  error_code TEXT,
  error_message TEXT,
  raw_response_json JSONB,
  created_by UUID
);

CREATE INDEX idx_cert_checks_company ON public.certificate_checks(company_id, started_at DESC);

GRANT SELECT, INSERT ON public.certificate_checks TO authenticated;
GRANT ALL ON public.certificate_checks TO service_role;
ALTER TABLE public.certificate_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read checks" ON public.certificate_checks
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admin/editor insert checks" ON public.certificate_checks
  FOR INSERT TO authenticated WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

-- ==================================================================
-- 7. integration_settings
-- ==================================================================
CREATE TABLE public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  sandbox_mode BOOLEAN NOT NULL DEFAULT true,
  production_enabled BOOLEAN NOT NULL DEFAULT false,
  token_configured BOOLEAN NOT NULL DEFAULT false,
  endpoint_base_url TEXT,
  last_health_check_at TIMESTAMPTZ,
  last_health_check_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.integration_settings TO authenticated;
GRANT ALL ON public.integration_settings TO service_role;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read integration_settings" ON public.integration_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role writes integration_settings" ON public.integration_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER trg_integration_settings_updated
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================================================================
-- 8. notification_rules
-- ==================================================================
CREATE TABLE public.notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_type_id UUID REFERENCES public.certificate_types(id) ON DELETE CASCADE,
  warning_days INT NOT NULL,
  notify_on_expired BOOLEAN NOT NULL DEFAULT true,
  notify_on_error BOOLEAN NOT NULL DEFAULT true,
  notify_on_status_change BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_rules TO authenticated;
GRANT ALL ON public.notification_rules TO service_role;
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read notification_rules" ON public.notification_rules
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admin/editor write notification_rules" ON public.notification_rules
  FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE TRIGGER trg_notification_rules_updated
  BEFORE UPDATE ON public.notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==================================================================
-- 9. compliance_alerts
-- ==================================================================
CREATE TABLE public.compliance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_type_id UUID REFERENCES public.certificate_types(id) ON DELETE CASCADE,
  company_certificate_id UUID REFERENCES public.company_certificates(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_alerts_company ON public.compliance_alerts(company_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.compliance_alerts TO authenticated;
GRANT ALL ON public.compliance_alerts TO service_role;
ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read alerts" ON public.compliance_alerts
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "Admin/editor write alerts" ON public.compliance_alerts
  FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

-- ==================================================================
-- 10. compliance_audit_logs
-- ==================================================================
CREATE TABLE public.compliance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_compliance_audit_company ON public.compliance_audit_logs(company_id, created_at DESC);

GRANT SELECT, INSERT ON public.compliance_audit_logs TO authenticated;
GRANT ALL ON public.compliance_audit_logs TO service_role;
ALTER TABLE public.compliance_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read audit logs" ON public.compliance_audit_logs
  FOR SELECT TO authenticated USING (company_id IS NULL OR public.is_company_member(company_id));
CREATE POLICY "Auth users insert audit logs" ON public.compliance_audit_logs
  FOR INSERT TO authenticated WITH CHECK (company_id IS NULL OR public.is_company_member(company_id));

-- ==================================================================
-- 11. SEEDS — catálogo de certidões
-- ==================================================================
INSERT INTO public.certificate_types (code, name, short_name, category, scope, state, city, issuing_authority, provider, provider_service_key, automatic_enabled, manual_upload_enabled, active, description, official_portal_url, default_check_frequency_days, default_warning_days, display_order)
VALUES
  ('cnd-federal', 'Certidão Negativa de Débitos Federais (CND)', 'CND Federal', 'fiscal', 'federal', NULL, NULL, 'Receita Federal / PGFN', 'infosimples', 'receita-federal/pgfn/cnd', true, true, true, 'Certidão Negativa de Débitos relativos a Créditos Tributários Federais e à Dívida Ativa da União', 'https://servicos.receita.fazenda.gov.br/Servicos/certidaointernet/PJ/Emitir', 7, 30, 10),
  ('sefaz-rs', 'Certidão de Situação Fiscal — SEFAZ-RS', 'SEFAZ-RS', 'fiscal_estadual', 'estadual', 'RS', NULL, 'SEFAZ-RS', 'infosimples', 'sefaz-rs/cnd', true, true, true, 'Certidão de Situação Fiscal junto à Secretaria da Fazenda do RS', 'https://www.sefaz.rs.gov.br/sat/CertidaoSituacaoFiscal.aspx', 7, 30, 20),
  ('crf-fgts', 'Certificado de Regularidade do FGTS (CRF)', 'CRF FGTS', 'trabalhista', 'federal', NULL, NULL, 'Caixa Econômica Federal', 'infosimples', 'caixa/crf-fgts', true, true, true, 'Certificado de Regularidade do FGTS', 'https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf', 7, 30, 30),
  ('cndt', 'Certidão Negativa de Débitos Trabalhistas (CNDT)', 'CNDT', 'trabalhista', 'federal', NULL, NULL, 'Tribunal Superior do Trabalho', 'infosimples', 'tst/cndt', true, true, true, 'Certidão Negativa de Débitos Trabalhistas', 'https://cndt-certidao.tst.jus.br/inicio.faces', 7, 30, 40),
  ('cadin-cfil-rs', 'CADIN e CFIL — Rio Grande do Sul', 'CADIN/CFIL RS', 'compliance_estadual', 'estadual', 'RS', NULL, 'SEFAZ-RS', 'infosimples', 'sefaz-rs/cadin-cfil', true, true, true, 'Cadastro Informativo de créditos não quitados — RS', 'https://www.sefaz.rs.gov.br/', 7, 30, 50),
  ('cgu-correcional', 'Certidão Correcional — CGU', 'CGU', 'integridade', 'federal', NULL, NULL, 'Controladoria-Geral da União', 'infosimples', 'cgu/certidao-correcional', true, true, true, 'Certidão Negativa Correcional emitida pela CGU', 'https://certidoes-apf.apps.tcu.gov.br/', 30, 30, 60),
  ('cnd-municipal-saoborja', 'CND Municipal — Prefeitura de São Borja', 'CND Municipal São Borja', 'fiscal_municipal', 'municipal', 'RS', 'São Borja', 'Prefeitura de São Borja', NULL, NULL, false, true, true, 'Certidão Negativa de Débitos Municipais — São Borja/RS', 'https://www.saoborja.rs.gov.br/', 15, 30, 70),
  ('trf4-judicial', 'Certidão Judicial Federal — TRF4', 'TRF4', 'judicial', 'regional', 'RS', NULL, 'Tribunal Regional Federal 4ª Região', NULL, NULL, false, true, false, 'Certidão de distribuição cível e criminal — TRF4 (RS/SC/PR). Opcional, desativada por padrão.', 'https://www.trf4.jus.br/trf4/', 30, 30, 80),
  ('tjrs-judicial', 'Certidão Judicial Estadual — TJRS', 'TJRS', 'judicial', 'estadual', 'RS', NULL, 'Tribunal de Justiça do RS', NULL, NULL, false, true, false, 'Certidão Judicial Estadual — TJRS. Opcional, desativada por padrão.', 'https://www.tjrs.jus.br/', 30, 30, 90);

-- ==================================================================
-- 12. SEEDS — integration_settings
-- ==================================================================
INSERT INTO public.integration_settings (provider, sandbox_mode, production_enabled, token_configured, endpoint_base_url, notes)
VALUES ('infosimples', true, false, false, 'https://api.infosimples.com/api/v2/consultas', 'Sandbox ativo. Token deve ser cadastrado em Secrets como INFOSIMPLES_TOKEN. Endpoints específicos por consulta devem ser mapeados em provider_service_key de cada certificate_type.');

-- ==================================================================
-- 13. SEEDS — vincula certidões à empresa Solv
-- ==================================================================
DO $$
DECLARE
  v_company_id UUID;
  v_type RECORD;
BEGIN
  SELECT id INTO v_company_id FROM public.companies
    WHERE LOWER(name) LIKE '%solv%' OR LOWER(COALESCE(legal_name,'')) LIKE '%solv%'
    LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_type IN SELECT id, automatic_enabled, default_check_frequency_days, code FROM public.certificate_types WHERE active = true LOOP
    INSERT INTO public.company_certificates (
      company_id, certificate_type_id, status, status_message,
      automatic_update_enabled, source_type, api_provider, next_check_at
    ) VALUES (
      v_company_id, v_type.id,
      CASE WHEN v_type.automatic_enabled THEN 'sandbox' ELSE 'manual_update_required' END,
      CASE WHEN v_type.automatic_enabled THEN 'Modo de teste — aguardando primeira consulta' ELSE 'Atualização manual: faça upload do PDF' END,
      v_type.automatic_enabled,
      CASE WHEN v_type.automatic_enabled THEN 'sandbox' ELSE 'manual' END,
      CASE WHEN v_type.automatic_enabled THEN 'infosimples' ELSE NULL END,
      now() + (v_type.default_check_frequency_days || ' days')::interval
    ) ON CONFLICT (company_id, certificate_type_id) DO NOTHING;
  END LOOP;

  -- Regras de notificação padrão
  INSERT INTO public.notification_rules (company_id, certificate_type_id, warning_days, active)
  SELECT v_company_id, NULL, d, true FROM unnest(ARRAY[30,15,7,1,0]) d
  ON CONFLICT DO NOTHING;
END $$;
