# Roadmap — Plataforma SOLV de Inteligência de Engenharia

Esse escopo (30 módulos) é grande demais para uma única entrega. Sem fasear, o risco de quebrar Orçamento / Realizado / NF-e / Estoque atuais é alto. Proponho **6 fases incrementais**, mantendo tudo que já existe intacto.

## Princípios (válidos em todas as fases)

- Zero alteração visual nas telas existentes (Orçamento, Realizado, NF-e, Estoque, Mão de Obra, Insumos, Equipe).
- Todo módulo novo entra como **rota nova** + menu adicional; nada é reescrito.
- Orçamento = previsto (imutável automaticamente). Tudo de execução vai em tabelas **novas** (camada Realizado já existente é estendida, nunca substituída).
- Histórico nunca é apagado — `soft delete` + versionamento.
- Toda nova tabela: RLS por `company_id` + GRANT para `authenticated`/`service_role`.

---

## Fase 1 — Fundação de Cadastros e Apropriação (já 70% pronto)

Itens do briefing: **6, 7, 8, 9, 10, 11, 28 (parcial)**

Já existe: `insumos_mestre`, `insumo_categorias`, `insumo_aliases`, `unidades_medida` com `fator_conversao`, seed de ~50 insumos, `nfe_item_apropriacoes` (rateio por quantidade).

A fazer:
- **Expandir seed** de insumos para ~500 itens cobrindo todas as 20 categorias do item 7.
- **Tela "Apropriar NF-e com rateio"** (substituir o seletor único por diálogo de divisão para várias composições/centros de custo).
- **Campo `centro_custo`** em `nfe_item_apropriacoes` e em `apontamentos_mao_obra`.
- **Aprendizado de aliases**: ao apropriar uma descrição de NF-e a um insumo mestre, gravar automático em `insumo_aliases`.
- **Sugestão por IA** (Lovable AI Gateway, `google/gemini-2.5-flash-lite`) de categoria + insumo mestre na importação de XML.

Entrega: usuário consegue importar XML, sistema sugere o insumo certo, rateia entre composições e o estoque registra entrada automática.

---

## Fase 2 — Estoque, Perdas e Transferências

Itens: **12, 11 (perdas)**

Tabela `estoque_movimentos` já existe com tipos `entrada/saida/ajuste/transferencia`. Faltam fluxos de UI.

- **Tela de transferência** entre obras / almoxarifado central.
- **Devolução** (tipo `devolucao` adicionado ao enum lógico).
- **Apontamento de consumo** vinculado a item do orçamento (fecha o loop "comprado → aplicado").
- **Indicador de perda** por insumo: `comprado − aplicado − saldo = perda`.
- **Rastreabilidade**: tela "Histórico do insumo" mostrando NF-e origem → estoque → consumo → obra.

---

## Fase 3 — Mão de Obra Completa, Equipamentos e Produtividade

Itens: **13, 14, 15, 16, 17, 18**

Já existe: `funcionarios`, `funcoes_mao_obra`, `equipes`, `apontamentos_mao_obra` (com `quantidade_executada`).

Novas tabelas:
- `funcionario_custos` — salário, encargos, benefícios, VT, VA, EPI mensais → cálculo de `custo_hora_real`.
- `equipamentos` — próprios e locados, horímetro, operador padrão.
- `apontamentos_equipamento` — horas, obra, item, operador, consumo combustível.
- `equipamento_manutencoes` e `equipamento_abastecimentos`.
- `servicos_terceirizados` — frete, munck, concretagem, vinculados ao item do orçamento.

Telas:
- **Produtividade** — qtd executada / horas trabalhadas por equipe/colaborador, ranking.
- **Curva de consumo** (item 19): previsto acumulado × realizado acumulado com alertas.

---

## Fase 4 — Banco de Preços, Histórico e Composições Próprias SOLV

Itens: **21, 22, 23, 24, 25**

- View materializada `banco_precos_insumo` agregando todas as NF-e por insumo mestre × fornecedor × UF × mês (mín/máx/médio/último).
- **Biblioteca técnica**: nova tabela `obra_execucoes_acervo` consolidando por serviço executado (fotos, equipe, prazo, materiais, custo real). Usa storage bucket `obra-fotos` já existente.
- **Composições SOLV automáticas** — função SQL que, para cada item executado em ≥3 obras, calcula coeficientes médios reais (qtd insumo / qtd serviço, h MO / qtd serviço) e gera `composicoes_solv` versionadas (`composicoes_solv_2026`, `_2027`...).
- Tela "Composições SOLV" lado a lado com SINAPI/TCPO de referência.

---

## Fase 5 — Centro de Lucro, Índice de Confiabilidade e Auditoria

Itens: **20 (completo), 26, 27, 29**

- Tabela `obra_contrato` — valor, aditivos, faturamentos.
- Dashboard "Centro de Lucro": receita − custo realizado = margem.
- Após `obra.status = 'concluida'`: gera `obra_confiabilidade` (precisão = 1 − |realizado − orçado| / orçado).
- **Auditoria genérica**: tabela `audit_log` + trigger em todas as tabelas críticas (orçamento, NF-e, apropriações, apontamentos) registrando user, antes/depois, timestamp.

---

## Fase 6 — Certificado Digital A1 e Integrações

Itens: **5, 4 (avançado), 30**

- Estrutura de storage privado `certificados-digitais` (criptografado).
- Tabela `empresa_certificados` (CNPJ, validade, senha cifrada via Lovable Cloud secret).
- Server function `consultarNFeBySefaz` (preparada, sem chamada real até A1 ativo).
- View consolidada `obra_360` integrando orçamento + compras + estoque + apropriações + apontamentos + medições + financeiro.

---

## Itens transversais (entram conforme cada fase)

- **3 — Camada Realizado**: já existe a rota `/realizado`, será estendida em cada fase.
- **1, 2 — Preservação + orçamento como base**: regra arquitetural, validada em cada migration.
- **30 — Integração total**: emerge naturalmente nas fases 4–6.

---

## Tecnologia

- TanStack Start (server functions, sem novas Edge Functions).
- Supabase Postgres com RLS por `company_id`.
- Lovable AI Gateway para classificação automática (item 28).
- Lovable Storage para fotos e certificados.
- Recharts para curva de consumo e dashboards.

---

## Como quer prosseguir?

**Recomendo começar pela Fase 1**, que destrava o fluxo NF-e → composição → estoque que já está parcialmente feito e é a base para todo o resto.

Me confirme qual fase iniciar (ou se quer reordenar). Cada fase será 4–8 entregas separadas para você validar passo a passo.