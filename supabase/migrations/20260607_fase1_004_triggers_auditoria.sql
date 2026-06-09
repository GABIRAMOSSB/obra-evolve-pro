-- FASE 1: Saneamento da fundacao
-- Data original: 2026-06-07
-- Revisao: 2026-06-08
--
-- Esta migration foi neutralizada de proposito.
--
-- Os triggers desta versao dependiam das tabelas paralelas neutralizadas nas
-- migrations 001 e 002. Auditoria, timestamps, soft delete e validacoes devem
-- ser adicionados futuramente sobre as tabelas reais da aplicacao.
--
-- Regra especial: nao alterar a logica historica do BM aprovado. O fluxo atual
-- de BM permanece em src/lib/calc.ts e src/lib/pdf.ts; qualquer integracao com
-- public.medicoes deve ser planejada como reconciliacao controlada.

DO $$
BEGIN
  RAISE NOTICE 'Fase 1 saneamento: migration 004 neutralizada; nao criar triggers sobre tabelas paralelas.';
END $$;