# ESTRUTURA DE PASTAS - SOLV GESTÃO (Fases 1-13)

**Referência**: Esta é a estrutura que será criada nas fases subsequentes  
**Status**: Documentação apenas (não criar ainda)

---

## 📁 FASE 1 - Fundação

```
Gest-o-Solv/
├── .github/
│   └── workflows/
│       ├── lint.yml
│       ├── test.yml
│       └── deploy.yml
├── supabase/
│   ├── migrations/
│   │   ├── 001_create_base_tables.sql
│   │   ├── 002_documents_versioning.sql
│   │   ├── 003_oportunidades_pncp.sql
│   │   ├── 004_regularidade.sql
│   │   ├── 005_propostas.sql
│   │   ├── 006_cronogramas.sql
│   │   ├── 007_boletins_medicao.sql
│   │   ├── 008_reajustes.sql
│   │   └── 009_signatarios.sql
│   ├── functions/
│   │   ├── webhook-zapsign.ts
│   │   ├── job-radar-pncp.ts
│   │   ├── job-indices.ts
│   │   ├── validar-edital.ts
│   │   ├── query-cnd.ts
│   │   ├── gerar-proposta.ts
│   │   ├── calcular-reajuste.ts
│   │   ├── gerar-oficio.ts
│   │   └── audit-logger.ts
│   ├── policies/
│   │   ├── rls_usuarios.sql
│   │   ├── rls_obras.sql
│   │   ├── rls_contratos.sql
│   │   ├── rls_documentos.sql
│   │   ├── rls_propostas.sql
│   │   └── rls_auditoria.sql
│   ├── seed/
│   │   ├── seed_empresas.sql
│   │   └── seed_usuarios.sql
│   └── config.toml
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── styles/
│   │   │   └── types/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js
│   │   └── tailwind.config.js
│   └── api/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── FASE_0_AUDITORIA.md
├── ARQUITETURA_MAPA.md
├── QUESTOES_CRITICAS.md
├── INDICE.md
├── README.md
├── package.json
├── .env.example
├── .gitignore
└── .editorconfig
```

---

## 📁 FASE 2-3 - Documentos + PNCP

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── documentos/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   └── upload.tsx
│   └── oportunidades/
│       ├── index.tsx
│       ├── [id].tsx
│       └── analise.tsx
├── apps/web/src/components/
│   ├── documents/
│   │   ├── VersionHistory.tsx
│   │   ├── DocumentViewer.tsx
│   │   └── UploadForm.tsx
│   └── opportunities/
│       ├── OportunityList.tsx
│       ├── OportunityCard.tsx
│       └── TriagemForm.tsx
└── supabase/migrations/
    └── 010_cnds_cache.sql
```

---

## 📁 FASE 4 - IA Editais

**Adicionar**:
```
├── apps/web/src/pages/
│   └── editais/
│       ├── index.tsx
│       ├── [id].tsx
│       ├── analise.tsx
│       └── ocr.tsx
├── apps/web/src/components/
│   └── editais/
│       ├── EdittalAnalyzer.tsx
│       ├── OCRViewer.tsx
│       ├── ConfidenceIndicator.tsx
│       └── RiskMatrix.tsx
├── services/
│   ├── ai/
│   │   ├── editalAnalyzer.ts
│   │   ├── ocr.ts
│   │   └── prompts/
│   │       ├── edital-base.md
│   │       ├── edital-compliance.md
│   │       └── edital-proposal.md
│   └── external/
│       └── pncp.ts
└── __tests__/
    ├── unit/
    │   ├── editalAnalyzer.test.ts
    │   └── ocr.test.ts
    └── integration/
        └── edital-flow.test.ts
```

---

## 📁 FASE 5 - Assinatura

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── signatarios/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── procuracoes/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   └── assinaturas/
│       ├── index.tsx
│       └── [id].tsx
├── apps/web/src/components/
│   └── signatures/
│       ├── SignatureRequest.tsx
│       ├── SignatorySelector.tsx
│       ├── PowerMatrix.tsx
│       └── WebhookStatus.tsx
├── services/
│   └── signatures/
│       ├── zapsign.ts
│       ├── powerValidator.ts
│       └── webhookHandler.ts
└── supabase/migrations/
    ├── 011_signatarios.sql
    ├── 012_poderes.sql
    ├── 013_procuracoes.sql
    └── 014_assinaturas.sql
```

---

