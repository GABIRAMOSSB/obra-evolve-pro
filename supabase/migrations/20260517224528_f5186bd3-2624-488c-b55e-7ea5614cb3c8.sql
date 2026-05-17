
insert into storage.buckets (id, name, public)
values ('obra-fotos', 'obra-fotos', true)
on conflict (id) do nothing;

create policy "Public read obra-fotos"
on storage.objects for select
using (bucket_id = 'obra-fotos');

create policy "Public insert obra-fotos"
on storage.objects for insert
with check (bucket_id = 'obra-fotos');

create policy "Public update obra-fotos"
on storage.objects for update
using (bucket_id = 'obra-fotos');

create policy "Public delete obra-fotos"
on storage.objects for delete
using (bucket_id = 'obra-fotos');
