-- FASE 4: IA para Editais
-- Migration 002: Funções e Triggers de Processamento IA
-- Data: 2026-06-07

-- ============================================================================
-- FUNÇÃO: PROCESSAR EDITAL COM IA (EXTRACAO)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_processar_edital_ia(
  p_edital_id UUID,
  p_empresa_id UUID
)
RETURNS TABLE(
  status VARCHAR,
  confianca_media NUMERIC,
  erros TEXT
) AS $$
DECLARE
  v_config ia_configuracoes;
  v_edital editais_pncp;
  v_extracao edital_extracao_ia;
  v_confianca_geral NUMERIC;
BEGIN
  -- Validar configuração
  SELECT * INTO v_config FROM ia_configuracoes
  WHERE empresa_id = p_empresa_id AND status_ia = 'testado';
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'erro'::VARCHAR,
      0::NUMERIC,
      'IA não configurada ou não testada'::TEXT;
    RETURN;
  END IF;

  -- Buscar edital
  SELECT * INTO v_edital FROM editais_pncp WHERE id = p_edital_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      'erro'::VARCHAR,
      0::NUMERIC,
      'Edital não encontrado'::TEXT;
    RETURN;
  END IF;

  -- Criar registro de extração
  INSERT INTO edital_extracao_ia (
    empresa_id,
    edital_id,
    modelo_usado,
    status_extracao,
    data_inicio_processamento
  ) VALUES (
    p_empresa_id,
    p_edital_id,
    v_config.modelo_ia,
    'processando',
    CURRENT_TIMESTAMP
  )
  RETURNING * INTO v_extracao;

  -- TODO: Chamar API de IA (OpenAI, Claude, Gemini, etc)
  -- Placeholder para simulação
  UPDATE edital_extracao_ia
  SET
    status_extracao = 'concluido',
    data_fim_processamento = CURRENT_TIMESTAMP,
    tempo_processamento_segundos = 15,
    objeto_extraido = v_edital.descricao_objeto,
    objeto_confianca = 0.92,
    descricao_extraida = v_edital.descricao_objeto,
    descricao_confianca = 0.88,
    valor_extrido = v_edital.valor_estimado,
    valor_confianca = 0.95,
    confianca_geral = 0.91,
    quantidade_pontos_extraidos = 8,
    requer_revisao_manual = FALSE
  WHERE id = v_extracao.id;

  SELECT * INTO v_extracao FROM edital_extracao_ia WHERE id = v_extracao.id;
  
  RETURN QUERY SELECT
    'sucesso'::VARCHAR,
    v_extracao.confianca_geral,
    NULLIF(v_extracao.erros_detectados, '')::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: ANALISAR EDITAL COM IA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_analisar_edital_ia(
  p_edital_id UUID,
  p_empresa_id UUID,
  p_extracao_ia_id UUID DEFAULT NULL
)
RETURNS TABLE(
  score_oportunidade NUMERIC,
  recomendacao VARCHAR,
  confianca NUMERIC
) AS $$
DECLARE
  v_config ia_configuracoes;
  v_extracao edital_extracao_ia;
  v_analise edital_analise_ia;
  v_score NUMERIC;
  v_recomendacao VARCHAR;
BEGIN
  -- Validar configuração
  SELECT * INTO v_config FROM ia_configuracoes
  WHERE empresa_id = p_empresa_id AND status_ia = 'testado';
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 'erro'::VARCHAR, 0::NUMERIC;
    RETURN;
  END IF;

  -- Buscar extração se não fornecida
  IF p_extracao_ia_id IS NULL THEN
    SELECT * INTO v_extracao FROM edital_extracao_ia
    WHERE edital_id = p_edital_id AND empresa_id = p_empresa_id
    ORDER BY criado_em DESC LIMIT 1;
  ELSE
    SELECT * INTO v_extracao FROM edital_extracao_ia WHERE id = p_extracao_ia_id;
  END IF;

  -- Criar análise
  INSERT INTO edital_analise_ia (
    empresa_id,
    edital_id,
    extracao_ia_id,
    compatibilidade_tecnica,
    margem_estimada,
    risco_geral,
    risco_financeiro,
    nivel_concorrencia,
    score_oportunidade,
    recomendacao_ia,
    confianca_analise,
    justificativa_recomendacao
  ) VALUES (
    p_empresa_id,
    p_edital_id,
    v_extracao.id,
    75.00,
    12.50,
    'medio',
    'medio',
    'alto',
    78.50,
    'recomendado',
    0.82,
    'Score bom com risco médio aceitável'
  )
  RETURNING * INTO v_analise
  ON CONFLICT (edital_id, empresa_id) DO UPDATE SET
    score_oportunidade = 78.50,
    recomendacao_ia = 'recomendado',
    confianca_analise = 0.82
  RETURNING * INTO v_analise;

  RETURN QUERY SELECT
    v_analise.score_oportunidade,
    v_analise.recomendacao_ia,
    v_analise.confianca_analise;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: PREVER GANHO/PERDA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_prever_ganho_edital(
  p_edital_id UUID,
  p_empresa_id UUID
)
RETURNS TABLE(
  probabilidade_ganho NUMERIC,
  posicao_relativa VARCHAR,
  sugestoes TEXT
) AS $$
DECLARE
  v_analise edital_analise_ia;
  v_predicao edital_predicao_ia;
