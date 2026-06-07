# SOLV GESTÃO — Central Inteligente de Licitações, Obras, Documentos e Contratos

**Status**: 🟡 FASE 0 - AUDITORIA CONCLUÍDA  
**Data**: 2026-06-07  
**Próxima Ação**: Aprovação para FASE 1

---

## 📋 Resumo Executivo

SOLV GESTÃO é uma plataforma integrada para gerenciar o ciclo completo de licitações públicas, desde a oportunidade até o fechamento do contrato, com IA inteligente que automatiza tarefas repetitivas e preserva 100% da rastreabilidade.

**Organização**: SOLV CONSTRUTORA E SOLUÇÕES LTDA (CNPJ: 36.419.348/0001-65)

---

## 🎯 Objetivo Principal

Criar uma plataforma que integre:

✅ **Radar de Oportunidades** - Coleta automática de licitações PNCP  
✅ **Análise com IA** - Extração de editais com confiança registrada  
✅ **Documentação Inteligente** - CNDs, Atestados, CATs, ARTs com versionamento  
✅ **Propostas Comerciais** - Desconto linear/não-linear com precisão financeira  
✅ **Cronogramas** - Físico-financeiro + Curva S + Previsto x Realizado  
✅ **Boletins de Medição** - Preservação 100% com reajuste integrado  
✅ **Reajustes Contratuais** - Monitoramento de indices + elegibilidade + ofícios  
✅ **Assinatura Eletrônica** - Signatários + Poderes + Procurações  
✅ **Dossiês** - Templates + PDF unificado + ZIP estruturado  
✅ **Segurança Total** - RLS, Auditoria, Mascaramento, Backend-first  

---

## 📊 FASE 0 - Entregáveis

A auditoria foi completada. Três documentos foram gerados:

### 1. 📄 **[FASE_0_AUDITORIA.md](FASE_0_AUDITORIA.md)**
Diagnóstico executivo completo com:
- ✅ Escopo confirmado (82 funcionalidades)
- ✅ Arquitetura proposta (React + Node + Supabase)
- ✅ 28 tabelas estruturais necessárias
- ✅ 9 Edge Functions planejadas
- ✅ Mapeamento de reutilizáveis
- ✅ Estimativa 175h / 2090 créditos Lovable
- ✅ 13 Fases de implementação

### 2. 📊 **[ARQUITETURA_MAPA.md](ARQUITETURA_MAPA.md)**
Mapeamento técnico com diagramas:
- 🔷 Stack tecnológico completo
- 🔷 Fluxo de dados (exemplo: oportunidade)
- 🔷 Estrutura de tabelas e relacionamentos
- 🔷 Precisão financeira (proposta)
- 🔷 Reajuste contratual (passo a passo)
- 🔷 Security Matrix (RLS + Buckets)
- 🔷 Jobs automáticos (scheduler)
- 🔷 Timeline das 13 fases

### 3 ❓ **[QUESTOES_CRITICAS.md](QUESTOES_CRITICAS.md)**
14 questões críticas para você responder:
- ⚙️ Supabase (Project ID, keys)
- ⚙️ Assinatura eletrônica (ZapSign?)
- ⚙️ Índices FGV (credenciais?)
- ⚙️ CNDs (qual API?)
- ⚙️ Proposta (desconto linear/não-linear?)
- ⚙️ Reajuste (padrão vigente?)
- E mais 8 questões operacionais

---

## 🏗️ Stack Tecnológico

```
Frontend:  React/Next.js + TypeScript + Tailwind CSS
Backend:   Supabase Edge Functions + Node.js
Database:  PostgreSQL (via Supabase)
Storage:   Supabase Buckets (versionado por hash)
Auth:      Supabase Auth + RLS
APIs:      PNCP, IBGE SIDRA, BCB SGS, FGV, CNDs, ZapSign
```

---

## 🔒 Princípios Absolutos

1. **PRESERVAÇÃO** - Nunca sobrescrever; criar versão + hash + histórico
2. **FONTE ÚNICA** - Um registro por empresa, fornecedor, obra, contrato
3. **VERSIONAMENTO** - Timestamp + usuário + hash + motivo em cada mudança
4. **SEGURANÇA** - Backend-first, RLS, secrets, mascaramento CPF
5. **PRECISÃO FINANCEIRA** - NUMERIC(18,2) para moeda, NUMERIC(18,8) para unitários
6. **IA COM EVIDÊNCIA** - Arquivo + versão + página + confiança sempre visível
7. **EXCEÇÕES** - IA automatiza repetitivo; humano decide exceção

---

## 📈 13 Fases de Implementação

