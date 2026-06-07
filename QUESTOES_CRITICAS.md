# SOLV GESTÃO — QUESTÕES CRÍTICAS PARA APROVAÇÃO FASE 1

**Data**: 2026-06-07  
**Status**: Aguardando respostas  
**Próxima Ação**: Sua aprovação e respostas para prosseguir

---

## QUESTÕES CRÍTICAS (Afetam Arquitetura)

### 1. ✅ INFRAESTRUTURA SUPABASE

**Pergunta**: Você já tem um projeto Supabase criado para SOLV GESTÃO?

- [ ] Sim, já existe (Project ID: _______________)
- [ ] Não, precisa ser criado
- [ ] Não sei

**Informações necessárias se já existe**:
- Project ID: 
- URL da API: 
- Anon Key (será usada frontend):
- Service Role Key (será usada backend):
- Database Connection String:

**Impacto**: Sem Supabase, não conseguimos começar a FASE 1.

---

### 2. ✅ ASSINATURA ELETRÔNICA

**Pergunta**: Qual plataforma de assinatura eletrônica será usada?

- [ ] ZapSign (já contratado)
- [ ] ZapSign (precisa contratar)
- [ ] DocuSign
- [ ] Meu Assinador (gov.br)
- [ ] Outra: _______________
- [ ] Ainda não definido

**Informações necessárias**:
- Provider escolhido:
- Credenciais/API Key disponível:
- Domínio para webhook de retorno:
- Template de documentos:

**Impacto**: Define integração da FASE 5 (Assinatura).

---

### 3. ✅ ÍNDICES ECONÔMICOS - FGV IBRE

**Pergunta**: Vocês têm credencial autorizada para consultar FGV IBRE?

- [ ] Sim (Código cliente: __________)
- [ ] Não, mas podem contratar
- [ ] Não, usar fallback manual apenas
- [ ] Não definido

**Se não tem credencial**:
- [ ] Aceita usar IBGE + BCB (públicas) apenas
- [ ] Quer que implementemos fallback manual (usuário upload)
- [ ] Quer que tentemos integração FGV sem credencial (menos confiável)

**Impacto**: Define FASE 11 (Índices Econômicos).

---

### 4. ✅ CNDs - QUAL API USAR

**Pergunta**: Qual API vocês usam atualmente para consultar CNDs?

- [ ] Serasa (CNPJ + CPF)
- [ ] Soluções Financeiras
- [ ] SOLUÇÕES (antiga plataforma)
- [ ] Outra: _______________
- [ ] Fazem upload manual
- [ ] Não têm CND integrada ainda

**Informações necessárias**:
- Provider atual:
- Credenciais disponíveis:
- Formato de retorno (JSON/XML/PDF):
- Taxa de consulta (custo por requisição):
- Volume esperado/mês:

**Impacto**: Define reutilização FASE 2 (Documentos).

---

### 5. ✅ PROPOSTA COMERCIAL - CASOS DE USO

**Pergunta**: Quais são os tipos de desconto/readequação que existem?

- [ ] Desconto linear simples (mesmo % em todos itens)
- [ ] Desconto não-linear (readequação controlada)
- [ ] Ambos (depende da licitação)
- [ ] Outro padrão: _______________

**Questão adicional**: Existe limite de desconto máximo?

- [ ] Não há limite
- [ ] Máximo: _____ %
- [ ] Depende do edital

**Questão adicional**: Editais com XLSX para planilha ou precisa gerar do zero?

- [ ] Editais fornecem XLSX modelo
- [ ] Precisam gerar a planilha do zero
- [ ] Às vezes um, às vezes outro

**Impacto**: Define lógica de FASE 7 (Proposta Comercial).

---

### 6. ✅ REAJUSTE CONTRATUAL - PADRÃO VIGENTE

**Pergunta**: Qual é o padrão de reajuste contratual usado?

- [ ] Reajuste em sentido estrito (IPCA anual)
- [ ] Repactuação com validação
- [ ] Reequilíbrio econômico-financeiro
- [ ] Múltiplos tipos (depende contrato)
- [ ] Não definido

**Questão adicional**: Todos os contratos têm cláusula de reajuste?

- [ ] Sim, todos
- [ ] Maioria sim
- [ ] Apenas alguns
- [ ] Nenhum ainda

**Questão adicional**: Qual é o índice padrão?

- [ ] IPCA
- [ ] INPC
- [ ] INCC
- [ ] IGP-M
- [ ] Depende contrato

**Questão adicional**: Quantos ciclos de reajuste um contrato pode ter?

- [ ] 1 ciclo
- [ ] 2-3 ciclos
- [ ] Ilimitado
- [ ] Varia

**Impacto**: Define FASE 12 (Reajustes Contratuais).

---

### 7. ✅ BOLETIM DE MEDIÇÃO - ESTRUTURA ATUAL

**Pergunta**: Vocês querem preservar a estrutura atual de BM?

- [ ] Sim, 100% preservada
- [ ] Sim, mas com pequenas melhorias
- [ ] Sim, com integração reajuste novo
- [ ] Não definido

**Questão adicional**: BM tem versionamento histórico que não pode perder?

- [ ] Sim, vários anos de histórico
- [ ] Sim, últimos meses
- [ ] Pouco histórico
- [ ] Começando agora

**Impacto**: Define preservação FASE 1 e integração FASE 8/12.

---

### 8. ✅ CRONOGRAMA FÍSICO-FINANCEIRO

**Pergunta**: Vocês têm cronogramas em formato estruturado?

