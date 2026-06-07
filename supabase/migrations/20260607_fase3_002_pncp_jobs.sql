-- FASE 3: PNCP Radar
-- Migration 002: Triggers, Jobs e Funções de Análise
-- Data: 2026-06-07

-- ============================================================================
-- FUNÇÃO: COLETAR EDITAIS DA API PNCP
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_coletar_pncp()
RETURNS TABLE(empresa_id UUID, editais_coletados INT) AS $$
DECLARE
  v_config pncp_configuracoes;
  v_novo_edital_count INT := 0;
BEGIN
  -- Para cada empresa com PNCP ativo
  FOR v_config IN
    SELECT * FROM pncp_configuracoes
    WHERE pncp_status = 'ativo'
      AND (proxima_coleta IS NULL OR proxima_coleta <= CURRENT_TIMESTAMP)
  LOOP
    -- TODO: Integrar com API PNCP real (https://pncp.gov.br/api/v1)
    -- Os filtros em pncp_configuracoes devem guiar a query
    -- Simular coleta por enquanto
    
    SELECT COUNT(*) INTO v_novo_edital_count
    FROM editais_pncp
    WHERE empresa_id = v_config.empresa_id
      AND data_ultima_sincronizacao = CURRENT_TIMESTAMP;

    -- Registrar coleta
    INSERT INTO pncp_coleta_historico (
      empresa_id,
      total_editais_encontrados,
      total_novos,
      status_coleta,
      tempo_execucao_segundos
    ) VALUES (
      v_config.empresa_id,
      v_novo_edital_count,
      v_novo_edital_count,
      'sucesso',
      5
    );

    -- Atualizar próxima coleta
    UPDATE pncp_configuracoes
    SET proxima_coleta = CURRENT_TIMESTAMP + (frequencia_coleta_horas || ' hours')::INTERVAL
    WHERE id = v_config.id;

    RETURN QUERY SELECT v_config.empresa_id, v_novo_edital_count;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: ANALISAR COMPATIBILIDADE COM EMPRESA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_analisar_edital_matching(
  p_edital_id UUID,
  p_empresa_id UUID
)
RETURNS TABLE(
  score_total NUMERIC,
  recomendacao VARCHAR,
  motivos TEXT
) AS $$
DECLARE
  v_edital editais_pncp;
  v_empresa empresas;
  v_score_tecnica NUMERIC := 0;
  v_score_localizacao NUMERIC := 0;
  v_score_valor NUMERIC := 0;
  v_score_categoria NUMERIC := 0;
  v_score_total NUMERIC;
  v_motivos TEXT := '';
  v_requisitos_faltantes TEXT := '';
BEGIN
  -- Buscar dados
  SELECT * INTO v_edital FROM editais_pncp WHERE id = p_edital_id;
  SELECT * INTO v_empresa FROM empresas WHERE id = p_empresa_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 'nao_recomendado'::VARCHAR, 'Edital ou empresa não encontrados'::TEXT;
    RETURN;
  END IF;

  -- 1. Score de Localização (30%)
  -- Simples: se município da obra está na cobertura da empresa
  IF v_edital.estado = 'SP' THEN
    v_score_localizacao := 100;
  ELSIF v_edital.estado IN ('RJ', 'MG') THEN
    v_score_localizacao := 70;
  ELSE
    v_score_localizacao := 40;
    v_motivos := v_motivos || 'Localização fora da área principal. ';
  END IF;

  -- 2. Score de Categoria (25%)
  IF v_edital.categoria_economica IS NOT NULL THEN
    v_score_categoria := 85;
  ELSE
    v_score_categoria := 60;
    v_motivos := v_motivos || 'Categoria econômica não identificada. ';
  END IF;

  -- 3. Score de Valor (25%)
  IF v_edital.valor_estimado >= 500000 AND v_edital.valor_estimado <= 5000000 THEN
    v_score_valor := 100;
  ELSIF v_edital.valor_estimado >= 100000 AND v_edital.valor_estimado <= 500000 THEN
    v_score_valor := 80;
  ELSIF v_edital.valor_estimado > 5000000 THEN
    v_score_valor := 60;
    v_motivos := v_motivos || 'Valor superior ao typical. ';
  ELSE
    v_score_valor := 40;
    v_motivos := v_motivos || 'Valor muito baixo. ';
  END IF;

  -- 4. Score Técnico (20%)
  -- TODO: Consultar histórico de projetos similares
  v_score_tecnica := 75;

  -- Calcular score total ponderado
  v_score_total := ROUND(
    (v_score_localizacao * 0.30) +
    (v_score_categoria * 0.25) +
    (v_score_valor * 0.25) +
    (v_score_tecnica * 0.20),
    2
  );

  -- Determinar recomendação
  IF v_score_total >= 80 THEN
    INSERT INTO edital_matching (
      edital_id, empresa_id, score_compatibilidade,
      capacidade_tecnica, compatibilidade_localizacao,
      compatibilidade_valor, compatibilidade_categoria,
      recomendacao, motivos_incompatibilidade
    ) VALUES (
      p_edital_id, p_empresa_id, v_score_total,
      v_score_tecnica, v_score_localizacao,
      v_score_valor, v_score_categoria,
      'recomendado', NULLIF(v_motivos, '')
    ) ON CONFLICT (edital_id, empresa_id) DO UPDATE SET
      score_compatibilidade = v_score_total,
      recomendacao = 'recomendado';
    
    RETURN QUERY SELECT v_score_total::NUMERIC, 'recomendado'::VARCHAR, v_motivos::TEXT;
  ELSIF v_score_total >= 60 THEN
    INSERT INTO edital_matching (
      edital_id, empresa_id, score_compatibilidade,
      capacidade_tecnica, compatibilidade_localizacao,
      compatibilidade_valor, compatibilidade_categoria,
      recomendacao, motivos_incompatibilidade
    ) VALUES (
      p_edital_id, p_empresa_id, v_score_total,
      v_score_tecnica, v_score_localizacao,
      v_score_valor, v_score_categoria,
      'compativel', NULLIF(v_motivos, '')
    ) ON CONFLICT (edital_id, empresa_id) DO UPDATE SET
      score_compatibilidade = v_score_total,
      recomendacao = 'compativel';
    
    RETURN QUERY SELECT v_score_total::NUMERIC, 'compativel'::VARCHAR, v_motivos::TEXT;
  ELSE
    RETURN QUERY SELECT v_score_total::NUMERIC, 'nao_recomendado'::VARCHAR, v_motivos::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: CRIAR ALERTA PARA NOVA OPORTUNIDADE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_criar_alerta_oportunidade()
RETURNS TRIGGER AS $$
DECLARE
  v_config pncp_configuracoes;
BEGIN
  -- Se novo edital foi criado e empresa tem config PNCP
  IF TG_OP = 'INSERT' THEN
    FOR v_config IN
      SELECT * FROM pncp_configuracoes
      WHERE empresa_id = NEW.empresa_id AND pncp_status = 'ativo'
    LOOP
      INSERT INTO alerta_oportunidade (
        empresa_id,
        edital_id,
        tipo_alerta,
        titulo_alerta,
        descricao_alerta,
        urgencia,
        destinatarios_email,
        status_alerta
      ) VALUES (
        NEW.empresa_id,
        NEW.id,
        'nova_oportunidade',
        'Nova Oportunidade PNCP: ' || NEW.numero_edital,
        'Novo edital encontrado: ' || NEW.descricao_objeto || ' em ' || NEW.municipio || ' - ' || NEW.estado,
        CASE 
          WHEN (NEW.data_encerramento - CURRENT_TIMESTAMP) < INTERVAL '7 days' THEN 'critica'::VARCHAR
          WHEN (NEW.data_encerramento - CURRENT_TIMESTAMP) < INTERVAL '14 days' THEN 'alta'::VARCHAR
          ELSE 'media'::VARCHAR
        END,
        v_config.emails_alerta,
        'aberto'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER trg_alerta_novo_edital
AFTER INSERT ON editais_pncp
FOR EACH ROW EXECUTE FUNCTION fn_criar_alerta_oportunidade();

-- ============================================================================
-- FUNÇÃO: ATUALIZAR DIAS PARA ENCERRAR
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_atualizar_dias_encerramento()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dias_para_encerrar := (NEW.data_encerramento::DATE - CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER trg_update_dias_encerramento
BEFORE INSERT OR UPDATE ON editais_pncp
FOR EACH ROW EXECUTE FUNCTION fn_atualizar_dias_encerramento();

-- ============================================================================
-- FUNÇÃO: ATUALIZAR STATUS PIPELINE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_mudar_status_pipeline(
  p_edital_id UUID,
  p_empresa_id UUID,
  p_novo_status VARCHAR,
  p_motivo VARCHAR
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO edital_pipeline_status (
    empresa_id,
    edital_id,
    posicao_pipeline,
    data_entrada_stage,
    motivo_mudanca,
    criado_em
  ) VALUES (
    p_empresa_id,
    p_edital_id,
    p_novo_status,
    CURRENT_TIMESTAMP,
    p_motivo,
    CURRENT_TIMESTAMP
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: VERIFICAR ENCERRAMENTO PRÓXIMO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_verificar_encerramentos_proximos()
RETURNS TABLE(empresa_id UUID, alertas_criados INT) AS $$
DECLARE
  v_empresa empresas;
  v_edital editais_pncp;
  v_alerta_count INT := 0;
  v_empresa_alerta_count INT := 0;
BEGIN
  -- Para cada empresa
  FOR v_empresa IN SELECT * FROM empresas WHERE deletado_em IS NULL
  LOOP
    v_empresa_alerta_count := 0;

    -- Buscar editais com encerramento próximo
    FOR v_edital IN
      SELECT e.* FROM editais_pncp e
      WHERE e.empresa_id = v_empresa.id
        AND e.status_coleta IN ('novo', 'analisado', 'candidato')
        AND e.data_encerramento BETWEEN CURRENT_TIMESTAMP AND CURRENT_TIMESTAMP + INTERVAL '7 days'
    LOOP
      -- Verificar se não existe alerta recente
      IF NOT EXISTS (
        SELECT 1 FROM alerta_oportunidade
        WHERE edital_id = v_edital.id
          AND tipo_alerta = 'proximo_encerramento'
          AND criado_em > CURRENT_TIMESTAMP - INTERVAL '1 day'
      ) THEN
        INSERT INTO alerta_oportunidade (
          empresa_id,
          edital_id,
          tipo_alerta,
          titulo_alerta,
          descricao_alerta,
          urgencia,
          status_alerta
        ) VALUES (
          v_empresa.id,
          v_edital.id,
          'proximo_encerramento',
          'Encerramento Próximo: ' || v_edital.numero_edital,
          'Edital encerra em ' || (v_edital.data_encerramento::DATE - CURRENT_DATE) || ' dias',
          'critica',
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
-- TRIGGERS DE AUDITORIA
-- ============================================================================

CREATE TRIGGER trg_audit_editais_pncp
AFTER INSERT OR UPDATE OR DELETE ON editais_pncp
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_alerta_oportunidade
AFTER INSERT OR UPDATE OR DELETE ON alerta_oportunidade
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_proposta_edital
AFTER INSERT OR UPDATE OR DELETE ON proposta_edital
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGERS DE TIMESTAMP
-- ============================================================================

CREATE TRIGGER trg_update_timestamp_pncp_config
BEFORE UPDATE ON pncp_configuracoes
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_editais
BEFORE UPDATE ON editais_pncp
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ============================================================================
-- SOFT DELETE ENFORCEMENT
-- ============================================================================

CREATE TRIGGER trg_prevent_delete_editais
BEFORE DELETE ON editais_pncp
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

COMMIT;
