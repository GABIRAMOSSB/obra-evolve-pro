DROP POLICY IF EXISTS biblioteca_delete ON public.biblioteca_documentos;
CREATE POLICY biblioteca_delete ON public.biblioteca_documentos
  FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin'::text, 'editor'::text]));