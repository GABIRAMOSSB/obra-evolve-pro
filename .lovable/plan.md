# Análise Gerencial V2 — Refatoração completa

Trabalho exclusivamente sobre a tela existente (`AnaliseGerencialV2`), sem criar tela paralela, sem duplicar componentes. Primeiro corrijo regras de negócio e cálculos no engine/server; depois reorganizo o front em abas com identidade SOLV.

## Arquivos afetados (sem novas telas)

```text
src/lib/analise-v2.engine.ts          (reescrita do engine: SPI, riscos 4D, cenários, prontidão, financeiro)
src/lib/analise-v2.helpers.server.ts  (carrega aditivos, medições, faturamento, dependências, baseline)
src/lib/analise-v2.functions.ts       (orquestra; usa atividade_id como chave; cobertura de dados)
src/components/AnaliseGerencialV2.tsx (reorganiza em 6 abas + cabeçalho + 6 KPIs + Curva S + lateral)
src/components/analise/*              (subcomponentes da MESMA tela — KpiCard, CurvaS, Tooltips, MemoriaCalculo, AbaExecutivo, AbaPrazo, AbaFinanceiro, AbaAtividades, AbaRecuperacao, AbaQualidade)
src/lib/analise-gerencial-pdf.ts      (atualiza export usando o novo DTO)
supabase/migrations/<ts>_analise_v2.sql (tabelas: obra_atividade_dependencias, obra_decisoes, obra_acoes; colunas em obra_atividades: codigo_interno, prontidao_checklist; cron snapshot diário)
```

Sem mexer em outras áreas, exportações ou permissões existentes.

## FASE 1 — Correções críticas (sem mudar UI ainda)

1. **Bug prontidão sempre verdadeira** — remover `prioridade !== "baixa" || true` no engine; substituir por matriz real de 11 critérios (projeto, material comprado/entregue, equipe, equipamento, frente, predecessora, responsável, segurança, doc, data confirmada).
2. **Identificação por `atividade_id`** — toda chave de evolução, snapshot, dependência e merge passa a usar o UUID `obra_atividades.id`. `loadEvolutionsMap` indexa por UUID via `(obra_id, item_hierarquico)`; SINAPI deixa de ser chave.
3. **Migration**: adiciona `codigo_interno text`, `item_hierarquico text`, `prontidao jsonb`, `baseline_inicio date`, `baseline_fim date`, `predecessoras jsonb` em `obra_atividades` (nullable, idempotente). Cria `obra_atividade_dependencias`, `obra_decisoes`, `obra_acoes` com GRANT + RLS por `has_company_role`.
4. **Conferência do valor contratado** — engine carrega `obras.valor_contratado`, soma `aditivos_contratuais` (aprovados, supressões negativas), calcula `valor_vigente`, soma `obra_atividades.valor`, expõe diferença, % cobertura, contadores (sem valor, sem peso, sem planejamento).
5. **Separação de avanços** — DTO passa a expor: `avanco_fisico`, `avanco_fisico_ponderado`, `avanco_financeiro_estimado`, `valor_agregado_producao`, `valor_medido` (de `medicoes`), `valor_faturado` (de `notas_fiscais`), `valor_recebido` (de `notas_fiscais.status='paga'`). Nunca misturados.
6. **Confiança dos dados** — score 0–100 ponderando cobertura de valor, peso, datas planejadas, responsável, snapshots, predecessoras. Exibido em todo cartão.

Quando cobertura < 100%: bloquear avanço ponderado por valor, mostrar **"Dados insuficientes para cálculo"** + lista de pendências. Nunca esconder ausência.

## FASE 2 — Planejamento real (linha de base e SPI)

7. **Baseline planejada** por atividade — usa `data_prevista_inicio/fim` (já existe) + `peso`/`valor`.
8. **Avanço planejado acumulado** até `data_referencia` — curva S planejada por integração diária.
9. **SPI real** = `avanco_realizado / avanco_planejado`, faixas: ≥1,00 ok / 0,95–0,99 atenção / 0,85–0,94 atraso / <0,85 crítico. Trata zero ("não previsto para iniciar"). O índice antigo (linear) permanece como **"Índice linear simplificado"**, nunca chamado de SPI.
10. **Análise por etapa** — cada etapa comparada ao próprio início/fim/avanço planejado; situação enum: não_prevista | pronta | em_andamento | atenção | atrasada | bloqueada | concluída | concluída_com_atraso.
11. **Dependências editáveis** — tabela `obra_atividade_dependencias` (predecessora_id, sucessora_id, tipo TI/II/TT/IT, defasagem_dias, percentual_minimo, obrigatoria, observacao). Regras genéricas viram apenas sugestão inicial.

