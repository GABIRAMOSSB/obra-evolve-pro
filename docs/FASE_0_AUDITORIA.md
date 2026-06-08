# SOLV GESTÃO — FASE 0: AUDITORIA E MAPEAMENTO

**Data**: 2026-06-07  
**Status**: Em Processamento  
**Organização**: SOLV CONSTRUTORA E SOLUÇÕES LTDA  
**CNPJ**: 36.419.348/0001-65

---

## 1. DIAGNÓSTICO EXECUTIVO

### Situação Atual
- **Tipo de Projeto**: Novo projeto de consolidação + evolução
- **Repositório Base**: github.com/GABIRAMOSSB/Gest-o-Solv (vazio, a ser populado)
- **Stack Definida**: React/Next.js + Node.js + Supabase/PostgreSQL
- **Objetivo**: Plataforma integrada de Licitações, Obras, Documentos e Contratos com IA

### Missão Crítica
Criar arquitetura que:
- ✅ Preserve 100% dos dados, históricos e cálculos existentes
- ✅ Implemente fonte única de dados (zero duplicidade)
- ✅ Integre IA sem alucinações (com evidência sempre visível)
- ✅ Trabalhe por exceções (automação + decisão humana)
- ✅ Mantenha precisão financeira (DECIMAL, não Float)

---

## 2. ESCOPO CONFIRMADO (82 Funcionalidades)

### A. LICITAÇÕES E OPORTUNIDADES
1. **Radar PNCP** - Coleta de oportunidades via API pública
2. **Triagem automática** - Filtros + rejeição com histórico
3. **Análise de Edital com IA** - Extração estruturada em JSON
4. **Retificações e Erratas** - Versionamento + hash + detecção de mudança
5. **OCR inteligente** - Somente em PDFs escaneados, com qualidade registrada

### B. DOCUMENTAÇÃO E REGULARIDADE
6. **CNDs** - Reutilizar APIs existentes, evitar duplicidade
7. **Documentos versioning** - Hash + histórico + restauração
8. **Biblioteca técnica** - Atestados, CATs, ARTs, ARTs, Certificações CREA
9. **Declarações licitatórias** - Modelos + assinatura eletrônica
10. **Signatários** - Matriz de poderes + procurações + limites

### C. PROPOSTAS COMERCIAIS
11. **Carta proposta** - Geração automática validada
12. **Proposta original** - Preservação integral
13. **Proposta readequada** - Desconto linear/não-linear controlado
14. **Arredondamentos** - Reconciliação com maior resto fracionário
15. **BDI e Encargos** - Cálculo preciso em DECIMAL

### D. CRONOGRAMAS E MEDIÇÕES
16. **Cronograma físico-financeiro** - Importação + versionamento
17. **Curva S** - Cálculo previsto x realizado
18. **Boletins de Medição** - Preservação integral (BM-01 a Bn)
19. **RDO** - Registro de Diário de Obras integrado

### E. CONTRATOS E REAJUSTES
20. **Gestão de Contratos** - Eventos contratuais + histórico
21. **Reajustes** - Monitoramento de data-base + índices + elegibilidade
22. **Índices Econômicos** - IBGE SIDRA + BCB SGS + FGV + fallback
23. **Ofícios de Reajuste** - Geração + protocolo + resposta + apostilamento

### F. INTEGRAÇÕES E SEGURANÇA
24. **Edge Functions** - Backend seguro Supabase
25. **RLS (Row Level Security)** - Controle por usuário/obra/empresa
26. **Assinatura Eletrônica** - ZapSign ou equivalente
27. **Auditoria** - Logs imutáveis de todas as ações

### G. DASHBOARDS E RELATÓRIOS
28. **Dashboard Executivo** - KPIs + alertas + filtros
29. **Alertas inteligentes** - 30+ tipos de notificação
30. **Relatórios** - PDF + Excel + ZIP estruturado

---

## 3. ARQUITETURA PROPOSTA

### 3.1 Stack Tecnológico

