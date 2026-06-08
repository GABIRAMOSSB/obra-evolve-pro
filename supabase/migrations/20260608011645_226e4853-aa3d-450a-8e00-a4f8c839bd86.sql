
-- =========================================================================
-- FASE 3.1 — PNCP Radar (adaptado ao schema atual)
-- Adiciona: configuração do radar, histórico de coleta, alertas
-- (editais/filtros/pipeline já existem em oportunidades*)
-- =========================================================================

-- 1) Configuração do Radar PNCP (1 linha por company)
CREATE TABLE public.pncp_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'nao_configurado'
    CHECK (status IN ('nao_configurado','configurado','coletando','ativo','pausado')),
  endpoint_api TEXT NOT NULL DEFAULT 'https://pncp.gov.br/api/v1',
  frequencia_coleta_horas INT NOT NULL DEFAULT 6 CHECK (frequencia_coleta_horas > 0),
  ultima_coleta TIMESTAMPTZ,
  proxima_coleta TIMESTAMPTZ,
  filtro_estado TEXT DEFAULT 'todos',
  filtro_modalidade TEXT,
  filtro_categoria_economica TEXT,
  alertar_via_email BOOLEAN NOT NULL DEFAULT TRUE,
  alertar_via_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  emails_alerta TEXT,
  criar_proposta_automatico BOOLEAN NOT NULL DEFAULT FALSE,
  criar_edital BOOLEAN NOT NULL DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pncp_configuracoes TO authenticated;
GRANT ALL ON public.pncp_configuracoes TO service_role;
ALTER TABLE public.pncp_configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY pncp_config_select_member ON public.pncp_configuracoes
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY pncp_config_insert_admin ON public.pncp_configuracoes
  FOR INSERT WITH CHECK (has_company_role(company_id, ARRAY['admin']));
CREATE POLICY pncp_config_update_admin ON public.pncp_configuracoes
  FOR UPDATE USING (has_company_role(company_id, ARRAY['admin']))
  WITH CHECK (has_company_role(company_id, ARRAY['admin']));
CREATE POLICY pncp_config_delete_admin ON public.pncp_configuracoes
  FOR DELETE USING (has_company_role(company_id, ARRAY['admin']));

CREATE TRIGGER trg_pncp_configuracoes_updated_at
  BEFORE UPDATE ON public.pncp_configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Histórico de coletas PNCP
CREATE TABLE public.pncp_coleta_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  filtro_id UUID REFERENCES public.oportunidade_filtros(id) ON DELETE SET NULL,
  data_coleta TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_encontrados INT NOT NULL DEFAULT 0,
  total_novos INT NOT NULL DEFAULT 0,
  total_atualizados INT NOT NULL DEFAULT 0,
  total_removidos INT NOT NULL DEFAULT 0,
  novos_alertas INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('sucesso','parcial','erro')),
  mensagem_erro TEXT,
  tempo_execucao_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pncp_coleta_historico TO authenticated;
GRANT ALL ON public.pncp_coleta_historico TO service_role;
ALTER TABLE public.pncp_coleta_historico ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pncp_coleta_company_data ON public.pncp_coleta_historico (company_id, data_coleta DESC);

CREATE POLICY pncp_coleta_select_member ON public.pncp_coleta_historico
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY pncp_coleta_insert_editor ON public.pncp_coleta_historico
  FOR INSERT WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY pncp_coleta_delete_admin ON public.pncp_coleta_historico
  FOR DELETE USING (has_company_role(company_id, ARRAY['admin']));

-- 3) Alertas de oportunidade
CREATE TABLE public.oportunidade_alertas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  oportunidade_id UUID REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL
    CHECK (tipo IN ('nova_oportunidade','proximo_encerramento','requisito_atendido','aviso_geral')),
  titulo TEXT NOT NULL,
  descricao TEXT,
  urgencia TEXT NOT NULL DEFAULT 'media' CHECK (urgencia IN ('baixa','media','alta','critica')),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','resolvido','ignorado')),
  enviado_via_email BOOLEAN NOT NULL DEFAULT FALSE,
  enviado_via_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  destinatarios_email TEXT,
  lido_em TIMESTAMPTZ,
  acao_realizada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidade_alertas TO authenticated;
GRANT ALL ON public.oportunidade_alertas TO service_role;
ALTER TABLE public.oportunidade_alertas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_op_alertas_company_status ON public.oportunidade_alertas (company_id, status, created_at DESC);
CREATE INDEX idx_op_alertas_oportunidade ON public.oportunidade_alertas (oportunidade_id);

CREATE POLICY op_alertas_select_member ON public.oportunidade_alertas
  FOR SELECT USING (is_company_member(company_id));
CREATE POLICY op_alertas_insert_editor ON public.oportunidade_alertas
  FOR INSERT WITH CHECK (has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY op_alertas_update_member ON public.oportunidade_alertas
  FOR UPDATE USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));
CREATE POLICY op_alertas_delete_admin ON public.oportunidade_alertas
  FOR DELETE USING (has_company_role(company_id, ARRAY['admin']));

CREATE TRIGGER trg_oportunidade_alertas_updated_at
  BEFORE UPDATE ON public.oportunidade_alertas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
