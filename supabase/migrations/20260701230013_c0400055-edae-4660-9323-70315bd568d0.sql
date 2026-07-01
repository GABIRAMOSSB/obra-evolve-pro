
-- RLS policies for boletim-anexos storage bucket
-- Path convention: {company_id}/{medicao_id}/{filename}

CREATE POLICY "Members read boletim-anexos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'boletim-anexos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Editors write boletim-anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'boletim-anexos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin','editor')
  )
);

CREATE POLICY "Editors update boletim-anexos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'boletim-anexos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin','editor')
  )
)
WITH CHECK (
  bucket_id = 'boletim-anexos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin','editor')
  )
);

CREATE POLICY "Editors delete boletim-anexos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'boletim-anexos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin','editor')
  )
);
