-- FASE 4: IA para Editais
-- Migration 001: Tabelas de Processamento com IA
-- Data: 2026-06-07

-- ============================================================================
-- 1. TABELA: CONFIGURAÇÃO DE IA POR EMPRESA
-- ============================================================================

CREATE TABLE IF NOT EXISTS ia_configuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  modelo_ia VARCHAR(50) DEFAULT 'gpt-4' CHECK (modelo_ia IN ('gpt-4', 'claude-3', 'gemini-pro', 'llama-2', 'custom')),
  api_provider VARCHAR(50) CHECK (api_provider IN ('openai', 'anthropic', 'google', 'local', 'custom')),
  api_key_hash VARCHAR(64),
  status_ia VARCHAR(50) DEFAULT 'nao_configurado' CHECK (status_ia IN ('nao_configurado', 'configurado', 'testado', 'erro')),
  ativar_extracao_ocr BOOLEAN DEFAULT TRUE,
  ativar_analise_compatibilidade BOOLEAN DEFAULT TRUE,
  ativar_predicao_ganho BOOLEAN DEFAULT TRUE,
  ativar_alertas_ia BOOLEAN DEFAULT TRUE,
  confianca_minima_extracao NUMERIC(5, 2) DEFAULT 0.85,
  confianca_minima_analise NUMERIC(5, 2) DEFAULT 0.75,
  usar_historico_empresa BOOLEAN DEFAULT TRUE,
  usar_dados_mercado BOOLEAN DEFAULT FALSE,
  criar_resumo_automatico BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ia_config_empresa ON ia_configuracoes(empresa_id);

-- ============================================================================
-- 2. TABELA: EXTRACAO DE DADOS COM IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS edital_extracao_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE CASCADE,
  modelo_usado VARCHAR(50),
  status_extracao VARCHAR(50) DEFAULT 'pendente' CHECK (status_extracao IN ('pendente', 'processando', 'concluido', 'erro')),
  data_inicio_processamento TIMESTAMP,
  data_fim_processamento TIMESTAMP,
  tempo_processamento_segundos INT,
  
  -- Dados Extraídos
  objeto_extraido TEXT,
  objeto_confianca NUMERIC(5, 2),
  
  descricao_extraida TEXT,
  descricao_confianca NUMERIC(5, 2),
  
  requisitos_extridos TEXT,
  requisitos_confianca NUMERIC(5, 2),
  
  cronograma_extrido JSONB,
  cronograma_confianca NUMERIC(5, 2),
  
  valor_extrido NUMERIC(18, 2),
  valor_confianca NUMERIC(5, 2),
  
  documentos_necessarios TEXT,
  documentos_confianca NUMERIC(5, 2),
  
  pontos_criticos_extridos TEXT,
  pontos_criticos_confianca NUMERIC(5, 2),
  
  -- Qualidade da Extração
  confianca_geral NUMERIC(5, 2),
  quantidade_pontos_extraidos INT,
  erros_detectados TEXT,
  requer_revisao_manual BOOLEAN DEFAULT FALSE,
  revisado_em TIMESTAMP,
  revisado_por UUID,
  observacoes_revisor TEXT,
  
  -- Hash e Integridade
  hash_extracao VARCHAR(64),
  versao_extracao INT DEFAULT 1,
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extracao_empresa ON edital_extracao_ia(empresa_id);
CREATE INDEX IF NOT EXISTS idx_extracao_edital ON edital_extracao_ia(edital_id);
CREATE INDEX IF NOT EXISTS idx_extracao_status ON edital_extracao_ia(status_extracao);
CREATE INDEX IF NOT EXISTS idx_extracao_confianca ON edital_extracao_ia(confianca_geral);

