-- Bucket privado para documentos das obras
insert into storage.buckets (id, name, public)
values ('obra-documentos', 'obra-documentos', false)
on conflict (id) do nothing;

-- Estrutura de path: <company_id>/<obra_id>/<pasta>/<arquivo>
-- Membros da empresa podem ler/enviar; só admins podem excluir.

create policy "Membros podem ver documentos da empresa"
on storage.objects for select
to authenticated
using (
  bucket_id = 'obra-documentos'
  and public.is_company_member(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "Membros podem enviar documentos da empresa"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'obra-documentos'
  and public.is_company_member(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "Membros podem atualizar documentos da empresa"
on storage.objects for update
to authenticated
using (
  bucket_id = 'obra-documentos'
  and public.is_company_member(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid
  )
);

create policy "Admins podem excluir documentos da empresa"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'obra-documentos'
  and public.has_company_role(
    auth.uid(),
    ((storage.foldername(name))[1])::uuid,
    'admin'::public.company_role
  )
);
