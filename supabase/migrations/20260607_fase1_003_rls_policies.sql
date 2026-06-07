-- FASE 1: Fundação Segura
-- Migration 003: RLS (Row Level Security) Policies
-- Data: 2026-06-07
-- Objetivo: Implementar segurança com políticas de acesso por empresa

-- ============================================================================
-- ENABLE RLS EM TODAS AS TABELAS
-- ============================================================================

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas_readequadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronogramas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma_periodos ENABLE ROW LEVEL SECURITY;
ALTER TABLE boletins_medicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE clausulas_reajuste ENABLE ROW LEVEL SECURITY;
ALTER TABLE indices_economicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reajustes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reajuste_base_elegivel ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE matriz_poderes ENABLE ROW LEVEL SECURITY;
ALTER TABLE procuracoes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICY: EMPRESAS
-- ============================================================================

-- Admins podem ver tudo
CREATE POLICY empresas_admin_all ON empresas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid() AND p.nivel_acesso >= 100
    )
  );

-- Usuários podem ver apenas sua empresa
CREATE POLICY empresas_user_select ON empresas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND empresa_id = empresas.id
    )
  );

-- Inserção restrita a admins
CREATE POLICY empresas_admin_insert ON empresas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid() AND p.nivel_acesso >= 100
    )
  );

-- ============================================================================
-- RLS POLICY: USUÁRIOS
-- ============================================================================

-- Usuários veem a si mesmos e outros da mesma empresa
CREATE POLICY usuarios_select ON usuarios
  FOR SELECT
  USING (
    id = auth.uid() OR
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

-- Apenas admins podem inserir usuários
CREATE POLICY usuarios_admin_insert ON usuarios
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid() AND p.nivel_acesso >= 100
    )
  );

-- Usuários podem atualizar a si mesmos (parcialmente)
CREATE POLICY usuarios_update_self ON usuarios
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid() AND
    -- Não deixar mudar empresa ou perfil
    empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()) AND
    perfil_id = (SELECT perfil_id FROM usuarios WHERE id = auth.uid())
  );

-- ============================================================================
-- RLS POLICY: OBRAS
-- ============================================================================

-- Usuários veem obras da sua empresa
CREATE POLICY obras_select ON obras
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

-- Gestores podem inserir obras
CREATE POLICY obras_gestor_insert ON obras
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 80
        AND u.empresa_id = obras.empresa_id
    )
  );

-- Gestores podem atualizar obras
CREATE POLICY obras_gestor_update ON obras
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 80
        AND u.empresa_id = obras.empresa_id
    )
  );

-- ============================================================================
-- RLS POLICY: FORNECEDORES
-- ============================================================================

CREATE POLICY fornecedores_select ON fornecedores
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY fornecedores_insert ON fornecedores
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 60
        AND u.empresa_id = fornecedores.empresa_id
    )
  );

-- ============================================================================
-- RLS POLICY: CONTRATOS
-- ============================================================================

CREATE POLICY contratos_select ON contratos
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY contratos_insert ON contratos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 80
        AND u.empresa_id = contratos.empresa_id
    )
  );

-- ============================================================================
-- RLS POLICY: DOCUMENTOS
-- ============================================================================

CREATE POLICY documentos_select ON documentos
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY documentos_insert ON documentos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid() AND u.empresa_id = documentos.empresa_id
    )
  );

-- ============================================================================
-- RLS POLICY: PROPOSTAS
-- ============================================================================

CREATE POLICY propostas_select ON propostas
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY propostas_insert ON propostas
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 60
        AND u.empresa_id = propostas.empresa_id
    )
  );

-- ============================================================================
-- RLS POLICY: BOLETINS DE MEDIÇÃO
-- ============================================================================

CREATE POLICY boletins_medicao_select ON boletins_medicao
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY boletins_medicao_insert ON boletins_medicao
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 60
        AND u.empresa_id = boletins_medicao.empresa_id
    )
  );

-- ============================================================================
-- RLS POLICY: REAJUSTES
-- ============================================================================

CREATE POLICY reajustes_select ON reajustes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM contratos c
      JOIN usuarios u ON u.empresa_id = c.empresa_id
      WHERE c.id = reajustes.contrato_id AND u.id = auth.uid()
    )
  );

CREATE POLICY reajustes_insert ON reajustes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contratos c
      JOIN usuarios u ON u.empresa_id = c.empresa_id
      JOIN perfis p ON u.perfil_id = p.id
      WHERE c.id = reajustes.contrato_id
        AND u.id = auth.uid()
        AND p.nivel_acesso >= 60
    )
  );

-- ============================================================================
-- RLS POLICY: AUDITORIA LOGS (Somente leitura para admins)
-- ============================================================================

CREATE POLICY auditoria_logs_admin_select ON auditoria_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid() AND p.nivel_acesso >= 100
    )
  );

-- Ninguém pode modificar ou deletar auditoria
CREATE POLICY auditoria_logs_no_modify ON auditoria_logs
  FOR UPDATE, DELETE
  USING (FALSE);

-- ============================================================================
-- RLS POLICY: SIGNATÁRIOS
-- ============================================================================

CREATE POLICY signatarios_select ON signatarios
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY signatarios_insert ON signatarios
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      JOIN perfis p ON u.perfil_id = p.id
      WHERE u.id = auth.uid()
        AND p.nivel_acesso >= 80
        AND u.empresa_id = signatarios.empresa_id
    )
  );

-- ============================================================================
-- RLS POLICY: PROCURAÇÕES
-- ============================================================================

CREATE POLICY procuracoes_select ON procuracoes
  FOR SELECT
  USING (
    empresa_id = (
      SELECT empresa_id FROM usuarios WHERE id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGER: FUNÇÃO PARA REGISTRAR EM AUDITORIA
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO auditoria_logs (
      usuario_id,
      acao,
      modulo,
      entidade,
      registro_id,
      dados_antes,
      dados_depois,
      resultado
    ) VALUES (
      auth.uid(),
      'DELETE',
      TG_TABLE_NAME,
      TG_TABLE_NAME,
      OLD.id,
      row_to_json(OLD),
      NULL,
      'sucesso'
    );
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO auditoria_logs (
      usuario_id,
      acao,
      modulo,
      entidade,
      registro_id,
      dados_antes,
      dados_depois,
      resultado
    ) VALUES (
      auth.uid(),
      'UPDATE',
      TG_TABLE_NAME,
      TG_TABLE_NAME,
      NEW.id,
      row_to_json(OLD),
      row_to_json(NEW),
      'sucesso'
    );
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO auditoria_logs (
      usuario_id,
      acao,
      modulo,
      entidade,
      registro_id,
      dados_antes,
      dados_depois,
      resultado
    ) VALUES (
      auth.uid(),
      'INSERT',
      TG_TABLE_NAME,
      TG_TABLE_NAME,
      NEW.id,
      NULL,
      row_to_json(NEW),
      'sucesso'
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMENTÁRIO: TRIGGERS SERÃO APLICADOS NA PRÓXIMA MIGRATION
-- ============================================================================

-- Os triggers de auditoria para cada tabela serão criados em
-- uma migration separada para melhor organização e rollback seguro.

COMMIT;