-- ============================================================================
-- 3. TABELA: ANÁLISE DE COMPATIBILIDADE COM IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS edital_analise_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE CASCADE,
  extracao_ia_id UUID REFERENCES edital_extracao_ia(id) ON DELETE SET NULL,
  
  -- Análise Técnica
  compatibilidade_tecnica NUMERIC(5, 2),
  capacidade_existente NUMERIC(5, 2),
  capacidade_necessaria NUMERIC(5, 2),
  gap_tecnico NUMERIC(5, 2),
  como_superar_gap TEXT,
  
  -- Análise Financeira
  margem_estimada NUMERIC(5, 2),
  custo_estimado NUMERIC(18, 2),
  risco_financeiro VARCHAR(50) CHECK (risco_financeiro IN ('baixo', 'medio', 'alto', 'critico')),
  
  -- Análise de Mercado
  concorrencia_esperada INT,
  nivel_concorrencia VARCHAR(50) CHECK (nivel_concorrencia IN ('baixo', 'medio', 'alto', 'muito_alto')),
  posicionamento_empresa VARCHAR(255),
  
  -- Análise de Risco
  risco_geral VARCHAR(50) CHECK (risco_geral IN ('baixo', 'medio', 'alto', 'critico')),
  riscos_identificados TEXT,
  mitigacoes_sugeridas TEXT,
  
  -- Score Geral
  score_oportunidade NUMERIC(5, 2),
  recomendacao_ia VARCHAR(50) CHECK (recomendacao_ia IN ('altamente_recomendado', 'recomendado', 'considerar', 'nao_recomendado', 'alto_risco')),
  justificativa_recomendacao TEXT,
  
  -- Confiança da Análise
  confianca_analise NUMERIC(5, 2),
  requer_validacao_manual BOOLEAN DEFAULT FALSE,
  validado_em TIMESTAMP,
  validado_por UUID,
  observacoes_validador TEXT,
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(edital_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_analise_empresa ON edital_analise_ia(empresa_id);
CREATE INDEX IF NOT EXISTS idx_analise_score ON edital_analise_ia(score_oportunidade);

-- ============================================================================
-- 4. TABELA: PREDICÃO DE GANHO/PERDA
-- ============================================================================

CREATE TABLE IF NOT EXISTS edital_predicao_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE CASCADE,
  analise_ia_id UUID REFERENCES edital_analise_ia(id) ON DELETE SET NULL,
  
  -- Predicão Geral
  probabilidade_ganho NUMERIC(5, 2),
  probabilidade_perda NUMERIC(5, 2),
  probabilidade_desempate NUMERIC(5, 2),
  
  -- Fatores de Ganho
  fatores_favoraveis TEXT,
  fator_1_nome VARCHAR(100),
  fator_1_peso NUMERIC(5, 2),
  fator_1_score NUMERIC(5, 2),
  
  fator_2_nome VARCHAR(100),
  fator_2_peso NUMERIC(5, 2),
  fator_2_score NUMERIC(5, 2),
  
  fator_3_nome VARCHAR(100),
  fator_3_peso NUMERIC(5, 2),
  fator_3_score NUMERIC(5, 2),
  
  -- Fatores de Risco
  fatores_desfavoraveis TEXT,
  
  -- Análise de Concorrentes
  concorrentes_esperados TEXT,
  concorrentes_prováveis TEXT,
  posicao_relativa VARCHAR(50) CHECK (posicao_relativa IN ('lideranca', 'bem_posicionado', 'competitivo', 'desvantagem', 'muito_atraso')),
  
  -- Cenários
  cenario_otimista_prob NUMERIC(5, 2),
  cenario_realista_prob NUMERIC(5, 2),
  cenario_pessimista_prob NUMERIC(5, 2),
  
  -- Sugestões de Ação
  sugestoes_melhoria TEXT,
  acao_recomendada VARCHAR(255),
  
  -- Confiança
  confianca_predicao NUMERIC(5, 2),
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(edital_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_predicao_empresa ON edital_predicao_ia(empresa_id);
CREATE INDEX IF NOT EXISTS idx_predicao_prob_ganho ON edital_predicao_ia(probabilidade_ganho);

-- ============================================================================
-- 5. TABELA: ALERTAS GERADOS POR IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS alerta_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID REFERENCES editais_pncp(id) ON DELETE SET NULL,
  tipo_alerta VARCHAR(100) CHECK (tipo_alerta IN (
    'extracao_incompleta', 'confianca_baixa', 'risco_detectado',
    'oportunidade_forte', 'incompatibilidade_tecnica', 'gap_financeiro',
    'prazo_critico', 'requisito_rigoroso', 'concorrencia_forte',
    'alteracao_edital'
  )),
  titulo_alerta VARCHAR(500),
  descricao_alerta TEXT,
  severidade VARCHAR(50) DEFAULT 'media' CHECK (severidade IN ('info', 'baixa', 'media', 'alta', 'critica')),
  score_impacto NUMERIC(5, 2),
  
  -- Recomendação
  acao_sugerida TEXT,
  prioridade_acao INT DEFAULT 100,
  
  -- Rastreamento
  enviado_em TIMESTAMP,
  lido_em TIMESTAMP,
  acao_tomada BOOLEAN DEFAULT FALSE,
  descricao_acao TEXT,
  
  status_alerta VARCHAR(50) DEFAULT 'aberto' CHECK (status_alerta IN ('aberto', 'em_progresso', 'resolvido', 'arquivado')),
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alerta_ia_empresa ON alerta_ia(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alerta_ia_status ON alerta_ia(status_alerta);
CREATE INDEX IF NOT EXISTS idx_alerta_ia_severidade ON alerta_ia(severidade);

-- ============================================================================
-- 6. TABELA: RESUMO EXECUTIVO GERADO POR IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS edital_resumo_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID NOT NULL REFERENCES editais_pncp(id) ON DELETE CASCADE,
  
  -- Resumo Estruturado
  titulo_resumo VARCHAR(500),
  
  resumo_executivo TEXT,
  
  objeto_resumido VARCHAR(1000),
  
  requisitos_principais TEXT,
  
  pontos_fortes_empresa TEXT,
  
  pontos_fracos_empresa TEXT,
  
  oportunidades_texto TEXT,
  
  ameacas_texto TEXT,
  
  recomendacao_final TEXT,
  
  proximos_passos TEXT,
  
  -- Formato
  formato_saida VARCHAR(50) DEFAULT 'markdown' CHECK (formato_saida IN ('markdown', 'html', 'pdf', 'json')),
  
  -- Qualidade
  linguagem_original VARCHAR(50) DEFAULT 'pt-BR',
  confianca_resumo NUMERIC(5, 2),
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(edital_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_resumo_empresa ON edital_resumo_ia(empresa_id);

-- ============================================================================
-- 7. TABELA: FEEDBACK E TREINAMENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS ia_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  edital_id UUID REFERENCES editais_pncp(id) ON DELETE SET NULL,
  tipo_feedback VARCHAR(50) CHECK (tipo_feedback IN ('extracao', 'analise', 'predicao', 'alerta', 'geral')),
  
  predicao_ia VARCHAR(50),
  resultado_real VARCHAR(50),
  acuracia NUMERIC(5, 2),
  
  descricao_feedback TEXT,
  score_util NUMERIC(5, 2),
  
  usar_para_treino BOOLEAN DEFAULT FALSE,
  peso_treino NUMERIC(5, 2),
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_empresa ON ia_feedback(empresa_id);

-- ============================================================================
-- 8. TABELA: LOG DE REQUISIÇÕES IA
-- ============================================================================

CREATE TABLE IF NOT EXISTS ia_requisicoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  tipo_requisicao VARCHAR(100),
  
  prompt_enviado TEXT,
  resposta_recebida TEXT,
  
  tokens_usados INT,
  custo_requisicao NUMERIC(18, 8),
  tempo_resposta_ms INT,
  
  status_requisicao VARCHAR(50) CHECK (status_requisicao IN ('sucesso', 'erro', 'timeout')),
  mensagem_erro TEXT,
  
  modelo_usado VARCHAR(50),
  
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ia_req_empresa ON ia_requisicoes_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_ia_req_data ON ia_requisicoes_log(criado_em);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE ia_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_extracao_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_analise_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_predicao_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerta_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE edital_resumo_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_requisicoes_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

CREATE POLICY ia_config_select ON ia_configuracoes FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY ia_config_insert ON ia_configuracoes FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM usuarios u JOIN perfis p ON u.perfil_id = p.id
  WHERE u.id = auth.uid() AND p.nivel_acesso >= 100 AND u.empresa_id = ia_configuracoes.empresa_id
));

CREATE POLICY extracao_ia_select ON edital_extracao_ia FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY analise_ia_select ON edital_analise_ia FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY predicao_ia_select ON edital_predicao_ia FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY alerta_ia_select ON alerta_ia FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY resumo_ia_select ON edital_resumo_ia FOR SELECT
USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

COMMIT;
