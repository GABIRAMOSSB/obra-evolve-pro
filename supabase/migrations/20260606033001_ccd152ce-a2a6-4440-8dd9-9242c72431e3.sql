
create extension if not exists vector;

create table if not exists public.edital_chunks (
  id uuid primary key default gen_random_uuid(),
  edital_id uuid not null references public.editais(id) on delete cascade,
  documento_id uuid not null references public.edital_documentos(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  pagina integer,
  chunk_index integer not null,
  conteudo text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.edital_chunks to authenticated;
grant all on public.edital_chunks to service_role;

alter table public.edital_chunks enable row level security;

create policy "edital_chunks_select_members" on public.edital_chunks for select to authenticated
  using (exists (select 1 from public.company_members cm where cm.company_id = edital_chunks.company_id and cm.user_id = auth.uid()));
create policy "edital_chunks_insert_members" on public.edital_chunks for insert to authenticated
  with check (exists (select 1 from public.company_members cm where cm.company_id = edital_chunks.company_id and cm.user_id = auth.uid()));
create policy "edital_chunks_update_members" on public.edital_chunks for update to authenticated
  using (exists (select 1 from public.company_members cm where cm.company_id = edital_chunks.company_id and cm.user_id = auth.uid()))
  with check (exists (select 1 from public.company_members cm where cm.company_id = edital_chunks.company_id and cm.user_id = auth.uid()));
create policy "edital_chunks_delete_members" on public.edital_chunks for delete to authenticated
  using (exists (select 1 from public.company_members cm where cm.company_id = edital_chunks.company_id and cm.user_id = auth.uid()));

create index if not exists idx_edital_chunks_edital on public.edital_chunks(edital_id);
create index if not exists idx_edital_chunks_documento on public.edital_chunks(documento_id);
create index if not exists idx_edital_chunks_company on public.edital_chunks(company_id);
create index if not exists idx_edital_chunks_embedding on public.edital_chunks using hnsw (embedding vector_cosine_ops);

create or replace function public.match_edital_chunks(
  p_edital_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 8
)
returns table (
  id uuid,
  documento_id uuid,
  pagina integer,
  chunk_index integer,
  conteudo text,
  similarity float
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.documento_id,
    c.pagina,
    c.chunk_index,
    c.conteudo,
    1 - (c.embedding <=> p_query_embedding) as similarity
  from public.edital_chunks c
  where c.edital_id = p_edital_id
    and c.embedding is not null
  order by c.embedding <=> p_query_embedding
  limit p_match_count;
$$;
