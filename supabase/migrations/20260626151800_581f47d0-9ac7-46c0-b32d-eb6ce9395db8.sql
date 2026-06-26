DROP POLICY IF EXISTS "Admin/editor update company-certificates" ON storage.objects;
CREATE POLICY "Admin/editor update company-certificates" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-certificates'
  AND has_company_role(((string_to_array(name, '/'))[2])::uuid, ARRAY['admin','editor'])
)
WITH CHECK (
  bucket_id = 'company-certificates'
  AND has_company_role(((string_to_array(name, '/'))[2])::uuid, ARRAY['admin','editor'])
);