```
FRONTEND (React/Next.js)
├─ Pages (40 telas principais)
├─ Components (Design System + Figma)
└─ State Management (Context/Zustand)

BACKEND (Edge Functions Supabase + Node.js)
├─ API Routes
├─ Webhooks (Assinatura, CNDs, Índices)
└─ Jobs (Radar PNCP, Índices automáticos)

DATABASE (PostgreSQL via Supabase)
├─ Tabelas Fundamentais (30+)
├─ RLS Policies
├─ Indexes
└─ Versionamento + Soft Deletes

STORAGE (Supabase Buckets)
├─ /editais (Públicos, PDFs versionados)
├─ /propostas (Privado, XLSX + PDF)
├─ /contratos (Privado, PDFs)
└─ /documentos (Privado, validação)

INTEGRAÇÕES EXTERNAS
├─ PNCP (API pública)
├─ IBGE SIDRA (API pública)
├─ BCB SGS (API pública)
├─ FGV IBRE (Autorizada/Manual)
├─ CNDs (Existentes)
└─ ZapSign (Assinatura eletrônica)
```

### 3.2 Princípios Arquiteturais

| Princípio | Aplicação |
|-----------|-----------|
| **PRESERVAÇÃO** | Nunca sobrescrever; criar versão + hash + histórico |
| **FONTE ÚNICA** | Um registro por empresa, fornecedor, obra, contrato, documento |
| **VERSIONAMENTO** | Timestamp + usuário + hash + motivo em cada mudança |
| **SEGURANÇA** | Backend-first, RLS, secrets, mascaramento CPF |
| **PRECISÃO FINANCEIRA** | NUMERIC(18,2) para moeda, NUMERIC(18,8) para unitários |
| **IA COM EVIDÊNCIA** | Arquivo + versão + página + item + confiança sempre visível |
| **EXCEÇÕES** | IA automatiza repetitivo; humano decide exceção |

---

## 4. MAPEAMENTO DE TABELAS ESTRITAMENTE NECESSÁRIAS

### Fase 1 - FUNDAÇÃO (Tabelas Críticas)

```sql
-- EMPRESAS (Fonte Única)
empresas (id, cnpj, nome, razao_social, endereco, ...)
usuarios (id, email, empresa_id, perfil_id, auth_id)
perfis (id, nome, permissoes[])

-- OBRAS (Fonte Única)
obras (id, empresa_id, nome, localizacao, valor_contratado, status, ...)
contratos (id, obra_id, empresa_id, fornecedor_id, numero, valor, data_inicio, ...)

-- FORNECEDORES (Fonte Única)
fornecedores (id, empresa_id, cnpj, nome, contato, ...)
representantes_legais (id, fornecedor_id, nome, cargo, cpf_masked, ...)

-- DOCUMENTOS E VERSIONING
documentos (id, tipo, entidade_id, hash, versao, url_storage, data_upload, usuario_id)
documentos_versoes (id, documento_id, hash, numero_versao, motivo_mudanca, usuario_id, data)

-- AUDITORIA
auditoria_logs (id, usuario_id, acao, modulo, entidade, registro_id, antes, depois, timestamp)
```

### Fase 2 - LICITAÇÕES

```sql
oportunidades_pncp (id, empresa_id, processo, orgao, modalidade, objeto, data_limite, ...)
oportunidades_status (id, oportunidade_id, status, usuario_id, timestamp, motivo_rejeicao)
editais (id, oportunidade_id, hash, versao, url_original, data_download, ocr_realizado)
editais_analise (id, edital_id, json_extraido, confianca_score, usuario_validou)
```

### Fase 3 - REGULARIDADE

```sql
cnds (id, empresa_id, fornecedor_id, tipo, data_consulta, validade, url_pdf, api_provider)
documentos_obrigatorios (id, empresa_id, tipo, validade_dias, status_atual, proximo_vencimento)
```

### Fase 4 - PROPOSTAS

```sql
propostas (id, oportunidade_id, empresa_id, valor_original, hash_original, status)
propostas_readequadas (id, proposta_id, valor_final, fator_readequacao, motivo_mudanca)
propostas_itens (id, proposta_id, descricao, quantidade, unitario_original, unitario_readequado, total)
```

