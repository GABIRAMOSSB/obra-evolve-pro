
ALTER TABLE public.insumos_mestre
  ADD COLUMN IF NOT EXISTS sinapi_codigo text,
  ADD COLUMN IF NOT EXISTS imagem_url text,
  ADD COLUMN IF NOT EXISTS normas_tecnicas text,
  ADD COLUMN IF NOT EXISTS informacoes_gerais text;

CREATE UNIQUE INDEX IF NOT EXISTS insumos_mestre_company_sinapi_uidx
  ON public.insumos_mestre (company_id, sinapi_codigo)
  WHERE sinapi_codigo IS NOT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('sinapi-imagens', 'sinapi-imagens', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read sinapi imagens" ON storage.objects;
CREATE POLICY "Public read sinapi imagens"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sinapi-imagens');

DROP POLICY IF EXISTS "Authenticated write sinapi imagens" ON storage.objects;
CREATE POLICY "Authenticated write sinapi imagens"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sinapi-imagens');
