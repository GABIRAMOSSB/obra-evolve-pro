# SOLV GESTÃO — MAPA DE ARQUITETURA

## 1. STACK TECNOLÓGICO

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React/Next.js)                      │
│  40 Telas + Design System Figma (Bronze/Grafite) + Responsivo   │
│                                                                   │
│  Dashboard │ Radar PNCP │ Editais │ Propostas │ Cronogramas  │
│  BM        │ Contratos  │ Reajustes │ Assinaturas │ Índices │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            BACKEND (Supabase Edge Functions + Node.js)           │
│  API Routes │ Webhooks │ Jobs Automáticos │ Validações RLS     │
│                                                                   │
│  GET /pncp  │ POST /assinatura │ Job /indices │ Audit Logs    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│         DATABASE (PostgreSQL via Supabase)                       │
│  28 Tabelas │ Versioning │ Soft Deletes │ Auditoria Imutável   │
│                                                                   │
│  RLS Policies by empresa_id │ Indexes Otimizados │ Constraints  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│       STORAGE (Supabase Buckets - Versionado por Hash)          │
│  /editais │ /propostas │ /contratos │ /docs │ /bm │ /assinados│
│  Privados │ URLs Temporárias (5min) │ Manifesto em cada pasta  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           INTEGRAÇÕES EXTERNAS (APIs Públicas)                  │
│  PNCP │ IBGE SIDRA │ BCB SGS │ FGV IBRE │ CNDs │ ZapSign      │
│  Via Backend Only │ Secrets seguros │ Rate Limiting │ Fallbacks│
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. FLUXO DE DADOS - EXEMPLO: OPORTUNIDADE LICITAÇÃO

```
┌─ Dia 1: Novo Edital ─────────────────────────────────────────┐
│                                                                │
│  1. Job PNCP consulta API pública                             │
│     ↓                                                          │
│  2. Nova oportunidade encontrada → tabela oportunidades_pncp  │
│     ↓                                                          │
│  3. Triagem automática (filtros + rejeição anterior)          │
│     ↓                                                          │
│  4. Alerta para usuário: "Nova oportunidade em análise"       │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Dia 2-3: Download e Versionamento ──────────────────────────┐
│                                                                │
│  1. Usuário clica "Analisar"                                  │
│     ↓                                                          │
│  2. Backend baixa: edital.pdf + anexos + TR + planilhas       │
│     ↓                                                          │
│  3. Calcula HASH de cada arquivo                              │
│     ↓                                                          │
│  4. Armazena em storage com versionamento:                    │
│     /editais/{oportunidade_id}/v1/{hash}.pdf                 │
│     ↓                                                          │
│  5. Registra no banco: edital + hash + timestamp              │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Dia 4-7: Análise com IA ────────────────────────────────────┐
│                                                                │
│  1. Backend chama função IA (no LLM)                          │
│     Entrada: PDF binário + prompt estruturado                │
│     ↓                                                          │
│  2. IA extrai JSON:                                           │
│     {                                                          │
│       "orgao": "prefeitura de...",                           │
│       "processo": "xxxxx/2024",                              │
│       "objeto": "construção de...",                          │
│       "exigencias": [{...}],                                 │
│       "confianca_score": 0.89,                               │
│       "riscos": ["baixa visita técnica"]                     │
│     }                                                          │
│     ↓                                                          │
│  3. Backend valida JSON (estrutura + tipos)                  │
│     ↓                                                          │
│  4. Se confiança < 95%: Marca para revisão humana            │
│     Se confiança ≥ 95%: Preenche automaticamente             │
│     ↓                                                          │
│  5. Registra no banco: edital_analise + confianca + custo IA │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Dia 8: Retificação (Se houver) ────────────────────────────┐
│                                                                │
│  1. Job PNCP detecta retificação                              │
│     ↓                                                          │
│  2. Compara HASH anterior vs novo                             │
│     ↓                                                          │
│  3. Se diferente:                                             │
│     - Cria nova versão: /editais/{id}/v2/{novo_hash}.pdf    │
│     - Invalida approvações anteriores                        │
│     - Gera alerta: "Edital alterado, reanalisar"            │
│     - Preserva v1 intacta                                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Dia 9-12: Decisão e Preparação ────────────────────────────┐
│                                                                │
│  1. Gestor revisa análise IA + recomendação                  │
│     ↓                                                          │
│  2. Opções:                                                   │
│     [Participar] → próxima etapa                             │
│     [Não participar] → registra motivo + previne reaparecimento│
│     [Análise posterior] → mantém pendente                    │
│     ↓                                                          │
│  3. Se "Participar": Sistema gera checklist de documentos    │
│     Busca template padrão + edital → dossiê adaptado        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. ESTRUTURA DE TABELAS - RELACIONAMENTOS

```
empresas (1)
  ├─ (1:N) usuarios
  ├─ (1:N) obras
  ├─ (1:N) fornecedores
  ├─ (1:N) oportunidades_pncp
  ├─ (1:N) documentos
  ├─ (1:N) propostas
  └─ (1:N) signatarios

