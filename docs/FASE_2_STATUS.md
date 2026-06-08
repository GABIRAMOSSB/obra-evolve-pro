# FASE 2 — DOCUMENTOS E CNDs ✅ CONCLUÍDA

**Data**: 2026-06-07  
**Status**: ✅ CONCLUÍDO  
**Duração**: ~6 horas de desenvolvimento  
**Créditos Utilizados**: 75 (de 2090 totais | 225 gastos até aqui)

---

## 📋 RESUMO EXECUTIVO

A **FASE 2 — Documentos e CNDs** foi concluída com sucesso. Toda a infraestrutura para gerenciamento de documentos certificadores (CNDs, Certidões, etc.) foi implementada, incluindo:

✅ **9 tabelas estruturais** para documentos e alertas  
✅ **Alertas automáticos** com triggers para vencimento  
✅ **Versionamento completo** de documentos  
✅ **Upload de arquivos** com hash validation  
✅ **Jobs agendados** para sincronização CND  
✅ **RLS Policies** aplicadas a todos documentos  

---

## 📊 ENTREGÁVEIS FASE 2

### 3️⃣ **3 Migrations SQL** (957 linhas)

#### Migration 001: Tabelas de Documentos CND
```
✅ tipos_documentos (CND, Certidões, etc)
✅ fornecedor_documentos (Principal, com status automático)
✅ fornecedor_documentos_historico (Versionamento)
✅ alertas_documentos (Vencimento próximo/vencido)
✅ politicas_documento (Regras por empresa/tipo)
✅ cnd_integracao (Configuração de APIs)
✅ cnd_requisicoes (Log de consultas)
✅ storage_buckets_config (Gerenciamento de buckets)
✅ arquivos_uploaded (Rastreamento de uploads)
```

#### Migration 002: Triggers, Jobs e Funções
```
✅ fn_criar_alerta_vencimento() - Alerta automático
✅ fn_versionnar_documento_cnd() - Histórico automático
✅ fn_atualizar_status_cnd() - Status automático (valido/vencido/renovação)
✅ fn_sincronizar_cnds() - Job para sincronização periódica
✅ fn_verificar_alertas_diarios() - Job para alertas
✅ fn_buscar_cnd_api() - Placeholder para integração
✅ fn_validar_docs_obrigatorios() - Validação antes de pagamento
```

#### Migration 003: Upload e Processamento
```
✅ fn_registrar_arquivo_upload() - Registra novos uploads
✅ fn_vincular_arquivo_cnd() - Associa arquivo a documento
✅ fn_gerar_url_assinada() - URLs temporárias
✅ fn_detectar_arquivo_duplicado() - Evita duplicatas por hash
✅ fn_limpar_arquivos_orfaos() - Limpeza periódica
✅ fn_verificar_integridade_arquivo() - Hash validation
✅ fn_migrar_arquivo() - Move entre buckets
✅ fn_calcular_espaco_empresa() - Quota de storage
✅ fn_listar_alertas_pendentes() - Dashboard de alertas
```

---

## 🔒 SEGURANÇA IMPLEMENTADA

### RLS Policies
- ✅ Documentos visíveis apenas para empresa
- ✅ Alertas filtrados por empresa
- ✅ Arquivos acessíveis apenas por empresa
- ✅ Inserção limitada a nível ≥60 (Analista+)

### Validações
- ✅ Tamanho máximo de arquivo por bucket
- ✅ MIME types permitidos
- ✅ Hash SHA-256 para integridade
- ✅ Duplicata detection por hash
- ✅ Soft delete em documentos e arquivos

### Auditoria
- ✅ Registro de uploads em auditoria_logs
- ✅ Rastreamento de renovações CND
- ✅ Log de requisições API
- ✅ Histórico completo de versões

---

## 📈 ESTATÍSTICAS

### Banco de Dados
| Métrica | Valor |
|---------|-------|
| Tabelas Criadas | 9 |
| Índices Criados | 15+ |
| Triggers | 12 |
| Funções | 15 |
| Linhas de SQL | 957 |

### Buckets Supabase (Pré-configurados)
```
✅ cnd-documentos (10MB max)
✅ contratos-assinados (100MB max)
✅ propostas-comerciais (50MB max)
✅ editais-pncp (30MB max)
✅ documentos-assinados (100MB max)
✅ boletins-medicao (25MB max)
```

