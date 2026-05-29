
-- 1. Funções de mão de obra
CREATE TABLE public.funcoes_mao_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  custo_hora_base numeric NOT NULL DEFAULT 0,
  encargos_percentual numeric NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes_mao_obra TO authenticated;
GRANT ALL ON public.funcoes_mao_obra TO service_role;
ALTER TABLE public.funcoes_mao_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view funcoes" ON public.funcoes_mao_obra FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert funcoes" ON public.funcoes_mao_obra FOR INSERT WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors update funcoes" ON public.funcoes_mao_obra FOR UPDATE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Admins delete funcoes" ON public.funcoes_mao_obra FOR DELETE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role));
CREATE INDEX idx_funcoes_company ON public.funcoes_mao_obra(company_id);

-- 2. Funcionários
CREATE TABLE public.funcionarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text NOT NULL,
  cpf text,
  matricula text,
  funcao_id uuid REFERENCES public.funcoes_mao_obra(id) ON DELETE SET NULL,
  salario_mensal numeric DEFAULT 0,
  custo_hora numeric DEFAULT 0,
  data_admissao date,
  data_demissao date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios TO authenticated;
GRANT ALL ON public.funcionarios TO service_role;
ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view funcionarios" ON public.funcionarios FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert funcionarios" ON public.funcionarios FOR INSERT WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors update funcionarios" ON public.funcionarios FOR UPDATE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Admins delete funcionarios" ON public.funcionarios FOR DELETE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role));
CREATE INDEX idx_funcionarios_company ON public.funcionarios(company_id);
CREATE INDEX idx_funcionarios_funcao ON public.funcionarios(funcao_id);

-- 3. Equipes
CREATE TABLE public.equipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  encarregado_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes TO authenticated;
GRANT ALL ON public.equipes TO service_role;
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view equipes" ON public.equipes FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert equipes" ON public.equipes FOR INSERT WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors update equipes" ON public.equipes FOR UPDATE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Admins delete equipes" ON public.equipes FOR DELETE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role));
CREATE INDEX idx_equipes_company ON public.equipes(company_id);

-- 4. Equipe Membros
CREATE TABLE public.equipe_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  equipe_id uuid NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipe_id, funcionario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipe_membros TO authenticated;
GRANT ALL ON public.equipe_membros TO service_role;
ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view equipe_membros" ON public.equipe_membros FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert equipe_membros" ON public.equipe_membros FOR INSERT WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors delete equipe_membros" ON public.equipe_membros FOR DELETE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE INDEX idx_equipe_membros_equipe ON public.equipe_membros(equipe_id);
CREATE INDEX idx_equipe_membros_func ON public.equipe_membros(funcionario_id);

-- 5. Apontamentos de mão de obra
CREATE TABLE public.apontamentos_mao_obra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  obra_id text NOT NULL,
  item_key text,
  item_codigo text,
  item_descricao text,
  funcionario_id uuid REFERENCES public.funcionarios(id) ON DELETE SET NULL,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE SET NULL,
  funcao_id uuid REFERENCES public.funcoes_mao_obra(id) ON DELETE SET NULL,
  data date NOT NULL,
  horas_normais numeric NOT NULL DEFAULT 0,
  horas_extras numeric NOT NULL DEFAULT 0,
  custo_hora numeric NOT NULL DEFAULT 0,
  custo_total numeric NOT NULL DEFAULT 0,
  quantidade_executada numeric DEFAULT 0,
  unidade text,
  observacoes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apontamentos_mao_obra TO authenticated;
GRANT ALL ON public.apontamentos_mao_obra TO service_role;
ALTER TABLE public.apontamentos_mao_obra ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view apontamentos" ON public.apontamentos_mao_obra FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert apontamentos" ON public.apontamentos_mao_obra FOR INSERT WITH CHECK (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors update apontamentos" ON public.apontamentos_mao_obra FOR UPDATE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors delete apontamentos" ON public.apontamentos_mao_obra FOR DELETE USING (has_company_role(auth.uid(), company_id, 'admin'::company_role) OR has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE INDEX idx_apont_company ON public.apontamentos_mao_obra(company_id);
CREATE INDEX idx_apont_obra ON public.apontamentos_mao_obra(company_id, obra_id);
CREATE INDEX idx_apont_data ON public.apontamentos_mao_obra(data);
CREATE INDEX idx_apont_func ON public.apontamentos_mao_obra(funcionario_id);

-- Triggers updated_at
CREATE TRIGGER trg_funcoes_upd BEFORE UPDATE ON public.funcoes_mao_obra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_funcionarios_upd BEFORE UPDATE ON public.funcionarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_equipes_upd BEFORE UPDATE ON public.equipes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_apont_upd BEFORE UPDATE ON public.apontamentos_mao_obra FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função para popular funções base
CREATE OR REPLACE FUNCTION public.seed_funcoes_base(_company uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_company_member(auth.uid(), _company) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO funcoes_mao_obra (company_id, nome, custo_hora_base, encargos_percentual) VALUES
    (_company, 'Engenheiro Civil', 120.00, 80),
    (_company, 'Mestre de Obras', 45.00, 80),
    (_company, 'Encarregado', 35.00, 80),
    (_company, 'Pedreiro', 25.00, 80),
    (_company, 'Servente', 15.00, 80),
    (_company, 'Carpinteiro', 28.00, 80),
    (_company, 'Armador', 28.00, 80),
    (_company, 'Eletricista', 32.00, 80),
    (_company, 'Encanador', 30.00, 80),
    (_company, 'Pintor', 25.00, 80),
    (_company, 'Soldador', 35.00, 80),
    (_company, 'Operador de Máquina', 38.00, 80),
    (_company, 'Motorista', 22.00, 80),
    (_company, 'Vigia', 13.00, 80),
    (_company, 'Auxiliar Administrativo', 18.00, 80)
  ON CONFLICT DO NOTHING;
END $$;
