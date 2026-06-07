-- FASE 2: Documentos e CNDs
-- Migration 001: Tabelas de Documentos CND e Alertas
-- Data: 2026-06-07

-- ============================================================================
-- 1. TABELA: TIPOS DE DOCUMENTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS tipos_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) UNIQUE NOT NULL,
  descricao VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) CHECK (categoria IN ('cnd', 'contratual', 'tecnico', 'administrativo', 'legal')),
  dias_validade INT,
  exigido_para_contrato BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  UNIQUE(codigo)
);

INSERT INTO tipos_documentos (codigo, descricao, categoria, dias_validade, exigido_para_contrato)
VALUES
  ('CND', 'Certidão Negativa de Débito', 'cnd', 365, TRUE),
  ('CRF', 'Certidão de Regularidade Fiscal', 'cnd', 180, TRUE),
  ('CCF', 'Certificado de Conformidade Fiscal', 'cnd', 365, FALSE),
  ('CERT_SINDICAL', 'Certidão Negativa Sindical', 'legal', 365, FALSE),
  ('CERT_TRABALHISTA', 'Certidão Negativa Trabalhista', 'legal', 365, FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. TABELA: DOCUMENTOS DO FORNECEDOR (CND, CERT, etc)
-- ============================================================================

CREATE TABLE IF NOT EXISTS fornecedor_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  fornecedor_id UUID NOT NULL REFERENCES fornecedores(id) ON DELETE CASCADE,
  tipo_documento_id UUID NOT NULL REFERENCES tipos_documentos(id),
  numero_documento VARCHAR(100),
  data_emissao TIMESTAMP,
  data_validade TIMESTAMP,
  emitente VARCHAR(255),
  url_documento VARCHAR(500),
  hash_arquivo VARCHAR(64),
  tamanho_arquivo INT,
  status VARCHAR(50) DEFAULT 'valido' CHECK (status IN ('valido', 'vencido', 'pendente_renovacao', 'cancelado')),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_por UUID,
  UNIQUE(fornecedor_id, tipo_documento_id)
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_docs_empresa ON fornecedor_documentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_docs_fornecedor ON fornecedor_documentos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_fornecedor_docs_status ON fornecedor_documentos(status);
CREATE INDEX IF NOT EXISTS idx_fornecedor_docs_validade ON fornecedor_documentos(data_validade);

-- ============================================================================
-- 3. TABELA: HISTÓRICO VERSÕES CND
-- ============================================================================

CREATE TABLE IF NOT EXISTS fornecedor_documentos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_documento_id UUID NOT NULL REFERENCES fornecedor_documentos(id) ON DELETE CASCADE,
  numero_versao INT,
  numero_documento VARCHAR(100),
  data_emissao TIMESTAMP,
  data_validade TIMESTAMP,
  emitente VARCHAR(255),
  url_documento VARCHAR(500),
  hash_arquivo VARCHAR(64),
  motivo_mudanca TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  UNIQUE(fornecedor_documento_id, numero_versao)
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_docs_hist_doc ON fornecedor_documentos_historico(fornecedor_documento_id);

-- ============================================================================
-- 4. TABELA: ALERTAS DE VENCIMENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS alertas_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  fornecedor_documento_id UUID REFERENCES fornecedor_documentos(id) ON DELETE CASCADE,
  tipo_alerta VARCHAR(50) CHECK (tipo_alerta IN ('vencimento_proximo', 'vencido', 'renovacao_pendente')),
  dias_para_vencer INT,
  data_alerta TIMESTAMP,
  descricao TEXT,
  destinatarios_email TEXT,
  lido_em TIMESTAMP,
  acao_realizada BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'aberto' CHECK (status IN ('aberto', 'resolvido', 'ignorado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_alertas_empresa ON alertas_documentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_alertas_status ON alertas_documentos(status);
CREATE INDEX IF NOT EXISTS idx_alertas_vencimento ON alertas_documentos(data_alerta);

-- ============================================================================
-- 5. TABELA: POLITICA DE DOCUMENTOS (Por tipo e empresa)
-- ============================================================================

CREATE TABLE IF NOT EXISTS politicas_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  tipo_documento_id UUID NOT NULL REFERENCES tipos_documentos(id),
  obrigatorio BOOLEAN DEFAULT FALSE,
  dias_aviso_vencimento INT DEFAULT 30,
  exigir_para_pagamento BOOLEAN DEFAULT FALSE,
  bloquear_contrato_sem_doc BOOLEAN DEFAULT FALSE,
  requer_aprovacao_gestor BOOLEAN DEFAULT FALSE,
  UNIQUE(empresa_id, tipo_documento_id)
);

CREATE INDEX IF NOT EXISTS idx_politicas_empresa ON politicas_documento(empresa_id);

-- ============================================================================
-- 6. TABELA: INTEGRAÇÃO CND API
-- ============================================================================

CREATE TABLE IF NOT EXISTS cnd_integracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  api_provider VARCHAR(50) CHECK (api_provider IN ('gcm', 'receita_federal', 'manual')),
  endpoint_url VARCHAR(500),
  api_key_hash VARCHAR(64),
  status VARCHAR(50) DEFAULT 'nao_configurado' CHECK (status IN ('nao_configurado', 'configurado', 'testado', 'erro')),
  ultima_sincronizacao TIMESTAMP,
  proxima_sincronizacao TIMESTAMP,
  frequencia_horas INT DEFAULT 24,
  criar_automaticamente BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cnd_integracao_empresa ON cnd_integracao(empresa_id);

-- ============================================================================
-- 7. TABELA: LOG DE REQUISIÇÕES CND
-- ============================================================================

CREATE TABLE IF NOT EXISTS cnd_requisicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  fornecedor_id UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  api_provider VARCHAR(50),
  cnpj_consultado VARCHAR(18),
  situacao_retornada VARCHAR(100),
  descricao_retorno TEXT,
  hash_snapshot VARCHAR(64),
  status_requisicao VARCHAR(50) CHECK (status_requisicao IN ('sucesso', 'erro', 'pendente')),
  mensagem_erro TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tempo_resposta_ms INT
);

CREATE INDEX IF NOT EXISTS idx_cnd_reqs_empresa ON cnd_requisicoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cnd_reqs_fornecedor ON cnd_requisicoes(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_cnd_reqs_data ON cnd_requisicoes(criado_em);

-- ============================================================================
-- 8. TABELA: BUCKETS DE ARMAZENAMENTO
-- ============================================================================

CREATE TABLE IF NOT EXISTS storage_buckets_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  bucket_name VARCHAR(100) UNIQUE NOT NULL,
  tipo_conteudo VARCHAR(50) CHECK (tipo_conteudo IN ('cnd', 'contratos', 'propostas', 'editais', 'assinados', 'bm')),
  max_file_size_mb INT DEFAULT 50,
  formatos_permitidos VARCHAR(255) DEFAULT 'pdf,jpg,png,docx',
  criar_versionamento BOOLEAN DEFAULT TRUE,
  status VARCHAR(50) DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo'))
);

-- Pre-populate com buckets padrão
INSERT INTO storage_buckets_config (bucket_name, tipo_conteudo, max_file_size_mb)
VALUES
  ('cnd-documentos', 'cnd', 10),
  ('contratos-assinados', 'contratos', 100),
  ('propostas-comerciais', 'propostas', 50),
  ('editais-pncp', 'editais', 30),
  ('documentos-assinados', 'assinados', 100),
  ('boletins-medicao', 'bm', 25)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. TABELA: ARQUIVOS ENVIADOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS arquivos_uploaded (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE RESTRICT,
  tipo_conteudo VARCHAR(50) NOT NULL,
  nome_arquivo_original VARCHAR(500),
  nome_arquivo_storage VARCHAR(500),
  bucket_path VARCHAR(500),
  tamanho_bytes INT,
  mime_type VARCHAR(100),
  hash_sha256 VARCHAR(64),
  url_publica VARCHAR(500),
  url_assinada VARCHAR(500),
  data_expiracao_url TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'processado', 'erro', 'deletado')),
  scanner_malware_status VARCHAR(50) DEFAULT 'pendente' CHECK (scanner_malware_status IN ('pendente', 'limpo', 'suspeito', 'infectado')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por UUID,
  deletado_em TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_arquivos_empresa ON arquivos_uploaded(empresa_id);
CREATE INDEX IF NOT EXISTS idx_arquivos_hash ON arquivos_uploaded(hash_sha256);
CREATE INDEX IF NOT EXISTS idx_arquivos_tipo ON arquivos_uploaded(tipo_conteudo);
CREATE INDEX IF NOT EXISTS idx_arquivos_status ON arquivos_uploaded(status);

-- ============================================================================
-- ENABLE RLS
-- ============================================================================

ALTER TABLE tipos_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedor_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedor_documentos_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertas_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE politicas_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnd_integracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE cnd_requisicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_buckets_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE arquivos_uploaded ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Tipos de documentos: readonly para todos
CREATE POLICY tipos_docs_select ON tipos_documentos FOR SELECT USING (TRUE);

-- Fornecedor documentos
CREATE POLICY fornecedor_docs_select ON fornecedor_documentos
  FOR SELECT
  USING (
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY fornecedor_docs_insert ON fornecedor_documentos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 60
        AND u.empresa_id = fornecedor_documentos.empresa_id
    )
  );

-- Alertas
CREATE POLICY alertas_select ON alertas_documentos
  FOR SELECT
  USING (
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

-- Arquivos
CREATE POLICY arquivos_select ON arquivos_uploaded
  FOR SELECT
  USING (
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())
  );

COMMIT;
