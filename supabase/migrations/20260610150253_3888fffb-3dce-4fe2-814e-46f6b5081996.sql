
DROP POLICY IF EXISTS "Owners can update obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete obra-fotos" ON storage.objects;

CREATE POLICY "Editors can update obra-fotos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'obra-fotos'
    AND (
      has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::company_role)
      OR has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor'::company_role)
    )
  )
  WITH CHECK (
    bucket_id = 'obra-fotos'
    AND (
      has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::company_role)
      OR has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor'::company_role)
    )
  );

CREATE POLICY "Editors can delete obra-fotos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'obra-fotos'
    AND (
      has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::company_role)
      OR has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor'::company_role)
    )
  );

ALTER FUNCTION public.log_audit_event(
  uuid, text, text, text, text, jsonb, jsonb, text, text, text
) SET search_path = public;
