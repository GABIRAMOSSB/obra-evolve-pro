## Módulo Governança e Compliance — Central de Certidões

Vou implementar um módulo completo de compliance documental para a Solv Construtora, em **modo sandbox** desde o início, sem quebrar nenhuma funcionalidade existente do aplicativo (assinaturas, obras, NF-e, etc).

> **Importante sobre arquitetura:** Este projeto roda em **TanStack Start** (não Next.js). A diretriz padrão da stack é usar **server functions (`createServerFn`)** para lógica de backend em vez de Supabase Edge Functions. Vou seguir esse padrão (que é o correto para o projeto), mas mantendo exatamente a separação de responsabilidades que você descreveu (adapter, update, update-all, scheduled, upload, health-check). O token da InfoSimples ficará só nos Secrets do backend, lido via `process.env` dentro do handler — nunca exposto ao frontend. Se preferir Edge Functions Supabase mesmo assim, me avise antes de eu começar.

---

### 1. Banco de dados (migration única)

Reutilizo a tabela `companies` existente (já tem Solv cadastrada via `company_members`). Adiciono colunas que faltam (`cnpj`, `legal_name`, `trade_name`, `city`, `state`, `address`, etc) sem quebrar nada.

Novas tabelas (todas com RLS, escopadas por `company_id` + `has_role`):
- `certificate_types` — catálogo extensível
- `company_certificates` — estado atual (1 por empresa+tipo)
- `certificate_versions` — histórico imutável com hash
- `certificate_checks` — log de cada tentativa
- `integration_settings` — sandbox/produção, sem token
- `notification_rules` — regras de alerta
- `compliance_alerts` — alertas gerados (prefixo para não colidir)
- `compliance_audit_logs` — trilha de auditoria
- `user_roles` + enum `app_role` (`admin`, `compliance_manager`, `viewer`) + função `has_role` — padrão Lovable

Seeds: 9 certidões iniciais no catálogo + linhas em `company_certificates` para Solv + regras de notificação padrão (30/15/7/1/0).

Bucket privado **`company-certificates`** com policies por `company_id`.

### 2. Server functions (substituem as edge functions)

Em `src/lib/compliance/`:
- `infosimples-adapter.server.ts` — wrapper isolado, lê `INFOSIMPLES_TOKEN` de `process.env` dentro do handler, retorno normalizado, suporta sandbox com payloads simulados realistas
- `compliance.functions.ts` expõe:
  - `updateCertificate` — atualiza uma certidão
  - `updateAllCertificates` — atualiza todas as automáticas
  - `uploadManualCertificate` — recebe PDF, valida MIME/tamanho, calcula hash, evita duplicata
  - `getSignedCertificateUrl` — URL assinada temporária
  - `runComplianceHealthCheck` — verifica config sem revelar token
  - `clearSandboxData` — limpa dados simulados (só com sandbox=true)
  - `requestProductionActivation` — registra solicitação, NÃO ativa
- Rota pública `src/routes/api.public.compliance-scheduled.ts` para o cron diário 06:00 BRT (registrado via `pg_cron`, mas só executando em modo sandbox até produção ser liberada manualmente)

### 3. Frontend (qualidade Figma sênior)

Item de menu novo no `AppSidebar` agrupado como **Governança e Compliance** com submenu (Visão Geral, Central de Certidões, Histórico, Alertas, Logs, Configurações).

Rotas em `src/routes/_app.compliance.*.tsx`:
- `_app.compliance.tsx` — layout pai com badge sandbox fixo
- `_app.compliance.index.tsx` — **Visão Geral**: KPIs, barra de saúde documental, próximos vencimentos, atividade recente
- `_app.compliance.certidoes.tsx` — **Central**: tabela premium + toggle cards, filtros, drawer lateral de detalhes com timeline
- `_app.compliance.historico.tsx` — versões com hash e comparação
- `_app.compliance.alertas.tsx` — agrupado por gravidade
- `_app.compliance.logs.tsx` — checks e auditoria
- `_app.compliance.configuracoes.tsx` — admin: integração, frequência, alertas, catálogo

Componentes reutilizáveis em `src/components/compliance/`: `StatusBadge`, `CertificateRow`, `CertificateDrawer`, `ManualUploadDialog`, `SandboxBanner`, `HealthBar`.

Tokens de cor seguem o sistema atual (`primary`, `success`, `warning`, `destructive`, `measure`, `muted`) — mesmo padrão da página de Atividades que já normalizamos. Tipografia, espaçamento 8px, cartões discretos, sem gradientes artificiais.

### 4. Segurança

- RLS em todas as tabelas com `has_role` (security definer, padrão Lovable)
- Bucket privado, downloads só via URL assinada
- Validação de permissão também dentro de cada server function
- `INFOSIMPLES_TOKEN` só nos Secrets; só leio dentro do `.handler()`
- Sandbox como default; ativação de produção exige confirmação dupla + role admin
- Auditoria em uploads, downloads, atualizações, mudança de config, ativação

### 5. Modo sandbox

- Banner discreto no topo do módulo
- Adapter retorna payloads simulados realistas (Solv: CND válida, FGTS vencendo, Municipal manual, etc)
- Botão "Limpar dados simulados" visível só em sandbox
- Cron não chama API externa enquanto sandbox=true

### 6. O que NÃO vou fazer

- Não alterar/quebrar nada existente (assinaturas ZapSign, obras, NF-e, etc)
- Não criar mock dizendo "API conectada" sem token
- Não colocar token no frontend nem em `VITE_*`
- Não ativar produção automaticamente
- Não usar URLs reais da InfoSimples (deixo `provider_service_key` configurável + comentário onde mapear)

### Entrega

Ao final apresento: tabelas criadas, server functions criadas, onde cadastrar `INFOSIMPLES_TOKEN`, confirmação de sandbox ativo, e checklist de validações executadas.

---

**Escopo é grande (≈ 15-20 arquivos novos + 1 migration robusta).** Posso começar pela migration + estrutura básica e ir construindo as telas em sequência. Confirma para eu seguir?
