-- FASE 2: Documentos e CNDs
-- Migration 002: Triggers, Funções e Job Scheduler
-- Data: 2026-06-07

-- ============================================================================
-- FUNÇÃO: CRIAR ALERTA AUTOMÁTICO PARA VENCIMENTO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_criar_alerta_vencimento()
RETURNS TRIGGER AS $$
DECLARE
  v_dias_para_vencer INT;
  v_politica politicas_documento;
BEGIN
  -- Obter política de documento
  SELECT * INTO v_politica
  FROM politicas_documento
  WHERE empresa_id = NEW.empresa_id
    AND tipo_documento_id = NEW.tipo_documento_id;

  -- Se política existe e configurada para alertar
  IF v_politica.dias_aviso_vencimento > 0 THEN
    v_dias_para_vencer := (NEW.data_validade::DATE - CURRENT_DATE);
    
    -- Se faltam X dias para vencer, criar alerta
    IF v_dias_para_vencer > 0 AND v_dias_para_vencer <= v_politica.dias_aviso_vencimento THEN
      INSERT INTO alertas_documentos (
        empresa_id,
        fornecedor_documento_id,
        tipo_alerta,
        dias_para_vencer,
        data_alerta,
        descricao,
        status
      ) VALUES (
        NEW.empresa_id,
        NEW.id,
        'vencimento_proximo',
        v_dias_para_vencer,
        CURRENT_TIMESTAMP,
        'Documento ' || (SELECT descricao FROM tipos_documentos WHERE id = NEW.tipo_documento_id) || 
        ' do fornecedor ' || (SELECT razao_social FROM fornecedores WHERE id = NEW.fornecedor_id) || 
        ' vence em ' || v_dias_para_vencer || ' dias',
        'aberto'
      );
    END IF;

    -- Se venceu, criar alerta de vencido
    IF NEW.data_validade < CURRENT_TIMESTAMP THEN
      INSERT INTO alertas_documentos (
        empresa_id,
        fornecedor_documento_id,
        tipo_alerta,
        dias_para_vencer,
        data_alerta,
        descricao,
        status
      ) VALUES (
        NEW.empresa_id,
        NEW.id,
        'vencido',
        0,
        CURRENT_TIMESTAMP,
        'Documento vencido: ' || (SELECT descricao FROM tipos_documentos WHERE id = NEW.tipo_documento_id),
        'aberto'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER trg_alerta_vencimento_cnd
AFTER INSERT OR UPDATE ON fornecedor_documentos
FOR EACH ROW EXECUTE FUNCTION fn_criar_alerta_vencimento();

-- ============================================================================
-- FUNÇÃO: VERSIONAR CND
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_versionnar_documento_cnd()
RETURNS TRIGGER AS $$
DECLARE
  v_max_versao INT;
BEGIN
  -- Obter versão máxima anterior
  SELECT COALESCE(MAX(numero_versao), 0) + 1 INTO v_max_versao
  FROM fornecedor_documentos_historico
  WHERE fornecedor_documento_id = NEW.id;

  -- Inserir no histórico se é UPDATE (não INSERT)
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO fornecedor_documentos_historico (
      fornecedor_documento_id,
      numero_versao,
      numero_documento,
      data_emissao,
      data_validade,
      emitente,
      url_documento,
      hash_arquivo,
      motivo_mudanca,
      criado_por
    ) VALUES (
      NEW.id,
      v_max_versao,
      OLD.numero_documento,
      OLD.data_emissao,
      OLD.data_validade,
      OLD.emitente,
      OLD.url_documento,
      OLD.hash_arquivo,
      'Renovação/Atualização de documento',
      NEW.atualizado_por
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER trg_versionar_cnd
AFTER UPDATE ON fornecedor_documentos
FOR EACH ROW EXECUTE FUNCTION fn_versionnar_documento_cnd();

-- ============================================================================
-- FUNÇÃO: ATUALIZAR STATUS CND
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_atualizar_status_cnd()
RETURNS TRIGGER AS $$
BEGIN
  -- Se data_validade passou, marcar como vencido
  IF NEW.data_validade < CURRENT_TIMESTAMP THEN
    NEW.status := 'vencido';
  ELSIF NEW.data_validade <= CURRENT_TIMESTAMP + INTERVAL '30 days' THEN
    NEW.status := 'pendente_renovacao';
  ELSE
    NEW.status := 'valido';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER trg_update_status_cnd
BEFORE INSERT OR UPDATE ON fornecedor_documentos
FOR EACH ROW EXECUTE FUNCTION fn_atualizar_status_cnd();

-- ============================================================================
-- FUNÇÃO: AUDITAR DOCUMENTO
-- ============================================================================

CREATE TRIGGER trg_audit_fornecedor_docs
AFTER INSERT OR UPDATE OR DELETE ON fornecedor_documentos
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_alertas
AFTER INSERT OR UPDATE OR DELETE ON alertas_documentos
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_cnd_requisicoes
AFTER INSERT OR UPDATE OR DELETE ON cnd_requisicoes
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- FUNÇÃO: JOB - SINCRONIZAR CNDs PERIODICAMENTE
-- ============================================================================

-- Comentário: Este job será criado com pg_cron
-- INSERIR EM CONFIGURAÇÕES DE JOBS (próxima migration)
-- SELECT cron.schedule('sincronizar_cnd_job', '0 */6 * * *', 'SELECT fn_sincronizar_cnds()');

CREATE OR REPLACE FUNCTION fn_sincronizar_cnds()
RETURNS TABLE(empresa_id UUID, fornecedores_processados INT) AS $$
DECLARE
  v_integracao cnd_integracao;
  v_fornecedor fornecedores%ROWTYPE;
  v_result RECORD;
  v_processados INT := 0;
BEGIN
  -- Buscar integrações configuradas
  FOR v_integracao IN 
    SELECT * FROM cnd_integracao 
    WHERE status = 'configurado' 
      AND (proxima_sincronizacao IS NULL OR proxima_sincronizacao <= CURRENT_TIMESTAMP)
  LOOP
    -- Para cada fornecedor sem CND válida
    FOR v_fornecedor IN
      SELECT f.* FROM fornecedores f
      WHERE f.empresa_id = v_integracao.empresa_id
        AND f.deletado_em IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM fornecedor_documentos fd
          WHERE fd.fornecedor_id = f.id
            AND fd.tipo_documento_id = (SELECT id FROM tipos_documentos WHERE codigo = 'CND')
            AND fd.status = 'valido'
        )
    LOOP
      -- TODO: Integrar com API real (GCM, Receita Federal, etc)
      -- INSERT INTO cnd_requisicoes (...)
      v_processados := v_processados + 1;
    END LOOP;

    -- Atualizar próxima sincronização
    UPDATE cnd_integracao
    SET proxima_sincronizacao = CURRENT_TIMESTAMP + (frequencia_horas || ' hours')::INTERVAL
    WHERE id = v_integracao.id;
  END LOOP;

  RETURN QUERY SELECT v_integracao.empresa_id, v_processados;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: JOB - VERIFICAR ALERTAS DIÁRIOS
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_verificar_alertas_diarios()
RETURNS TABLE(empresa_id UUID, alertas_criados INT) AS $$
DECLARE
  v_empresa empresas;
  v_doc fornecedor_documentos;
  v_alerta_count INT := 0;
  v_empresa_alerta_count INT := 0;
BEGIN
  -- Para cada empresa
  FOR v_empresa IN SELECT * FROM empresas WHERE deletado_em IS NULL
  LOOP
    v_empresa_alerta_count := 0;

    -- Verificar cada documento próximo do vencimento
    FOR v_doc IN
      SELECT fd.* FROM fornecedor_documentos fd
      WHERE fd.empresa_id = v_empresa.id
        AND fd.status != 'vencido'
        AND fd.data_validade BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '60 days'
    LOOP
      -- Verificar se já existe alerta aberto
      IF NOT EXISTS (
        SELECT 1 FROM alertas_documentos
        WHERE fornecedor_documento_id = v_doc.id
          AND tipo_alerta = 'vencimento_proximo'
          AND status = 'aberto'
      ) THEN
        INSERT INTO alertas_documentos (
          empresa_id,
          fornecedor_documento_id,
          tipo_alerta,
          dias_para_vencer,
          data_alerta,
          descricao,
          status
        ) VALUES (
          v_empresa.id,
          v_doc.id,
          'vencimento_proximo',
          (v_doc.data_validade::DATE - CURRENT_DATE),
          CURRENT_TIMESTAMP,
          'Documento próximo do vencimento',
          'aberto'
        );
        v_empresa_alerta_count := v_empresa_alerta_count + 1;
      END IF;
    END LOOP;

    RETURN QUERY SELECT v_empresa.id, v_empresa_alerta_count;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: BUSCAR CND DO FORNECEDOR (Placeholder para API)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_buscar_cnd_api(
  p_cnpj VARCHAR,
  p_api_provider VARCHAR DEFAULT 'gcm'
)
RETURNS TABLE(
  status_cnd VARCHAR,
  descricao VARCHAR,
  data_consulta TIMESTAMP
) AS $$
BEGIN
  -- Placeholder: Esta função será implementada na integração real
  -- Possíveis providers: GCM, Receita Federal, Manual
  
  RETURN QUERY SELECT
    'NAO_CONSULTADO'::VARCHAR,
    'Integração com API ' || p_api_provider || ' ainda não configurada'::VARCHAR,
    CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: VALIDAR DOCUMENTOS OBRIGATÓRIOS ANTES DE PAGAMENTO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_validar_docs_obrigatorios(
  p_fornecedor_id UUID,
  p_empresa_id UUID
)
RETURNS TABLE(
  validacao_ok BOOLEAN,
  documentos_faltantes TEXT,
  documentos_vencidos TEXT
) AS $$
DECLARE
  v_faltantes TEXT := '';
  v_vencidos TEXT := '';
  v_tipo_doc tipos_documentos;
BEGIN
  -- Verificar cada documento obrigatório para a empresa
  FOR v_tipo_doc IN
    SELECT td.* FROM tipos_documentos td
    JOIN politicas_documento pd ON pd.tipo_documento_id = td.id
    WHERE pd.empresa_id = p_empresa_id
      AND pd.obrigatorio = TRUE
      AND pd.exigir_para_pagamento = TRUE
  LOOP
    -- Documentos faltantes
    IF NOT EXISTS (
      SELECT 1 FROM fornecedor_documentos
      WHERE fornecedor_id = p_fornecedor_id
        AND tipo_documento_id = v_tipo_doc.id
        AND status = 'valido'
    ) THEN
      v_faltantes := v_faltantes || v_tipo_doc.descricao || ', ';
    END IF;

    -- Documentos vencidos
    IF EXISTS (
      SELECT 1 FROM fornecedor_documentos
      WHERE fornecedor_id = p_fornecedor_id
        AND tipo_documento_id = v_tipo_doc.id
        AND status = 'vencido'
    ) THEN
      v_vencidos := v_vencidos || v_tipo_doc.descricao || ', ';
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    (v_faltantes = '' AND v_vencidos = '')::BOOLEAN,
    NULLIF(TRIM(BOTH ',' FROM v_faltantes), '')::TEXT,
    NULLIF(TRIM(BOTH ',' FROM v_vencidos), '')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TIMESTAMP TRIGGERS
-- ============================================================================

CREATE TRIGGER trg_update_timestamp_fornecedor_docs
BEFORE UPDATE ON fornecedor_documentos
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_cnd_integracao
BEFORE UPDATE ON cnd_integracao
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

COMMIT;