- [ ] XLSX com fórmulas
- [ ] PDF escaneado
- [ ] Dados em BD já
- [ ] Diferentes formatos

**Questão adicional**: Precisam gerar cronograma do zero ou importar?

- [ ] Importar (já têm em arquivo)
- [ ] Gerar automaticamente da proposta
- [ ] Editor manual
- [ ] Ambos

**Impacto**: Define FASE 8 (Cronograma).

---

### 9. ✅ DOMÍNIO E HOSPEDAGEM

**Pergunta**: Onde a aplicação será hospedada?

- [ ] Supabase Cloud (recomendado)
- [ ] Servidor próprio/VPS
- [ ] Vercel (frontend) + Supabase (backend)
- [ ] Outro: _______________

**Pergunta adicional**: Qual é o domínio esperado?

- [ ] solv.com.br
- [ ] solv-gestao.com.br
- [ ] gestao.solv.com.br
- [ ] Outra: _______________

**Impacto**: Define deploy e webhooks (assinatura, CNDs, índices).

---

### 10. ✅ VOLUME E PERFORMANCE

**Pergunta**: Qual é o volume esperado?

- [ ] < 10 usuários
- [ ] 10-50 usuários
- [ ] 50-200 usuários
- [ ] > 200 usuários

**Questão adicional**: Quantas obras simultâneas?

- [ ] < 5
- [ ] 5-20
- [ ] 20-50
- [ ] > 50

**Questão adicional**: Editais por mês?

- [ ] < 5
- [ ] 5-20
- [ ] 20-100
- [ ] > 100

**Impacto**: Define indexes, caching strategy, rate limiting.

---

### 11. ✅ TESTES AUTOMATIZADOS

**Pergunta**: Vocês querem testes automatizados?

- [ ] Sim, teste completo (unit + integration + e2e)
- [ ] Sim, testes críticos (financeiro + RLS)
- [ ] Sim, testes simples
- [ ] Não, validation apenas
- [ ] Não definido

**Impacto**: Define tempo + créditos FASE 13 (Qualidade).

---

### 12. ✅ INTEGRAÇÕES FUTURAS

**Pergunta**: Há outras integrações planejadas?

- [ ] Não, apenas PNCP + índices + CNDs
- [ ] Integração com ERP (qual: _______)
- [ ] Integração com contabilidade
- [ ] Integração com BI/Dashboard externo
- [ ] Outra: _______________

**Impacto**: Afeta arquitetura APIs e webhooks.

---

### 13. ✅ COMPLIANCE E REGULAMENTAÇÕES

**Pergunta**: Há requisitos regulatórios específicos?

- [ ] LGPD (Proteção de dados)
- [ ] SOX (Se cotada na Bolsa)
- [ ] Certificação ISO (qual: _______)
- [ ] Conformidade com órgão público (qual: _______)
- [ ] Nenhum específico
- [ ] Não definido

**Impacto**: Define camada auditoria, mascaramento, retenção.

---

### 14. ✅ TIMELINE E ORÇAMENTO

**Pergunta**: Qual é a timeline esperada?

- [ ] Urgente (ASAP)
- [ ] 1-2 meses
- [ ] 3-6 meses
- [ ] 6-12 meses
- [ ] Sem pressa

**Pergunta adicional**: Há orçamento definido?

- [ ] Sim, créditos Lovable: ________
- [ ] Sim, valor: R$ ________
- [ ] Definir conforme escopo
- [ ] Não definido

**Impacto**: Define priorização de fases e recursos.

---

## QUESTÕES OPERACIONAIS (Menos críticas, podem ser respondidas depois)

### 15. BI e Dashboards
- Plataforma BI preferida (Metabase, Superset, Power BI)?
- Relatórios mais críticos?

### 16. Treinamento
- Quantos usuários precisam treinamento?
- Quer documentação passo a passo?

### 17. Suporte
- SLA esperado?
- Comunicação preferida (email, Slack, WhatsApp)?

---

## CHECKLIST DE APROVAÇÃO FASE 0

Antes de prosseguir para FASE 1, confirme:

- [ ] Leu FASE_0_AUDITORIA.md
- [ ] Leu ARQUITETURA_MAPA.md
- [ ] Concorda com 28 tabelas propostas
- [ ] Concorda com 82 funcionalidades
- [ ] Concorda com sequência de 13 fases
- [ ] Respondeu questões críticas (1-14)
- [ ] Aprovou estimativa 175h / 2090 créditos
- [ ] Aprovou princípios (Preservação, Fonte Única, Versionamento, Segurança, Precisão)
- [ ] Aprovou risco de regressão (será mitigado com testes)
- [ ] Aprovou timeline

---

## PRÓXIMAS AÇÕES

✅ **Você faz agora:**
1. Ler documentos de auditoria
2. Responder questões críticas
3. Confirmar checklist

✅ **Eu faço depois:**
1. Receber suas respostas
2. Ajustar arquitetura se necessário
3. Iniciar FASE 1 (Fundação)

---

**Aguardando sua confirmação e respostas!**

Responda de forma estruturada:

```
QUESTÃO 1: Supabase
[ ] Sim, Project ID: xxxxxxx

QUESTÃO 2: Assinatura
[ ] ZapSign, já contratado

QUESTÃO 3: FGV
[ ] Não têm credencial, aceita IBGE + BCB

... e assim por diante
```

---

**Elaborado por**: GitHub Copilot  
**Modelo**: Claude Haiku 4.5  
**Data**: 2026-06-07  
**Status**: Aguardando respostas
