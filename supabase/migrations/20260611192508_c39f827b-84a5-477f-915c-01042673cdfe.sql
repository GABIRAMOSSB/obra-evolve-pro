
-- 1) contrato_eventos: allow admins/editors of the company to delete events
DROP POLICY IF EXISTS "Editors can delete contrato_eventos" ON public.contrato_eventos;
CREATE POLICY "Editors can delete contrato_eventos"
  ON public.contrato_eventos
  FOR DELETE
  TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin')
    OR public.has_company_role(auth.uid(), company_id, 'editor')
  );

-- 2) sinapi-imagens bucket: restrict writes to admin/editor company members
DROP POLICY IF EXISTS "Authenticated upload SINAPI images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update SINAPI images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete SINAPI images" ON storage.objects;

CREATE POLICY "Editors can upload SINAPI images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sinapi-imagens'
    AND EXISTS (
      SELECT 1 FROM public.company_members
      WHERE user_id = auth.uid()
        AND role IN ('admin','editor')
    )
  );

CREATE POLICY "Editors can update SINAPI images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'sinapi-imagens'
    AND EXISTS (
      SELECT 1 FROM public.company_members
      WHERE user_id = auth.uid()
        AND role IN ('admin','editor')
    )
  );

CREATE POLICY "Editors can delete SINAPI images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sinapi-imagens'
    AND EXISTS (
      SELECT 1 FROM public.company_members
      WHERE user_id = auth.uid()
        AND role IN ('admin','editor')
    )
  );