obras (1)
  ├─ (1:N) contratos
  ├─ (1:N) boletins_medicao
  ├─ (1:N) cronogramas
  └─ (1:N) clausulas_reajuste

contratos (1)
  ├─ (1:N) boletins_medicao
  ├─ (1:N) cronogramas
  ├─ (1:N) clausulas_reajuste
  ├─ (1:N) reajustes
  └─ (1:N) eventos_contratuais

fornecedores (1)
  ├─ (1:N) contratos
  ├─ (1:N) representantes_legais
  ├─ (1:N) procuracoes (outorgante)
  └─ (1:N) cnds

oportunidades_pncp (1)
  ├─ (1:1) editais
  ├─ (1:1) editais_analise
  ├─ (1:N) propostas
  └─ (1:1) dossiê

propostas (1)
  ├─ (1:N) propostas_itens
  └─ (1:1) propostas_readequadas

boletins_medicao (1)
  └─ (1:N) bm_itens

cronogramas (1)
  └─ (1:N) cronograma_periodos

clausulas_reajuste (1)
  ├─ (N:1) indices_economicos (data_base_inicial)
  └─ (1:N) reajustes

reajustes (1)
  ├─ (1:N) reajuste_base_elegivel
  └─ (1:1) oficio_reajuste

indices_economicos
  └─ (1:N) reajustes

signatarios (1)
  ├─ (1:N) matriz_poderes
  ├─ (1:N) procuracoes (procurador)
  └─ (1:N) assinaturas_eletronica

documentos (1)
  └─ (1:N) documentos_versoes

modelos_dossiê (1)
  └─ (1:N) dossiês

dossiê (1)
  └─ (N:N) documentos (via dossiê_documentos)

auditoria_logs
  └─ Registra TUDO
```

---

## 4. FLUXO DE PRECISÃO FINANCEIRA - PROPOSTA

```
PROPOSTA ORIGINAL (Lance vencedor)
│
├─ Valor Global: R$ 1.000.000,00
├─ Itens: 50
├─ Unitários: com até 8 casas decimais
└─ Total: PRESERVADO COMO ORIGINAL

   ↓ READEQUAÇÃO (Se desconto exigido)

CÁLCULO DE REAJUSTE (BACKEND)
│
├─ fator = 1.000.000 / 1.050.000 = 0.952380952381 (10 casas)
├─ percentual_desconto = 1 - 0.952380952381 = 0.047619... (8 casas)
│
└─ Para cada item:
   novo_unitario_exato = unitario_original × fator (8 casas decimais)
   novo_total_item = quantidade × novo_unitario_exato (2 casas)

   ↓ EXPORT

SOMA DOS ITENS EXPORTADOS (2 casas)
│
└─ 1.000.000,00 (após arredondamento padrão)

   ↓ VALIDAÇÃO

RESÍDUO = 1.000.000,00 - soma_itens_exportados
│
├─ Se resíduo = 0: ✅ OK
├─ Se resíduo > 0: Distribuir por "maior resto fracionário"
│   └─ Incrementar centavos nos itens elegíveis até zerá-lo
├─ Se resíduo < 0: ❌ BLOQUEADO
│   └─ Exigir revisão manual

   ↓ MEMÓRIA DE CÁLCULO

Gerar documento com:
├─ Valor original
├─ Valor vencedor
├─ Fator exato
├─ Percentual desconto
├─ Resíduo antes/depois
├─ Itens ajustados
└─ Aprovação gestor

   ↓ OUTPUTS

├─ XLSX com fórmulas recalculáveis
├─ PDF com memória
├─ Carta Proposta com valor por extenso
└─ Hash para auditoria
```

---

## 5. FLUXO DE REAJUSTE CONTRATUAL

```
CONTRATO ASSINADO (Data-base = 01/2024)
│
├─ Regime: Reajuste em sentido estrito
├─ Índice: IPCA-15
├─ Periodicidade: Anual (01 de cada ano)
├─ Fórmula: R = V × ((I ÷ I0) − 1)
└─ Cláusula: Página 5, item 2.3

   ↓ 01/01/2025 (Primeira anualidade)