## 📁 FASE 6 - Biblioteca Técnica

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── biblioteca/
│   │   ├── index.tsx
│   │   ├── atestados/
│   │   ├── cats/
│   │   ├── arts/
│   │   └── upload.tsx
│   └── sugestoes/
│       ├── index.tsx
│       └── [id].tsx
├── apps/web/src/components/
│   └── library/
│       ├── DocumentUpload.tsx
│       ├── AIExtraction.tsx
│       ├── SuggestionMatrix.tsx
│       └── EngineeringValidation.tsx
├── services/
│   └── library/
│       ├── extractor.ts
│       ├── matcher.ts
│       └── validator.ts
└── supabase/migrations/
    └── 015_biblioteca_tecnica.sql
```

---

## 📁 FASE 7 - Proposta Comercial

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── propostas/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   ├── original.tsx
│   │   ├── readequada.tsx
│   │   └── comparativo.tsx
│   └── carta-proposta/
│       ├── index.tsx
│       └── [id].tsx
├── apps/web/src/components/
│   └── proposals/
│       ├── ProposalForm.tsx
│       ├── DiscountCalculator.tsx
│       ├── RoundingMatrix.tsx
│       ├── CartaPropostaPreview.tsx
│       └── MemoriaCalculo.tsx
├── services/
│   └── financial/
│       ├── discountCalculator.ts
│       ├── roundingStrategy.ts
│       ├── bdiCalculator.ts
│       └── cartaGenerator.ts
├── lib/
│   └── decimal.ts (Utilidades Decimal.js)
└── supabase/migrations/
    ├── 016_propostas.sql
    ├── 017_propostas_readequadas.sql
    └── 018_propostas_itens.sql
```

---

## 📁 FASE 8 - Cronograma

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── cronogramas/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   ├── editor.tsx
│   │   └── curva-s.tsx
│   └── previsto-realizado/
│       ├── index.tsx
│       └── [id].tsx
├── apps/web/src/components/
│   └── schedules/
│       ├── CronogramaEditor.tsx
│       ├── CurvaSChart.tsx
│       ├── ForecastVsActual.tsx
│       └── MonthlyBreakdown.tsx
├── services/
│   └── scheduling/
│       ├── cronogramaCalculator.ts
│       ├── curvaS.ts
│       └── import.ts
└── supabase/migrations/
    ├── 019_cronogramas.sql
    └── 020_cronograma_periodos.sql
```

---

## 📁 FASE 9 - Dossiês

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── dossiês/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   ├── editor.tsx
│   │   └── preview.tsx
│   └── modelos/
│       ├── index.tsx
│       └── [id].tsx
├── apps/web/src/components/
│   └── dossiers/
│       ├── DossierEditor.tsx
│       ├── TemplateManager.tsx
│       ├── PDFGenerator.tsx
│       └── ExcelExporter.tsx
├── services/
│   └── dossiers/
│       ├── dossierBuilder.ts
│       ├── pdfGenerator.ts
│       ├── excelExporter.ts
│       ├── zipBuilder.ts
│       └── manifestBuilder.ts
└── supabase/migrations/
    ├── 021_modelos_dossiê.sql
    └── 022_dossiês.sql
```

---

## 📁 FASE 10 - Portais

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── perfis-portal/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   └── simulador/
│       ├── index.tsx
│       └── [id].tsx
├── apps/web/src/components/
│   └── portals/
│       ├── PortalProfileForm.tsx
│       ├── UploadSimulator.tsx
│       └── ValidationRules.tsx
├── services/
│   └── portals/
│       ├── validator.ts
│       └── simulator.ts
└── supabase/migrations/
    └── 023_perfis_portal.sql
```

---

## 📁 FASE 11 - Índices Econômicos

**Adicionar**:
```
├── apps/web/src/pages/
│   └── indices/
│       ├── index.tsx
│       ├── [id].tsx
│       └── consulta.tsx
├── apps/web/src/components/
│   └── indices/
│       ├── IndicesCatalog.tsx
│       ├── APIStatus.tsx
│       └── HistoryChart.tsx
├── services/
│   └── economic/
│       ├── ibge.ts
│       ├── bcb.ts
│       ├── fgv.ts
│       ├── cache.ts
│       └── snapshot.ts
├── jobs/
│   └── sync-indices.ts
└── supabase/migrations/
    └── 024_indices_economicos.sql
