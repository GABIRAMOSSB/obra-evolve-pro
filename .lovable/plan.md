
# Fase 0 — Auditoria executiva (sem alterações)

## 1. Identidade do sistema atual
- Aplicação real em produção, multi-empresa, com `b88c560c-…` = **SOLV CONSTRUTORA E SOLUÇÕES LTDA** e outras 3 empresas.
- Branding interno: **"Obralytics"** (sidebar) — não é "SOLV GESTÃO". → ver questão Q1.
- Stack: TanStack Start v1 + React 19 + Tailwind v4 + shadcn + Supabase (Lovable Cloud) em Cloudflare Workers.
- Backend: **TanStack `createServerFn`** (não há Edge Functions). RLS ativo em todas as 38 tabelas públicas.

## 2. Mapa de rotas (todas em `_app/*`, layout autenticado)
Visão geral · Previsto×Realizado · Comparativo Composição · Notas Fiscais · Estoque · **Assinaturas + Relatório** · Mão de obra · Equipamentos · Insumos (+ importar) · Composições · Centros de Custo · **Central de Certidões** (Compliance) · Equipe · Parâmetros Financeiros · Backup · **Config ZapSign + Roteiro de Testes Sandbox**. Públicas: `/login`, `/reset-password`, `/invite/$token`, `api/public/zapsign-webhook`, `api/public/zapsign-reminders`.

## 3. Mapa de dados (38 tabelas, todas com `company_id` + RLS por `is_company_member`)
**Cadastros**: companies, company_members, company_invites, company_workspaces, user_workspaces.
**Obra (JSONB)**: `company_workspaces.workspace` — guarda **obras, BMs, cronogramas, RDOs, fotos, BDI, encargos, planilha orçamentária** como blob. ⚠️ Não há tabela relacional `obras`, `contratos`, `propostas`, `cronogramas`, `boletins_medicao`.
**Recursos**: insumos_mestre, insumo_categorias, insumo_aliases, unidades_medida, composicoes_proprias(+_insumos), equipamentos, funcionarios, equipes, equipe_membros, funcoes_mao_obra.
**Apropriação**: apontamentos_mao_obra, notas_fiscais, nota_fiscal_itens, nfe_item_apropriacoes, estoque_movimentos, centros_custo, parametros_financeiros, historico_importacoes_sinapi.
**Compliance/CNDs**: certificate_types, company_certificates, certificate_versions, certificate_checks, compliance_alerts, compliance_audit_logs, integration_settings (Infosimples), notification_rules.
**Assinatura ZapSign**: signature_requests, signature_signers, signature_fields, signature_events, signature_settings, signature_templates.
**Buckets**: `obra-documentos` (priv) · `company-certificates` (priv) · `obra-fotos` (pub) · `sinapi-imagens` (pub).

## 4. Integrações já existentes (NÃO recriar)
| Domínio | Existe? | Como |
|---|---|---|
| **Assinatura eletrônica (ZapSign)** | ✅ Sandbox completo | `zapsign-*.functions.ts`, webhook HMAC, templates, dashboard, relatório, roteiro de testes |
| **CNDs / Regularidade (Infosimples)** | ✅ Sandbox + produção opt-in | `compliance.functions.ts`, fluxo: API → fallback upload, versionamento, audit log |
| **Apropriação NFe (XML)** | ✅ | `nfe-parser.ts`, `NfeRateioDialog` |
| **Importação SINAPI** | ✅ | `import_sinapi_batch()` |
| **Boletim de Medição** | ✅ Maduro | `ObraApp.tsx` + `MeasurementClosure.tsx` + `pdf.ts` + `excel.ts` — **PRESERVAR INTEGRALMENTE** |
| Lovable AI Gateway | ✅ Disponível (LOVABLE_API_KEY) | Não usado ainda |
| PNCP / Editais / IA edital | ❌ | A construir |
| Signatários · Procurações · Matriz de poderes | ❌ (ZapSign tem signers efêmeros por documento) | A construir |
| Biblioteca técnica · Atestados · CATs · ARTs | ❌ | A construir |
| Propostas · Carta proposta · Readequação | ❌ | A construir |
| Cronograma físico-financeiro · Curva S relacional | ❌ (existe no JSONB) | A normalizar |
| Contratos · Eventos · Reajustes · Apostilamentos | ❌ | A construir |
| Índices IBGE/BCB/FGV · Snapshots | ❌ | A construir |
| Dossiês · Templates · Perfis de portal · Simulador | ❌ | A construir |

