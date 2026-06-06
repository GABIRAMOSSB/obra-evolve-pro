
-- Responsáveis técnicos
CREATE TABLE public.responsaveis_tecnicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  email text,
  telefone text,
  formacao text,
  conselho text,
  numero_registro text,
  uf_registro text,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis_tecnicos TO authenticated;
GRANT ALL ON public.responsaveis_tecnicos TO service_role;
ALTER TABLE public.responsaveis_tecnicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rt_select" ON public.responsaveis_tecnicos FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "rt_modify" ON public.responsaveis_tecnicos FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Atestados
CREATE TABLE public.atestados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES public.responsaveis_tecnicos(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  contratante_nome text,
  contratante_cnpj text,
  objeto text,
  valor numeric,
  data_emissao date,
  periodo_inicio date,
  periodo_fim date,
  observacoes text,
  storage_path text,
  nome_arquivo text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atestados TO authenticated;
GRANT ALL ON public.atestados TO service_role;
ALTER TABLE public.atestados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atest_select" ON public.atestados FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "atest_modify" ON public.atestados FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- CATs
CREATE TABLE public.cats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES public.responsaveis_tecnicos(id) ON DELETE SET NULL,
  atestado_id uuid REFERENCES public.atestados(id) ON DELETE SET NULL,
  numero_cat text NOT NULL,
  conselho text,
  uf text,
  data_emissao date,
  atividades text,
  observacoes text,
  storage_path text,
  nome_arquivo text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cats TO authenticated;
GRANT ALL ON public.cats TO service_role;
ALTER TABLE public.cats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cats_select" ON public.cats FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "cats_modify" ON public.cats FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- ARTs
CREATE TABLE public.arts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES public.responsaveis_tecnicos(id) ON DELETE SET NULL,
  numero_art text NOT NULL,
  conselho text,
  uf text,
  tipo text DEFAULT 'execucao',
  contratante text,
  objeto text,
  data_emissao date,
  data_inicio date,
  data_termino date,
  valor_contrato numeric,
  status text DEFAULT 'ativa',
  observacoes text,
  storage_path text,
  nome_arquivo text,
  tamanho_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.arts TO authenticated;
GRANT ALL ON public.arts TO service_role;
ALTER TABLE public.arts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arts_select" ON public.arts FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "arts_modify" ON public.arts FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_rt_updated BEFORE UPDATE ON public.responsaveis_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_atest_updated BEFORE UPDATE ON public.atestados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cats_updated BEFORE UPDATE ON public.cats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_arts_updated BEFORE UPDATE ON public.arts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
