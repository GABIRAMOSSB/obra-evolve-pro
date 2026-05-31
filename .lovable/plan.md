## 1. Sincronização automática ao apagar (verificação)
O Realizado já lê do banco a cada montagem da página. Vou confirmar que as queries não estão cacheadas em excesso e adicionar invalidação ao focar a aba para garantir reflexo imediato após apagar no Diário/NF-e.

## 2. Editar/apagar por linha de insumo no espelho
Em `src/routes/realizado.tsx`, na tabela "Composição real" (insumos expandidos da composição), cada linha vai ganhar:
- **🗑️ Apagar** — confirmação e remove do banco a linha de origem:
  - `MO` → deleta de `apontamentos_mao_obra`
  - `NF-e` (rateio) → deleta de `nfe_item_apropriacoes`
  - `NF-e` (direto) → remove o vínculo `obra_id`/`item_codigo` do `nota_fiscal_itens` (mantém a NF, só desapropria)
  - `Estoque` → deleta de `estoque_movimentos`
- **✏️ Editar** — abre dialog para ajustar quantidade, valor e descrição; salva no banco

Cada item do array `insumos` passa a carregar `{ id, origemTabela, ... }` para saber o que apagar/editar.

## 3. Novo módulo: Composições Próprias
**Banco** — duas novas tabelas:
- `composicoes_proprias` (codigo, descricao, unidade, custo_total, observacoes)
- `composicoes_proprias_insumos` (composicao_id, insumo_id, descricao, unidade, coeficiente, custo_unitario)

Ambas com RLS por `company_id` e GRANTs corretos.

**UI** — nova rota `/composicoes`:
- Lista de composições próprias da empresa (busca + filtros)
- Botão "Nova composição" → dialog com:
  - Cabeçalho: código, descrição, unidade
  - Tabela de insumos: adicionar/remover linhas (puxa do `insumos_mestre`), com coeficiente e custo unitário; total calculado
- Ações por linha: editar, duplicar, apagar
- Link no menu lateral

**Integração futura no orçamento**: as composições próprias ficam disponíveis para serem inseridas como item no orçamento (esta integração entra como passo 2 — primeiro entrego o CRUD funcionando).

## Ordem de entrega
1. Migration das tabelas de composições próprias
2. Ações editar/apagar nos insumos do espelho do Realizado
3. Página `/composicoes` com CRUD completo
4. Link no menu