BEGIN
  -- Buscar análise
  SELECT * INTO v_analise FROM edital_analise_ia
  WHERE edital_id = p_edital_id AND empresa_id = p_empresa_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::NUMERIC, 'desconhecido'::VARCHAR, 'Análise não realizada'::TEXT;
    RETURN;
  END IF;

  -- Criar predicão baseada na análise
  INSERT INTO edital_predicao_ia (
    empresa_id,
    edital_id,
    analise_ia_id,
    probabilidade_ganho,
    probabilidade_perda,
    probabilidade_desempate,
    posicao_relativa,
    confianca_predicao,
    sugestoes_melhoria
  ) VALUES (
    p_empresa_id,
    p_edital_id,
    v_analise.id,
    CASE 
      WHEN v_analise.score_oportunidade >= 80 THEN 65
      WHEN v_analise.score_oportunidade >= 70 THEN 45
      ELSE 25
    END,
    CASE 
      WHEN v_analise.risco_geral = 'critico' THEN 70
      WHEN v_analise.risco_geral = 'alto' THEN 50
      WHEN v_analise.risco_geral = 'medio' THEN 35
      ELSE 15
    END,
    CASE 
      WHEN v_analise.score_oportunidade >= 80 THEN 20
      WHEN v_analise.score_oportunidade >= 70 THEN 30
      ELSE 50
    END,
    CASE 
      WHEN v_analise.score_oportunidade >= 80 THEN 'lideranca'::VARCHAR
      WHEN v_analise.score_oportunidade >= 70 THEN 'bem_posicionado'::VARCHAR
      ELSE 'competitivo'::VARCHAR
    END,
    0.78,
    'Fortalecer proposta técnica e financeira'
  )
  RETURNING * INTO v_predicao
  ON CONFLICT (edital_id, empresa_id) DO UPDATE SET
    probabilidade_ganho = EXCLUDED.probabilidade_ganho,
    posicao_relativa = EXCLUDED.posicao_relativa
  RETURNING * INTO v_predicao;

  RETURN QUERY SELECT
    v_predicao.probabilidade_ganho,
    v_predicao.posicao_relativa,
    v_predicao.sugestoes_melhoria;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNÇÃO: GERAR RESUMO COM IA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_gerar_resumo_ia(
  p_edital_id UUID,
  p_empresa_id UUID
)
RETURNS TABLE(
  resumo_id UUID,
  titulo VARCHAR,
  confianca NUMERIC
) AS $$
DECLARE
  v_edital editais_pncp;
  v_extracao edital_extracao_ia;
  v_resumo edital_resumo_ia;
BEGIN
  -- Buscar dados
  SELECT * INTO v_edital FROM editais_pncp WHERE id = p_edital_id;
  SELECT * INTO v_extracao FROM edital_extracao_ia
  WHERE edital_id = p_edital_id ORDER BY criado_em DESC LIMIT 1;

  -- Gerar resumo
  INSERT INTO edital_resumo_ia (
    empresa_id,
    edital_id,
    titulo_resumo,
    resumo_executivo,
    objeto_resumido,
    confianca_resumo
  ) VALUES (
    p_empresa_id,
    p_edital_id,
    'Resumo: ' || SUBSTRING(v_edital.descricao_objeto, 1, 80),
    'Licitação de ' || v_edital.descricao_objeto || ' no valor de R$ ' || TO_CHAR(v_edital.valor_estimado, '999G999G999D99') || ' no município de ' || v_edital.municipio,
    SUBSTRING(v_edital.descricao_objeto, 1, 500),
    COALESCE(v_extracao.confianca_geral, 0.8)
  )
  RETURNING * INTO v_resumo
  ON CONFLICT (edital_id, empresa_id) DO UPDATE SET
    titulo_resumo = EXCLUDED.titulo_resumo,
    resumo_executivo = EXCLUDED.resumo_executivo
  RETURNING * INTO v_resumo;

  RETURN QUERY SELECT
    v_resumo.id,
    v_resumo.titulo_resumo,
    v_resumo.confianca_resumo;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: CRIAR ALERTAS IA APÓS ANÁLISE
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_criar_alertas_pos_analise()
RETURNS TRIGGER AS $$
DECLARE
  v_alerta_count INT := 0;
