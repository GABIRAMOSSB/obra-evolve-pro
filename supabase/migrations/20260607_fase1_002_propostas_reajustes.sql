-- FASE 1: Fundação Segura
-- Migration 002: Tabelas Propostas, Cronogramas, Boletins e Reajustes
-- Data: 2026-06-07

-- ============================================================================
-- 1. TABELA: PROPOSTAS COMERCIAIS
-- ============================================================================

CREATE TABLE IF NOT EXISTS propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  obra_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  numero_proposta VARCHAR(100) UNIQUE NOT NULL,
  descricao TEXT,
  valor_original NUMERIC(18, 2) NOT NULL,
  valor_final NUMERIC(18, 2),
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_analise', 'aprovada', 'rejeitada', 'readequada')),
  tipo_proposta VARCHAR(50) CHECK (tipo_proposta IN ('original', 'readequada', 'carta_proposta')),
  hash_original VARCHAR(64),
  url_documento VARCHAR(500),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  deletado_em TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_propostas_empresa_id ON propostas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_propostas_numero ON propostas(numero_proposta);
CREATE INDEX IF NOT EXISTS idx_propostas_status ON propostas(status);

-- ============================================================================
-- 2. TABELA: ITENS DA PROPOSTA
-- ============================================================================

CREATE TABLE IF NOT EXISTS propostas_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES propostas(id) ON DELETE CASCADE,
  numero_item INT NOT NULL,
  descricao VARCHAR(500) NOT NULL,
  quantidade NUMERIC(18, 6) NOT NULL,
  unidade VARCHAR(20),
  preco_unitario_original NUMERIC(18, 8),
  preco_unitario_readequado NUMERIC(18, 8),
  total_original NUMERIC(18, 2),
  total_readequado NUMERIC(18, 2),
  UNIQUE(proposta_id, numero_item)
);

CREATE INDEX IF NOT EXISTS idx_propostas_itens_proposta_id ON propostas_itens(proposta_id);

-- ============================================================================
-- 3. TABELA: PROPOSTAS READEQUADAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS propostas_readequadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_original_id UUID NOT NULL REFERENCES propostas(id) ON DELETE RESTRICT,
  proposta_readequada_id UUID NOT NULL REFERENCES propostas(id) ON DELETE RESTRICT,
  fator_readequacao NUMERIC(18, 10),
  percentual_desconto NUMERIC(18, 8),
  motivo_mudanca TEXT,
  valor_residuo NUMERIC(18, 2),
  estrategia_arredondamento VARCHAR(100) CHECK (estrategia_arredondamento IN ('maior_resto', 'menor_incremento', 'proporcional')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID
);

CREATE INDEX IF NOT EXISTS idx_propostas_readequadas_original ON propostas_readequadas(proposta_original_id);

-- ============================================================================
-- 4. TABELA: CRONOGRAMAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS cronogramas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
  tipo_cronograma VARCHAR(50) CHECK (tipo_cronograma IN ('fisico_financeiro', 'simplificado', 'compatibilizado')),
  numero_cronograma INT DEFAULT 1,
  descricao TEXT,
  data_inicio TIMESTAMP,
  data_fim TIMESTAMP,
  percentual_total_fisico NUMERIC(5, 2),
  valor_total_financeiro NUMERIC(18, 2),
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'validado', 'em_execucao', 'concluido')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID
);

CREATE INDEX IF NOT EXISTS idx_cronogramas_empresa_id ON cronogramas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cronogramas_contrato_id ON cronogramas(contrato_id);

-- ============================================================================
-- 5. TABELA: PERÍODOS CRONOGRAMA
-- ============================================================================

CREATE TABLE IF NOT EXISTS cronograma_periodos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cronograma_id UUID NOT NULL REFERENCES cronogramas(id) ON DELETE CASCADE,
  numero_periodo INT NOT NULL,
  mes INT,
  ano INT,
  percentual_fisico NUMERIC(5, 4),
  valor_financeiro NUMERIC(18, 2),
  UNIQUE(cronograma_id, numero_periodo)
);

