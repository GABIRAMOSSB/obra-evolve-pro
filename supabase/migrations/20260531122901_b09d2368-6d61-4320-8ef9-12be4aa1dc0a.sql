
-- ============================================================
-- Diário: apontamento estruturado de Mão de Obra e Equipamentos
-- ============================================================

-- 1) Cadastro de Equipamentos (próprios/locados) com custo/hora
CREATE TABLE IF NOT EXISTS public.equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  tipo text DEFAULT 'proprio',         -- 'proprio' | 'locado'
  custo_hora numeric NOT NULL DEFAULT 0,
  custo_hora_extra numeric,             -- opcional; se null usa custo_hora * 1.5
  unidade text DEFAULT 'H',
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos TO authenticated;
GRANT ALL ON public.equipamentos TO service_role;

ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view equipamentos" ON public.equipamentos
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert equipamentos" ON public.equipamentos
  FOR INSERT WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin') OR public.has_company_role(auth.uid(), company_id, 'editor'));
CREATE POLICY "Editors update equipamentos" ON public.equipamentos
  FOR UPDATE USING (public.has_company_role(auth.uid(), company_id, 'admin') OR public.has_company_role(auth.uid(), company_id, 'editor'));
CREATE POLICY "Admins delete equipamentos" ON public.equipamentos
  FOR DELETE USING (public.has_company_role(auth.uid(), company_id, 'admin'));

CREATE INDEX IF NOT EXISTS idx_equipamentos_company ON public.equipamentos(company_id);

-- 2) Estender apontamentos_mao_obra para refletir diário + equipamentos
-- Reusamos a tabela existente; recurso_tipo distingue MO vs Equipamento.
ALTER TABLE public.apontamentos_mao_obra
  ADD COLUMN IF NOT EXISTS diary_entry_id text,
  ADD COLUMN IF NOT EXISTS recurso_tipo text NOT NULL DEFAULT 'mao_obra',
  ADD COLUMN IF NOT EXISTS recurso_nome text,
  ADD COLUMN IF NOT EXISTS equipamento_id uuid,
  ADD COLUMN IF NOT EXISTS quantidade_pessoas integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS jornada_horas numeric NOT NULL DEFAULT 8;

CREATE INDEX IF NOT EXISTS idx_apont_mo_diary ON public.apontamentos_mao_obra(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_apont_mo_obra ON public.apontamentos_mao_obra(obra_id);
