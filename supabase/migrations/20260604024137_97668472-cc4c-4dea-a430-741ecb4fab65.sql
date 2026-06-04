
CREATE POLICY "Members read company-certificates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'company-certificates'
  AND public.is_company_member((string_to_array(name, '/'))[2]::uuid)
);

CREATE POLICY "Admin/editor upload company-certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-certificates'
  AND public.has_company_role((string_to_array(name, '/'))[2]::uuid, ARRAY['admin','editor'])
);

CREATE POLICY "Admin/editor update company-certificates"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-certificates'
  AND public.has_company_role((string_to_array(name, '/'))[2]::uuid, ARRAY['admin','editor'])
);

CREATE POLICY "Admin/editor delete company-certificates"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-certificates'
  AND public.has_company_role((string_to_array(name, '/'))[2]::uuid, ARRAY['admin','editor'])
);