## 5. Riscos críticos identificados
1. **Obras em JSONB** — incompatível com reajustes (precisão DECIMAL, auditoria por linha, base elegível por período, RLS por contrato). Cronograma/BM/Curva S relacionais exigem normalização incremental SEM mexer no blob legado (espelhamento read-side). → Q2.
2. **`obra_id` é `text` UUID em todas as tabelas** (não FK). Funciona, mas impede `ON DELETE CASCADE` e validação referencial — risco de órfãos ao introduzir tabela `obras`.
3. **Branding inconsistente** ("Obralytics" no header, "SOLV CONSTRUTORA" como company). → Q1.
4. **Cálculos financeiros do BM atual em `Number` JS** (`calc.ts`) — funciona para BM mas não atende à regra absoluta do briefing (NUMERIC backend) para reajustes/propostas. Decisão: novos módulos calculam no backend com NUMERIC; BM atual fica preservado como está.
5. **FGV (INCC/IGP-M)** não tem API pública gratuita. → Q3.
6. **PNCP** publica licitações, não recebe propostas. Escopo "Radar" = leitura/triagem; envio final continua manual nos portais (Comprasnet, BNC, Licitar Digital etc.). → Q4.
7. **`integration_settings` é tabela global** (única linha por provider). Hoje OK para Infosimples; ao adicionar IBGE/BCB/FGV/ZapSign-prod precisa ser estendida ou criar `provider_credentials` por empresa.
8. **Tabela `notification_rules`** existe mas sem UI — pode ser reaproveitada para alertas de reajuste/CND/edital.

## 6. Componentes e estruturas reutilizáveis
- `PdfFieldPlacer` (posicionamento visual em PDF) → reaproveitar em **declarações** e **carta proposta**.
- `SendForSignatureDialog` + `BatchSendForSignatureDialog` → fluxo de assinatura pronto.
- `SignatureTemplateManager` → base para "modelos de declaração".
- `DocumentsTab` + bucket `obra-documentos` → base para biblioteca técnica e dossiês (criar subpastas com prefixo).
- `compliance.functions.ts` (estrutura: API → fallback → versão → audit) → padrão de ouro para índices IBGE/BCB.
- Tabelas `certificate_*` → padrão para `atestados_*`, `arts_*`, `procuracoes_*` (mesmo modelo: type/version/check).
- `MeasurementClosure` → padrão para "ofício de reajuste".

## 7. Arquitetura proposta (acréscimo, não substituição)

```text
Camada nova (incremental)               Camada existente (preservada)
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ obras (normalizada)          │←──────►│ company_workspaces.workspace │
│ contratos                    │   sync │ (JSONB legado, read-only)    │
│ propostas (orig/readequada)  │        │ ObraApp + MeasurementClosure │
│ cronograma_itens, curva_s    │        │ apontamentos / NFe / CNDs    │
│ oportunidades (PNCP)         │        │ ZapSign / Infosimples        │
│ editais + versoes + hash     │        └──────────────────────────────┘
│ analises_ia + evidencias     │
│ signatarios / procuracoes    │        Tudo novo respeita:
│ matriz_poderes               │         • RLS por company_id
│ atestados / cats / arts      │         • Auditoria (audit_logs por módulo)
│ declaracoes_modelos          │         • Versionamento + hash sha256
│ dossie_templates / dossies   │         • Cálculos no backend (NUMERIC)
│ perfis_portal / simulacoes   │         • Bucket privado + signed URL
│ protocolos                   │         • Lovable AI Gateway (sem API key user)
│ indices_catalogo + snapshots │
│ reajustes_ciclos + memorias  │
│ oficios / apostilamentos     │
└──────────────────────────────┘
```

