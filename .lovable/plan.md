# Análise Gerencial da Obra — nova aba

Vou criar uma **nova aba "Análise Gerencial"** ao lado da aba *Atividades* dentro da página da obra. O painel existente (`AnaliseGerencialPanel`) continua no código mas deixa de ser exibido — a nova aba o substitui visualmente e implementa os 21 blocos pedidos, lendo **somente** de `obra_atividades` (sem inserts, sem mudar schema dessa tabela).

## Arquitetura

```text
ObraApp
 ├── Tab "Atividades"           (existente, intocado)
 └── Tab "Análise Gerencial"    (NOVO)
        └── <AnaliseGerencialV2 obraId=... />
              ├── lê obra + obra_atividades (idempotente, só SELECT)
              ├── chama engine puro analise-gerencial-v2.ts
              └── renderiza 21 seções
```

Engine 100% puro em `src/lib/analise-gerencial-v2.ts` (sem I/O, testável). Snapshot diário gravado em `obra_analise_snapshots` (tabela já existe) via upsert por `(obra_id, data_referencia)` — **só leitura** de `obra_atividades`.

## Blocos implementados

**Topo (KPIs grandes):** pontuação de risco 0–100 com barra, badge confiabilidade, diagnóstico estruturado em 5 parágrafos (situação / causa / consequência / recuperação / decisão).

**1. Indicadores principais** — prazo consumido, avanço ponderado (financeiro→físico→média), desvio p.p. com classificação, IDP com frase "a cada 1% de prazo, entregou X%".

**2. Ritmo** — médio acumulado, 7d, 15d (deriva de `data_real_fim` / snapshots), necessário, fator de aceleração com frase automática.

**3. Projeção** — 2 cenários (acumulado e últimos 14d), datas projetadas, atraso, comparação tendência (melhorando/piorando).

**4. Atividades críticas** — índice de impacto ponderado (valor 30%, atraso 25%, % pendente 15%, prioridade 10%, impedimento 10%, sem responsável 5%, proximidade prazo 5%), classificação crítica/alta/média/baixa, tabela ordenada.

**5. Exposição financeira** — não iniciadas, atrasadas, críticas, % com 0%, % concentrado nas 5 maiores, textos automáticos.

**6. Por etapa** — agrupa por campo `etapa`, situação (concluída/no prazo/atenção/atrasada/bloqueada/não iniciada).

**7. Dependências/bloqueios** — inferidas por regras fixas de etapa (cobertura→acabamentos, instalações→drywall, drywall→pintura, esquadrias→vedação, PPCI→entrega). Indicadores: nº bloqueadas, valor bloqueado.

**8. Prontidão das frentes** — checklist por atividade (responsável, prazo, predecessoras, impedimento, data programada) → índice 0–100%.

**9. Produtividade recente** — 7d vs semana anterior vs 15d vs meta. Alerta após 2 semanas <75%.

**10. Metas de recuperação** — 7d / 15d / 30d / meio do prazo / -15d / final, com % esperado, valor, diferença vs realizado.

**11. Três cenários** — ritmo atual / +30% / ritmo necessário; condições, não promessas.

**12. Pontuação de risco 0–100** — pesos exatos (25/20/20/15/10/10) e breakdown dos fatores.

**13. Confiabilidade** — alta/média/baixa + lista de dados faltantes ("18 sem responsável, 12 sem prazo...").

**14. Diagnóstico estruturado** — 5 parágrafos.

**15. Decisões agora** — até 7 cards com problema/impacto/decisão/responsável/prazo/resultado.

**16. Plano de ação** — tabela com prioridade/ação/atividade/responsável/prazo/impacto/status. "Responsável não definido" gera ação automática.

**17. Tendência** — comparação hoje vs ontem vs 7d vs análise anterior, lida de `obra_analise_snapshots`. Snapshot é gravado a cada cálculo (upsert na chave `obra_id+data_referencia` → idempotente).

**18. Alertas inteligentes** — gerados em memória a partir das regras; deduplicação por hash do conteúdo comparando com snapshot anterior.

**19. Botão "Gerar relatório gerencial"** — PDF expandido reutilizando `analise-gerencial-pdf.ts`, com todos os blocos acima.

**20. Idempotência** — engine **só lê** `obra_atividades`. Snapshot vai para `obra_analise_snapshots` via upsert. Zero inserts em `obra_atividades`. Constraint `obra_atividades_obra_id_item_codigo_key` permanece.

**21. Texto-resultado** — frases compostas automaticamente a partir dos números (ex: "Existem N atividades atrasadas, que representam R$ X e Y% do contrato. Z delas bloqueiam outras W...").

## Detalhes técnicos

- **Novo arquivo `src/lib/analise-gerencial-v2.ts`** — engine puro, exporta `calcularAnaliseV2(obra, atividades, snapshotsAnteriores)` retornando todos os 21 blocos como DTO.
- **Novo arquivo `src/lib/analise-gerencial-v2.functions.ts`** — `createServerFn` com `requireSupabaseAuth`: SELECT em `obras` + `obra_atividades` + últimos 30 snapshots; chama engine; faz upsert do snapshot do dia; retorna DTO.
- **Novo componente `src/components/AnaliseGerencialV2.tsx`** — renderiza os 21 blocos, usa `useQuery` para invalidação automática quando atividades mudam.
- **Edição em `src/components/ObraApp.tsx`** — adiciona `<TabsTrigger value="analise-v2">` ao lado de Atividades e o `<TabsContent>` correspondente. Painel antigo (`AnaliseGerencialPanel`) sai da UI mas o arquivo permanece (pode ser removido depois).
- **Sem migration nova** — `obra_analise_snapshots` já existe; campo `payload` jsonb guarda DTO completo.
- **PDF** — extensão de `analise-gerencial-pdf.ts` (mesmo arquivo) com nova função `gerarRelatorioGerencialV2(dto)`.
- **Auto-recálculo** — toda mutação que toca `obra_atividades` invalida a query key `["analise-v2", obraId]`.

## O que NÃO faço

- Não mexo no schema de `obra_atividades`, não removo constraint, não faço INSERT lá.
- Não removo o `AnaliseGerencialPanel` antigo neste passo (fica órfão no código; removo depois se você confirmar).
- Não adiciono campo de dependências cadastrável agora — dependências são inferidas por regras de etapa. Se quiser depois um cadastro manual, faço em fase 2.
- Sem cron diário automático nesta entrega — o snapshot é gravado quando o usuário abre a aba ou clica em recalcular. Se quiser cron 1x/dia por obra ativa, adiciono em fase 2.
