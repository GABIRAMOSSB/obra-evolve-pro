# Empresa/Equipe compartilhada

## Modelo de dados (novas tabelas)

- **companies** — `id`, `name`, `owner_id`, `created_at`
- **company_members** — `company_id` + `user_id` (PK composta), `role` (`admin` | `member`), `joined_at`
- **company_invites** — `id`, `company_id`, `email`, `role`, `token` (uuid único, vai no link), `invited_by`, `created_at`, `expires_at` (7 dias), `accepted_at`
- **company_workspaces** — `company_id` (PK), `workspace` (jsonb com obras/diários/fotos), `updated_at` — substitui o `user_workspaces` por dado compartilhado da empresa

Funções `security definer` para evitar recursão em RLS:
- `is_company_member(_user, _company)`
- `has_company_role(_user, _company, _role)`
- `current_user_company()` — retorna a única empresa do usuário (uma empresa por usuário)

## Regras de acesso (RLS)

- **companies**: membro vê; só admin atualiza nome; ninguém deleta direto (usar função).
- **company_members**: membros vêem a lista; só admin insere/remove/muda papel; usuário pode sair (deletar a si mesmo se não for o último admin).
- **company_invites**: admin gerencia (CRUD); convidado vê pelo token via função pública `accept_invite(token)`.
- **company_workspaces**: qualquer membro lê e escreve a workspace da empresa.

## Migração automática dos dados atuais

Migration faz, para cada linha em `user_workspaces`:
1. Cria `companies` com nome "Minha Empresa" e `owner_id = user_id`.
2. Insere `company_members` com role `admin`.
3. Copia `workspace` para `company_workspaces`.

Trigger em `auth.users` (novo cadastro):
- Se o e-mail tem convite pendente válido → entra como `member` na empresa que convidou (aceita automaticamente).
- Senão → cria uma nova empresa "Minha Empresa" e vira `admin`.

## Convite por e-mail

- Admin abre **Equipe** → digita e-mail + papel → app cria `company_invites` com token único.
- App mostra **link copiável** `/invite/<token>` e (se a infra de e-mail estiver ativa) envia automaticamente; senão o admin compartilha o link. Posso ativar envio automático depois.
- Rota `/invite/<token>`:
  - Logado e e-mail bate → aceita e entra na empresa.
  - Não logado → manda pro login/cadastro; depois do login aceita.

> Como cada usuário só pode estar em uma empresa, aceitar convite enquanto já é admin solo da própria empresa: pergunta se quer sair da atual e entrar na nova (ou recusar). Se a empresa antiga ficar sem membros, é removida.

## UI

- **Header**: mostra nome da empresa e link "Equipe".
- **Página Equipe** (`/equipe`):
  - Nome da empresa (admin pode editar).
  - Lista de membros com papel; admin pode promover/rebaixar/remover.
  - Lista de convites pendentes com botão "Copiar link" e "Cancelar".
  - Form de novo convite (e-mail + papel).
  - Botão "Sair da empresa" (não aparece se for último admin).
- **Obras**: sem mudança visual — só passa a vir da empresa, não do usuário.

## Código

- `src/lib/storage.ts`: usa `company_workspaces` em vez de `user_workspaces`; busca `company_id` via `current_user_company()` no carregamento.
- Novo `src/hooks/use-company.tsx` (carrega empresa, membros, papel do usuário).
- Novo `src/routes/_authenticated/equipe.tsx`.
- Nova rota pública `src/routes/invite.$token.tsx`.
- Migração da workspace local (banner já existente) continua funcionando — agora grava na empresa do usuário.

## Fora do escopo desta entrega

- Envio automático de e-mail (precisa configurar domínio de e-mail; faço como próximo passo se quiser).
- Múltiplas empresas por usuário (decidido: uma só).
- Permissões granulares por obra (todos os membros vêem todas as obras).

Confirmando, sigo com a migração SQL + código.