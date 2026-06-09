-- FASE 1: Saneamento da fundacao
-- Data original: 2026-06-07
-- Revisao: 2026-06-08
--
-- Esta migration foi neutralizada de proposito.
--
-- As policies desta versao apontavam para tabelas paralelas
-- (empresas/usuarios/perfis) que nao sao a fonte unica da aplicacao.
-- A camada de seguranca deve continuar usando public.company_members,
-- public.companies e as RLS policies ja existentes nas migrations originais.
--
-- Novas policies devem ser criadas apenas sobre tabelas reais ja usadas pela
-- aplicacao, com company_id e menor privilegio.

DO $$
BEGIN
  RAISE NOTICE 'Fase 1 saneamento: migration 003 neutralizada; nao aplicar RLS sobre tabelas paralelas.';
END $$;