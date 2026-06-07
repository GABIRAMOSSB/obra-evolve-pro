-- FASE 2: Documentos e CNDs
-- Migration 003: Funções de Upload, Storage e Processamento
-- Data: 2026-06-07

-- ============================================================================
-- FUNÇÃO: REGISTRAR UPLOAD DE ARQUIVO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_registrar_arquivo_upload(
  p_empresa_id UUID,
  p_tipo_conteudo VARCHAR,
  p_nome_original VARCHAR,
  p_nome_storage VARCHAR,
  p_bucket_path VARCHAR,
  p_tamanho_bytes INT,
  p_mime_type VARCHAR,
  p_hash_sha256 VARCHAR,
  p_usuario_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_arquivo_id UUID;
  v_bucket_config storage_buckets_config;
BEGIN
  -- Validar tamanho
  SELECT * INTO v_bucket_config
  FROM storage_buckets_config
  WHERE tipo_conteudo = p_tipo_conteudo
    AND status = 'ativo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tipo de conteúdo inválido: %', p_tipo_conteudo;
  END IF;

  IF p_tamanho_bytes > (v_bucket_config.max_file_size_mb * 1024 * 1024) THEN
    RAISE EXCEPTION 'Arquivo excede tamanho máximo de % MB', v_bucket_config.max_file_size_mb;
  END IF;

  -- Registrar arquivo
  INSERT INTO arquivos_uploaded (
    empresa_id,
    tipo_conteudo,
    nome_arquivo_original,
    nome_arquivo_storage,
    bucket_path,
    tamanho_bytes,
    mime_type,
    hash_sha256,
    status,
    criado_em,
    criado_por
  ) VALUES (
    p_empresa_id,
    p_tipo_conteudo,
    p_nome_original,
    p_nome_storage,
    p_bucket_path,
    p_tamanho_bytes,
    p_mime_type,
    p_hash_sha256,
    'pendente',
    CURRENT_TIMESTAMP,
    p_usuario_id
  )
  RETURNING id INTO v_arquivo_id;

  RETURN v_arquivo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: VINCULAR ARQUIVO A DOCUMENTO CND
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_vincular_arquivo_cnd(
  p_fornecedor_documento_id UUID,
  p_arquivo_id UUID,
  p_hash_arquivo VARCHAR
)
RETURNS VOID AS $$
BEGIN
  UPDATE fornecedor_documentos
  SET 
    url_documento = (SELECT bucket_path FROM arquivos_uploaded WHERE id = p_arquivo_id),
    hash_arquivo = p_hash_arquivo,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE id = p_fornecedor_documento_id;

  UPDATE arquivos_uploaded
  SET status = 'processado'
  WHERE id = p_arquivo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: GERAR URL ASSINADA TEMPORÁRIA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_gerar_url_assinada(
  p_arquivo_id UUID,
  p_duracao_horas INT DEFAULT 24
)
RETURNS TABLE(url_assinada VARCHAR, expira_em TIMESTAMP) AS $$
DECLARE
  v_arquivo arquivos_uploaded;
BEGIN
  SELECT * INTO v_arquivo FROM arquivos_uploaded WHERE id = p_arquivo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Arquivo não encontrado';
  END IF;

  -- Placeholder: Integrar com Supabase Storage API para gerar URL assinada
  RETURN QUERY SELECT
    'https://storage.supabase.example.com/signed/' || v_arquivo.bucket_path || '?token=xxxxx'::VARCHAR,
    (CURRENT_TIMESTAMP + (p_duracao_horas || ' hours')::INTERVAL)::TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: DETECTAR DUPLICATAS POR HASH
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_detectar_arquivo_duplicado(
  p_hash_sha256 VARCHAR,
  p_empresa_id UUID
)
RETURNS TABLE(
  arquivo_id UUID,
  nome_arquivo VARCHAR,
  data_upload TIMESTAMP,
  tamanho_bytes INT
) AS $$
BEGIN
  RETURN QUERY SELECT
    a.id,
    a.nome_arquivo_original,
    a.criado_em,
    a.tamanho_bytes
  FROM arquivos_uploaded a
  WHERE a.hash_sha256 = p_hash_sha256
    AND a.empresa_id = p_empresa_id
    AND a.deletado_em IS NULL
    AND a.status != 'erro'
  ORDER BY a.criado_em DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: LIMPEZA DE ARQUIVOS ORFÃOS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_limpar_arquivos_orfaos()
RETURNS TABLE(arquivos_removidos INT) AS $$
DECLARE
  v_removidos INT := 0;
BEGIN
  -- Soft delete de arquivos que não estão mais vinculados
  UPDATE arquivos_uploaded
  SET 
    deletado_em = CURRENT_TIMESTAMP,
    status = 'deletado'
  WHERE status = 'pendente'
    AND criado_em < CURRENT_TIMESTAMP - INTERVAL '7 days'
    AND NOT EXISTS (
      SELECT 1 FROM fornecedor_documentos 
      WHERE url_documento LIKE '%' || arquivos_uploaded.bucket_path || '%'
    );

  GET DIAGNOSTICS v_removidos = ROW_COUNT;
  RETURN QUERY SELECT v_removidos;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: VERIFICAR INTEGRIDADE DE ARQUIVO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_verificar_integridade_arquivo(
  p_arquivo_id UUID,
  p_hash_calculado VARCHAR
)
RETURNS TABLE(
  integridade_ok BOOLEAN,
  mensagem VARCHAR
) AS $$
DECLARE
  v_arquivo arquivos_uploaded;
BEGIN
  SELECT * INTO v_arquivo FROM arquivos_uploaded WHERE id = p_arquivo_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Arquivo não encontrado'::VARCHAR;
    RETURN;
  END IF;

  IF v_arquivo.hash_sha256 = p_hash_calculado THEN
    RETURN QUERY SELECT TRUE::BOOLEAN, 'Integridade verificada com sucesso'::VARCHAR;
  ELSE
    RETURN QUERY SELECT FALSE::BOOLEAN, 'Hash não corresponde. Arquivo pode estar corrompido.'::VARCHAR;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: MIGRAR ARQUIVO ENTRE BUCKETS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_migrar_arquivo(
  p_arquivo_id UUID,
  p_novo_bucket VARCHAR,
  p_novo_path VARCHAR
)
RETURNS VOID AS $$
BEGIN
  -- Validar novo bucket
  IF NOT EXISTS (
    SELECT 1 FROM storage_buckets_config
    WHERE bucket_name = p_novo_bucket AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION 'Bucket destino inválido ou inativo';
  END IF;

  UPDATE arquivos_uploaded
  SET 
    bucket_path = p_novo_path,
    atualizado_em = CURRENT_TIMESTAMP
  WHERE id = p_arquivo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: CALCULAR ESPAÇO TOTAL POR EMPRESA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_calcular_espaco_empresa(
  p_empresa_id UUID
)
RETURNS TABLE(
  empresa_id UUID,
  total_bytes BIGINT,
  total_mb NUMERIC,
  total_gb NUMERIC,
  quantidade_arquivos INT
) AS $$
BEGIN
  RETURN QUERY SELECT
    p_empresa_id::UUID,
    SUM(COALESCE(a.tamanho_bytes, 0))::BIGINT,
    (SUM(COALESCE(a.tamanho_bytes, 0))::NUMERIC / 1024 / 1024)::NUMERIC,
    (SUM(COALESCE(a.tamanho_bytes, 0))::NUMERIC / 1024 / 1024 / 1024)::NUMERIC,
    COUNT(*)::INT
  FROM arquivos_uploaded a
  WHERE a.empresa_id = p_empresa_id
    AND a.deletado_em IS NULL
    AND a.status != 'erro';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: LISTAR ALERTAS PENDENTES POR EMPRESA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_listar_alertas_pendentes(
  p_empresa_id UUID
)
RETURNS TABLE(
  alerta_id UUID,
  tipo_alerta VARCHAR,
  fornecedor_nome VARCHAR,
  documento_descricao VARCHAR,
  dias_para_vencer INT,
  data_alerta TIMESTAMP,
  status VARCHAR
) AS $$
BEGIN
  RETURN QUERY SELECT
    a.id,
    a.tipo_alerta,
    f.razao_social,
    td.descricao,
    a.dias_para_vencer,
    a.data_alerta,
    a.status
  FROM alertas_documentos a
  LEFT JOIN fornecedor_documentos fd ON fd.id = a.fornecedor_documento_id
  LEFT JOIN fornecedores f ON f.id = fd.fornecedor_id
  LEFT JOIN tipos_documentos td ON td.id = fd.tipo_documento_id
  WHERE a.empresa_id = p_empresa_id
    AND a.status = 'aberto'
  ORDER BY a.data_alerta ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- AUDITAR EVENTOS DE UPLOAD
-- ============================================================================

CREATE TRIGGER trg_audit_arquivos_uploaded
AFTER INSERT OR UPDATE OR DELETE ON arquivos_uploaded
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- SOFT DELETE ENFORCEMENT
-- ============================================================================

CREATE TRIGGER trg_prevent_delete_fornecedor_docs
BEFORE DELETE ON fornecedor_documentos
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_prevent_delete_arquivos
BEFORE DELETE ON arquivos_uploaded
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

COMMIT;