| Fase | Nome | Duração | Créditos | Status |
|------|------|---------|----------|--------|
| 1 | Fundação Segura | 12h | 150 | ⏳ Aguarda aprovação |
| 2 | Documentos e CNDs | 8h | 100 | ⏳ |
| 3 | Radar PNCP | 10h | 120 | ⏳ |
| 4 | IA para Editais | 20h | 250 | ⏳ 🔴 Alto risco |
| 5 | Assinatura Eletrônica | 12h | 150 | ⏳ |
| 6 | Biblioteca Técnica | 14h | 170 | ⏳ |
| 7 | Proposta Comercial | 18h | 220 | ⏳ 🔴 Alto risco |
| 8 | Cronograma | 12h | 150 | ⏳ |
| 9 | Dossiês | 15h | 180 | ⏳ |
| 10 | Portais e Perfis | 8h | 100 | ⏳ |
| 11 | Índices Econômicos | 14h | 170 | ⏳ |
| 12 | Reajustes Contratuais | 20h | 250 | ⏳ 🔴 Alto risco |
| 13 | Qualidade e Deploy | 12h | 150 | ⏳ |
| | **TOTAL** | **175h** | **2090** | |

---

## 🎯 Críticos Identificados

### 🔴 RISCOS CRÍTICOS
- **Alucinação IA em Editais** → Exigir confiança ≥95%
- **Erro Financeiro em Reajuste** → Validação tripla + auditoria
- **Duplicidade de Dados** → RLS + UNIQUE constraints
- **Perda de Histórico** → Soft delete + versioning obrigatório

### ⚠️ AÇÕES IMEDIATAS
- [ ] Responder as 14 questões críticas
- [ ] Confirmar Supabase project
- [ ] Validar provider assinatura eletrônica
- [ ] Definir API de CNDs
- [ ] Aprovar estimativa de tempo

---

## 📋 Como Prosseguir

### 1️⃣ Você lê agora:
- [x] Este README
- [ ] [FASE_0_AUDITORIA.md](FASE_0_AUDITORIA.md)
- [ ] [ARQUITETURA_MAPA.md](ARQUITETURA_MAPA.md)
- [ ] [QUESTOES_CRITICAS.md](QUESTOES_CRITICAS.md)

### 2️⃣ Você responde:
- [ ] As 14 questões críticas
- [ ] Aprova ou sugere ajustes na arquitetura
- [ ] Confirma timeline e orçamento

### 3️⃣ Eu faço:
- [ ] Recebo respostas
- [ ] Ajusto arquitetura se necessário
- [ ] Iniciamos FASE 1 (Fundação Segura)

---

## 🚀 Próximas Ações

**Data**: 2026-06-07  
**Status**: ⏳ Aguardando aprovação

### Para começar FASE 1:
1. ✅ Confirmar Supabase project criado
2. ✅ Responder questões críticas
3. ✅ Aprovar 28 tabelas e arquitetura
4. ✅ Iniciar desenvolvimento

### Estimativa FASE 1:
- **Duração**: 12 horas
- **Créditos**: 150 (Lovable)
- **Entregáveis**: 
  - Database schema completo
  - RLS policies funcionando
  - Auditoria ativa
  - Buckets configurados
  - Testes de permissões

---

## 📞 Suporte

Dúvidas sobre a arquitetura? Consulte:

- **Diagrama de fluxo**: Ver [ARQUITETURA_MAPA.md](ARQUITETURA_MAPA.md)
- **Questões técnicas**: Ver [FASE_0_AUDITORIA.md](FASE_0_AUDITORIA.md) - Seção 13 (Riscos)
- **Estrutura de tabelas**: Ver [FASE_0_AUDITORIA.md](FASE_0_AUDITORIA.md) - Seção 4
- **Respostas necessárias**: Ver [QUESTOES_CRITICAS.md](QUESTOES_CRITICAS.md)

---

## 📝 Licença

Propriedade da SOLV CONSTRUTORA E SOLUÇÕES LTDA (CNPJ: 36.419.348/0001-65)

---

**Elaborado por**: GitHub Copilot  
**Modelo**: Claude Haiku 4.5  
**Data**: 2026-06-07  
**Versão**: FASE 0 - COMPLETO

---

## 📊 Documento Relacionados

1. [FASE_0_AUDITORIA.md](FASE_0_AUDITORIA.md) - Diagnóstico completo
2. [ARQUITETURA_MAPA.md](ARQUITETURA_MAPA.md) - Diagramas técnicos
3. [QUESTOES_CRITICAS.md](QUESTOES_CRITICAS.md) - 14 questões para aprovação