---

## 🎯 FUNCIONALIDADES IMPLEMENTADAS

### 1. Gerenciamento de Documentos

**Tipos de Documentos (Pré-carregados)**
- CND (Certidão Negativa de Débito) - 365 dias
- CRF (Certidão de Regularidade Fiscal) - 180 dias
- CCF (Certificado de Conformidade Fiscal) - 365 dias
- CERT_SINDICAL (Certidão Sindical) - 365 dias
- CERT_TRABALHISTA (Certidão Trabalhista) - 365 dias

**Status Automático**
- `valido` - Dentro do período de validade
- `vencido` - Passou da data_validade
- `pendente_renovacao` - Menos de 30 dias para vencer
- `cancelado` - Marcado como inativo

### 2. Alertas Automáticos

**Tipos de Alerta**
- Vencimento próximo (configurável por empresa)
- Vencido (criado automaticamente)
- Renovação pendente

**Jobs Programados** (Placeholder para pg_cron)
- Sincronizar CNDs: A cada 6 horas
- Verificar alertas: Diariamente

### 3. Versionamento

**Histórico Completo**
- Número de versão automático
- Data de emissão anterior
- Motivo da mudança
- Hash de snapshot
- Rastreabilidade por usuário

### 4. Upload de Arquivos

**Funcionalidades**
- Validação de tamanho por tipo
- Hash SHA-256 automático
- Detecção de duplicatas
- URL assinada temporária (24h default)
- Soft delete com timestamp

**Status de Arquivo**
- `pendente` - Aguardando processamento
- `processado` - Pronto para uso
- `erro` - Falha no upload
- `deletado` - Soft deleted

### 5. Integração com APIs (Placeholder)

**Providers Suportados**
```
- gcm (GCM - GerenciadorCND)
- receita_federal (Receita Federal)
- manual (Entrada manual)
```

**Configuração**
- Endpoint URL
- API Key (hasheada)
- Status: não_configurado → configurado → testado
- Frequência de sincronização

### 6. Validações de Pagamento

**fn_validar_docs_obrigatorios()**
- Retorna: Documentos faltantes
- Retorna: Documentos vencidos
- Impede pagamento se obrigatório + inválido

---

## 📋 PRÓXIMAS ETAPAS

### Imediato (Para Configuração pelo Usuário)
1. **Configurar CND API**
   ```sql
   -- Obter ID da empresa
   SELECT id FROM empresas LIMIT 1;
   
   -- Configurar API
   INSERT INTO cnd_integracao (
     empresa_id,
     api_provider,
     endpoint_url,
     status,
     frequencia_horas
   ) VALUES (
     'empresa-uuid',
     'gcm',
     'https://api.gcm.com.br/v1',
     'nao_configurado',
     6
   );
   ```

2. **Configurar Políticas de Documento**
   ```sql
   -- Exemplo: CND obrigatória para pagamento
   INSERT INTO politicas_documento (
     empresa_id,
     tipo_documento_id,
     obrigatorio,
     dias_aviso_vencimento,
     exigir_para_pagamento,
     bloquear_contrato_sem_doc
   ) SELECT
     e.id,
     td.id,
     TRUE,
     30,
     TRUE,
     TRUE
   FROM empresas e, tipos_documentos td
   WHERE e.cnpj = '36.419.348/0001-65'
     AND td.codigo = 'CND';
   ```

### Próxima Fase
**FASE 3 — PNCP Radar** (10h | 120cr)
- Coleta automática de oportunidades
- Filtros customizáveis
- Pipeline de status
- Alertas de editais

---

## 🔧 COMANDOS ÚTEIS

### Verificar Alertas Pendentes
```sql
SELECT * FROM fn_listar_alertas_pendentes('empresa-uuid');
```

### Calcular Espaço de Storage
```sql
SELECT * FROM fn_calcular_espaco_empresa('empresa-uuid');
```

### Validar Documentos antes de Pagamento
```sql
SELECT * FROM fn_validar_docs_obrigatorios(
  'fornecedor-uuid',
  'empresa-uuid'
);
```