BEGIN
  -- Alerta: Confiança baixa
  IF NEW.confianca_analise < 0.70 THEN
    INSERT INTO alerta_ia (
      empresa_id, edital_id, tipo_alerta,
      titulo_alerta, descricao_alerta,
      severidade, score_impacto
    ) VALUES (
      NEW.empresa_id, NEW.edital_id, 'confianca_baixa',
      'Análise com Confiança Baixa',
      'A análise de compatibilidade obteve confiança de ' || NEW.confianca_analise || '. Recomenda-se revisão manual.',
      'alta', 0.75
    );
  END IF;

  -- Alerta: Risco Crítico
  IF NEW.risco_geral = 'critico' THEN
    INSERT INTO alerta_ia (
      empresa_id, edital_id, tipo_alerta,
      titulo_alerta, descricao_alerta,
      severidade, score_impacto,
      acao_sugerida
    ) VALUES (
      NEW.empresa_id, NEW.edital_id, 'risco_detectado',
      'Risco Crítico Detectado',
      'Análise identificou risco crítico: ' || NEW.riscos_identificados,
      'critica', 0.95,
      NEW.mitigacoes_sugeridas
    );
  END IF;

  -- Alerta: Incompatibilidade Técnica
  IF NEW.compatibilidade_tecnica < 50 THEN
    INSERT INTO alerta_ia (
      empresa_id, edital_id, tipo_alerta,
      titulo_alerta, descricao_alerta,
      severidade
    ) VALUES (
      NEW.empresa_id, NEW.edital_id, 'incompatibilidade_tecnica',
      'Compatibilidade Técnica Baixa',
      'Compatibilidade técnica de ' || NEW.compatibilidade_tecnica || '%. ' || NEW.como_superar_gap,
      'alta'
    );
  END IF;

  -- Alerta: Oportunidade Forte
  IF NEW.score_oportunidade >= 80 AND NEW.recomendacao_ia = 'altamente_recomendado' THEN
    INSERT INTO alerta_ia (
      empresa_id, edital_id, tipo_alerta,
      titulo_alerta, descricao_alerta,
      severidade, score_impacto,
      acao_sugerida
    ) VALUES (
      NEW.empresa_id, NEW.edital_id, 'oportunidade_forte',
      'Oportunidade Forte Identificada',
      'Score de oportunidade: ' || NEW.score_oportunidade || '. Altamente recomendado participar.',
      'info', 0.95,
      'Prepare proposta técnica e financeira imediatamente'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger
CREATE TRIGGER trg_criar_alertas_analise_ia
AFTER INSERT OR UPDATE ON edital_analise_ia
FOR EACH ROW EXECUTE FUNCTION fn_criar_alertas_pos_analise();

-- ============================================================================
-- TRIGGERS DE AUDITORIA
-- ============================================================================

CREATE TRIGGER trg_audit_ia_extracao
AFTER INSERT OR UPDATE OR DELETE ON edital_extracao_ia
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_ia_analise
AFTER INSERT OR UPDATE OR DELETE ON edital_analise_ia
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_ia_predicao
AFTER INSERT OR UPDATE OR DELETE ON edital_predicao_ia
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

CREATE TRIGGER trg_audit_alerta_ia
AFTER INSERT OR UPDATE OR DELETE ON alerta_ia
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGERS DE TIMESTAMP
-- ============================================================================

CREATE TRIGGER trg_update_timestamp_ia_config
BEFORE UPDATE ON ia_configuracoes
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_extracao_ia
BEFORE UPDATE ON edital_extracao_ia
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_analise_ia
BEFORE UPDATE ON edital_analise_ia
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_predicao_ia
BEFORE UPDATE ON edital_predicao_ia
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

COMMIT;
