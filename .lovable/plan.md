# Apontamento detalhado de Mão de Obra e Equipamentos no Diário de Obra

## Objetivo

Evoluir o bloco "Equipe presente" e "Equipamentos utilizados" do diário para registrar **quantidade, horas trabalhadas, hora extra e atividade da planilha** de cada recurso. Esse apontamento alimenta automaticamente o módulo **Realizado** usando os valores cadastrados em Mão de Obra / Equipamentos. Se a entrada do diário for apagada, o custo correspondente é removido do Realizado.

---

## Como vai funcionar (visão do usuário)

No diálogo "Registrar entrada no diário de obra", o bloco **Equipe presente** passa a ser uma lista de linhas. Cada linha tem:

- **Função** (Pedreiro, Servente, Eletricista…)
- **Quantidade** (ex: 2 pedreiros)
- **Atividade da planilha** (select com os itens do orçamento da obra)
- **Horas trabalhadas** (ex: 9h)
- **% jornada** (calculado: horas / 8h → 112,5%)
- **Hora extra** (calculado: max(0, horas − 8) × qtd)
- **Custo** (calculado: qtd × horas normais × R$/h + qtd × HE × R$/h × 1,5)

Botão "+ Adicionar linha de mão de obra".

Mesma estrutura para **Equipamentos utilizados**:

- Equipamento, quantidade, atividade, horas, % uso, custo (do cadastro do equipamento).

Os chips antigos viram atalhos: clicar em "+ Pedreiro" adiciona uma linha já com função preenchida.

O campo livre de texto "Mestre de obras, Encarregado…" continua existindo como **resumo automático** gerado a partir das linhas.

---

## Integração com Realizado

- Ao **salvar a entrada** do diário, o sistema grava em `apontamentos_mao_obra` e `apontamentos_equipamento` (já existem) um registro por linha, com `diary_entry_id` como chave de origem.
- A tela `/realizado` já lê esses apontamentos — passa a mostrar custo agregado por item do orçamento.
- Ao **editar** a entrada do diário, o sistema faz `delete + insert` dos apontamentos vinculados àquele `diary_entry_id`.
- Ao **apagar** a entrada do diário, os apontamentos vinculados são apagados em cascata → custo some do Realizado.

Valores R$/h vêm de:
- Mão de obra: `funcoes_mao_obra.custo_hora` (cadastro existente). HE = custo_hora × 1,5.
- Equipamento: `equipamentos.custo_hora` (será criado se não existir).

---

## Etapas de implementação

### 1. Banco de dados (migração)

- Adicionar coluna `diary_entry_id uuid` em `apontamentos_mao_obra` e `apontamentos_equipamento` (FK lógica, sem constraint pra não quebrar dados antigos).
- Adicionar `quantidade_pessoas int`, `horas_normais numeric`, `horas_extras numeric`, `custo_calculado numeric`, `item_orcamento_codigo text` em `apontamentos_mao_obra` (alguns já existem; verificar).
- Mesma estrutura em `apontamentos_equipamento`.
- Garantir tabela `equipamentos` com `custo_hora`. Se não existir, criar mínima (id, company_id, nome, custo_hora, ativo) com RLS por company_id e GRANT para authenticated/service_role.
- Índices em `diary_entry_id`.

### 2. Tipos no front

- Estender `DiaryEntry` (em `src/lib/types.ts`) com:
  ```ts
  maoObraLinhas?: Array<{
    id: string; funcaoId: string; funcaoNome: string;
    quantidade: number; horas: number; itemCodigo?: string;
    custoHora: number;
  }>;
  equipamentoLinhas?: Array<{
    id: string; equipamentoId: string; equipamentoNome: string;
    quantidade: number; horas: number; itemCodigo?: string;
    custoHora: number;
  }>;
  ```
- Manter campos antigos `equipe` e `equipamentos` (string) para compatibilidade — gerados automaticamente.

### 3. UI do diálogo do diário

- Em `src/components/ObraApp.tsx` (ou onde o `DiaryDialog` está), substituir o bloco de chips por:
  - Tabela compacta com linhas editáveis.
  - Botões "+ Pedreiro" etc. continuam, agora adicionam linha pré-preenchida.
  - Coluna "Atividade" = `Select` com os itens da planilha (`rows` da obra, só folhas).
  - Coluna "Horas", "% jornada" (read-only, `horas/8*100`), "HE" (read-only), "Custo" (read-only).
  - Mesma estrutura para equipamentos.
- Buscar `funcoes_mao_obra` e `equipamentos` do Supabase via `useQuery` ao abrir o diálogo.

### 4. Persistência

- Ao salvar diário (já passa por algum hook/serviço), após persistir o `diary_entries`:
  1. `delete from apontamentos_mao_obra where diary_entry_id = :id`
  2. `insert` uma linha por `maoObraLinhas`.
  3. Idem equipamentos.
- Ao deletar entrada do diário: trigger SQL `ON DELETE` em `diary_entries` que apaga apontamentos com aquele `diary_entry_id`. (Ou cascade no app.)

### 5. Realizado

- Em `src/routes/realizado.tsx`, somar `custo_calculado` de `apontamentos_mao_obra` e `apontamentos_equipamento` agrupado por `item_orcamento_codigo`.
- Mostrar como nova coluna/seção "MO Real" e "Equip. Real" ao lado do material já apurado.

### 6. QA

- Criar entrada com 2 pedreiros × 9h em item X → conferir cálculo (2 × 8 × R$/h + 2 × 1 × R$/h × 1,5) e aparecer em Realizado.
- Editar a entrada (mudar pra 1 pedreiro) → Realizado atualiza.
- Apagar entrada → Realizado zera essa contribuição.

---

## Detalhes técnicos

- Linguagem: TypeScript + TanStack Start (sem edge functions; usar `supabase` client direto, padrão do projeto).
- Hora extra fixa em 1,5× nesta fase. (1,5 dia útil / 2× domingo/feriado pode vir depois.)
- Jornada padrão = 8h (hardcoded por enquanto; podemos parametrizar por empresa numa Fase 2).
- A migração não toca em dados existentes — apenas adiciona colunas nullable.
- Sem mudanças visuais nas telas Realizado / Orçamento além da nova coluna de MO/Equipamento.

---

## Fora de escopo desta entrega

- Cadastro de funcionário individual com nome (continua por função).
- Folha de pagamento, encargos detalhados (Fase 3 do roadmap).
- Manutenção/combustível de equipamento (Fase 3).
- Apontamento via app mobile separado.

Confirma a abordagem? Após o "ok", aplico migração + UI + integração com Realizado.
