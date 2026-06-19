
DROP POLICY IF EXISTS "Public read sinapi imagens" ON storage.objects;

DROP POLICY IF EXISTS "Editors can upload SINAPI images" ON storage.objects;
DROP POLICY IF EXISTS "Editors can update SINAPI images" ON storage.objects;
DROP POLICY IF EXISTS "Editors can delete SINAPI images" ON storage.objects;

CREATE POLICY "Editors can upload SINAPI images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sinapi-imagens'
    AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::company_role, 'editor'::company_role])
        AND cm.company_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Editors can update SINAPI images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sinapi-imagens'
    AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::company_role, 'editor'::company_role])
        AND cm.company_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Editors can delete SINAPI images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'sinapi-imagens'
    AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role = ANY (ARRAY['admin'::company_role, 'editor'::company_role])
        AND cm.company_id::text = (storage.foldername(name))[1]
    )
  );
