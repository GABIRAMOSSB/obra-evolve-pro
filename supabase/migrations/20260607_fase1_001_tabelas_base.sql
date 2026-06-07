-- FASE 1: Fundação Segura
-- Migration 001: Tabelas Base (Empresas, Usuários, Perfis)
-- Data: 2026-06-07
-- Objetivo: Criar estrutura fundamental do SOLV GESTÃO

-- ============================================================================
-- 1. TABELA: EMPRESAS (Fonte Única)
-- ============================================================================

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  endereco_rua VARCHAR(255),
  endereco_numero VARCHAR(20),
  endereco_complemento VARCHAR(255),
  endereco_bairro VARCHAR(255),
  endereco_cidade VARCHAR(255),
  endereco_estado VARCHAR(2),
  endereco_cep VARCHAR(10),
  email_contato VARCHAR(255),
  telefone_contato VARCHAR(20),
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  deletado_em TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_empresas_cnpj ON empresas(cnpj);
CREATE INDEX IF NOT EXISTS idx_empresas_status ON empresas(status);
CREATE INDEX IF NOT EXISTS idx_empresas_deletado_em ON empresas(deletado_em);

-- ============================================================================
-- 2. TABELA: PERFIS
-- ============================================================================

CREATE TABLE IF NOT EXISTS perfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) UNIQUE NOT NULL,
  descricao TEXT,
  permissoes JSONB DEFAULT '[]'::JSONB,
  nivel_acesso INT DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir perfis padrão
INSERT INTO perfis (nome, descricao, nivel_acesso) VALUES
  ('admin', 'Administrador com acesso total', 100),
  ('gestor', 'Gestor de projetos e obras', 80),
  ('analista', 'Analista de licitações e propostas', 60),
  ('consultor', 'Consultor técnico', 50),
  ('visualizador', 'Visualizador apenas leitura', 10)
ON CONFLICT (nome) DO NOTHING;

