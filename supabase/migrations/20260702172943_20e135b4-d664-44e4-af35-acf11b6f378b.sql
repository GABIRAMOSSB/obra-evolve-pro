
-- 1. Restrict signature_templates writes to admin/editor
DROP POLICY IF EXISTS "Members can insert templates for their company" ON public.signature_templates;
DROP POLICY IF EXISTS "Members can update templates of their company" ON public.signature_templates;
DROP POLICY IF EXISTS "Members can delete templates of their company" ON public.signature_templates;

CREATE POLICY "Admin/editor can insert templates"
ON public.signature_templates FOR INSERT TO authenticated
WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "Admin/editor can update templates"
ON public.signature_templates FOR UPDATE TO authenticated
USING (public.has_company_role(company_id, ARRAY['admin','editor']))
WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "Admin/editor can delete templates"
ON public.signature_templates FOR DELETE TO authenticated
USING (public.has_company_role(company_id, ARRAY['admin','editor']));

-- 2. Lock company-certificates storage policies to the documented path format:
--    'companies/{company_id}/certificates/...'
DROP POLICY IF EXISTS "Members read company-certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admin/editor upload company-certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admin/editor update company-certificates" ON storage.objects;
DROP POLICY IF EXISTS "Admin/editor delete company-certificates" ON storage.objects;

CREATE POLICY "Members read company-certificates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'company-certificates'
  AND (storage.foldername(name))[1] = 'companies'
  AND public.is_company_member(((storage.foldername(name))[2])::uuid)
);

CREATE POLICY "Admin/editor upload company-certificates"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'company-certificates'
  AND (storage.foldername(name))[1] = 'companies'
  AND public.has_company_role(((storage.foldername(name))[2])::uuid, ARRAY['admin','editor'])
);

CREATE POLICY "Admin/editor update company-certificates"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'company-certificates'
  AND (storage.foldername(name))[1] = 'companies'
  AND public.has_company_role(((storage.foldername(name))[2])::uuid, ARRAY['admin','editor'])
)
WITH CHECK (
  bucket_id = 'company-certificates'
  AND (storage.foldername(name))[1] = 'companies'
  AND public.has_company_role(((storage.foldername(name))[2])::uuid, ARRAY['admin','editor'])
);

CREATE POLICY "Admin/editor delete company-certificates"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'company-certificates'
  AND (storage.foldername(name))[1] = 'companies'
  AND public.has_company_role(((storage.foldername(name))[2])::uuid, ARRAY['admin','editor'])
);