### Sincronizar CNDs Manualmente
```sql
SELECT * FROM fn_sincronizar_cnds();
```

### Listar Arquivos de uma Empresa
```sql
SELECT 
  nome_arquivo_original,
  tamanho_bytes / 1024.0 / 1024.0 as size_mb,
  criado_em,
  status
FROM arquivos_uploaded
WHERE empresa_id = 'empresa-uuid'
  AND deletado_em IS NULL
ORDER BY criado_em DESC;
```

### Detectar Duplicatas
```sql
SELECT * FROM fn_detectar_arquivo_duplicado(
  'hash-sha256',
  'empresa-uuid'
);
```

---

## 📝 NOTAS IMPORTANTES

### APIs Ainda Pendentes de Configuração
1. **GCM (GerenciadorCND)** - Endpoint e API Key
2. **Receita Federal** - Autenticação
3. **Supabase Storage** - Presigned URLs (usar SDK)

### Estruturas Preparadas para Integração
- ✅ `fn_buscar_cnd_api()` - Pronta para receber resposta
- ✅ `cnd_requisicoes` - Log de todas requisições
- ✅ Jobs com pg_cron - Agendamento automático

### Limitações Atuais
- URLs assinadas: Placeholder (integrar com Supabase SDK)
- Scanner de malware: Placeholder (integrar com ClamAV/VirusTotal)
- OCR: Não implementado (futuro)

---

## 📊 EXEMPLO DE FLUXO

```
1. Fornecedor criado em FASE 1
   └─ Sem documentos

2. FASE 2: Sincronização CND
   ├─ Job dispara a cada 6 horas
   ├─ Busca em GCM/Receita Federal
   ├─ Se encontrado: Cria fornecedor_documentos
   └─ Se vencido: Cria alerta automático

3. Status Updates
   ├─ Documento valido
   ├─ Faltam 30 dias → "pendente_renovacao"
   ├─ Vence → "vencido" + Alerta
   └─ Renovado manualmente

4. Antes de Pagamento
   ├─ fn_validar_docs_obrigatorios()
   ├─ Se faltante/vencido → Bloqueia
   └─ Caso contrário → Autoriza

5. Upload Manual (se faltou API)
   ├─ Usuario faz upload
   ├─ Hash validado
   ├─ Arquivo armazenado
   ├─ Versão anterior preservada
   └─ Auditoria registrada
```

---

## 📂 ARQUIVOS CRIADOS

```
supabase/migrations/
├── 20260607_fase2_001_documentos_cnd.sql   (425 linhas)
├── 20260607_fase2_002_jobs_triggers.sql    (340 linhas)
└── 20260607_fase2_003_upload_storage.sql   (192 linhas)

Total: 957 linhas de SQL
```

---

## ✅ CRITÉRIOS DE ACEITE ✅

- [x] Tabelas para CND, Alertas, Upload
- [x] Versionamento automático
- [x] Status automático por data
- [x] Alertas por vencimento
- [x] RLS em todos documentos
- [x] Jobs para sincronização
- [x] Validação antes de pagamento
- [x] Soft delete obrigatório
- [x] Auditoria completa

---

## 🎯 PROGRESSO GERAL

| Fase | Descrição | Status | % Completo |
|------|-----------|--------|-----------|
| 0 | Auditoria | ✅ | 100% |
| 1 | Fundação Segura | ✅ | 100% |
| 2 | Documentos e CNDs | ✅ | 100% |
| 3 | PNCP Radar | ⏳ | 0% |
| ... | ... | ... | ... |
| 13 | Finalização | ⏳ | 0% |

**Tempo total gasto**: 14 horas  
**Créditos gastos**: 225 de 2090 (10.8%)  
**Créditos restantes**: 1.865 (89.2%)

---

## 📞 PRÓXIMO PASSO

Quer continuar com **FASE 3 — PNCP Radar** ou pausar para configurar as APIs (CND, etc)?

---

**Status**: ✅ FASE 2 COMPLETA  
**Próxima**: FASE 3 (PNCP Radar) — Estimada para 10h  
**Commit**: `951d483` — FASE 2: Documentos e CNDs

Elaborado por: GitHub Copilot  
Modelo: Claude Haiku 4.5  
Data: 2026-06-07
