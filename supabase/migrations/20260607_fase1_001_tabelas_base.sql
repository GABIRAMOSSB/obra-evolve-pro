-- FASE 1: Saneamento da fundacao
-- Data original: 2026-06-07
-- Revisao: 2026-06-08
--
-- Esta migration foi neutralizada de proposito.
--
-- A auditoria da Fase 0 confirmou que a aplicacao oficial ja possui uma
-- fundacao ativa baseada em:
--   - public.companies
--   - public.company_members
--   - public.company_invites
--   - public.company_workspaces
--   - public.obras
--   - public.contratos
--   - public.centros_custo
--
-- Portanto, NAO criar tabelas paralelas como empresas, usuarios, perfis,
-- fornecedores, documentos, documentos_versoes ou auditoria_logs nesta fase.
-- A fonte unica de dados deve permanecer no schema ja usado pela aplicacao.
--
-- Proximas migrations da Fase 1 devem ampliar tabelas existentes de forma
-- incremental, com ALTERs ou novas tabelas apenas para lacunas reais e sem
-- duplicar cadastros.

DO $$
BEGIN
  RAISE NOTICE 'Fase 1 saneamento: migration 001 neutralizada; usar schema existente da aplicacao.';
END $$;