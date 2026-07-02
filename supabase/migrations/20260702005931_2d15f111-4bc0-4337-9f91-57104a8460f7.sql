
-- Tighten write policies to admin/editor for editais and obra_atividades
-- editais
DROP POLICY IF EXISTS editais_insert_members ON public.editais;
DROP POLICY IF EXISTS editais_update_members ON public.editais;
DROP POLICY IF EXISTS editais_delete_members ON public.editais;
CREATE POLICY editais_insert_editors ON public.editais FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY editais_update_editors ON public.editais FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY editais_delete_editors ON public.editais FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']));

-- edital_checklist
DROP POLICY IF EXISTS edital_checklist_insert_members ON public.edital_checklist;
DROP POLICY IF EXISTS edital_checklist_update_members ON public.edital_checklist;
DROP POLICY IF EXISTS edital_checklist_delete_members ON public.edital_checklist;
CREATE POLICY edital_checklist_insert_editors ON public.edital_checklist FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY edital_checklist_update_editors ON public.edital_checklist FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY edital_checklist_delete_editors ON public.edital_checklist FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']));

-- edital_chunks
DROP POLICY IF EXISTS edital_chunks_insert_members ON public.edital_chunks;
DROP POLICY IF EXISTS edital_chunks_update_members ON public.edital_chunks;
DROP POLICY IF EXISTS edital_chunks_delete_members ON public.edital_chunks;
CREATE POLICY edital_chunks_insert_editors ON public.edital_chunks FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY edital_chunks_update_editors ON public.edital_chunks FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY edital_chunks_delete_editors ON public.edital_chunks FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']));

-- edital_documentos
DROP POLICY IF EXISTS edital_documentos_insert_members ON public.edital_documentos;
DROP POLICY IF EXISTS edital_documentos_update_members ON public.edital_documentos;
DROP POLICY IF EXISTS edital_documentos_delete_members ON public.edital_documentos;
CREATE POLICY edital_documentos_insert_editors ON public.edital_documentos FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY edital_documentos_update_editors ON public.edital_documentos FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY edital_documentos_delete_editors ON public.edital_documentos FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']));

-- obra_atividades
DROP POLICY IF EXISTS obra_atividades_insert ON public.obra_atividades;
DROP POLICY IF EXISTS obra_atividades_update ON public.obra_atividades;
DROP POLICY IF EXISTS obra_atividades_delete ON public.obra_atividades;
CREATE POLICY obra_atividades_insert_editors ON public.obra_atividades FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY obra_atividades_update_editors ON public.obra_atividades FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY obra_atividades_delete_editors ON public.obra_atividades FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']));