## 8. Tabelas estritamente necessárias por fase (resumo)
- **F1 Fundação**: `obras`, `contratos`, `contrato_eventos`, `audit_logs_v2` (genérico jsonb antes/depois).
- **F2 já existe** (CNDs). Apenas pequenas extensões.
- **F3 PNCP**: `oportunidades`, `oportunidade_filtros`, `oportunidade_pipeline_eventos`.
- **F4 Editais**: `editais`, `edital_versoes`, `edital_anexos`, `edital_analises_ia`, `edital_evidencias`, `ia_custos`.
- **F5 Assinatura**: `signatarios`, `procuracoes`, `matriz_poderes`, `declaracoes_modelos`, `declaracoes_geradas`.
- **F6 Biblioteca**: `atestados`, `cats`, `arts`, `responsaveis_tecnicos`.
- **F7 Proposta**: `propostas`, `proposta_itens`, `proposta_readequacao_residuos`, `cartas_proposta`.
- **F8 Cronograma**: `cronograma_etapas`, `cronograma_periodos`, `cronograma_baseline`.
- **F9 Dossiês**: `dossie_templates`, `dossie_template_itens`, `dossies`, `dossie_itens`.
- **F10 Portais**: `portais`, `portal_perfis`, `simulacoes_upload`, `protocolos`.
- **F11 Índices**: `indices_catalogo`, `indices_series`, `indices_snapshots`, `provider_credentials` (por empresa).
- **F12 Reajustes**: `reajustes_ciclos`, `reajuste_bases_elegiveis`, `reajuste_memorias`, `oficios`, `apostilamentos`.

## 9. Sequência segura (alinhada às 13 fases do briefing)
F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F11 → F12 → F13.
Cada fase termina com: lista de arquivos · migrations · functions · policies · testes · riscos · pendências · **estimativa de créditos** · aprovação antes da próxima.

## 10. Estimativa de créditos por fase (ordem de grandeza)
F1 fundação 6–10 · F2 ajustes CND 2–4 · F3 PNCP 10–15 · F4 IA editais 18–28 (depende de tokens IA) · F5 assinaturas/poderes 10–14 · F6 biblioteca técnica 12–18 · F7 propostas 14–20 · F8 cronograma 10–14 · F9 dossiês 14–20 · F10 portais/simulador 8–12 · F11 índices 10–14 · F12 reajustes 18–26 · F13 QA 6–10. **Total bruto: 138–205 créditos**, fortemente dependente do uso real de IA na F4 e F6.

## 11. Dúvidas estritamente necessárias (bloqueiam F1)
Antes de iniciar a Fase 1, preciso decidir 4 pontos que não consigo extrair do código/banco:

- **Q1 — Branding**: substituir "Obralytics" por **"SOLV Gestão"** em todo o UI, ou manter "Obralytics" como produto e SOLV como cliente?
- **Q2 — Modelo de obras**: criar tabela relacional `obras`/`contratos` e **espelhar** o JSONB legado (zero perda, BM atual segue lendo o blob), ou **migrar** o blob para as novas tabelas (mais limpo, exige rollback plan)?
- **Q3 — FGV (INCC/IGP-M)**: existe credencial paga FGV/IPEA? Se não, índices FGV ficam só como **upload manual validado em duas etapas** (regra do briefing já prevê fallback).
- **Q4 — PNCP**: confirma que o Radar é **somente leitura/triagem** (download de editais e gestão do pipeline interno) e o envio da proposta segue manual nos portais específicos?

Após as respostas, abro a Fase 1 (Fundação Segura) com migrations incrementais, sem tocar nada do BM atual.