### Fase 5 - CRONOGRAMAS

```sql
cronogramas (id, contrato_id, versao, percentual_total, data_criacao, usuario_id)
cronograma_periodos (id, cronograma_id, periodo, mes, percentual_fisico, valor_financeiro)
```

### Fase 6 - BOLETINS DE MEDIÇÃO

```sql
boletins_medicao (id, contrato_id, numero_bm, data_medicao, acumulado_anterior, usuario_id)
bm_itens (id, boletim_id, etapa_id, quantidade_periodo, valor_periodo, acumulado)
```

### Fase 7 - REAJUSTES

```sql
clausulas_reajuste (id, contrato_id, tipo, data_base_inicial, indice_id, formula_reajuste, ...)
indices_economicos (id, indice, competencia, numero_indice, variacao, fonte, data_consulta, hash)
reajustes (id, contrato_id, ciclo, data_base, indice_id_inicial, indice_id_atual, fator_reajuste, ...)
reajuste_base_elegivel (id, reajuste_id, saldo_contratual, exclusoes_motivo, valor_elegivel)
```

### Fase 8 - ASSINATURA E PODERES

```sql
signatarios (id, empresa_id, nome, cargo, cpf_masked, categoria, status, limites[])
matriz_poderes (id, signatario_id, documento_tipo, origem_documento, poder_limite, validade)
procuracoes (id, outorgante_id, procurador_id, poderes[], validade, url_pdf)
```

### Fase 9 - DOSSIÊS

```sql
modelos_dossiê (id, empresa_id, nome, tipo, estrutura_json, status)
dossiês (id, empresa_id, oportunidade_id, modelo_id, status, data_criacao)
dossiê_documentos (id, dossiê_id, documento_id, ordem, obrigatorio)
```

---

## 5. MIGRATIONS PLANEJADAS

### M001: Tabelas de Base
```
criar: empresas, usuarios, perfis, obras, fornecedores
RLS: Por empresa_id
Índices: cnpj, email, nome
```

### M002: Documentos e Versioning
```
criar: documentos, documentos_versoes, auditoria_logs
Índices: hash, documento_id, timestamp
RLS: Por documento.empresa_id
```

### M003-M009: Progressivas conforme fases

---

## 6. EDGE FUNCTIONS PLANEJADAS

### Função: `webhook-zapsign`
- Recebe resposta de assinatura
- Atualiza status documento
- Valida integridade
- Registra versão assinada

### Função: `job-radar-pncp`
- Consulta API PNCP diariamente
- Filtra por palavras-chave
- Compara com rejeitados anteriores
- Cria nova oportunidade

### Função: `job-indices-economicos`
- Consulta IBGE, BCB, FGV
- Valida resposta
- Salva snapshot com hash
- Gera alerta se índice publicado

### Função: `validar-edital`
- Valida JSON extraído
- Verifica confiança mínima
- Bloqueia se inválido
- Retorna erros estruturados

---

## 7. REUTILIZÁVEIS IDENTIFICADOS

| Item | Reutilizar | Ampliar |
|------|-----------|---------|
| Boletim de Medição | ✅ Preservar 100% | ⚠️ Adicionar campos reajuste |
| CNDs | ✅ Reutilizar API | ⚠️ Integrar com regularidade |
| Fornecedores | ✅ Preservar | ⚠️ Adicionar subempreiteiros |
| Contratos | ✅ Preservar | ⚠️ Adicionar eventos + reajustes |
| Notas Fiscais | ✅ Preservar | ⚠️ Integrar com apropriações |
| Centros de Custo | ✅ Preservar | ⚠️ Integrar com cronogramas |

---

## 8. TABELAS NOVAS ESTRITAMENTE NECESSÁRIAS

**Quantidade**: 28 tabelas estruturais

**Justificativa**: Não há sobreposição. Cada tabela serve a um propósito único:
- Oportunidades PNCP (nova coleta)
- Análises com IA (nova automação)
- Reajustes (novo módulo)
- Signatários + Poderes (novo fluxo de assinatura)
- Índices Econômicos (novo monitoramento)
- Documentos com versioning (necessário para rastreabilidade)
- Dossiês (novo agrupamento)
- Auditoria (novo requisito de compliance)