```

---

## 📁 FASE 12 - Reajustes

**Adicionar**:
```
├── apps/web/src/pages/
│   ├── reajustes/
│   │   ├── index.tsx
│   │   ├── [id].tsx
│   │   ├── novo.tsx
│   │   └── oficio.tsx
│   ├── clausulas/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   └── elegibilidade/
│       ├── index.tsx
│       └── [id].tsx
├── apps/web/src/components/
│   └── adjustments/
│       ├── ReajusteCalculator.tsx
│       ├── EligibilityMatrix.tsx
│       ├── OficioPreview.tsx
│       ├── ApostilmentTracker.tsx
│       └── Alerting.tsx
├── services/
│   └── reajustes/
│       ├── clausulaExtractor.ts
│       ├── eligibilityCalculator.ts
│       ├── reajusteCalculator.ts
│       ├── memoriaBuilder.ts
│       ├── oficioGenerator.ts
│       └── cicloManager.ts
├── jobs/
│   └── monitor-reajustes.ts
└── supabase/migrations/
    ├── 025_clausulas_reajuste.sql
    ├── 026_reajustes.sql
    ├── 027_reajuste_base_elegivel.sql
    └── 028_eventos_contratuais.sql
```

---

## 📁 FASE 13 - Qualidade

**Adicionar**:
```
├── __tests__/
│   ├── unit/
│   │   ├── financial/
│   │   ├── reajuste/
│   │   ├── scheduling/
│   │   └── dossiers/
│   ├── integration/
│   │   ├── proposal-flow.test.ts
│   │   ├── reajuste-flow.test.ts
│   │   ├── signature-flow.test.ts
│   │   └── dossier-flow.test.ts
│   └── e2e/
│       ├── oportunidade-to-contrato.test.ts
│       ├── reajuste-completo.test.ts
│       └── segurança-rls.test.ts
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   ├── USER_GUIDE.md
│   ├── DEVELOPER_GUIDE.md
│   └── SECURITY.md
├── scripts/
│   ├── setup-supabase.sh
│   ├── seed-data.sh
│   ├── run-tests.sh
│   └── deploy.sh
├── .env.production
├── .env.staging
├── docker-compose.yml
└── Dockerfile
```

---

## 🎯 Estrutura Final (Pós Fase 13)

```
Gest-o-Solv/
├── .github/
├── apps/
│   ├── web/          (Frontend React/Next)
│   └── api/          (Backend Node)
├── supabase/         (Database + Functions + Policies)
├── services/         (Serviços compartilhados)
├── lib/              (Utilidades)
├── jobs/             (Cron jobs)
├── __tests__/        (Testes)
├── docs/             (Documentação)
├── scripts/          (Deploy + Setup)
├── docker/           (Containerização)
├── FASE_0_AUDITORIA.md
├── ARQUITETURA_MAPA.md
├── QUESTOES_CRITICAS.md
├── INDICE.md
├── README.md
├── package.json      (Monorepo)
└── .env.example
```

**Total de arquivos**: ~500+  
**Total de linhas de código**: ~50.000+  
**Tempo de desenvolvimento**: 175 horas (13 fases)

---

## 📝 Convenções de Nomenclatura

### Pastas
- PascalCase para componentes (Pages, Components)
- kebab-case para funcionalidades (edital-analyzer, reajuste-calculator)
- snake_case para migrations e SQL (001_create_base_tables.sql)

### Arquivos
- `.tsx` para componentes React
- `.ts` para lógica pura
- `.sql` para migrações
- `.test.ts` para testes

### Bancos de Dados
- snake_case para tabelas (usuarios, boletins_medicao)
- snake_case para colunas (data_criacao, valor_total)
- Soft-delete: `deletado_em` (deleted_at)
- Auditoria: `criado_por`, `criado_em`, `atualizado_por`, `atualizado_em`

---

## 🚀 Como Usar Esta Estrutura

1. ✅ **FASE 1**: Criar estrutura base + migrations
2. ✅ **FASE 2-3**: Adicionar documentos + PNCP
3. ✅ **FASE 4**: Adicionar IA + OCR
4. ✅ **FASE 5**: Adicionar assinatura
5. ✅ **FASE 6**: Adicionar biblioteca
6. ✅ **FASE 7**: Adicionar proposta
7. ✅ **FASE 8**: Adicionar cronogramas
8. ✅ **FASE 9**: Adicionar dossiês
9. ✅ **FASE 10**: Adicionar portais
10. ✅ **FASE 11**: Adicionar índices
11. ✅ **FASE 12**: Adicionar reajustes
12. ✅ **FASE 13**: Testes + Deploy

---

**Referência**: Esta estrutura será criada incrementalmente ao longo das 13 fases.  
**Status**: Documentação apenas - não criar pastas ainda.

Aguardando aprovação FASE 0 para iniciar FASE 1.
