
ALTER TABLE public.notas_fiscais
  ADD COLUMN IF NOT EXISTS manifestacao_tipo text
    CHECK (manifestacao_tipo IS NULL OR manifestacao_tipo IN ('ciencia','confirmacao','desconhecimento','nao_realizada')),
  ADD COLUMN IF NOT EXISTS manifestacao_data timestamptz,
  ADD COLUMN IF NOT EXISTS manifestacao_justificativa text,
  ADD COLUMN IF NOT EXISTS manifestacao_por uuid;

CREATE INDEX IF NOT EXISTS idx_nf_manifestacao_tipo
  ON public.notas_fiscais (company_id, manifestacao_tipo);
