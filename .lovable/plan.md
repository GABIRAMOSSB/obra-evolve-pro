# Reformulação do Boletim de Medição

Escopo grande — proponho executar em 4 fases sequenciais dentro deste mesmo fluxo, cada uma verificável isoladamente. Preservo banco, autenticação, integrações e dados existentes.

## Fase 1 — Fundação de dados e cálculos (backend)

**Migração de banco (aditiva, sem quebrar dados atuais):**
- `medicoes`: adicionar `numero_bm` (text), `data_medicao` (date), `snapshot_itens` (jsonb) para congelar acumulados por item após aprovação, `status_workflow` (rascunho/em_conferencia/aprovada/cancelada).
- `medicao_itens` (nova): `medicao_id`, `obra_atividade_id`, `item_codigo`, `descricao`, `unidade`, `qtd_contratada`, `valor_unitario`, `qtd_periodo`, `qtd_acum_anterior`, `valor_acum_anterior`, `valor_periodo`, `valor_acum_atual`, `pct_executado`, `status_calc`. Unique (medicao_id, item_codigo).
- Grants + RLS por company_id, seguindo padrão do projeto.

**Cálculos (util novo `src/lib/boletim-medicao.calc.ts`):**
- Trabalhar em centavos inteiros; arredondar ROUND(qtd × unit, 2) por item **antes** de somar.
- `computeItem`, `computeTotais`, `computeStatus`, validações (saldo, período, número BM único por obra).
- Testes unitários (vitest) cobrindo os casos de aceite: total = R$ 236.951,00 na planilha referência; BM-01 zerado; BM-02 puxando snapshot; extrapolação bloqueada.

**Server functions (`src/lib/medicoes.functions.ts` estendido):**
- `getMedicaoDetalhe(id)`: retorna itens da obra (do orçamento + atividades) + snapshot anterior consolidado + dados contratuais completos (obra, contrato, responsável técnico, fiscal).
- `salvarRascunhoMedicao({ id, itens })`: upsert em `medicao_itens`, sem aprovar.
- `aprovarMedicao(id)`: valida tudo, congela `snapshot_itens`, muda status.
- `gerarMedicao` refatorado: cria BM vazio herdando acumulado da última aprovada (não mais consolidando NFe/MO — passa a ser preenchimento manual guiado, como no modelo Excel de referência).

## Fase 2 — Tela institucional (`src/routes/_app.medicoes.$id.tsx`)

Nova rota de detalhe do BM (lista atual em `_app.medicoes.tsx` vira índice + botão "Abrir"). Layout:

- **Tokens SOLV** em `src/styles.css`: `--solv-graphite`, `--solv-gold`, `--solv-silver`, etc.
- **Barra superior** grafite com logo, obra, nº BM, status; botões Salvar/Validar/PDF/Excel/Imprimir (principal dourado).
- **Card contratual** em grid sem bordas: órgão, contratante, executora, CNPJ, contrato, licitação, endereço, RT, CREA, ART, fiscal, datas. "Informação pendente" quando faltar.
- **5 KPIs** (Valor Total / Medição / Acumulado / % / Saldo) + barra de progresso dourada.
- **Tabela de serviços** sem grid: cabeçalho fixo, colunas Item/Descrição fixas, grupos Planejamento/Físico/Financeiro/Controle por fundo e tipografia. Zebra suave. Coluna editável (qtd período) com fundo dourado claro só no foco. Etapas colapsáveis. Busca, filtro por etapa/status, "só pendências", "só medidos".
- **Rodapé de conferência**: totais, alertas, "última atualização por Fulano".
- Responsivo: cards expansíveis no mobile.
- `Executado %` (renomear a coluna "Desvio").

## Fase 3 — PDF institucional (`src/lib/boletim-pdf.ts` novo)

- jsPDF + autoTable, A4 paisagem, margens 10-12mm.
- Header repetido: logo SOLV, obra, BM, período.
- Tabela sem grid vertical, separadores horizontais 0.2pt cor `#EEF0F2`, zebra `#FAFBFC`, cabeçalho grafite/branco.
- `rowPageBreak: 'avoid'` para não quebrar serviços; total nunca sozinho.
- Rodapé "SOLV Construtora… | Página X de Y" + declaração final + bloco de assinaturas (RT e Fiscal do cadastro, sem hardcode).
- Descrições íntegras, unidades normalizadas na exibição, sanitização `x000d`.

## Fase 4 — Excel institucional (refatorar `src/lib/pdf.ts` → `src/lib/boletim-xlsx.ts`)

- Migrar para **ExcelJS** (mais controle sobre showGridLines, proteção, validação, print setup). Instalar `exceljs`.
- `worksheet.views = [{ state:'frozen', ySplit: N, showGridLines:false }]`
- `worksheet.pageSetup.showGridLines = false`, A4 paisagem, fit-to-width 1.
- Fórmulas por linha (ROUND, acumulados, %). Proteção: só qtd período desbloqueada. Validação numérica. Formato pt-BR moeda/data/%. Formatação condicional no status. Cabeçalhos repetidos na impressão.
- Paleta SOLV nos títulos/totais; sem grade quadriculada.

## Detalhes técnicos

- Dinheiro sempre em centavos inteiros no cálculo; conversão só na apresentação (`Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`).
- Sanitização de descrição: remover `x000d`, `\r\n\r\n`, espaços duplos; preservar acentos e códigos SINAPI/ORSE.
- Normalização de unidade só na exibição (`un`→`UN`, `m²/m2`→`M²`, `m³/m3`→`M³`).
- Snapshot congelado: aprovar BM-N grava `snapshot_itens` com acumulados; BM-(N+1) lê daí (não recalcula retroativo).
- Concorrência: `updated_at` como versão otimista no salvar rascunho.
- Testes vitest para calc + snapshot chain.

## Fora de escopo (para não inflar)

- Colar de planilha (multi-célula): fica para follow-up.
- Auditoria histórica granular por campo: usar `audit_logs_v2` existente sem novo schema.
- Assinatura digital embutida no PDF: exibir bloco de assinatura textual; integração ZapSign continua no fluxo atual.

---

**Confirma iniciar pela Fase 1 (migração + cálculos + testes)?** Ou prefere que eu ataque tudo em sequência sem parar entre fases (leva várias execuções, mas entrego cada fase verificável)?
