
-- 1) Extensões e colunas novas em insumos_mestre
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.insumos_mestre
  ADD COLUMN IF NOT EXISTS codigo_interno text,
  ADD COLUMN IF NOT EXISTS descricao_completa text,
  ADD COLUMN IF NOT EXISTS especificacao_tecnica text,
  ADD COLUMN IF NOT EXISTS versao_sinapi text,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

-- 2) Índices de performance
CREATE INDEX IF NOT EXISTS idx_insumos_company ON public.insumos_mestre(company_id);
CREATE INDEX IF NOT EXISTS idx_insumos_sinapi_codigo ON public.insumos_mestre(company_id, sinapi_codigo);
CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON public.insumos_mestre(company_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_insumos_ncm ON public.insumos_mestre(company_id, ncm);
CREATE INDEX IF NOT EXISTS idx_insumos_descricao_trgm ON public.insumos_mestre USING gin (descricao gin_trgm_ops);

-- 3) Tabela de histórico de importações
CREATE TABLE IF NOT EXISTS public.historico_importacoes_sinapi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  arquivo text,
  versao_sinapi text,
  usuario_id uuid,
  data_importacao timestamptz NOT NULL DEFAULT now(),
  total_registros integer NOT NULL DEFAULT 0,
  novos_registros integer NOT NULL DEFAULT 0,
  registros_atualizados integer NOT NULL DEFAULT 0,
  registros_ignorados integer NOT NULL DEFAULT 0,
  registros_com_erro integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'concluido',
  detalhes jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_importacoes_sinapi TO authenticated;
GRANT ALL ON public.historico_importacoes_sinapi TO service_role;

ALTER TABLE public.historico_importacoes_sinapi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view historico" ON public.historico_importacoes_sinapi
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins insert historico" ON public.historico_importacoes_sinapi
  FOR INSERT WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE POLICY "Admins delete historico" ON public.historico_importacoes_sinapi
  FOR DELETE USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE INDEX IF NOT EXISTS idx_historico_company_data
  ON public.historico_importacoes_sinapi(company_id, data_importacao DESC);