JOB AUTOMÁTICO DETECTA PRÓXIMA DATA
│
├─ Registra alerta: "120 dias para reajuste"
├─ → "90 dias para reajuste"
├─ → "60 dias para reajuste"
├─ → "30 dias para reajuste"
└─ → "15 dias para reajuste"

   ↓ 15/12/2024 (15 dias antes)

ALERTA: Índice será publicado em breve?
│
├─ Job consulta IBGE SIDRA
├─ Se publicado: "Índice IPCA-15 dezembro/2024 = 0.62%"
│   └─ Salva snapshot com hash
├─ Se não publicado: "Aguardando publicação... próx consulta em 3 dias"
└─ Registra tudo em indices_economicos

   ↓ 01/01/2025 (Data de vigência)

USUÁRIO CLICA "Gerar Reajuste"
│
├─ Backend busca:
│   ├─ Contrato
│   ├─ Cláusula
│   ├─ Data-base (01/2024) → I0 = IPCA 01/2024 = 123.45
│   ├─ Data atual (01/2025) → I = IPCA 01/2025 = 124.21
│   └─ Base elegível: BMs medidos, menos BMs anteriores
│
├─ Calcula:
│   ├─ Fator = 124.21 ÷ 123.45 = 1.006143...
│   ├─ Percentual = 0.6143%
│   ├─ Reajuste = V_elegivel × 0.006143
│   └─ Valor_atualizado = V_elegivel + reajuste
│
└─ Registra em BD com:
   ├─ reajuste_id
   ├─ I0, I, fator, percentual
   ├─ V_elegivel
   ├─ reajuste (NUMERIC 18,2)
   ├─ usuario_id
   ├─ timestamp
   └─ hash

   ↓ GERAR OFÍCIO

Backend cria minuta editável:
│
├─ Cabeçalho (órgão, contrato, processo)
├─ Corpo com fórmula
├─ Tabela: [I0 | I | Fator | % | Valor_elegivel | Reajuste]
├─ Novo valor = V_original + reajuste
├─ Assinatura + carimbo
└─ Salva em /contratos/{id}/oficio_reajuste_01_2025.pdf

   ↓ VALIDAÇÃO HUMANA

Gestor abre ofício:
├─ Valida números
├─ Valida elegibilidade de BMs
├─ Valida se não foi aplicado antes
├─ Aprova ou rejeita

   ↓ PROTOCOLO / ENVIO

├─ Backend gera protocolo
├─ Registra em protocolos + numero + data + hora
├─ Cria webhook para retorno (se protocolo eletrônico)
└─ Alerta: "Ofício enviado. Protocolo: xxxxx"

   ↓ RESPOSTA (Quando chegar)

├─ Órgão responde com apostilamento
├─ Backend registra em reajustes:
│   ├─ status = "apostilado"
│   ├─ data_apostilamento
│   ├─ numero_apostilamento
│   └─ url_pdf_resposta
│
└─ Próximo ciclo: 01/01/2026

   ↓ INTEGRAÇÃO COM BM

