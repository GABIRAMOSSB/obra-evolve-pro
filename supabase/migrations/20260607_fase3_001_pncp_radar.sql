-- FASE 3: PNCP Radar
-- Migration 001: Tabelas para Coleta de Oportunidades PNCP
-- Data: 2026-06-07

-- ============================================================================
-- 1. TABELA: CONFIGURAÇÃO DE RADAR PNCP
-- ============================================================================

CREATE TABLE IF NOT EXISTS pncp_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  pncp_status VARCHAR(50) DEFAULT 'nao_configurado' CHECK (pncp_status IN ('nao_configurado', 'configurado', 'coletando', 'ativo', 'pausado')),
  endpoint_api VARCHAR(500) DEFAULT 'https://pncp.gov.br/api/v1',
  frequencia_coleta_horas INT DEFAULT 6,
  ultima_coleta TIMESTAMP,
  proxima_coleta TIMESTAMP,
  filtro_estado TEXT DEFAULT 'todos',
  filtro_modalidade TEXT,
  filtro_categoria_economica TEXT,
  alertar_via_email BOOLEAN DEFAULT TRUE,
  alertar_via_whatsapp BOOLEAN DEFAULT FALSE,
  emails_alerta VARCHAR(1000),
  criar_proposta_automatico BOOLEAN DEFAULT FALSE,
  criar_edital BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pncp_config_empresa ON pncp_configuracoes(empresa_id);

-- ============================================================================
-- 2. TABELA: FILTROS CUSTOMIZADOS DE BUSCA
-- ============================================================================

CREATE TABLE IF NOT EXISTS pncp_filtros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  nome_filtro VARCHAR(255) NOT NULL,
  descricao TEXT,
  filtro_municipios TEXT,
  filtro_tipos_obra VARCHAR(500),
  filtro_valores_minimo NUMERIC(18, 2),
  filtro_valores_maximo NUMERIC(18, 2),
  filtro_modalidades VARCHAR(500),
  filtro_estados TEXT,
  prioridade INT DEFAULT 100,
  ativo BOOLEAN DEFAULT TRUE,
  aplicar_automatico BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(empresa_id, nome_filtro)
);

CREATE INDEX IF NOT EXISTS idx_pncp_filtros_empresa ON pncp_filtros(empresa_id);

-- ============================================================================
-- 3. TABELA: EDITALAÇÕES (Oportunidades do PNCP)
-- ============================================================================

CREATE TABLE IF NOT EXISTS editais_pncp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  numero_edital VARCHAR(100) UNIQUE NOT NULL,
  descricao_objeto TEXT,
  orgao_responsavel VARCHAR(500),
  municipio VARCHAR(255),
  estado VARCHAR(2),
  valor_estimado NUMERIC(18, 2),
  valor_minimo NUMERIC(18, 2),
  valor_maximo NUMERIC(18, 2),
  modalidade_licitacao VARCHAR(100),
  tipo_licitacao VARCHAR(100),
  categoria_economica VARCHAR(255),
  tipos_obra TEXT,
  atividade_economica VARCHAR(255),
  data_publicacao TIMESTAMP,
  data_abertura TIMESTAMP,
  data_encerramento TIMESTAMP,
  dias_para_encerrar INT,
  url_edital VARCHAR(500),
  url_documento VARCHAR(500),
  hash_documento VARCHAR(64),
  numero_processo VARCHAR(50),
  status_coleta VARCHAR(50) DEFAULT 'novo' CHECK (status_coleta IN ('novo', 'analisado', 'candidato', 'enviado', 'aceito', 'rejeitado', 'finalizado', 'descartado')),
  motivo_descarte VARCHAR(500),
  nota_matching NUMERIC(5, 2),
  relevancia_empresa NUMERIC(5, 2),
  origem_fonte VARCHAR(50) CHECK (origem_fonte IN ('pncp_api', 'manual_input', 'feed_externo')),
  hash_snapshot VARCHAR(64),
  data_ultima_sincronizacao TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deletado_em TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_editais_empresa ON editais_pncp(empresa_id);
CREATE INDEX IF NOT EXISTS idx_editais_status ON editais_pncp(status_coleta);
CREATE INDEX IF NOT EXISTS idx_editais_encerramento ON editais_pncp(data_encerramento);
CREATE INDEX IF NOT EXISTS idx_editais_municipio ON editais_pncp(municipio);
CREATE INDEX IF NOT EXISTS idx_editais_valor ON editais_pncp(valor_estimado);