-- ============================================================================
-- 3. TABELA: USUÁRIOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  nome_completo VARCHAR(255) NOT NULL,
  cpf VARCHAR(14),
  telefone VARCHAR(20),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  perfil_id UUID NOT NULL REFERENCES perfis(id) ON DELETE RESTRICT,
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso')),
  ultimo_acesso TIMESTAMP,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  deletado_em TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_id ON usuarios(empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_perfil_id ON usuarios(perfil_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_status ON usuarios(status);
CREATE INDEX IF NOT EXISTS idx_usuarios_deletado_em ON usuarios(deletado_em);

-- ============================================================================
-- 4. TABELA: OBRAS (Fonte Única)
-- ============================================================================

CREATE TABLE IF NOT EXISTS obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  numero_obra VARCHAR(100) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  localizacao_endereco VARCHAR(255),
  localizacao_cidade VARCHAR(255),
  localizacao_estado VARCHAR(2),
  valor_contratado NUMERIC(18, 2),
  status VARCHAR(50) DEFAULT 'em_planejamento' CHECK (status IN ('em_planejamento', 'em_execucao', 'concluida', 'suspensa', 'cancelada')),
  data_inicio TIMESTAMP,
  data_prevista_fim TIMESTAMP,
  data_fim_real TIMESTAMP,
  responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  deletado_em TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_obras_empresa_id ON obras(empresa_id);
CREATE INDEX IF NOT EXISTS idx_obras_numero_obra ON obras(numero_obra);
CREATE INDEX IF NOT EXISTS idx_obras_status ON obras(status);
CREATE INDEX IF NOT EXISTS idx_obras_deletado_em ON obras(deletado_em);

-- ============================================================================
-- 5. TABELA: FORNECEDORES (Fonte Única)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  cnpj VARCHAR(18) UNIQUE NOT NULL,
  razao_social VARCHAR(255) NOT NULL,
  nome_fantasia VARCHAR(255),
  endereco_rua VARCHAR(255),
  endereco_numero VARCHAR(20),
  endereco_complemento VARCHAR(255),
  endereco_bairro VARCHAR(255),
  endereco_cidade VARCHAR(255),
  endereco_estado VARCHAR(2),
  endereco_cep VARCHAR(10),
  email_contato VARCHAR(255),
  telefone_contato VARCHAR(20),
  contato_principal VARCHAR(255),
  tipo_fornecedor VARCHAR(50) DEFAULT 'fornecedor' CHECK (tipo_fornecedor IN ('fornecedor', 'subempreiteiro', 'prestador')),
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'bloqueado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  deletado_em TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_id ON fornecedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_cnpj ON fornecedores(cnpj);
CREATE INDEX IF NOT EXISTS idx_fornecedores_status ON fornecedores(status);
CREATE INDEX IF NOT EXISTS idx_fornecedores_deletado_em ON fornecedores(deletado_em);

-- ============================================================================
-- 6. TABELA: CONTRATOS (Fonte Única)
-- ============================================================================

CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE RESTRICT,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE RESTRICT,
  numero_contrato VARCHAR(100) UNIQUE NOT NULL,
  descricao TEXT,
  valor_total NUMERIC(18, 2) NOT NULL,
  data_assinatura TIMESTAMP,
  data_inicio TIMESTAMP,
  data_prevista_fim TIMESTAMP,
  data_fim_real TIMESTAMP,
  regime_execucao VARCHAR(50) CHECK (regime_execucao IN ('empreitada', 'empreitada_integral', 'por_preco', 'por_administracao')),
  status VARCHAR(50) DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'ativo', 'suspenso', 'encerrado', 'rescindido')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  deletado_em TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_contratos_empresa_id ON contratos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contratos_obra_id ON contratos(obra_id);
CREATE INDEX IF NOT EXISTS idx_contratos_fornecedor_id ON contratos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contratos_numero_contrato ON contratos(numero_contrato);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_deletado_em ON contratos(deletado_em);

-- ============================================================================
-- 7. TABELA: CENTROS DE CUSTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS centros_custo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo VARCHAR(50) CHECK (tipo IN ('departamento', 'projeto', 'obra', 'linha_negocio')),
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_centros_custo_empresa_id ON centros_custo(empresa_id);
CREATE INDEX IF NOT EXISTS idx_centros_custo_codigo ON centros_custo(codigo);

-- ============================================================================
-- 8. TABELA: DOCUMENTOS E VERSIONING
-- ============================================================================

CREATE TABLE IF NOT EXISTS documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  tipo_documento VARCHAR(100) NOT NULL,
  descricao VARCHAR(500),
  url_storage VARCHAR(500),
  hash_arquivo VARCHAR(64),
  tamanho_bytes BIGINT,
  mime_type VARCHAR(100),
  versao_atual INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'supersedido', 'arquivado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  deletado_em TIMESTAMP DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_documentos_empresa_id ON documentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_documentos_tipo ON documentos(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_documentos_hash ON documentos(hash_arquivo);
CREATE INDEX IF NOT EXISTS idx_documentos_status ON documentos(status);

-- ============================================================================
-- 9. TABELA: VERSÕES DE DOCUMENTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS documentos_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  numero_versao INT NOT NULL,
  hash_arquivo VARCHAR(64),
  motivo_mudanca VARCHAR(500),
  url_storage_versao VARCHAR(500),
  criado_por UUID,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(documento_id, numero_versao)
);

CREATE INDEX IF NOT EXISTS idx_documentos_versoes_documento_id ON documentos_versoes(documento_id);

-- ============================================================================
-- 10. TABELA: AUDITORIA LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS auditoria_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  acao VARCHAR(50) NOT NULL CHECK (acao IN ('CREATE', 'UPDATE', 'DELETE', 'READ')),
  modulo VARCHAR(100) NOT NULL,
  entidade VARCHAR(100) NOT NULL,
  registro_id UUID,
  dados_antes JSONB,
  dados_depois JSONB,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  resultado VARCHAR(50) DEFAULT 'sucesso' CHECK (resultado IN ('sucesso', 'erro')),
  mensagem_erro TEXT,
  hash_integridade VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_auditoria_logs_usuario_id ON auditoria_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_modulo ON auditoria_logs(modulo);
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_entidade ON auditoria_logs(entidade);
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_timestamp ON auditoria_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_registro_id ON auditoria_logs(registro_id);

-- Garantir que auditoria_logs não pode ser alterada
ALTER TABLE auditoria_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMENTÁRIOS DAS TABELAS (Próximas Migrations)
-- ============================================================================

-- As seguintes tabelas serão criadas em migrations subsequentes:
-- - oportunidades_pncp (FASE 3)
-- - editais (FASE 4)
-- - propostas (FASE 7)
-- - cronogramas (FASE 8)
-- - boletins_medicao (FASE 1 - BM preservado)
-- - reajustes (FASE 12)
-- - signatarios (FASE 5)
-- - assinaturas_eletronica (FASE 5)
-- - indices_economicos (FASE 11)

COMMIT;
