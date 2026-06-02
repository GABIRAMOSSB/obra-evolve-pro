# Centro de Custo — Plano de Implementação

## 1. Modelo de dados (migration)

Criar tabela `centros_custo` por empresa, hierárquica (grupo → subgrupo):

```
public.centros_custo
  id, company_id, parent_id (nullable),
  codigo (text, único por empresa),
  nome, descricao, tipo (enum: administracao | mao_obra | materiais |
                          equipamentos | terceiros | indiretos | outros),
  ordem, ativo, created_at, updated_at
```

- GRANTs para `authenticated` + `service_role`; RLS por `is_company_member` /
  `has_company_role` (mesmo padrão das outras tabelas).
- Função `seed_centros_custo_base(_company uuid)` — popula a estrutura
  padrão do briefing (Administração, MO Direta, Materiais, Equipamentos,
  Terceiros, Indiretos + subgrupos).
- Chamar o seed no trigger `handle_new_user_company` para novas empresas.
- Endpoint manual ("Carregar centros padrão") para empresas existentes.

## 2. Colunas `centro_custo_id` (substituindo o text livre atual)

Adicionar `centro_custo_id uuid` (nullable inicialmente para back-fill,
depois NOT NULL via validação na UI) em:

- `estoque_movimentos` (já existe `centro_custo text` — manter como
  legado e migrar para FK).
- `apontamentos_mao_obra` (idem).
- `nfe_item_apropriacoes` (idem).
- `composicoes_proprias` — opcional, centro de custo "sugerido" da
  composição (usado como default no rateio).

Índices: `(company_id, centro_custo_id)` em cada tabela acima.

## 3. UI — Cadastro (Cadastros → Centros de Custo)

Novo route: `src/routes/_app.centros-custo.tsx`

- Árvore com grupos e subgrupos (expand/collapse).
- CRUD: criar, editar, mover (alterar `parent_id`), ativar/desativar.
- Botão "Carregar estrutura padrão" (executa `seed_centros_custo_base`).
- Apenas `admin`/`editor` editam; demais só leitura.
- Link adicionado no `AppSidebar` em **Administração**.

## 4. Apropriação obrigatória nos lançamentos

Componente reutilizável `CentroCustoSelect` (combobox com busca,
mostrando "Grupo › Subgrupo"). Campo passa a ser **obrigatório** em:

- **NFe → rateio** (`NfeRateioDialog`): seletor por linha de apropriação.
  Bloquear "Salvar" se algum item sem centro de custo.
- **Estoque** (saídas/entradas manuais em `_app.estoque.tsx`).
- **Mão de obra / Apontamentos** (`_app.mao-de-obra.tsx`).
- **Equipamentos** (apontamentos de uso em `_app.equipamentos.tsx`).

Sugestão automática a partir da composição/insumo, mas usuário pode
sobrescrever.

## 5. Dashboard — Custos por Centro de Custo

Adicionar aba em `_app.realizado.tsx` (ou nova `_app.centros-custo.tsx`
dependendo do volume):

- **Tabela "Custos por Centro de Custo"**: valor realizado, % da obra.
- **Gráfico pizza/donut** do percentual por centro (Recharts).
- **Comparativo Previsto × Realizado × Desvio × Saldo × Margem** por
  centro, reutilizando `computeCalc` já implementada no realizado.
- Filtros: obra, período, grupo.

## 6. Tipos / lib

- Adicionar `CentroCusto` em `src/lib/types.ts`.
- Helper `useCentrosCusto()` em `src/hooks/use-centros-custo.tsx`
  (lista plana + map por id + árvore).
- Atualizar funções de cálculo em `src/lib/calc.ts` para agregação por
  centro de custo.

## 7. Fora de escopo nesta entrega

- Migração automática dos lançamentos antigos que usam `centro_custo`
  como texto livre — a UI mostra um alerta "sem centro" e oferece
  reclassificação manual.
- Centro de custo orçado/previsto por etapa (vem em fase 2, depois que
  a parametrização de orçamento estiver pronta).
- Permissões granulares por centro (todos os membros enxergam todos).

## 8. Ordem de execução

1. Migration (tabela + seed + FKs + índices + RLS/GRANTs).
2. `CentroCustoSelect` + hook.
3. Tela de cadastro + entrada no sidebar.
4. Tornar obrigatório nos dialogs de NFe, estoque, MO, equipamentos.
5. Dashboard e comparativo por centro.
