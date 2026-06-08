BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT e.extname
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE n.nspname = 'public'
      AND e.extname IN ('pg_trgm', 'vector')
      AND e.extrelocatable
  LOOP
    EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', r.extname);
  END LOOP;
END $$;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Company members can read signature realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Company members can write signature realtime" ON realtime.messages;

CREATE POLICY "Company members can read signature realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() ~ '^signature-(notifications|updates):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = split_part(realtime.topic(), ':', 2)
  )
);

CREATE POLICY "Company members can write signature realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension IN ('broadcast', 'presence')
  AND realtime.topic() ~ '^signature-(notifications|updates):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = split_part(realtime.topic(), ':', 2)
  )
);

UPDATE storage.buckets
SET public = false
WHERE id = 'obra-fotos';

DROP POLICY IF EXISTS "Public read obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public insert obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public update obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can insert obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can list obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Members can insert obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Members can list obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Company members can read obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Company editors can insert obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Company editors can update obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Company editors can delete obra-fotos" ON storage.objects;

CREATE POLICY "Company members can read obra-fotos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'obra-fotos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
  )
  AND EXISTS (
    SELECT 1 FROM public.obras o
    WHERE o.company_id::text = (storage.foldername(name))[1]
      AND (
        o.id::text = (storage.foldername(name))[2]
        OR o.legacy_obra_id = (storage.foldername(name))[2]
      )
  )
);

CREATE POLICY "Company editors can insert obra-fotos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'obra-fotos'
  AND auth.uid() = owner
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin', 'editor')
  )
  AND EXISTS (
    SELECT 1 FROM public.obras o
    WHERE o.company_id::text = (storage.foldername(name))[1]
      AND (
        o.id::text = (storage.foldername(name))[2]
        OR o.legacy_obra_id = (storage.foldername(name))[2]
      )
  )
);

CREATE POLICY "Company editors can update obra-fotos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'obra-fotos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin', 'editor')
  )
)
WITH CHECK (
  bucket_id = 'obra-fotos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin', 'editor')
  )
);

CREATE POLICY "Company editors can delete obra-fotos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'obra-fotos'
  AND EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.user_id = auth.uid()
      AND cm.company_id::text = (storage.foldername(name))[1]
      AND cm.role IN ('admin', 'editor')
  )
);

ALTER FUNCTION IF EXISTS public.categorizar_descricao(text) SET search_path = public, extensions;
ALTER FUNCTION IF EXISTS public.tg_set_updated_at() SET search_path = public;

ALTER FUNCTION IF EXISTS public.fn_criar_alerta_vencimento() SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_versionnar_documento_cnd() SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_atualizar_status_cnd() SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_sincronizar_cnds() SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_verificar_alertas_diarios() SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_buscar_cnd_api(varchar, varchar) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_validar_docs_obrigatorios(uuid, uuid) SET search_path = public;

ALTER FUNCTION IF EXISTS public.fn_registrar_arquivo_upload(uuid, varchar, varchar, varchar, varchar, int, varchar, varchar, uuid) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_vincular_arquivo_cnd(uuid, uuid, varchar) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_gerar_url_assinada(uuid, int) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_detectar_arquivo_duplicado(varchar, uuid) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_limpar_arquivos_orfaos() SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_verificar_integridade_arquivo(uuid, varchar) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_migrar_arquivo(uuid, varchar, varchar) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_calcular_espaco_empresa(uuid) SET search_path = public;
ALTER FUNCTION IF EXISTS public.fn_listar_alertas_pendentes(uuid) SET search_path = public;

COMMIT;