-- 4) Categorização automática por palavras-chave
CREATE OR REPLACE FUNCTION public.categorizar_descricao(_desc text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text := upper(coalesce(_desc, ''));
BEGIN
  IF d ~ '(PVC|TUBO|REGISTRO|JOELHO|ADAPTADOR|TORNEIRA|HIDR[ÁA]ULIC|ENCANAMENTO|CONEX[ÃA]O|V[ÁA]LVULA|FLANGE|MANGUEIRA|CAIXA D''[ÁA]GUA)' THEN
    RETURN 'Hidráulica';
  ELSIF d ~ '(CABO|FIO|DISJUNTOR|ELETRODUT|L[ÂA]MPADA|LUMIN[ÁA]RIA|TOMADA|INTERRUPTOR|QUADRO EL|EL[ÉE]TRIC|CONDU[ÍI]TE|REATOR|DR)' THEN
    RETURN 'Elétrica';
  ELSIF d ~ '(VERGALH[ÃA]O|ARAME|TELA|A[ÇC]O|FERRO CA|CA-?50|CA-?60|ARMADURA)' THEN
    RETURN 'Aço';
  ELSIF d ~ '(CIMENTO|ARGAMASSA|GRAUTE|ADITIVO|CONCRETO|CAL HIDR|GESSO)' THEN
    RETURN 'Concreto e Argamassa';
  ELSIF d ~ '(MANTA|SELANTE|IMPERMEABIL|ASF[ÁA]LTIC|VEDA[ÇC][ÃA]O)' THEN
    RETURN 'Impermeabilização';
  ELSIF d ~ '(TINTA|VERNIZ|ESMALTE|SELADOR|PINTURA|TEXTURA|MASSA CORRIDA|MASSA ACR[ÍI]LICA)' THEN
    RETURN 'Pintura';
  ELSIF d ~ '(TELHA|CUMEEIRA|RUFO|CALHA|COBERTURA|FORRO)' THEN
    RETURN 'Cobertura';
  ELSIF d ~ '(AREIA|BRITA|PEDRISCO|RACHA|SAIBRO|AGREGADO)' THEN
    RETURN 'Agregados';
  ELSIF d ~ '(MADEIRA|TABUA|T[ÁA]BUA|SARRAFO|CAIBRO|COMPENSADO|FORMA)' THEN
    RETURN 'Madeira/Forma';
  ELSIF d ~ '(PREGO|PARAFUSO|BUCHA|CHUMBADOR|REBITE|ARRUELA|PORCA)' THEN
    RETURN 'Fixadores';
  ELSIF d ~ '(CAPACETE|LUVA|BOTINA|[ÓO]CULOS|PROTETOR|M[ÁA]SCARA|CINTO|EPI)' THEN
    RETURN 'EPIs';
  ELSIF d ~ '(PISO|PORCELANATO|CER[ÂA]MIC|REVESTIMENTO|REJUNTE|RODAP[ÉE])' THEN
    RETURN 'Acabamentos';
  ELSE
    RETURN 'Outros';
  END IF;
END
$$;

-- 5) RPC: busca paginada de insumos
CREATE OR REPLACE FUNCTION public.search_insumos(
  _company uuid,
  _q text DEFAULT NULL,
  _categoria uuid DEFAULT NULL,
  _unidade uuid DEFAULT NULL,
  _ncm text DEFAULT NULL,
  _page integer DEFAULT 1,
  _page_size integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  codigo text,
  sinapi_codigo text,
  descricao text,
  categoria_id uuid,
  categoria_nome text,
  unidade_id uuid,
  unidade_sigla text,
  ncm text,
  imagem_url text,
  versao_sinapi text,
  normas_tecnicas text,
  especificacao_tecnica text,
  ativo boolean,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      i.id, i.codigo, i.sinapi_codigo, i.descricao,
      i.categoria_id, c.nome AS categoria_nome,
      i.unidade_id, u.sigla AS unidade_sigla,
      i.ncm, i.imagem_url, i.versao_sinapi,
      i.normas_tecnicas, i.especificacao_tecnica,
      i.ativo, i.updated_at
    FROM public.insumos_mestre i
    LEFT JOIN public.insumo_categorias c ON c.id = i.categoria_id
    LEFT JOIN public.unidades_medida u ON u.id = i.unidade_id
    WHERE i.company_id = _company
      AND public.is_company_member(auth.uid(), _company)
      AND (
        _q IS NULL OR _q = '' OR
        i.descricao ILIKE '%' || _q || '%' OR
        i.sinapi_codigo = _q OR
        i.codigo = _q OR
        i.sinapi_codigo ILIKE _q || '%'
      )
      AND (_categoria IS NULL OR i.categoria_id = _categoria)
      AND (_unidade IS NULL OR i.unidade_id = _unidade)
      AND (_ncm IS NULL OR _ncm = '' OR i.ncm = _ncm)
  )
  SELECT b.*, COUNT(*) OVER() AS total_count
  FROM base b
  ORDER BY b.descricao
  LIMIT GREATEST(_page_size, 1)
  OFFSET GREATEST((_page - 1) * _page_size, 0)
$$;