## FASE 3 — Gestão (riscos, decisões, cenários)

12. **Risco em 4 dimensões** — cada uma 0–100 + risco consolidado + confiança. Termo "Índice de risco: X/100" e nunca "% de chance".
    - Prazo: SPI, desvio, projeção, atividades de maior impacto, folgas.
    - Operacional: ritmo 14d, prontidão, materiais/equipes/equipamentos, bloqueios.
    - Financeiro: medido vs faturado vs recebido, custo realizado/comprometido/concluir, margem, fluxo.
    - Gerencial: decisões pendentes, sem responsável, pendências docs, atrasos aprovação.
13. **"Atividades de maior impacto gerencial"** (renomear; só vira "crítica" quando folga ≤ 0). Score pondera valor pendente, atraso, % restante, dependências, bloqueios, impacto medição/prazo, falta material/equipe/decisão/projeto, sem responsável.
14. **Decisões prioritárias** (top 5) e **Plano de ação** persistidos em `obra_decisoes` / `obra_acoes` com CRUD básico (registrar, marcar resolvido, evidência).
15. **Cenários** (5): inercial 14/28d, plano atual, recuperação viável, recuperação necessária, conservador. Cada um com data projetada, atraso, ritmo, equipe, custo, viabilidade.
16. **Projeções operacionais** baseadas em séries de snapshots e medições.

## FASE 4 — Front (mesma tela, redesenhada)

Identidade SOLV: navy primário, cartões brancos, raio 12–16px, sombra discreta, vermelho só crítico, laranja atenção, verde positivo, azul info. Tipografia 13–28px.

17. **Cabeçalho executivo** — obra, município, contrato, data-base, última atualização, responsável, confiança, situação, risco consolidado, botões: Atualizar / PDF / Excel.
18. **6 KPIs**: Avanço planejado | Avanço realizado | Desvio | SPI | Data projetada | Valor disponível p/ medição. Cada um com comparação, explicação, ícone, cor de situação, tooltip com fórmula.
19. **Curva S** (Recharts) — planejado / realizado / projeção / data atual / data contratual / data projetada / faixa recuperação. Filtros: 30d/60d/obra/etapa, físico/financeiro. Tooltip rico.
20. **6 abas**: Executivo | Prazo e Produção | Financeiro | Atividades e Bloqueios | Plano de Recuperação | Qualidade dos Dados.
21. **Painel lateral sticky** (desktop) — 3 maiores riscos, 3 decisões urgentes, 3 frentes sem prontidão, potencial próxima medição, última atualização, próximo prazo. Vira seção empilhada no mobile.
22. **Padrão visual SOLV** aplicado consistentemente; sem hardcode de cor, tudo via tokens em `src/styles.css`.

Tooltips em todo indicador + botão **"Ver memória de cálculo"** (dialog com valores, fórmula, resultado, alertas, dados ausentes).

## FASE 5 — Snapshots automáticos

Cron diário (`src/routes/api.public.analise-snapshot-cron.ts` + pg_cron) — upsert por `(obra_id, data_snapshot)` para todas as obras ativas. Aba Qualidade mostra: dias registrados, dias sem registro, última atualização, último lançamento, confiabilidade da série.

## FASE 6 — Validação

Build TS, testes manuais: obra sem planejamento, obra sem histórico, SINAPI duplicado, divisão por zero, datas nulas, desktop/tablet/mobile. PDF/Excel continuam funcionando com novo DTO.

## O que NÃO faço

- Sem nova rota / tela paralela.
- Sem alterar Atividades, Medições, RDO, Compliance.
- Sem mocks. Quando faltar dado: estado vazio explícito.
- Não removo `AnaliseGerencialPanel` antigo nesta entrega.
- Riscos jamais como probabilidade estatística.

Por ser muito grande, vou **entregar em PRs sequenciais nesta mesma tela**, na ordem das fases acima — começando pela Fase 1 assim que você aprovar. Confirma para eu iniciar?
