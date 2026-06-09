-- FASE 1: Saneamento da fundacao
-- Data original: 2026-06-07
-- Revisao: 2026-06-08
--
-- Esta seed foi neutralizada de proposito.
--
-- A seed original inseria dados em tabelas paralelas (empresas, fornecedores,
-- boletins_medicao etc.). Isso violaria a regra de fonte unica de dados.
--
-- Seeds futuras devem usar somente as tabelas reais da aplicacao
-- (companies, company_members, obras, contratos, centros_custo etc.) e nunca
-- criar cadastros duplicados para a SOLV ou para fornecedores/obras.

DO $$
BEGIN
  RAISE NOTICE 'Fase 1 saneamento: seed neutralizada; nao inserir dados em tabelas paralelas.';
END $$;