-- 6) RPC: importação em lote (UPSERT por sinapi_codigo)
CREATE OR REPLACE FUNCTION public.import_sinapi_batch(
  _company uuid,
  _versao text,
  _rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row jsonb;
  _cat_id uuid;
  _uni_id uuid;
  _cat_nome text;
  _sigla text;
  _novos integer := 0;
  _atualizados integer := 0;
  _ignorados integer := 0;
  _erros integer := 0;
  _was_insert boolean;
BEGIN
  IF NOT public.has_company_role(auth.uid(), _company, 'admin'::company_role) THEN
    RAISE EXCEPTION 'forbidden_admin_only';
  END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    BEGIN
      IF coalesce(_row->>'sinapi_codigo','') = '' OR coalesce(_row->>'descricao','') = '' THEN
        _ignorados := _ignorados + 1;
        CONTINUE;
      END IF;

      -- Garante categoria
      _cat_nome := coalesce(nullif(trim(_row->>'categoria'), ''), public.categorizar_descricao(_row->>'descricao'));
      SELECT id INTO _cat_id FROM public.insumo_categorias
        WHERE company_id = _company AND nome = _cat_nome AND parent_id IS NULL LIMIT 1;
      IF _cat_id IS NULL THEN
        INSERT INTO public.insumo_categorias(company_id, nome, ordem)
          VALUES (_company, _cat_nome, 999)
          RETURNING id INTO _cat_id;
      END IF;

      -- Garante unidade
      _sigla := upper(coalesce(nullif(trim(_row->>'unidade'), ''), 'UN'));
      SELECT id INTO _uni_id FROM public.unidades_medida
        WHERE company_id = _company AND sigla = _sigla LIMIT 1;
      IF _uni_id IS NULL THEN
        INSERT INTO public.unidades_medida(company_id, sigla, descricao)
          VALUES (_company, _sigla, _sigla)
          RETURNING id INTO _uni_id;
      END IF;

      INSERT INTO public.insumos_mestre (
        company_id, sinapi_codigo, codigo, descricao,
        categoria_id, unidade_id, ncm, normas_tecnicas,
        especificacao_tecnica, imagem_url, versao_sinapi,
        created_by, updated_by
      ) VALUES (
        _company,
        _row->>'sinapi_codigo',
        coalesce(_row->>'sinapi_codigo', _row->>'codigo'),
        _row->>'descricao',
        _cat_id,
        _uni_id,
        nullif(_row->>'ncm',''),
        nullif(_row->>'normas_tecnicas',''),
        nullif(_row->>'especificacao_tecnica',''),
        nullif(_row->>'imagem_url',''),
        _versao,
        auth.uid(),
        auth.uid()
      )
      ON CONFLICT (company_id, sinapi_codigo) DO UPDATE SET
        descricao = EXCLUDED.descricao,
        unidade_id = EXCLUDED.unidade_id,
        ncm = coalesce(EXCLUDED.ncm, public.insumos_mestre.ncm),
        normas_tecnicas = coalesce(EXCLUDED.normas_tecnicas, public.insumos_mestre.normas_tecnicas),
        especificacao_tecnica = coalesce(EXCLUDED.especificacao_tecnica, public.insumos_mestre.especificacao_tecnica),
        imagem_url = coalesce(EXCLUDED.imagem_url, public.insumos_mestre.imagem_url),
        versao_sinapi = EXCLUDED.versao_sinapi,
        updated_by = auth.uid(),
        updated_at = now()
      RETURNING (xmax = 0) INTO _was_insert;

      IF _was_insert THEN
        _novos := _novos + 1;
      ELSE
        _atualizados := _atualizados + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      _erros := _erros + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'novos', _novos,
    'atualizados', _atualizados,
    'ignorados', _ignorados,
    'erros', _erros
  );
END
$$;

-- 7) Índice único necessário para o ON CONFLICT acima
CREATE UNIQUE INDEX IF NOT EXISTS idx_insumos_company_sinapi_uq
  ON public.insumos_mestre(company_id, sinapi_codigo)
  WHERE sinapi_codigo IS NOT NULL;

-- 8) Políticas no bucket de imagens SINAPI
-- (o bucket sinapi-imagens já existe; garante leitura pública e write para membros editor/admin)
DO $$ BEGIN
  PERFORM 1 FROM storage.buckets WHERE id = 'sinapi-imagens';
  IF NOT FOUND THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('sinapi-imagens', 'sinapi-imagens', true);
  ELSE
    UPDATE storage.buckets SET public = true WHERE id = 'sinapi-imagens';
  END IF;
END $$;

DROP POLICY IF EXISTS "SINAPI images are publicly readable" ON storage.objects;
CREATE POLICY "SINAPI images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sinapi-imagens');

DROP POLICY IF EXISTS "Authenticated upload SINAPI images" ON storage.objects;
CREATE POLICY "Authenticated upload SINAPI images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sinapi-imagens');

DROP POLICY IF EXISTS "Authenticated update SINAPI images" ON storage.objects;
CREATE POLICY "Authenticated update SINAPI images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'sinapi-imagens');

DROP POLICY IF EXISTS "Authenticated delete SINAPI images" ON storage.objects;
CREATE POLICY "Authenticated delete SINAPI images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sinapi-imagens');