Próximas medições (BM-XXX) incluem:
├─ valor_original_periodo
├─ valor_reajustado_periodo = valor_original × fator_reajuste
├─ campo: reajuste_ciclo_01_2025
└─ Visibilidade do reajuste aplicado
```

---

## 6. SECURITY MATRIX - RLS + BUCKETS

```
┌──────────────────────────────────────────────────────────────┐
│                    AUTENTICAÇÃO (Supabase Auth)              │
├──────────────────────────────────────────────────────────────┤
│  JWT Token    │ Refresh Token    │ Session Management        │
│  2FA Enabled  │ Password Recovery │ Rate Limiting            │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│              AUTORIZAÇÃO (Row Level Security)                │
├──────────────────────────────────────────────────────────────┤
│  Policy: usuarios.empresa_id = auth.user.empresa_id         │
│  Policy: documentos.empresa_id = auth.user.empresa_id       │
│  Policy: propostas.empresa_id = auth.user.empresa_id        │
│  Policy: boletins.empresa_id IN (user_obras.empresa_id)     │
│                                                               │
│  ✅ Admin vê tudo da empresa                                 │
│  ✅ Gestor vê obras atribuídas                              │
│  ✅ Usuário vê apenas documentos compartilhados             │
│  ❌ User de empresa A não vê dados empresa B                │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│            STORAGE PRIVADO (Supabase Buckets)               │
├──────────────────────────────────────────────────────────────┤
│  /editais/          → Listável, GET com URL temp (5min)    │
│  /propostas/        → Privado, GET com URL temp (5min)     │
│  /contratos/        → Privado, GET com URL temp (5min)     │
│  /documentos/       → Privado, GET com URL temp (5min)     │
│  /bm/               → Privado, GET com URL temp (5min)     │
│  /assinados/        → Privado, GET com URL temp (5min)     │
│                                                              │
│  NEVER: PUT/DELETE sem backend auth                        │
│  NEVER: Expor presigned URLs em client                     │
│  ALWAYS: Gerar em backend, enviar response apenas          │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│            DADOS SENSÍVEIS (Mascaramento)                   │
├──────────────────────────────────────────────────────────────┤
│  CPF: 123.456.789-00 → 123.*****.789-00                    │
│  CNPJ: 12.345.678/0001-90 → 12.345.****/0001-90           │
│  Email: usuario@empresa.com → u****@empresa.com             │
│  Senha: Nunca retornar em API                               │
│  Token: Nunca retornar em API                               │
│  PFX: Nunca retornar em API                                 │
│  Base64: Converter em backend apenas                        │
│                                                              │
│  Auditoria: Registra quem acessou CPF/CNPJ                 │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────────┐
│            AUDITORIA IMUTÁVEL (Logs)                        │
├──────────────────────────────────────────────────────────────┤
│  auditoria_logs (Soft-delete bloqueado)                     │
│                                                              │
│  ├─ usuario_id                                              │
│  ├─ acao (CREATE/UPDATE/DELETE)                            │
│  ├─ modulo (propostas, contratos, ...)                    │
│  ├─ antes (JSON anterior)                                  │
│  ├─ depois (JSON novo)                                     │
│  ├─ timestamp (UTC)                                        │
│  ├─ ip_address (quando aplicável)                          │
│  ├─ resultado (sucesso/erro)                               │
│  └─ hash (SHA256 para integridade)                         │
│                                                              │
│  RLS: Admin vê apenas empresa; usuário comum vê anônimo    │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. JOBS AUTOMÁTICOS

```
┌─────────────────────────────────────────────────────────────┐
│             SCHEDULER (Cron via Supabase)                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  05:00 UTC → job-radar-pncp                                │
│    └─ Consulta API PNCP                                     │
│    └─ Filtra por keywords                                   │
│    └─ Compara com rejeitados                                │
│    └─ Cria novas oportunidades                              │
│    └─ Gera alertas                                          │
│                                                              │
│  06:00 UTC → job-indices-economicos                        │
│    └─ Consulta IBGE SIDRA (últimas 3 séries)              │
│    └─ Consulta BCB SGS                                     │
│    └─ Salva snapshots com hash                             │
│    └─ Gera alertas se publicado                            │
│                                                              │
│  08:00 UTC → job-alertas-reajuste                         │
│    └─ Busca contratos próximos à data-base                │
│    └─ Gera alerts: 120d, 90d, 60d, 30d, 15d, 7d, 1d      │
│    └─ Verifica índice publicado                            │
│                                                              │
│  10:00 UTC → job-cnds-vencimento                          │
│    └─ Busca CNDs próximas do vencimento                   │
│    └─ Gera alerts: 30d, 15d, 7d, 1d                       │
│    └─ Marca para recoleta se vencida                      │
│                                                              │
│  Diariamente (00:00) → job-backup-snapshot                │
│    └─ Snapshots de índices consultados                     │
│    └─ Verify integridade de arquivos                       │
│    └─ Cleanup de URLs temporárias expiradas               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. FASES E TIMELINE

```
FASE 0: AUDITORIA ✅ (Este documento)
├─ Duração: 5h
├─ Status: Concluído
└─ Próxima ação: Aprovação para FASE 1

FASE 1: FUNDAÇÃO SEGURA (12h | 150 créditos)
├─ Criar banco: 28 tabelas base
├─ Configurar RLS policies
├─ Implementar auditoria
├─ Setup Supabase buckets
├─ Teste: RLS, CRUD, permissões
└─ ✅ Gate: DB functiona 100%

FASE 2: DOCUMENTOS (8h | 100 créditos)
├─ Versionamento + hash
├─ APIs de CND
├─ Fallback manual
├─ Alertas validade
└─ ✅ Gate: Documentos versionados

FASE 3: RADAR PNCP (10h | 120 créditos)
├─ Integração API PNCP
├─ Job automático
├─ Filtros + rejeição
├─ Pipeline status
└─ ✅ Gate: Coleta funcionando

FASE 4: IA EDITAIS (20h | 250 créditos) 🔴 ALTO RISCO
├─ Download versionado
├─ OCR quando necessário
├─ Prompt estruturado
├─ Validação JSON
├─ Confiança + Risco
├─ Teste: PDFs diversos
└─ ✅ Gate: IA não alucina

