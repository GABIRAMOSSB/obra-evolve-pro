-- 1) Enum tipo
DO $$ BEGIN
  CREATE TYPE public.centro_custo_tipo AS ENUM (
    'administracao','mao_obra','materiais','equipamentos','terceiros','indiretos','outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Tabela
CREATE TABLE IF NOT EXISTS public.centros_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  parent_id uuid REFERENCES public.centros_custo(id) ON DELETE CASCADE,
  codigo text,
  nome text NOT NULL,
  descricao text,
  tipo public.centro_custo_tipo NOT NULL DEFAULT 'outros',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS centros_custo_company_codigo_uq
  ON public.centros_custo(company_id, codigo) WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS centros_custo_company_parent_idx
  ON public.centros_custo(company_id, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo TO authenticated;
GRANT ALL ON public.centros_custo TO service_role;

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view centros_custo" ON public.centros_custo
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert centros_custo" ON public.centros_custo
  FOR INSERT WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
                      OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Editors update centros_custo" ON public.centros_custo
  FOR UPDATE USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
                 OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role));
CREATE POLICY "Admins delete centros_custo" ON public.centros_custo
  FOR DELETE USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE TRIGGER tg_centros_custo_updated_at
  BEFORE UPDATE ON public.centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) FKs nas tabelas de lançamento
ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id);
ALTER TABLE public.apontamentos_mao_obra
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id);
ALTER TABLE public.nfe_item_apropriacoes
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id);
ALTER TABLE public.composicoes_proprias
  ADD COLUMN IF NOT EXISTS centro_custo_id uuid REFERENCES public.centros_custo(id);

CREATE INDEX IF NOT EXISTS estoque_mov_centro_idx
  ON public.estoque_movimentos(company_id, centro_custo_id);
CREATE INDEX IF NOT EXISTS apont_mo_centro_idx
  ON public.apontamentos_mao_obra(company_id, centro_custo_id);
CREATE INDEX IF NOT EXISTS nfe_aprop_centro_idx
  ON public.nfe_item_apropriacoes(company_id, centro_custo_id);

