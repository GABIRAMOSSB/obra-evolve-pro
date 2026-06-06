
DROP POLICY IF EXISTS "Auth users insert audit logs" ON public.compliance_audit_logs;
DROP POLICY IF EXISTS "Members read audit logs" ON public.compliance_audit_logs;

CREATE POLICY "Members insert audit logs"
  ON public.compliance_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (company_id IS NOT NULL AND is_company_member(company_id));

CREATE POLICY "Members read audit logs"
  ON public.compliance_audit_logs
  FOR SELECT
  TO authenticated
  USING (company_id IS NOT NULL AND is_company_member(company_id));

DROP POLICY IF EXISTS "Authenticated read integration_settings" ON public.integration_settings;
REVOKE SELECT ON public.integration_settings FROM authenticated;

DROP POLICY IF EXISTS "Membros podem atualizar documentos da empresa" ON storage.objects;

CREATE POLICY "Admins e editores podem atualizar documentos da empresa"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'obra-documentos'
    AND (
      has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::company_role)
      OR has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor'::company_role)
    )
  )
  WITH CHECK (
    bucket_id = 'obra-documentos'
    AND (
      has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'admin'::company_role)
      OR has_company_role(auth.uid(), ((storage.foldername(name))[1])::uuid, 'editor'::company_role)
    )
  );

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;

CREATE POLICY "Authenticated can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);
