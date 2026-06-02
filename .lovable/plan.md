
# Importação do modelo "Orçamento Sintético"

## 1. Detecção automática do modelo no upload

No `src/lib/excel.ts` (`parseExcel`):

- Em vez de pegar sempre `wb.SheetNames[0]`, varrer todas as abas.
- Se existir aba cujo nome normalizado contenha `orcamento sintetico`, classificar como **`modelo_orcamento_sintetico`** e usar essa aba.
- Caso contrário, manter fluxo atual → **`modelo_antigo`**.
- Retornar `modelo: "modelo_antigo" | "modelo_orcamento_sintetico"` no `ParseResult`.

## 2. Parser do novo modelo

Novo módulo `src/lib/excel-sintetico.ts`:

- Detecta cabeçalho de 2 linhas: linha 1 com `Item, Código, Banco, Descrição, Und, Quant., Valor Unit, Valor Unit com BDI, Total`; linha 2 com sub-cabeçalhos `M.O. | MAT. | Total` sob "Valor Unit com BDI" e sob "Total".
- Mapeia colunas para:
  - `item`, `codigo`, `banco`, `descricao`, `und`, `quantidade`
  - `valorUnitSemBDI`
  - `valorUnitMOcomBDI`, `valorUnitMATcomBDI`, `valorUnitTotalcomBDI` (= `precoUnitarioVenda`)
  - `totalMO`, `totalMAT`, `totalGeral` (= `precoVendaTotal`)
- Classifica linha:
  - **Etapa/grupo**: item + descrição preenchidos, sem código/banco/und/quantidade.
  - **Composição**: item + código + banco + descrição + und + quantidade.
- Calcula `nivelHierarquico` pelos segmentos do item ("1.2.3" → nível 3) e `itemPai` (`1.2`).
- Ignora linhas totalmente vazias; coleta `skipped` com motivo igual ao parser antigo.

## 3. Modelo de dados (BudgetRow + persistência)

Estender `BudgetRow` em `src/lib/types.ts` (campos opcionais para não quebrar modelo antigo):

```
modelo?: "modelo_antigo" | "modelo_orcamento_sintetico"
nomeAba?: string
valorUnitMO?: number
valorUnitMaterial?: number
totalMO?: number
totalMaterial?: number
precoVendaTotal?: number     // = total atual quando sintético
impostosNota?: number        // calculado
lucroPlanejado?: number      // calculado
custoMeta?: number           // calculado
itemPai?: string
nivelHierarquico?: number
tipoLinha?: "etapa" | "composicao"
```

Persistência: o workspace já guarda `rows` em JSONB (`company_workspaces.workspace`), então não precisa migration — os novos campos viajam junto. Adicionar `modelo` e `nomeAba` em `ProjectData`.

## 4. Cálculos (impostos, lucro, custo meta)

Em `src/lib/calc.ts`, nova função `computeMetaCalc(row, params)`:

```
tributos% = ISS + PIS + COFINS + IRPJ + CSLL  (já em parametros_financeiros)
impostosNota   = precoVendaTotal * tributos%
lucroPlanejado = precoVendaTotal * lucroPretendido%
custoMeta      = precoVendaTotal - impostosNota - lucroPlanejado
```

Aplicado no momento da importação (snapshot) **e** recalculado em runtime quando os parâmetros mudarem (mesmo padrão usado hoje em `_app.realizado.tsx`).

## 5. UI — importação e conferência

Em `_app.index.tsx` / fluxo de upload (`ObraApp`):

- Após o `parseExcel`, mostrar diálogo de conferência com:
  - Nome do arquivo, **modelo detectado**, aba importada,
  - # etapas, # composições, valor total importado (somatório das composições),
  - # linhas ignoradas (lista expansível já existente).

## 6. Comparativo por composição

Em `_app.realizado.tsx` (ou aba dedicada), para obras com `modelo_orcamento_sintetico`:

- Adicionar colunas: Preço Venda, Impostos Nota, Lucro Planejado, Custo Meta, MO Prevista, Material Previsto, Previsto Técnico, MO Realizada, Material Consumido, Equipamento Apropriado, Realizado Total, **Saldo Meta**, Lucro Atual, Margem Atual %, Status.
- Status:
  - `Saldo Meta > 20% custoMeta` → verde "Dentro da Meta"
  - `0 < Saldo Meta ≤ 20% custoMeta` → amarelo "Atenção"
  - `Saldo Meta ≤ 0` → vermelho "Acima do Custo Meta"
- Botão **"Ver memória de cálculo"** abre dialog com: Preço Venda Total, % e R$ de tributos, % e R$ de lucro, Custo Meta, Realizado Total, Saldo Meta, Lucro Atual, Margem Atual.

Para obras com `modelo_antigo`, manter a tela como está hoje.

## 7. Compatibilidade

- `parseExcel` continua aceitando o modelo antigo sem mudança no chamador.
- `BudgetRow.modelo` ausente ⇒ tratar como `modelo_antigo`.
- Telas existentes que leem `row.total` seguem funcionando (no sintético, `total = precoVendaTotal`).

## 8. Ordem de execução

1. `excel-sintetico.ts` + detecção em `parseExcel` (retorna `modelo`/`nomeAba`).
2. Extensão de `BudgetRow` e `ProjectData`.
3. `computeMetaCalc` em `calc.ts`.
4. Diálogo de conferência pós-upload com modelo detectado.
5. Comparativo por composição + memória de cálculo (apenas modelo sintético).

## 9. Fora de escopo desta entrega

- Vínculo automático etapa↔centro de custo (continua manual via `CentroCustoSelect`).
- DRE da obra / dashboard de margem por centro (próxima fase, depois que o comparativo estiver validado).
- Base MRP (depende de quantidades de insumo por composição, que o sintético não traz).
- Migração retroativa de obras antigas para o novo schema de colunas.