-- 4) Função seed
CREATE OR REPLACE FUNCTION public.seed_centros_custo_base(_company uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _g uuid;
BEGIN
  -- Se chamado fora de trigger, valida membro
  IF auth.uid() IS NOT NULL AND NOT public.is_company_member(auth.uid(), _company) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Já tem? não duplica
  IF EXISTS (SELECT 1 FROM public.centros_custo WHERE company_id = _company) THEN
    RETURN;
  END IF;

  -- Administração da Obra
  INSERT INTO public.centros_custo (company_id, nome, tipo, ordem, codigo)
    VALUES (_company, 'Administração da Obra', 'administracao', 10, 'ADM') RETURNING id INTO _g;
  INSERT INTO public.centros_custo (company_id, parent_id, nome, tipo, ordem) VALUES
    (_company, _g, 'Engenheiro',      'administracao', 1),
    (_company, _g, 'Mestre de Obras', 'administracao', 2),
    (_company, _g, 'Encarregado',     'administracao', 3),
    (_company, _g, 'Administrativo',  'administracao', 4);

  -- Mão de Obra Direta
  INSERT INTO public.centros_custo (company_id, nome, tipo, ordem, codigo)
    VALUES (_company, 'Mão de Obra Direta', 'mao_obra', 20, 'MOD') RETURNING id INTO _g;
  INSERT INTO public.centros_custo (company_id, parent_id, nome, tipo, ordem) VALUES
    (_company, _g, 'Pedreiros',    'mao_obra', 1),
    (_company, _g, 'Serventes',    'mao_obra', 2),
    (_company, _g, 'Carpinteiros', 'mao_obra', 3),
    (_company, _g, 'Armadores',    'mao_obra', 4),
    (_company, _g, 'Soldadores',   'mao_obra', 5),
    (_company, _g, 'Pintores',     'mao_obra', 6);

  -- Materiais
  INSERT INTO public.centros_custo (company_id, nome, tipo, ordem, codigo)
    VALUES (_company, 'Materiais', 'materiais', 30, 'MAT') RETURNING id INTO _g;
  INSERT INTO public.centros_custo (company_id, parent_id, nome, tipo, ordem) VALUES
    (_company, _g, 'Concreto',     'materiais', 1),
    (_company, _g, 'Aço',          'materiais', 2),
    (_company, _g, 'Alvenaria',    'materiais', 3),
    (_company, _g, 'Cobertura',    'materiais', 4),
    (_company, _g, 'Esquadrias',   'materiais', 5),
    (_company, _g, 'Hidráulica',   'materiais', 6),
    (_company, _g, 'Elétrica',     'materiais', 7),
    (_company, _g, 'Acabamentos',  'materiais', 8);

  -- Equipamentos
  INSERT INTO public.centros_custo (company_id, nome, tipo, ordem, codigo)
    VALUES (_company, 'Equipamentos', 'equipamentos', 40, 'EQP') RETURNING id INTO _g;
  INSERT INTO public.centros_custo (company_id, parent_id, nome, tipo, ordem) VALUES
    (_company, _g, 'Escavadeira',  'equipamentos', 1),
    (_company, _g, 'Caminhão',     'equipamentos', 2),
    (_company, _g, 'Betoneira',    'equipamentos', 3),
    (_company, _g, 'Andaimes',     'equipamentos', 4),
    (_company, _g, 'Plataformas',  'equipamentos', 5);

  -- Terceiros
  INSERT INTO public.centros_custo (company_id, nome, tipo, ordem, codigo)
    VALUES (_company, 'Terceiros', 'terceiros', 50, 'TER') RETURNING id INTO _g;
  INSERT INTO public.centros_custo (company_id, parent_id, nome, tipo, ordem) VALUES
    (_company, _g, 'Fretes',          'terceiros', 1),
    (_company, _g, 'Locações',        'terceiros', 2),
    (_company, _g, 'Subempreiteiros', 'terceiros', 3),
    (_company, _g, 'Ensaios',         'terceiros', 4),
    (_company, _g, 'Topografia',      'terceiros', 5);

  -- Indiretos
  INSERT INTO public.centros_custo (company_id, nome, tipo, ordem, codigo)
    VALUES (_company, 'Custos Indiretos', 'indiretos', 60, 'IND') RETURNING id INTO _g;
  INSERT INTO public.centros_custo (company_id, parent_id, nome, tipo, ordem) VALUES
    (_company, _g, 'Alimentação',  'indiretos', 1),
    (_company, _g, 'Hospedagem',   'indiretos', 2),
    (_company, _g, 'Combustível',  'indiretos', 3),
    (_company, _g, 'EPI',          'indiretos', 4),
    (_company, _g, 'Uniformes',    'indiretos', 5),
    (_company, _g, 'Ferramentas',  'indiretos', 6),
    (_company, _g, 'Internet',     'indiretos', 7),
    (_company, _g, 'Energia',      'indiretos', 8),
    (_company, _g, 'Água',         'indiretos', 9);
END $$;

GRANT EXECUTE ON FUNCTION public.seed_centros_custo_base(uuid) TO authenticated;

-- 5) Trigger handle_new_user_company → também cria os centros padrão
CREATE OR REPLACE FUNCTION public.handle_new_user_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite public.company_invites%ROWTYPE;
  _new_company uuid;
BEGIN
  SELECT * INTO _invite FROM public.company_invites
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.company_members (company_id, user_id, role)
      VALUES (_invite.company_id, NEW.id, _invite.role);
    UPDATE public.company_invites SET accepted_at = now() WHERE id = _invite.id;
  ELSE
    INSERT INTO public.companies (name, owner_id) VALUES ('Minha Empresa', NEW.id) RETURNING id INTO _new_company;
    INSERT INTO public.company_members (company_id, user_id, role) VALUES (_new_company, NEW.id, 'admin');
    INSERT INTO public.company_workspaces (company_id) VALUES (_new_company);
    PERFORM public.seed_centros_custo_base(_new_company);
  END IF;
  RETURN NEW;
END $$;
