
CREATE POLICY "editais_storage_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'editais'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "editais_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'editais'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "editais_storage_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'editais'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "editais_storage_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'editais'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
  )
);