FASE 5: ASSINATURA (12h | 150 créditos)
├─ ZapSign integração
├─ Webhook retorno
├─ Signatários + Poderes
├─ Procurações
├─ Validação antes envio
└─ ✅ Gate: Assinatura funciona

FASE 6: BIBLIOTECA TÉCNICA (14h | 170 créditos)
├─ Upload CAT/ART
├─ IA extração
├─ Validação engenharia
├─ Sugestão atestados
└─ ✅ Gate: Biblioteca pronta

FASE 7: PROPOSTA COMERCIAL (18h | 220 créditos) 🔴 ALTO RISCO
├─ Carta proposta
├─ Desconto linear/não-linear
├─ Arredondamentos + residuo
├─ Fechamento valor_vencedor
├─ XLSX + PDF
├─ Memória de cálculo
├─ Testes: desconto > valor
└─ ✅ Gate: Financeiro OK

FASE 8: CRONOGRAMA (12h | 150 créditos)
├─ Cronograma físico-financeiro
├─ Curva S
├─ Previsto x Realizado
├─ Baseline
├─ Integração com BM
└─ ✅ Gate: Cronograma OK

FASE 9: DOSSIÊS (15h | 180 créditos)
├─ Templates
├─ Editor visual
├─ PDF unificado
├─ ZIP estruturado
├─ Excel compatível
├─ Manifesto
└─ ✅ Gate: Dossiê pronto

FASE 10: PORTAIS (8h | 100 créditos)
├─ Perfis de portal
├─ Simulador upload
├─ Validação limites
└─ ✅ Gate: Portal OK

FASE 11: ÍNDICES PÚBLICOS (14h | 170 créditos)
├─ IBGE SIDRA connector
├─ BCB SGS connector
├─ FGV autorizado/fallback
├─ Job automático
├─ Snapshot + hash
├─ Cache inteligente
└─ ✅ Gate: Índices OK

FASE 12: REAJUSTES (20h | 250 créditos) 🔴 ALTO RISCO
├─ Cláusula extração
├─ Data-base
├─ Elegibilidade BM
├─ Cálculo reajuste
├─ BM integração
├─ Memória cálculo
├─ Ofício geração
├─ Apostilamento
├─ Ciclos múltiplos
├─ Testes: aditivo, paralisação
└─ ✅ Gate: Reajuste OK

FASE 13: QUALIDADE (12h | 150 créditos)
├─ Testes regressão
├─ Segurança audit
├─ Performance check
├─ Documentação
├─ Treinamento
└─ ✅ Gate: Pronto produção

TOTAL: 175h | 2090 créditos Lovable
```

---

## 9. CHECKLIST TESTES POR FASE

### Fase 1 - Fundação
- [ ] RLS: Admin vê tudo; usuário comum vê só dados atribuídos
- [ ] CRUD: Create/Read/Update/Delete funcionam
- [ ] Constraints: Chaves únicas impedem duplicidade
- [ ] Índices: Queries rápidas (<100ms)
- [ ] Auditoria: Todos os UPDATEs registrados

### Fase 4 - IA Editais
- [ ] PDF texto: IA extrai corretamente
- [ ] PDF escaneado: OCR dispara, resultado OK
- [ ] JSON válido: Schema respeitado
- [ ] Confiança alta (≥95%): Auto-preenche
- [ ] Confiança baixa (<70%): Cria pendência

### Fase 7 - Proposta
- [ ] Desconto linear: Proporcional em todos itens
- [ ] Desconto não-linear: Mantém proporcionalidade
- [ ] Resíduo > 0: Distribuído por maior resto
- [ ] Resíduo < 0: Bloqueado, exigir revisão
- [ ] XLSX: Fórmulas funcionam se abrir novamente

### Fase 12 - Reajuste
- [ ] BM anterior: NÃO reajustado
- [ ] BM posterior: Reajustado
- [ ] BM atravessando: Separado corretamente
- [ ] Aditivo: Base elegível atualizada
- [ ] Paralisação: Período excluído da elegibilidade
- [ ] Segundo ciclo: Novo I0, calcula corretamente

---

## QUESTÕES CRÍTICAS

1. **ZapSign já contratado?** (Afeta integração assinatura)
2. **Credenciais FGV?** (Afeta índices)
3. **Qual API CND usar?** (Serasa, SOLUÇÕES?)
4. **Supabase project criado?** (Project ID + keys)
5. **Domínio para webhook?** (Retorno assinatura)

---

**Elaborado por**: GitHub Copilot  
**Modelo**: Claude Haiku 4.5  
**Data**: 2026-06-07