---

## 9. SEGURANÇA - MAPEAMENTO RLS

| Tabela | Visibilidade |
|--------|-------------|
| empresas | Apenas dados da empresa logada |
| usuarios | Apenas mesmo departamento/empresa |
| obras | Apenas obras da empresa |
| contratos | Apenas contratos da empresa |
| documentos | Apenas documentos da empresa |
| propostas | Apenas propostas da empresa |
| boletins_medicao | Apenas BMs da empresa |
| reajustes | Apenas reajustes da empresa |
| auditoria_logs | Apenas logs da empresa (mascarado para usuário comum) |

**Princípio**: Menor privilégio por RLS + Auth Supabase

---

## 10. BUCKETS STORAGE

```
/editais-versoes/
  ├─ {oportunidade_id}/v1/{hash}.pdf
  ├─ {oportunidade_id}/v2/{hash}.pdf
  └─ manifesto.json

/propostas-comerciais/
  ├─ {proposta_id}/original.xlsx
  ├─ {proposta_id}/readequada.xlsx
  └─ {proposta_id}/carta.pdf

/contratos/
  ├─ {contrato_id}/contrato.pdf
  └─ {contrato_id}/anexos/

/documentos-tecnicos/
  ├─ {tipo}/atestado_{id}.pdf
  ├─ {tipo}/cat_{id}.pdf
  └─ {tipo}/art_{id}.pdf

/boletins-medicao/
  ├─ {bm_id}/pdf/
  └─ {bm_id}/excel/

/assinados/
  └─ {documento_id}_assinado.pdf
```

**Política**: Todos privados. URLs temporárias para download (5 minutos).

---

## 11. APIS E INTEGRAÇÕES EXTERNAS

| API | Tipo | Função | Frequência |
|-----|------|--------|-----------|
| PNCP | GET Público | Radar de oportunidades | Diária |
| IBGE SIDRA | GET Público | Índices (IPCA, INPC) | Conforme publicação |
| BCB SGS | GET Público | Índices série | Conforme publicação |
| FGV IBRE | Autorizada | INCC, IGP | Conforme publicação |
| CNDs | GET Privada | Regularidade fornecedor | Por demanda |
| ZapSign | POST Webhook | Assinatura eletrônica | Por transação |

---

## 12. LISTA DE VERIFICAÇÃO - CRITÉRIOS DE ACEITE

### Aplicação Atual (Preservação)
- [ ] BM-01: acumulado anterior vazio
- [ ] BM-02+: acumulado automático
- [ ] Período: somente medição selecionada
- [ ] PDF: layout preservado
- [ ] Excel: fórmulas preservadas
- [ ] Histórico: imutável

### Novos Módulos (Implementação)
- [ ] PNCP: coleta + filtros + rejeitados
- [ ] Edital: download + versionamento + retificações
- [ ] IA: JSON validável + confiança + risco
- [ ] Declarações: modelos + assinatura + webhook
- [ ] Biblioteca: upload + extração + CAT/ART
- [ ] Proposta: desconto linear/não-linear + arredondamento + fechamento
- [ ] Cronograma: Curva S + baseline + BM
- [ ] Reajuste: elegibilidade + índice + memória + ofício
- [ ] Dossiê: modelos + PDF + ZIP + Excel
- [ ] Segurança: RLS + Auth + buckets + audit

---

## 13. ESTIMATIVA DE COMPLEXIDADE

