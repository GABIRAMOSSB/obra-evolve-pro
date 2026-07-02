-- Restrict audit_logs_v2 SELECT to admin/editor only (email PII exposure fix)
DROP POLICY IF EXISTS audit_logs_v2_select_member ON public.audit_logs_v2;
CREATE POLICY audit_logs_v2_select_admin_editor
  ON public.audit_logs_v2 FOR SELECT
  TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin'::text, 'editor'::text]));

-- Add admin-only UPDATE and DELETE policies on certificate_checks
CREATE POLICY "Admins update checks"
  ON public.certificate_checks FOR UPDATE
  TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin'::text]))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin'::text]));

CREATE POLICY "Admins delete checks"
  ON public.certificate_checks FOR DELETE
  TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin'::text]));