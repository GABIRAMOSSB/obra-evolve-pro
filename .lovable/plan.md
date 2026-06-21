## Objetivo

Transformar a aba **Atividades** (em `src/components/ObraApp.tsx`, dentro de `/obras`) numa ferramenta gerencial: indicadores, diagnóstico automático, atividades críticas, ações, tendência histórica e PDF — recalculados automaticamente a cada mudança.

## Mudança arquitetural necessária

Hoje as atividades (`BudgetRow`) vivem em `localStorage` (`Workspace.obras[].rows`). Para ter cálculo no backend, histórico persistido e atualização em tempo real entre usuários da mesma empresa, vou:

1. Criar tabelas no Lovable Cloud espelhando as atividades da obra ativa **com os campos novos** exigidos pela análise gerencial.
2. Adicionar uma camada de sincronização da planilha local → banco (na primeira abertura da obra após o deploy, e a cada edição) sem quebrar fluxo atual.
3. Mover os cálculos para server functions; o frontend só renderiza.

## Fase 1 — Banco (migração)

**Tabelas novas (todas com `company_id`, RLS por empresa, GRANTs):**

- `obra_atividades` — uma linha por atividade da obra
  - `obra_id`, `item_codigo`, `etapa`, `descricao`
  - `valor`, `peso`, `quantidade`, `unidade`
  - `percentual_concluido` (0–100)
  - `status` (`nao_iniciada` | `em_andamento` | `concluida` | `paralisada`)
  - `data_prevista_inicio`, `data_prevista_fim`, `data_real_inicio`, `data_real_fim`
  - `responsavel_id` (nullable → `equipe_membros`/`funcionarios` ou texto livre)
  - `prioridade` (`baixa` | `media` | `alta` | `critica`)
  - `impedimento` (texto), `bloqueia_atividades` (uuid[]), `observacoes`
- `obra_atividade_eventos` — log de cada alteração relevante (para auditoria + tendência fina)
- `obra_analise_snapshots` — snapshot diário por obra (avanço, prazo consumido, desvio, ritmo, fator, risco, nº críticas, valor executado) para comparativo D-1 / D-7 / medição anterior

**Trigger:** `AFTER INSERT/UPDATE/DELETE` em `obra_atividades` chama função que (a) registra evento, (b) faz upsert no snapshot **do dia** para a obra.

## Fase 2 — Server functions (`src/lib/analise-gerencial.functions.ts`)

Todas com `requireSupabaseAuth`:

- `sincronizarAtividades({obraId, rows})` — recebe BudgetRow do localStorage e faz upsert idempotente em `obra_atividades` (chave: `obra_id + item_codigo`). Roda 1x ao abrir a obra.
- `atualizarAtividade({id, patch})` — edição pontual (% concluído, status, datas, responsável, prioridade, impedimento).
- `getAnaliseGerencial({obraId})` — retorna **tudo num único payload**:
  - indicadores: `avanco`, `prazo_consumido`, `desvio`, `dias_decorridos`, `dias_restantes`, `ritmo_atual`, `ritmo_necessario`, `fator_aceleracao`, `saldo_executar`, `data_projetada`
  - classificação de risco + faixa
  - lista de atividades críticas (com motivo + ação sugerida)
  - até 5 ações recomendadas
  - plano de recuperação (se risco alto/crítico)
  - diagnóstico em texto
  - confiabilidade (peso financeiro / peso físico / média simples)
  - tendência D-1, D-7 e vs. medição anterior (a partir de `obra_analise_snapshots` + `medicoes`)
- `getHistoricoAnalise({obraId, dias})` — série temporal para o gráfico de evolução.

Toda a lógica de cálculo (avanço ponderado, ritmo, projeção, classificação) fica em `src/lib/analise-gerencial.server.ts` para ser testável.

## Fase 3 — UI dentro da aba Atividades

