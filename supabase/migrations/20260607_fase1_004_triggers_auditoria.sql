-- FASE 1: Fundação Segura
-- Migration 004: Triggers de Auditoria
-- Data: 2026-06-07
-- Objetivo: Registrar automaticamente todas as alterações no banco

-- ============================================================================
-- TRIGGER: EMPRESAS
-- ============================================================================

CREATE TRIGGER trg_audit_empresas
AFTER INSERT OR UPDATE OR DELETE ON empresas
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: USUÁRIOS
-- ============================================================================

CREATE TRIGGER trg_audit_usuarios
AFTER INSERT OR UPDATE OR DELETE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: OBRAS
-- ============================================================================

CREATE TRIGGER trg_audit_obras
AFTER INSERT OR UPDATE OR DELETE ON obras
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: FORNECEDORES
-- ============================================================================

CREATE TRIGGER trg_audit_fornecedores
AFTER INSERT OR UPDATE OR DELETE ON fornecedores
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: CONTRATOS
-- ============================================================================

CREATE TRIGGER trg_audit_contratos
AFTER INSERT OR UPDATE OR DELETE ON contratos
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: DOCUMENTOS
-- ============================================================================

CREATE TRIGGER trg_audit_documentos
AFTER INSERT OR UPDATE OR DELETE ON documentos
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: PROPOSTAS
-- ============================================================================

CREATE TRIGGER trg_audit_propostas
AFTER INSERT OR UPDATE OR DELETE ON propostas
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: BOLETINS DE MEDIÇÃO
-- ============================================================================

CREATE TRIGGER trg_audit_boletins_medicao
AFTER INSERT OR UPDATE OR DELETE ON boletins_medicao
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: REAJUSTES
-- ============================================================================

CREATE TRIGGER trg_audit_reajustes
AFTER INSERT OR UPDATE OR DELETE ON reajustes
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- TRIGGER: CRONOGRAMAS
-- ============================================================================

CREATE TRIGGER trg_audit_cronogramas
AFTER INSERT OR UPDATE OR DELETE ON cronogramas
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ============================================================================
-- FUNÇÃO: ATUALIZAR TIMESTAMP DE ATUALIZAÇÃO
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS: ATUALIZAR TIMESTAMP EM TODAS AS TABELAS
-- ============================================================================

CREATE TRIGGER trg_update_timestamp_empresas
BEFORE UPDATE ON empresas
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_usuarios
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_obras
BEFORE UPDATE ON obras
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_fornecedores
BEFORE UPDATE ON fornecedores
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_contratos
BEFORE UPDATE ON contratos
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_documentos
BEFORE UPDATE ON documentos
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_propostas
BEFORE UPDATE ON propostas
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_update_timestamp_cronogramas
BEFORE UPDATE ON cronogramas
FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- ============================================================================
-- FUNÇÃO: VALIDAR INTEGRIDADE FINANCEIRA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_validar_proposta_readequada()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o fator de readequação é válido (entre 0 e 1)
  IF NEW.fator_readequacao <= 0 OR NEW.fator_readequacao > 1 THEN
    RAISE EXCEPTION 'Fator de readequação deve estar entre 0 e 1';
  END IF;

  -- Verificar se o percentual de desconto está correto
  IF NEW.percentual_desconto != (1 - NEW.fator_readequacao) THEN
    RAISE EXCEPTION 'Percentual de desconto inconsistente com o fator';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar validação ao inserir propostas readequadas
CREATE TRIGGER trg_validar_proposta_readequada
BEFORE INSERT OR UPDATE ON propostas_readequadas
FOR EACH ROW EXECUTE FUNCTION fn_validar_proposta_readequada();

-- ============================================================================
-- FUNÇÃO: VALIDAR BM (Boletim de Medição)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_validar_boletim_medicao()
RETURNS TRIGGER AS $$
BEGIN
  -- BM-01 não pode ter acumulado anterior
  IF NEW.numero_bm = 1 AND NEW.acumulado_anterior IS NOT NULL AND NEW.acumulado_anterior > 0 THEN
    RAISE EXCEPTION 'BM-01 deve ter acumulado anterior vazio ou zero';
  END IF;

  -- Validar acumulado = acumulado_anterior + período
  IF NEW.acumulado_atual != (COALESCE(NEW.acumulado_anterior, 0) + COALESCE(NEW.valor_periodo, 0)) THEN
    RAISE EXCEPTION 'Acumulado atual inconsistente: deve ser acumulado_anterior + valor_periodo';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar validação
CREATE TRIGGER trg_validar_boletim_medicao
BEFORE INSERT OR UPDATE ON boletins_medicao
FOR EACH ROW EXECUTE FUNCTION fn_validar_boletim_medicao();

-- ============================================================================
-- FUNÇÃO: GARANTIR SOFT DELETE (Não permitir DELETE, apenas marcar como deletado)
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Impedir DELETE direto - sempre usar UPDATE com deletado_em
  RAISE EXCEPTION 'Soft delete obrigatório. Use UPDATE para marcar deletado_em = CURRENT_TIMESTAMP';
END;
$$ LANGUAGE plpgsql;

-- Aplicar soft delete em tabelas críticas
CREATE TRIGGER trg_prevent_delete_empresas
BEFORE DELETE ON empresas
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_prevent_delete_usuarios
BEFORE DELETE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_prevent_delete_obras
BEFORE DELETE ON obras
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_prevent_delete_fornecedores
BEFORE DELETE ON fornecedores
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_prevent_delete_contratos
BEFORE DELETE ON contratos
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_prevent_delete_documentos
BEFORE DELETE ON documentos
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

CREATE TRIGGER trg_prevent_delete_propostas
BEFORE DELETE ON propostas
FOR EACH ROW EXECUTE FUNCTION fn_soft_delete();

-- ============================================================================
-- COMENTÁRIO: ÍNDICES ADICIONAIS PARA PERFORMANCE
-- ============================================================================

-- Criar índices para queries comuns
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa_perfil ON usuarios(empresa_id, perfil_id);
CREATE INDEX IF NOT EXISTS idx_obras_empresa_status ON obras(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_contratos_obra_status ON contratos(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_boletins_contrato_numero ON boletins_medicao(contrato_id, numero_bm);
CREATE INDEX IF NOT EXISTS idx_propostas_empresa_status ON propostas(empresa_id, status);

COMMIT;