-- ============================================================================
-- 4. TABELA: REQUISITOS E CRITÉRIOS DO EDITAL
-- ============================================================================

CREATE TABLE IF NOT EXISTS edital_requisitos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE CASCADE,
  tipo_requisito VARCHAR(100) CHECK (tipo_requisito IN ('habilitacao', 'capacidade_tecnica', 'habilitacao_fiscal', 'outros')),
  descricao TEXT,
  obrigatorio BOOLEAN DEFAULT TRUE,
  percentual_impacto NUMERIC(5, 2),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edital_requisitos_edital ON edital_requisitos(edital_id);

-- ============================================================================
-- 5. TABELA: ANÁLISE DE MATCHING (Compatibilidade com Empresa)
-- ============================================================================

CREATE TABLE IF NOT EXISTS edital_matching (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  score_compatibilidade NUMERIC(5, 2),
  capacidade_tecnica NUMERIC(5, 2),
  compatibilidade_localizacao NUMERIC(5, 2),
  compatibilidade_valor NUMERIC(5, 2),
  compatibilidade_categoria NUMERIC(5, 2),
  atende_requisitos BOOLEAN,
  requisitos_faltantes TEXT,
  recomendacao VARCHAR(50) CHECK (recomendacao IN ('recomendado', 'compativel', 'cauto', 'nao_recomendado')),
  motivos_incompatibilidade TEXT,
  analise_criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  analise_por_usuario UUID,
  UNIQUE(edital_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_edital_matching_empresa ON edital_matching(empresa_id);
CREATE INDEX IF NOT EXISTS idx_edital_matching_score ON edital_matching(score_compatibilidade);

-- ============================================================================
-- 6. TABELA: ALERTAS DE OPORTUNIDADE
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerta_oportunidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID REFERENCES editais_pncp(id) ON DELETE SET NULL,
  tipo_alerta VARCHAR(50) CHECK (tipo_alerta IN ('nova_oportunidade', 'proximo_encerramento', 'requisito_atendido', 'aviso_geral')),
  titulo_alerta VARCHAR(500),
  descricao_alerta TEXT,
  urgencia VARCHAR(50) DEFAULT 'media' CHECK (urgencia IN ('baixa', 'media', 'alta', 'critica')),
  enviado_via_email BOOLEAN DEFAULT FALSE,
  enviado_via_whatsapp BOOLEAN DEFAULT FALSE,
  destinatarios_email VARCHAR(1000),
  lido_em TIMESTAMP,
  acao_realizada BOOLEAN DEFAULT FALSE,
  status_alerta VARCHAR(50) DEFAULT 'aberto' CHECK (status_alerta IN ('aberto', 'resolvido', 'ignorado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerta_oportunidade_empresa ON alerta_oportunidade(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alerta_oportunidade_status ON alerta_oportunidade(status_alerta);

-- ============================================================================
-- 7. TABELA: PROPOSTAS CRIADAS A PARTIR DE EDITAIS
-- ============================================================================

CREATE TABLE IF NOT EXISTS proposta_edital (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE RESTRICT,
  proposta_id UUID REFERENCES propostas(id) ON DELETE SET NULL,
  data_criacao_proposta TIMESTAMP,
  numero_proposta_edital VARCHAR(100),
  status_proposta VARCHAR(50) DEFAULT 'rascunho' CHECK (status_proposta IN ('rascunho', 'preenchida', 'revisada', 'enviada', 'aceita', 'rejeitada')),
  data_envio_proposta TIMESTAMP,
  data_resposta_edital TIMESTAMP,
  resultado_edital VARCHAR(50),
  motivo_rejeicao TEXT,
  valor_vencedor NUMERIC(18, 2),
  desconto_ofertado NUMERIC(18, 8),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proposta_edital_empresa ON proposta_edital(empresa_id);
CREATE INDEX IF NOT EXISTS idx_proposta_edital_edital ON proposta_edital(edital_id);

-- ============================================================================
-- 8. TABELA: HISTÓRICO DE COLETA PNCP
-- ============================================================================

CREATE TABLE IF NOT EXISTS pncp_coleta_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  data_coleta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_editais_encontrados INT,
  total_novos INT,
  total_atualizados INT,
  total_removidos INT,
  filtro_aplicado_id UUID REFERENCES pncp_filtros(id),
  status_coleta VARCHAR(50) CHECK (status_coleta IN ('sucesso', 'parcial', 'erro')),
  mensagem_erro TEXT,
  tempo_execucao_segundos INT,
  novos_alertas_criados INT
);

CREATE INDEX IF NOT EXISTS idx_pncp_coleta_empresa ON pncp_coleta_historico(empresa_id);

-- ============================================================================
-- 9. TABELA: CATEGORIAS DE ANÁLISE
-- ============================================================================

CREATE TABLE IF NOT EXISTS pncp_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_categoria VARCHAR(50) UNIQUE NOT NULL,
  descricao VARCHAR(500),
  tipos_obra TEXT,
  atividades_economicas TEXT,
  status VARCHAR(50) DEFAULT 'ativo'
);

-- Pré-carregar categorias comuns
INSERT INTO pncp_categorias (codigo_categoria, descricao, tipos_obra)
VALUES
  ('INFRAESTRUTURA', 'Obras de Infraestrutura', 'Rodovias,Ferrovias,Portos,Aeroportos'),
  ('SANEAMENTO', 'Obras de Saneamento', 'Sistemas de Água,Esgoto,Drenagem'),
  ('RESIDENCIAL', 'Obras Residenciais', 'Habitação,Edifícios,Condomínios'),
  ('COMERCIAL', 'Obras Comerciais', 'Prédios Comerciais,Shoppings,Escritórios'),
  ('EDUCACAO', 'Obras de Educação', 'Escolas,Universidades,Centros de Treinamento'),
  ('SAUDE', 'Obras de Saúde', 'Hospitais,Clínicas,Centros de Saúde'),
  ('REFORMA', 'Reformas e Restaurações', 'Reformas,Restauração,Reabilitação'),
  ('URBANIZACAO', 'Urbanização', 'Praças,Parques,Avenidas,Ruas'),
  ('INDUSTRIAL', 'Obras Industriais', 'Fábricas,Indústrias,Plantas'),
  ('ENERGIA', 'Obras de Energia', 'Usinas,Linhas de Transmissão,Subestações')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. TABELA: PIPELINE VISUAL DE STATUS
-- ============================================================================

CREATE TABLE IF NOT EXISTS edital_pipeline_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE CASCADE,
  posicao_pipeline VARCHAR(50) DEFAULT 'novo' CHECK (posicao_pipeline IN ('novo', 'analisando', 'interessado', 'proposta_preparada', 'proposta_enviada', 'aguardando_resposta', 'ganho', 'perdido', 'descartado')),
  data_entrada_stage TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  motivo_mudanca VARCHAR(500),
  responsavel_usuario UUID,
  proxima_acao VARCHAR(255),
  data_proxima_acao TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edital_pipeline_empresa ON edital_pipeline_status(empresa_id);
CREATE INDEX IF NOT EXISTS idx_edital_pipeline_posicao ON edital_pipeline_status(posicao_pipeline);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE pncp_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pncp_filtros ENABLE ROW LEVEL SECURITY;
ALTER TABLE editais_pncp ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_requisitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_matching ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerta_oportunidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposta_edital ENABLE ROW LEVEL SECURITY;
ALTER TABLE pncp_coleta_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_pipeline_status ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- PNCP Configurações
CREATE POLICY pncp_config_select ON pncp_configuracoes FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY pncp_config_insert ON pncp_configuracoes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM usuarios u JOIN perfis p ON u.perfil_id = p.id
  WHERE u.id = auth.uid() AND p.nivel_acesso >= 100 AND u.empresa_id = pncp_configuracoes.empresa_id
));

-- Editais PNCP
CREATE POLICY editais_select ON editais_pncp FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY editais_insert ON editais_pncp FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM usuarios u JOIN perfis p ON u.perfil_id = p.id
  WHERE u.id = auth.uid() AND p.nivel_acesso >= 60 AND u.empresa_id = editais_pncp.empresa_id
));

-- Alertas de Oportunidade
CREATE POLICY alerta_oportunidade_select ON alerta_oportunidade FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Pipeline
CREATE POLICY edital_pipeline_select ON edital_pipeline_status FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

COMMIT;
