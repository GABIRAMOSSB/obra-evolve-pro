-- Tighten storage policies on obra-fotos to require company membership.
-- New uploads will use the path "{companyId}/{obraId}/{file}" so the first
-- folder segment can be matched against company_members via is_company_member.

DROP POLICY IF EXISTS "Authenticated can insert obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list obra-fotos" ON storage.objects;

CREATE POLICY "Members can insert obra-fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'obra-fotos'
  AND auth.uid() = owner
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can list obra-fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'obra-fotos'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);