| Fase | Duração Est. | Créditos Lovable | Risco |
|------|-------------|-----------------|-------|
| 0 - Auditoria | 5h | - | ✅ Baixo |
| 1 - Fundação | 12h | 150 | ⚠️ Médio |
| 2 - Documentos | 8h | 100 | ⚠️ Médio |
| 3 - Radar PNCP | 10h | 120 | ✅ Baixo |
| 4 - IA Editais | 20h | 250 | 🔴 Alto |
| 5 - Assinatura | 12h | 150 | ⚠️ Médio |
| 6 - Biblioteca Técnica | 14h | 170 | ⚠️ Médio |
| 7 - Proposta | 18h | 220 | 🔴 Alto |
| 8 - Cronograma | 12h | 150 | ⚠️ Médio |
| 9 - Dossiês | 15h | 180 | ⚠️ Médio |
| 10 - Portais | 8h | 100 | ✅ Baixo |
| 11 - Índices | 14h | 170 | ⚠️ Médio |
| 12 - Reajustes | 20h | 250 | 🔴 Alto |
| 13 - Qualidade | 12h | 150 | ⚠️ Médio |
| **TOTAL** | **175h** | **2090** | - |

---

## 14. RISCOS IDENTIFICADOS

### 🔴 CRÍTICOS
1. **Alucinação IA em Editais** → Exigir confiança ≥95% para auto-preenchimento
2. **Erro Financeiro em Reajuste** → Validação tripla backend + log + auditoria
3. **Duplicidade de Dados** → RLS + Constraints UNIQUE + Validação antes de insert
4. **Perda de Histórico** → Soft delete + versioning obrigatório

### ⚠️ MÉDIOS
5. Falha API PNCP → Cache + fallback manual
6. Timeout OCR → Fila async + retry
7. Webhook ZapSign atrasado → Polling fallback
8. Índice não publicado → Alerta + ciclo anterior

### ✅ BAIXOS
9. Lentidão Dashboard → Indexes + caching
10. Usuário esquece senha → 2FA + recovery

---

## 15. ESTRUTURA SEGURA DE IMPLEMENTAÇÃO

### Sequência Recomendada

**1️⃣ FASE 1** → Banco + RLS + Auditoria (Fundação)
**2️⃣ FASE 2** → Documentos + Versioning (Rastreabilidade)
**3️⃣ FASE 3** → Radar PNCP (Coleta de dados)
**4️⃣ FASE 4** → IA Editais (Automação com segurança)
**5️⃣ FASE 5-6** → Assinatura + Biblioteca (Documentação)
**7️⃣ FASE 7** → Proposta (Precisão financeira CRÍTICA)
**8️⃣ FASE 8-9** → Cronograma + Dossiês (Organização)
**9️⃣ FASE 10-11** → Portais + Índices (Integração externa)
**🔟 FASE 12** → Reajustes (Complexidade máxima)
**1️⃣1️⃣ FASE 13** → Qualidade (Testes + estabilidade)

### Razão da Sequência
- Construir base segura primeiro
- IA somente após infraestrutura robusta
- Financeiro somente após validações
- Reajustes por último (máxima complexidade)

---

## 16. QUESTÕES AINDA NECESSÁRIAS

### Críticas (Afetam Arquitetura)
1. **ZapSign já contratado?** Se não, usar outro provider?
2. **Credenciais FGV/APIs autorizadas?** Ou usar fallback manual?
3. **Supabase project já criado?** ID + keys + URLs?
4. **Domínio de assinatura?** (para webhook retorno)

### Importantes (Afetam Funcionalidade)
5. **CNDs: qual(is) API(s) de consulta usar?** (Serasa, SOLUÇÕES, Outras?)
6. **Reajuste: fórmulas padronizadas ou por contrato?**
7. **Atestados: tabela de composições por item?**
8. **Cronograma: importar planilha modelo ou gerar?**

### Operacionais (Configuração)
9. **Quantos usuários simultâneos esperados?**
10. **Volume de oportunidades/editais por mês?**

---

## PRÓXIMOS PASSOS

✅ **Fase 0 Concluída**

➡️ **Próxima Ação**:
1. Responder questões críticas (itens 1-4)
2. Validar estrutura de tabelas
3. Aprovar sequência de fases
4. Iniciar FASE 1 (Fundação)

---

**Elaborado por**: GitHub Copilot  
**Modelo**: Claude Haiku 4.5  
**Data**: 2026-06-07  
**Status**: Aguardando aprovação para prosseguir
