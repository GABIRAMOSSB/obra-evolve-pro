## Objetivo

Substituir o modelo atual de uma única `Evolution` por item por uma **lista de medições sequenciais** (M1, M2, M3...). Cada medição registra a quantidade executada **no período**, e os acumulados são calculados a partir da soma. Apenas a medição **mais recente** é editável; as anteriores ficam **bloqueadas** após "Fechar Medição", e o sistema cria automaticamente a próxima medição em aberto.

## Modelo de dados (`src/lib/types.ts`)

```ts
export interface Measurement {
  id: string;
  number: number;        // M1, M2, M3...
  quantExec: number;     // quantidade do período (não acumulada)
  dataExec: string;
  observacoes: string;
  closed: boolean;       // bloqueada após "Fechar Medição"
  closedAt?: string;
}

export interface Evolution {
  measurements: Measurement[];   // ordenadas por number
  // campos legados mantidos por compatibilidade na leitura (migração)
}
```

**Migração in-memory ao carregar workspace**: se `evolution.quantExec` existir (formato antigo), converter em uma única medição fechada `M1`.

## Cálculos (`src/lib/calc.ts`)

- `quantAcum = soma(measurements.quantExec)` — limitado a `row.quantidade`
- `percent = quantAcum / row.quantidade * 100` (cap 100)
- `valorExec = (percent/100) * row.total`
- `quantRestante = row.quantidade - quantAcum`
- `valorRestante = row.total - valorExec`
- **Status**:
  - `Não iniciada`: `percent === 0` (qualquer item com qty 0 fica aqui)
  - `Em andamento`: `0 < percent < 100`
  - `Concluída`: `percent >= 100 && valorExec > 0`
- Itens com `quantidade === 0` ou `total === 0` ficam sempre em "Não iniciada".
- Todos os cálculos derivados (`groupMetrics`, `projectMetrics`, filtros, painel, PDF, exportação Excel) consomem a mesma função `activityMetrics(row, evo)` — recálculo automático ao abrir obra, alterar medição, filtrar, gerar relatório ou exportar.

## Validação

Ao salvar a quantidade da medição em aberto:
- `quantExecPeriodo <= row.quantidade - quantAcumAnteriores`
- Se exceder, exibir toast em PT-BR e clipar no máximo permitido.

## UI — Dialog de medição (`EvolutionDialog`)

Reformular para mostrar **tabela de medições** do item com colunas: `Medição | Qtd. Exec. | % Exec. | Valor Executado | Status | Data`.

- Linhas fechadas: somente leitura, com badge "Bloqueada".
- Linha em aberto (sempre a última): inputs editáveis (qty, data, obs).
- Rodapé com acumulados: Qtd. Acum., % Acum., Valor Acum., Qtd. Restante, Valor Restante.
- Botões:
  - **Salvar parcial** — grava sem fechar.
  - **Fechar Medição** — marca `closed=true`, registra `closedAt`, cria automaticamente a próxima medição em aberto (com qty 0). Confirmação antes ("Após fechar, esta medição não poderá ser alterada").
- Botão de excluir só na medição em aberto (apaga a linha aberta atual; nunca uma fechada).

## UI — Tabela principal

A coluna existente de "Qtd. Exec." continua mostrando o **acumulado** (soma das medições). Tooltip indica quantas medições existem (ex.: "3 medições · 1 em aberto"). Botão de editar abre o novo dialog. ProgressBar e status seguem `activityMetrics`.

## Painel resumo

O painel já existente passa a usar os mesmos cálculos. Garantir que mostre:
- Valor total da obra · Valor executado · Valor restante
- % executado + barra de progresso
- Qtd. concluída · Qtd. em andamento (com a regra "itens zerados nunca contam")

## Persistência

`Workspace` é serializado em JSON (tabelas `user_workspaces` / `company_workspaces`). Como `Evolution` muda de forma, a migração roda no load (`ObraApp` ao hidratar) e na primeira gravação o formato novo é persistido. Sem mudança de schema.

## Arquivos afetados

- `src/lib/types.ts` — novo tipo `Measurement`, novo formato de `Evolution`.
- `src/lib/calc.ts` — `activityMetrics` lê de `measurements`.
- `src/lib/excel.ts` — exportação usa acumulado (apenas leitura).
- `src/lib/pdf.ts` — relatório usa acumulado.
- `src/components/ObraApp.tsx` — migração no load, `updateEvolution` aceita lista, novo dialog, ações "Fechar Medição".

## Fora de escopo desta entrega

- Sincronização cross-device em tempo real das medições (continua via save do workspace).
- Histórico de auditoria por usuário/timestamp em cada medição fechada (apenas `closedAt`).
- Reabrir medição fechada (intencional — bloqueio é regra do negócio).