CREATE INDEX IF NOT EXISTS idx_cronograma_periodos_cronograma_id ON cronograma_periodos(cronograma_id);

-- ============================================================================
-- 6. TABELA: BOLETINS DE MEDIÇÃO
-- ============================================================================

CREATE TABLE IF NOT EXISTS boletins_medicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE RESTRICT,
  numero_bm INT NOT NULL,
  data_medicao TIMESTAMP,
  periodo_inicio TIMESTAMP,
  periodo_fim TIMESTAMP,
  acumulado_anterior NUMERIC(18, 2),
  valor_periodo NUMERIC(18, 2),
  acumulado_atual NUMERIC(18, 2),
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'validado', 'faturado', 'cancelado')),
  observacoes TEXT,
  url_pdf VARCHAR(500),
  url_excel VARCHAR(500),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  UNIQUE(contrato_id, numero_bm)
);

CREATE INDEX IF NOT EXISTS idx_boletins_medicao_empresa_id ON boletins_medicao(empresa_id);
CREATE INDEX IF NOT EXISTS idx_boletins_medicao_contrato_id ON boletins_medicao(contrato_id);
CREATE INDEX IF NOT EXISTS idx_boletins_medicao_numero ON boletins_medicao(numero_bm);

-- ============================================================================
-- 7. TABELA: ITENS DO BOLETIM DE MEDIÇÃO
-- ============================================================================

CREATE TABLE IF NOT EXISTS bm_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boletim_id UUID NOT NULL REFERENCES boletins_medicao(id) ON DELETE CASCADE,
  etapa_id VARCHAR(100),
  descricao VARCHAR(500),
  quantidade_periodo NUMERIC(18, 6),
  valor_periodo NUMERIC(18, 2),
  acumulado_anterior NUMERIC(18, 6),
  acumulado_atual NUMERIC(18, 6)
);

CREATE INDEX IF NOT EXISTS idx_bm_itens_boletim_id ON bm_itens(boletim_id);

-- ============================================================================
-- 8. TABELA: CLÁUSULAS DE REAJUSTE
-- ============================================================================

CREATE TABLE IF NOT EXISTS clausulas_reajuste (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  tipo_reajuste VARCHAR(50) CHECK (tipo_reajuste IN ('reajuste_estrito', 'repactuacao', 'reequilibrio')),
  regime_reajuste VARCHAR(50),
  data_base_inicial TIMESTAMP,
  indice_tipo VARCHAR(100) CHECK (indice_tipo IN ('ipca', 'inpc', 'incc', 'igp_m', 'outro')),
  indice_fonte VARCHAR(100) CHECK (indice_fonte IN ('ibge', 'bcb', 'fgv', 'manual')),
  formula_reajuste TEXT,
  periodicidade VARCHAR(50) CHECK (periodicidade IN ('mensal', 'anual', 'conforme_publicacao')),
  ultima_anualidade TIMESTAMP,
  proxima_anualidade TIMESTAMP,
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'finalizado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID
);

CREATE INDEX IF NOT EXISTS idx_clausulas_reajuste_contrato_id ON clausulas_reajuste(contrato_id);

-- ============================================================================
-- 9. TABELA: ÍNDICES ECONÔMICOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS indices_economicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_indice VARCHAR(100) NOT NULL CHECK (tipo_indice IN ('ipca', 'inpc', 'incc', 'igp_m', 'outro')),
  fonte VARCHAR(100) CHECK (fonte IN ('ibge', 'bcb', 'fgv', 'manual')),
  competencia DATE NOT NULL,
  numero_indice NUMERIC(18, 10),
  variacao_mensal NUMERIC(18, 8),
  variacao_acumulada_12m NUMERIC(18, 8),
  url_fonte VARCHAR(500),
  hash_snapshot VARCHAR(64),
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'supersedido')),
  data_consulta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tipo_indice, fonte, competencia)
);

CREATE INDEX IF NOT EXISTS idx_indices_economicos_tipo ON indices_economicos(tipo_indice);
CREATE INDEX IF NOT EXISTS idx_indices_economicos_competencia ON indices_economicos(competencia);

