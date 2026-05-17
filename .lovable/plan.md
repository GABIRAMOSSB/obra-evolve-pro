## Objetivo

Hoje as obras, evoluções e diários ficam salvos só no navegador (localStorage), por isso não aparecem no celular. Vou migrar tudo para a nuvem, protegido por login, para você acessar as mesmas obras em qualquer dispositivo.

## O que será feito

1. **Login**
   - Criar tela de login/cadastro com **e-mail/senha** e **Google**.
   - Toda a área do app fica protegida; sem login, redireciona para `/login`.
   - Botão "Sair" no topo.

2. **Banco de dados na nuvem** (tabelas privadas por usuário, com RLS):
   - `obras` — nome, arquivo, info da obra, data de importação.
   - `budget_rows` — linhas da planilha orçamentária de cada obra.
   - `evolutions` — execuções por item.
   - `diaries` — entradas do diário (com as fotos em JSON, já que as URLs vivem no bucket).
   - O bucket `obra-fotos` continua sendo usado; as fotos já estão na nuvem.

3. **Sincronização**
   - Ao logar, o app carrega as obras do usuário do banco.
   - Criar/editar/excluir obra, importar planilha, registrar evolução e diário passam a gravar direto no Supabase.
   - Mostrar indicador "Salvando..." discreto no header.

4. **Migração automática dos dados locais**
   - Na primeira vez que você logar num dispositivo que tem dados antigos no `localStorage`, o app envia as obras locais para a nuvem (associadas à sua conta) e marca como migradas para não duplicar.

## Detalhes técnicos

- Auth via Lovable Cloud (e-mail/senha + Google gerenciado).
- Rotas: `/login` pública; `/` dentro de layout `_authenticated` com `beforeLoad` redirecionando.
- Listener `onAuthStateChange` no root para invalidar cache ao trocar de sessão.
- Acesso ao banco via cliente browser do Supabase (RLS escopa por `auth.uid()`); nada de service role no frontend.
- Estrutura de salvamento: ao invés de `saveWorkspace` salvar tudo num blob, debounce de ~500ms persistindo só o que mudou (obra ativa, evoluções alteradas, diário criado/editado/removido).
- `storage.ts` antigo vira utilitário só de leitura do localStorage para a rotina de migração.

## Fora do escopo

- Compartilhamento de obras entre usuários (cada conta vê só as suas).
- Histórico/versionamento.
- Edição offline com sync posterior (vai exigir internet para salvar).
