
-- Fase F: workflow de aprovação do BM
ALTER TABLE public.medicoes DROP CONSTRAINT IF EXISTS medicoes_status_check;
ALTER TABLE public.medicoes ADD CONSTRAINT medicoes_status_check
  CHECK (status = ANY (ARRAY['rascunho','enviada','em_conferencia','revisao_solicitada','aprovada','paga','rejeitada']));

-- Colunas auxiliares para trilha do workflow
ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS enviada_em timestamptz,
  ADD COLUMN IF NOT EXISTS enviada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejeitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS rejeitada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text;
