-- FASE 1: Saneamento da fundacao
-- Data original: 2026-06-07
-- Revisao: 2026-06-08
--
-- Esta migration foi neutralizada de proposito.
--
-- A aplicacao ja possui tabelas reais para os modulos cobertos aqui:
--   - public.propostas, public.proposta_itens,
--     public.proposta_readequacao_residuos, public.cartas_proposta
--   - public.cronogramas, public.cronograma_etapas,
--     public.cronograma_periodos
--   - public.medicoes, com BM aprovado preservado em src/lib/calc.ts
--     e src/lib/pdf.ts
--   - public.indices_economicos, public.reajustes_contratuais
--   - public.company_signatarios, public.procuracoes
--
-- Portanto, NAO criar tabelas paralelas como propostas_itens,
-- propostas_readequadas, boletins_medicao, bm_itens, reajustes,
-- signatarios ou matriz_poderes nesta migration. Qualquer lacuna deve ser
-- tratada em migration incremental sobre as tabelas existentes.

DO $$
BEGIN
  RAISE NOTICE 'Fase 1 saneamento: migration 002 neutralizada; preservar propostas, medicoes/BM, reajustes e poderes existentes.';
END $$;