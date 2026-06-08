# FASE 1 - SANEAMENTO DA FUNDACAO

**Data:** 2026-06-08
**Status:** concluida como saneamento nao destrutivo
**Aplicacao oficial:** `C:\Users\gabii\obra-evolve-pro`

## Decisao Arquitetural

A Fase 1 foi reajustada apos a auditoria da Fase 0. A aplicacao ja possui uma fundacao real em uso, baseada em `companies`, `company_members`, `obras`, `contratos`, `medicoes`, `company_certificates`, `propostas`, `cronogramas`, `signature_requests`, `company_signatarios`, `procuracoes` e demais tabelas existentes.

Por isso, as migrations antigas da Fase 1 que criavam tabelas paralelas como `empresas`, `usuarios`, `perfis`, `boletins_medicao`, `bm_itens`, `signatarios`, `matriz_poderes`, `fornecedor_documentos` e afins foram neutralizadas. Elas agora registram apenas `NOTICE` e documentam a fonte unica correta.

## Preservacao

- Nenhuma tabela foi criada nesta execucao.
- Nenhuma migration foi executada no banco.
- Nenhuma tela foi alterada.
- O BM aprovado permanece preservado em `src/lib/calc.ts` e `src/lib/pdf.ts`.
- A tabela operacional `medicoes` deve ser tratada como integracao/reconciliacao futura, nao como substituta retroativa do BM historico.

## Arquivos Ajustados

- `supabase/migrations/20260607_fase1_001_tabelas_base.sql`
- `supabase/migrations/20260607_fase1_002_propostas_reajustes.sql`
- `supabase/migrations/20260607_fase1_003_rls_policies.sql`
- `supabase/migrations/20260607_fase1_004_triggers_auditoria.sql`
- `supabase/migrations/20260607_fase1_005_seed_inicial.sql`
- `FASE_1_STATUS.md`

## Resultado

A fundacao paralela foi bloqueada no repositorio. A proxima fase segura e ampliar apenas as tabelas reais ja usadas pela aplicacao, por migration incremental e com foco em lacunas comprovadas.

## Pendencias Para Aprovar Antes Da Fase 2

1. Confirmar se as migrations neutralizadas ainda nao foram aplicadas em producao.
2. Se ja tiverem sido aplicadas, planejar migration de reconciliacao sem `DROP TABLE` imediato.
3. Mapear as RLS atuais das tabelas reais antes de qualquer nova policy.
4. Mapear BM legado versus `medicoes` somente em leitura antes de integrar reajustes.

## Creditos Estimados

Fase 1 consumida: baixa, equivalente a saneamento/controle de risco.
Estimativa restante revisada: 900 a 1300 creditos, porque grande parte dos modulos ja existe e o maior custo agora esta em saneamento, seguranca, IA com evidencia, BM e reajustes.