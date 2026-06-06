# Status atual + Plano de correção do menu lateral

## 1. O que já foi implementado do prompt SOLV Gestão

Mapeando as fases do prompt contra o código atual (`src/routes/`, `src/lib/*.functions.ts`, migrations Supabase):

### ✅ Fase 0 — Auditoria
Mapeamento inicial feito em sessões anteriores (plan.md).

### ✅ Fase 1 — Fundação
`companies`, `company_members`, `user_workspaces`, RLS, auditoria (`audit_logs_v2`), buckets privados.

### ✅ Fase 2 — Documentos e CNDs (parcial)
- `compliance.functions.ts`, `compliance-scope.functions.ts`, `company_certificates`, `certificate_types`, `certificate_versions`, `certificate_checks`, `compliance_alerts` + rota `/compliance`.
- Falta: consulta automática via API pública oficial (hoje upload + validação manual/scoped).

### ✅ Fase 3 — Radar PNCP (parcial)
- `oportunidades.functions.ts`, `oportunidades`, `oportunidade_filtros`, `oportunidade_pipeline_eventos` + rota `/oportunidades`.
- Falta: coleta automática agendada da API PNCP, score com termos negativos, detecção de retificações.

### ✅ Fase 4 — IA para Editais
- `editais.functions.ts` com extração JSON, OCR fallback, checklist, RAG (pgvector + `edital_chunks`, `match_edital_chunks`), Q&A com citação de página.
- Falta: auto-indexação pós-extração, monitoramento contínuo de retificações com diff de hash.

### ⚠️ Fase 5 — Declarações e Assinaturas (parcial)
- ZapSign integrado (`zapsign*.functions.ts`, templates, webhook, dashboard, lembretes, relatório) + rota `/assinaturas`.
- Falta: módulo formal de **Declarações Licitatórias**, **Signatários**, **Matriz de Poderes** e **Procurações** (hoje signatários vivem só dentro do ZapSign, sem matriz de poderes).

### ✅ Fase 6 — Biblioteca Técnica
- Tabela `biblioteca_documentos`, bucket `biblioteca-tecnica`, rota `/biblioteca` com abas RT, Atestados, CATs, ARTs.
- Falta: OCR/IA para extrair dados dos PDFs (F6.1) e módulo de **Sugestão de Atestados** comparando com edital.

### ✅ Fase 7 — Proposta Comercial
- `propostas`, `proposta_itens`, `proposta_readequacao_residuos`, `cartas_proposta`, `recalc_proposta_totals`.
- `propostas.functions.ts` + `propostas-itens.functions.ts` + rotas `/propostas` e `/propostas/$id` (abas Itens, Readequação, Carta, Config).
- Falta: arredondamento controlado com distribuição de resíduo, exportação XLSX/PDF, simulador de upload por portal.

### ❌ Fase 8 — Cronograma físico-financeiro
Não iniciada. Sem tabelas `cronograma*`, sem Curva S, sem previsto×realizado dedicado ao cronograma (existe `/realizado` mas para outro contexto).

### ❌ Fase 9 — Templates e Dossiês
Não iniciada.

### ❌ Fase 10 — Perfis de Portal / Simulador / Protocolos
Não iniciada.

### ⚠️ Fase 11 — Índices Econômicos (parcial)
- Tabela `indices_economicos` + `indices.functions.ts` + **rota `/indices` existe mas NÃO está no menu**.
- Falta: conectores IBGE SIDRA / BCB SGS / FGV, job automático mensal, snapshot+hash.

### ⚠️ Fase 12 — Reajustes (parcial)
- Tabela `reajustes_contratuais` + `reajustes.functions.ts` + **rota `/reajustes` existe mas NÃO está no menu**.
- Falta: extração de cláusula via IA, base elegível considerando BMs, ofício editável, apostilamento, integração com BM futuro.

### ⚠️ Outros módulos já existentes mas **OCULTOS NO MENU**
- `/aditivos` (Aditivos Contratuais — `aditivos.functions.ts`, tabela `aditivos_contratuais`)
- `/medicoes` (BMs — `medicoes.functions.ts`)
- `/rdo` (RDO — `rdo.functions.ts`, `rdo_*`)
- `/indices` (Índices Econômicos)
- `/reajustes` (Reajustes Contratuais)
- `/assinaturas/relatorio` (sub-rota de assinaturas)
- `/configuracoes/zapsign/testes` (sub-rota de config)

## 2. Problema do menu

O `AppSidebar.tsx` lista 24 itens, mas o projeto tem **32 rotas `_app.*`**. Itens críticos do escopo SOLV (Medições, RDO, Aditivos, Índices, Reajustes) não aparecem, então o usuário acha que não foram implementados.

Também faltam separadores coerentes com a nomenclatura do prompt ("Licitações", "Execução de Obra", "Contratos", "Indexadores").

## 3. Plano de correção do menu (apenas frontend — `src/components/AppSidebar.tsx`)

Reorganizar em grupos alinhados ao prompt, incluindo TODAS as rotas implementadas:

```text
LICITAÇÕES
  Visão geral            /
  Radar PNCP             /oportunidades
  Editais (IA)           /editais
  Propostas (IA)         /propostas
  Biblioteca Técnica     /biblioteca

EXECUÇÃO DE OBRA
  Obras                  /obras
  Medições (BM)          /medicoes        ← novo no menu
  RDO                    /rdo             ← novo no menu
  Previsto × Realizado   /realizado
  Comparativo Composição /comparativo-composicao

CONTRATOS
  Contratos              /contratos
  Aditivos               /aditivos        ← novo no menu
  Reajustes              /reajustes       ← novo no menu
  Índices Econômicos     /indices         ← novo no menu
  Assinaturas            /assinaturas

FINANCEIRO
  Financeiro de Obra     /financeiro
  Notas Fiscais          /notas-fiscais
  Estoque                /estoque

RECURSOS
  Mão de obra            /mao-de-obra
  Equipamentos           /equipamentos
  Insumos                /insumos
  Composições            /composicoes
  Centros de Custo       /centros-custo

GOVERNANÇA
  Central de Certidões   /compliance

ADMINISTRAÇÃO
  Equipe                 /equipe
  Parâmetros Financeiros /parametros-financeiros
  Backup                 /backup
  Config. ZapSign        /configuracoes/zapsign
```

Mudanças puramente visuais/estruturais — sem tocar em rotas, lógica ou banco. Adiciona scroll já existente, ícones novos para BM/RDO/Aditivos/Reajustes/Índices via `lucide-react` (`ClipboardList`, `NotebookPen`, `FilePlus2`, `TrendingUp`, `LineChart`).

## 4. Próximo passo de implementação (após menu)

Sequência sugerida do prompt original, em ordem:

1. **F8 — Cronograma físico-financeiro + Curva S** (puxa itens da proposta readequada já existente).
2. **F4.4 — Auto-indexação RAG** (gatilho após extração de PDF).
3. **F12.x — Completar Reajustes** (cláusula via IA, base elegível, ofício).
4. **F5.x — Declarações / Signatários / Matriz de Poderes / Procurações**.
5. **F9 — Templates e Dossiês**.

Qual confirma para eu seguir? Posso implementar primeiro a **correção do menu** (mudança pequena e segura) e em seguida a **F8 — Cronograma**.