-- ============================================================================
-- 10. TABELA: REAJUSTES CONTRATUAIS
-- ============================================================================

CREATE TABLE IF NOT EXISTS reajustes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL REFERENCES contratos(id) ON DELETE CASCADE,
  clausula_reajuste_id UUID REFERENCES clausulas_reajuste(id) ON DELETE SET NULL,
  numero_ciclo INT,
  data_base_inicial TIMESTAMP,
  data_base_atual TIMESTAMP,
  indice_inicial_id UUID REFERENCES indices_economicos(id),
  indice_atual_id UUID REFERENCES indices_economicos(id),
  fator_reajuste NUMERIC(18, 10),
  percentual_reajuste NUMERIC(18, 8),
  valor_elegivel NUMERIC(18, 2),
  valor_reajuste NUMERIC(18, 2),
  valor_atualizado NUMERIC(18, 2),
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'calculado', 'oficio_gerado', 'protocolo_enviado', 'apostilado', 'aplicado', 'cancelado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reajustes_contrato_id ON reajustes(contrato_id);
CREATE INDEX IF NOT EXISTS idx_reajustes_status ON reajustes(status);

-- ============================================================================
-- 11. TABELA: BASE ELEGÍVEL DO REAJUSTE
-- ============================================================================

CREATE TABLE IF NOT EXISTS reajuste_base_elegivel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reajuste_id UUID NOT NULL REFERENCES reajustes(id) ON DELETE CASCADE,
  boletim_medicao_id UUID REFERENCES boletins_medicao(id),
  saldo_contratual NUMERIC(18, 2),
  exclusoes_motivo TEXT,
  valor_elegivel NUMERIC(18, 2),
  percentual_elegibilidade NUMERIC(5, 2)
);

CREATE INDEX IF NOT EXISTS idx_reajuste_base_elegivel_reajuste_id ON reajuste_base_elegivel(reajuste_id);

-- ============================================================================
-- 12. TABELA: SIGNATÁRIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS signatarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  nome_completo VARCHAR(255) NOT NULL,
  cargo VARCHAR(255),
  cpf_masked VARCHAR(20),
  categoria_signatario VARCHAR(50) CHECK (categoria_signatario IN ('socio_administrador', 'representante_legal', 'procurador', 'responsavel_tecnico', 'fiscal', 'representante_externo', 'eventual')),
  email VARCHAR(255),
  whatsapp VARCHAR(20),
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID
);

CREATE INDEX IF NOT EXISTS idx_signatarios_empresa_id ON signatarios(empresa_id);

-- ============================================================================
-- 13. TABELA: MATRIZ DE PODERES
-- ============================================================================

CREATE TABLE IF NOT EXISTS matriz_poderes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signatario_id UUID NOT NULL REFERENCES signatarios(id) ON DELETE CASCADE,
  tipo_documento VARCHAR(100),
  origem_documento VARCHAR(100) CHECK (origem_documento IN ('contrato_social', 'alteracao_contrato', 'procuracao', 'outro')),
  poder_limite NUMERIC(18, 2),
  data_validade TIMESTAMP,
  data_restrição TIMESTAMP,
  obra_restrita_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'vencido', 'revogado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_matriz_poderes_signatario_id ON matriz_poderes(signatario_id);

-- ============================================================================
-- 14. TABELA: PROCURAÇÕES
-- ============================================================================

CREATE TABLE IF NOT EXISTS procuracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  outorgante_id UUID NOT NULL REFERENCES signatarios(id) ON DELETE RESTRICT,
  procurador_id UUID NOT NULL REFERENCES signatarios(id) ON DELETE RESTRICT,
  data_emissao TIMESTAMP,
  data_validade TIMESTAMP,
  poderes TEXT,
  limitacoes TEXT,
  url_pdf_documento VARCHAR(500),
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'vencida', 'revogada')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_procuracoes_empresa_id ON procuracoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_procuracoes_outorgante_id ON procuracoes(outorgante_id);
CREATE INDEX IF NOT EXISTS idx_procuracoes_procurador_id ON procuracoes(procurador_id);

COMMIT;
