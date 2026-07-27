# Módulo Subempreiteiros

Novo módulo completo integrado a Obras, Orçamentos, Contratos e Medições, seguindo o padrão visual e arquitetural existente (TanStack Start + Supabase/RLS + shadcn + `createServerFn`).

## Escopo funcional

Menu **Subempreiteiros** com 6 rotas sob `/_app/subempreiteiros/*`:
Empresas • Contratos • Serviços Contratados • Medições • Recibos • Pagamentos

Fluxo: Contrato-Cliente → Contrato-Subempreitada → Medição → Assinatura → Recibo → Pagamento.

## Modelo de dados (nova migration)

Todas as tabelas com `company_id`, RLS por `is_company_member`, GRANTs padrão, `created_at/updated_at`, triggers.

- `subempreiteiros` — empresa (razão social, fantasia, CNPJ, contatos, endereço, dados bancários, PIX, obs).
- `subempreiteiro_documentos` — anexos (Storage bucket `subempreiteiros`, privado).
- `sub_contratos` — número, obra_id, subempreiteiro_id, datas, valor_max, objeto, responsável, status enum (`em_andamento|suspenso|finalizado|cancelado`), pdf_url.
- `sub_contrato_servicos` — código, descrição, unidade, qtd_contratada, preco_unit_sub, valor_total, qtd_executada (calc), saldo (calc). Origem opcional do `orcamento_itens`.
- `sub_medicoes` — número, competência, data, contrato_id, responsável, status enum (`rascunho|em_conferencia|aguardando_assinatura|assinada|liberada_pagamento|paga`), retenções (inss/iss/irrf/outras), valor_bruto/liquido, assinatura (base64), signed_at, signed_by, signed_ip, recibo_pdf_url, locked_at.
- `sub_medicao_itens` — servico_id, qtd_anterior, qtd_periodo, saldo, preco_unit, valor. Constraint: `qtd_anterior + qtd_periodo <= qtd_contratada` (via trigger, não CHECK).
- `sub_pagamentos` — medicao_id, data, conta, forma enum, num_comprovante, comprovante_url, valor_pago. Trigger valida medição `assinada|liberada_pagamento` e `sum(valor_pago) <= valor_liquido`.
- Trigger recalcula `qtd_executada` em `sub_contrato_servicos` quando medição vira `assinada+`.
- Trigger bloqueia UPDATE em medição após `assinada`.

## Backend (`src/lib/subempreiteiros/*.functions.ts`)

- `empresas.functions.ts` — CRUD.
- `contratos.functions.ts` — CRUD + `importarServicosDoOrcamento(contrato_id, versao_id)` copia itens do `orcamento_itens` gerando `sub_contrato_servicos` (preço unit começa 0, editável).
- `medicoes.functions.ts` — criar, listar, atualizar itens (validando saldo), calcular retenções e líquido, transição de status, `assinar(assinaturaBase64)` grava assinatura + IP + timestamp e dispara geração de recibo.
- `recibos.ts` — gerador de PDF (jsPDF, tema `report-theme.ts`) com logo, dados obra/contrato/sub, itens, retenções, líquido, assinaturas, QR-Code placeholder. Upload em Storage `recibos-subempreitada`.
- `pagamentos.functions.ts` — CRUD com validações.
- `dashboard.functions.ts` — agregados por contrato/obra/medição + painel de **lucro** (join `orcamento_itens` × `sub_contrato_servicos` por código para calcular receita vs custo, margem).

## Frontend

Rotas `_app.subempreiteiros.*.tsx` reutilizando componentes existentes (`Card`, `Table`, `Dialog`, `Tabs`, `Badge`, toolbar padrão). 

- **Empresas** — lista + drawer de cadastro + upload docs.
- **Contratos** — lista filtrada por obra, dialog de criação, tela de detalhe com abas: Dados / Serviços (importar do orçamento, editar preço) / Medições / Pagamentos / Documentos.
- **Serviços Contratados** — visão global com filtros.
- **Medições** — lista + tela de detalhe com grid de itens (qtd período, saldo em tempo real), card de retenções, resumo financeiro, timeline de status, botão **Assinar Medição** (canvas `react-signature-canvas` novo dep). Após assinar, botões Visualizar / Baixar / Enviar recibo.
- **Recibos** — lista de recibos gerados com preview.
- **Pagamentos** — lista, dialog de novo pagamento (só habilita medições assinadas), upload de comprovante, suporte a parcial.
- **Dashboard** no topo de cada tela com KPIs (contratado/medido/aprovado/pago/saldo/%).

## Integração com Obra

Nova aba **Subempreiteiros** em `ObraApp.tsx` listando contratos com KPIs e link para o contrato.

## Regras (enforçadas backend)

- Nunca medir > contratado (trigger).
- Pagamento exige medição assinada+ (trigger).
- Edição bloqueada após assinatura (trigger).
- Auditoria via `audit_logs_v2` em cada mutação relevante.

## Detalhes técnicos

- Novos buckets Storage: `subempreiteiros-docs`, `subempreiteiros-recibos`, `subempreiteiros-comprovantes` (privados, RLS por company_id no path).
- Dep nova: `react-signature-canvas` (client-only, via `<ClientOnly>` — SSR-safe).
- Sem edge functions; tudo em `createServerFn` com `requireSupabaseAuth`.
- PDF do recibo em `src/lib/subempreiteiros/recibo.pdf.ts` usando jsPDF já presente.
- QR Code: estrutura de campo `recibo_token uuid` no `sub_medicoes` para validação futura (rota pública `/recibo/$token` fica preparada mas fora do escopo desta entrega).

## Entrega em etapas

Dado o tamanho, sugiro entregar em 2 mensagens:

1. **Migration + backend completo** (aprovar migration primeiro).
2. **Rotas/UI + integração ObraApp + PDF do recibo + assinatura**.

Confirma que posso seguir? Quer priorizar alguma parte (ex.: começar sem o painel de Lucro ou sem o recibo PDF na v1)?
