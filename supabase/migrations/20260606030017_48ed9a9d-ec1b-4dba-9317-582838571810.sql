
CREATE TABLE public.rdo_fotos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  legenda TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rdo_fotos_rdo_id ON public.rdo_fotos(rdo_id);
CREATE INDEX idx_rdo_fotos_company_id ON public.rdo_fotos(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_fotos TO authenticated;
GRANT ALL ON public.rdo_fotos TO service_role;

ALTER TABLE public.rdo_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view rdo_fotos"
  ON public.rdo_fotos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = rdo_fotos.company_id AND cm.user_id = auth.uid()
  ));

CREATE POLICY "Editors can insert rdo_fotos"
  ON public.rdo_fotos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = rdo_fotos.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin','editor')
  ));

CREATE POLICY "Editors can update own rdo_fotos"
  ON public.rdo_fotos FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = rdo_fotos.company_id
      AND cm.user_id = auth.uid()
      AND (cm.role = 'admin' OR (cm.role = 'editor' AND rdo_fotos.uploaded_by = auth.uid()))
  ));

CREATE POLICY "Editors can delete own rdo_fotos"
  ON public.rdo_fotos FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = rdo_fotos.company_id
      AND cm.user_id = auth.uid()
      AND (cm.role = 'admin' OR (cm.role = 'editor' AND rdo_fotos.uploaded_by = auth.uid()))
  ));

CREATE TRIGGER update_rdo_fotos_updated_at
  BEFORE UPDATE ON public.rdo_fotos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage policies: path = {company_id}/{rdo_id}/{filename}
CREATE POLICY "Members can view rdo-fotos storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'rdo-fotos'
    AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id::text = (storage.foldername(name))[1]
    )
  );

CREATE POLICY "Editors can upload rdo-fotos storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rdo-fotos'
    AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id::text = (storage.foldername(name))[1]
        AND cm.role IN ('admin','editor')
    )
  );

CREATE POLICY "Editors can delete rdo-fotos storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'rdo-fotos'
    AND EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.company_id::text = (storage.foldername(name))[1]
        AND cm.role IN ('admin','editor')
    )
  );