Em `ObraApp.tsx`, na `TabsContent value="atividades"`, adicionar acima da tabela existente uma seção **Análise Gerencial da Obra** colapsável (aberta por padrão):

1. **Cards** (grid responsivo): risco + faixa, avanço, prazo consumido, desvio, dias restantes, saldo, ritmo atual, ritmo necessário, fator de aceleração, data projetada, nº atividades críticas.
2. **Diagnóstico** (parágrafo gerado server-side).
3. **3 gráficos** (recharts, já no projeto): Prazo×Execução (barras), Ritmo atual×necessário (barras), Evolução 30 dias (linha dupla avanço+risco).
4. **Tabela de atividades críticas** (ordenada por impacto financeiro + atraso) com coluna "ação recomendada".
5. **Ações recomendadas** (lista de cards com prioridade colorida).
6. **Plano de recuperação** (só se risco alto/crítico): metas 7/15/30 dias.
7. **Tendência**: badges D-1 / D-7 / medição anterior.
8. **Botão** "Atualizar análise agora" (invalida a query).
9. **Botão** "Gerar relatório gerencial" (PDF).

**Edição inline das atividades** (na tabela existente): adicionar colunas para % concluído, status, datas previstas, responsável, prioridade, impedimento — cada alteração chama `atualizarAtividade` e invalida `getAnaliseGerencial`.

**Reatividade:** TanStack Query com `queryKey: ['analise-gerencial', obraId]`. Cada `atualizarAtividade` faz `invalidateQueries`. Realtime channel em `obra_atividades` filtrado por `obra_id` para refletir mudanças de outros usuários.

## Fase 4 — PDF (`src/lib/analise-gerencial-pdf.ts`)

Usar `pdf-lib` ou `jspdf` (verificar o que já está no projeto). Layout em uma server function que monta o PDF a partir do mesmo payload do `getAnaliseGerencial`: capa, leitura executiva, prazo×execução, ritmo, projeção, atividades críticas, fatores risco/recuperação, metas, plano, decisão.

## Fase 5 — Cron de snapshot diário

`pg_cron` 1×/dia (03:00) chama `/api/public/hooks/snapshot-analise` que itera obras ativas e grava snapshot — garante histórico mesmo em dias sem edição.

## Detalhes técnicos importantes

- **Confiabilidade do avanço**: regra "valor → peso → média simples", retornada no payload e exibida com badge quando reduzida.
- **Sem mock**: se faltar `data_inicio` ou `prazo_contratual` da obra (campos `obras.data_inicio_obra`, `obras.prazo_contratual_dias` — verificar no schema atual), o painel mostra "Dados insuficientes — preencha em Configurações da Obra" e ainda assim renderiza o que for possível.
- **Sem alteração automática de atividades**: nunca o sistema marca % ou status — só calcula.
- **Recálculo**: snapshot é upsert do dia (não sobrescreve dias anteriores).

## Ordem de execução (1 turno por fase)

1. Migração (tabelas + RLS + triggers + cron).
2. Server functions (cálculos + sync + atualização).
3. UI: cards + diagnóstico + edição inline (sem gráficos/PDF).
4. Gráficos + tabela críticas + ações + plano + tendência.
5. PDF.

## Pontos que preciso confirmar antes de codar

- A obra hoje tem `data_inicio_obra` e `prazo_contratual_dias` em `ProjectData.info` (localStorage). Devo (a) **também migrar `ObraInfo` para tabela `obras`** se já não estiver, ou (b) ler do localStorage no momento da sync? Recomendo (a) — campos já existem em `obras` (verificar nomes exatos).
- Os "responsáveis" devem vir de `equipe_membros`/`funcionarios` (FK) ou aceitar texto livre? Recomendo: FK opcional + fallback texto.
- "Bloqueia atividades posteriores" (critério de criticidade): adiciono campo `bloqueia_atividades uuid[]` agora ou deixo para uma fase futura? Recomendo deixar campo no schema mas sem UI nesta entrega.
