-- FASE 1: Fundação Segura
-- Seed: Dados Iniciais para Desenvolvimento e Testes
-- Data: 2026-06-07

-- ============================================================================
-- SEED DATA: EMPRESAS
-- ============================================================================

INSERT INTO empresas (cnpj, razao_social, nome_fantasia, email_contato, status)
VALUES
  ('36.419.348/0001-65', 'SOLV CONSTRUTORA E SOLUÇÕES LTDA', 'SOLV', 'contato@solv.com.br', 'ativo')
ON CONFLICT (cnpj) DO NOTHING;

-- Obter ID da empresa para usar nos próximos inserts
-- Nota: Em produção, usar variáveis ou CTEs para evitar hardcoding de IDs

-- ============================================================================
-- SEED DATA: CENTROS DE CUSTO
-- ============================================================================

INSERT INTO centros_custo (empresa_id, codigo, nome, tipo, status)
SELECT 
  id,
  'CC001',
  'Administrativo',
  'departamento',
  'ativo'
FROM empresas WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT DO NOTHING;

INSERT INTO centros_custo (empresa_id, codigo, nome, tipo, status)
SELECT 
  id,
  'CC002',
  'Obras Públicas',
  'linha_negocio',
  'ativo'
FROM empresas WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT DO NOTHING;

INSERT INTO centros_custo (empresa_id, codigo, nome, tipo, status)
SELECT 
  id,
  'CC003',
  'Reformas e Manutenção',
  'linha_negocio',
  'ativo'
FROM empresas WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- SEED DATA: OBRAS (Exemplos)
-- ============================================================================

INSERT INTO obras (empresa_id, numero_obra, nome, localizacao_cidade, localizacao_estado, valor_contratado, status)
SELECT
  e.id,
  'OB001',
  'Construção de Escola Municipal',
  'São Paulo',
  'SP',
  1500000.00,
  'em_planejamento'
FROM empresas e WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT (numero_obra) DO NOTHING;

INSERT INTO obras (empresa_id, numero_obra, nome, localizacao_cidade, localizacao_estado, valor_contratado, status)
SELECT
  e.id,
  'OB002',
  'Reforma de Prédio Público',
  'Ribeirão Preto',
  'SP',
  800000.00,
  'em_planejamento'
FROM empresas e WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT (numero_obra) DO NOTHING;

INSERT INTO obras (empresa_id, numero_obra, nome, localizacao_cidade, localizacao_estado, valor_contratado, status)
SELECT
  e.id,
  'OB003',
  'Urbanização de Avenida',
  'Campinas',
  'SP',
  2000000.00,
  'em_planejamento'
FROM empresas e WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT (numero_obra) DO NOTHING;

-- ============================================================================
-- SEED DATA: FORNECEDORES (Exemplos)
-- ============================================================================

INSERT INTO fornecedores (empresa_id, cnpj, razao_social, nome_fantasia, email_contato, tipo_fornecedor, status)
SELECT
  e.id,
  '01.234.567/0001-80',
  'Construtora Exemplo LTDA',
  'Exemplo Engenharia',
  'contato@exemplo.com.br',
  'fornecedor',
  'ativo'
FROM empresas e WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO fornecedores (empresa_id, cnpj, razao_social, nome_fantasia, email_contato, tipo_fornecedor, status)
SELECT
  e.id,
  '02.345.678/0001-90',
  'Materiais de Construção Brasil',
  'MCB Distribuidora',
  'vendas@mcb.com.br',
  'fornecedor',
  'ativo'
FROM empresas e WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT (cnpj) DO NOTHING;

INSERT INTO fornecedores (empresa_id, cnpj, razao_social, nome_fantasia, email_contato, tipo_fornecedor, status)
SELECT
  e.id,
  '03.456.789/0001-00',
  'Mão de Obra Especializada LTDA',
  'Mão de Obra Esp',
  'contato@maodeobra.com.br',
  'subempreiteiro',
  'ativo'
FROM empresas e WHERE cnpj = '36.419.348/0001-65'
ON CONFLICT (cnpj) DO NOTHING;

-- ============================================================================
-- SEED DATA: CONTRATOS (Exemplos)
-- ============================================================================

INSERT INTO contratos (empresa_id, obra_id, fornecedor_id, numero_contrato, valor_total, regime_execucao, status)
SELECT
  e.id,
  o.id,
  f.id,
  'CT001-2026',
  o.valor_contratado,
  'empreitada_integral',
  'rascunho'
FROM empresas e
JOIN obras o ON o.empresa_id = e.id AND o.numero_obra = 'OB001'
JOIN fornecedores f ON f.empresa_id = e.id AND f.cnpj = '01.234.567/0001-80'
WHERE e.cnpj = '36.419.348/0001-65'
ON CONFLICT (numero_contrato) DO NOTHING;

-- ============================================================================
-- SEED DATA: ÍNDICES ECONÔMICOS (Exemplos - Valores fictícios para teste)
-- ============================================================================

INSERT INTO indices_economicos (tipo_indice, fonte, competencia, numero_indice, variacao_mensal, status)
VALUES
  ('ipca', 'ibge', '2026-01-01', 100.0000, 0.0500, 'ativo'),
  ('ipca', 'ibge', '2026-02-01', 100.5000, 0.0500, 'ativo'),
  ('ipca', 'ibge', '2026-03-01', 101.0100, 0.0515, 'ativo'),
  ('incc', 'ibge', '2026-01-01', 100.0000, 0.0350, 'ativo'),
  ('incc', 'ibge', '2026-02-01', 100.3500, 0.0350, 'ativo'),
  ('incc', 'ibge', '2026-03-01', 100.6501, 0.0301, 'ativo')
ON CONFLICT (tipo_indice, fonte, competencia) DO NOTHING;

-- ============================================================================
-- COMENTÁRIO: DADOS ADICIONAIS PODEM SER INSERIDOS CONFORME NECESSIDADE
-- ============================================================================

-- Esta seed fornece dados básicos para desenvolvimento e testes.
-- Dados de produção serão inseridos após a validação de toda a infraestrutura.

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Contar registros inseridos
SELECT 
  (SELECT COUNT(*) FROM empresas) as empresas,
  (SELECT COUNT(*) FROM centros_custo) as centros_custo,
  (SELECT COUNT(*) FROM obras) as obras,
  (SELECT COUNT(*) FROM fornecedores) as fornecedores,
  (SELECT COUNT(*) FROM contratos) as contratos,
  (SELECT COUNT(*) FROM indices_economicos) as indices;

COMMIT;
