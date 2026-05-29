
-- ============================================================
-- MÓDULO 1: Cadastro Mestre de Insumos + Unidades (SOLV)
-- ============================================================

-- Categorias de insumos (Concreto, Cimento, Agregados, Aço, etc.)
CREATE TABLE public.insumo_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  nome text NOT NULL,
  parent_id uuid REFERENCES public.insumo_categorias(id) ON DELETE SET NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, nome, parent_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumo_categorias TO authenticated;
GRANT ALL ON public.insumo_categorias TO service_role;

ALTER TABLE public.insumo_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view categorias"
  ON public.insumo_categorias FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert categorias"
  ON public.insumo_categorias FOR INSERT
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Editors update categorias"
  ON public.insumo_categorias FOR UPDATE
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Admins delete categorias"
  ON public.insumo_categorias FOR DELETE
  USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

-- Unidades de medida (UN, PÇ, KG, T, SC, M, M², M³, L)
CREATE TABLE public.unidades_medida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  sigla text NOT NULL,
  descricao text NOT NULL,
  -- Conversão para unidade base (ex.: SC 50KG -> 50 KG)
  unidade_base_id uuid REFERENCES public.unidades_medida(id) ON DELETE SET NULL,
  fator_conversao numeric(18,6) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, sigla)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unidades_medida TO authenticated;
GRANT ALL ON public.unidades_medida TO service_role;

ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view unidades"
  ON public.unidades_medida FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert unidades"
  ON public.unidades_medida FOR INSERT
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Editors update unidades"
  ON public.unidades_medida FOR UPDATE
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Admins delete unidades"
  ON public.unidades_medida FOR DELETE
  USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

-- Cadastro mestre de insumos
CREATE TABLE public.insumos_mestre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  codigo text,
  descricao text NOT NULL,
  categoria_id uuid REFERENCES public.insumo_categorias(id) ON DELETE SET NULL,
  unidade_id uuid REFERENCES public.unidades_medida(id) ON DELETE SET NULL,
  ncm text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, codigo)
);

CREATE INDEX idx_insumos_mestre_company ON public.insumos_mestre(company_id);
CREATE INDEX idx_insumos_mestre_categoria ON public.insumos_mestre(categoria_id);
CREATE INDEX idx_insumos_mestre_descricao ON public.insumos_mestre USING gin (to_tsvector('portuguese', descricao));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos_mestre TO authenticated;
GRANT ALL ON public.insumos_mestre TO service_role;

ALTER TABLE public.insumos_mestre ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view insumos"
  ON public.insumos_mestre FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert insumos"
  ON public.insumos_mestre FOR INSERT
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Editors update insumos"
  ON public.insumos_mestre FOR UPDATE
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Admins delete insumos"
  ON public.insumos_mestre FOR DELETE
  USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

-- Aliases (descrições alternativas vindas de XMLs e fornecedores)
CREATE TABLE public.insumo_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  insumo_id uuid NOT NULL REFERENCES public.insumos_mestre(id) ON DELETE CASCADE,
  descricao_alternativa text NOT NULL,
  fornecedor text,
  cnpj_fornecedor text,
  codigo_fornecedor text,
  origem text NOT NULL DEFAULT 'manual', -- manual | xml | import
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, descricao_alternativa, cnpj_fornecedor)
);

CREATE INDEX idx_insumo_aliases_insumo ON public.insumo_aliases(insumo_id);
CREATE INDEX idx_insumo_aliases_descricao ON public.insumo_aliases USING gin (to_tsvector('portuguese', descricao_alternativa));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumo_aliases TO authenticated;
GRANT ALL ON public.insumo_aliases TO service_role;

ALTER TABLE public.insumo_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view aliases"
  ON public.insumo_aliases FOR SELECT
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors insert aliases"
  ON public.insumo_aliases FOR INSERT
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Editors update aliases"
  ON public.insumo_aliases FOR UPDATE
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Editors delete aliases"
  ON public.insumo_aliases FOR DELETE
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

-- Triggers de updated_at
CREATE TRIGGER trg_insumo_categorias_updated BEFORE UPDATE ON public.insumo_categorias
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_unidades_medida_updated BEFORE UPDATE ON public.unidades_medida
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_insumos_mestre_updated BEFORE UPDATE ON public.insumos_mestre
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função para popular base inicial de unidades + categorias + insumos para uma empresa
CREATE OR REPLACE FUNCTION public.seed_insumos_base(_company uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kg uuid; _un uuid; _pc uuid; _m uuid; _m2 uuid; _m3 uuid;
  _sc uuid; _l uuid; _t uuid; _br uuid; _pct uuid; _h uuid;
  _cat_cimento uuid; _cat_agregados uuid; _cat_aco uuid; _cat_madeira uuid;
  _cat_eletrica uuid; _cat_hidraulica uuid; _cat_pintura uuid; _cat_epi uuid;
  _cat_cobertura uuid; _cat_fixadores uuid; _cat_ferramentas uuid;
BEGIN
  IF NOT public.is_company_member(auth.uid(), _company) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Unidades base
  INSERT INTO unidades_medida (company_id, sigla, descricao) VALUES
    (_company, 'UN', 'Unidade'),
    (_company, 'PÇ', 'Peça'),
    (_company, 'KG', 'Quilograma'),
    (_company, 'T',  'Tonelada'),
    (_company, 'SC', 'Saco'),
    (_company, 'M',  'Metro linear'),
    (_company, 'M²', 'Metro quadrado'),
    (_company, 'M³', 'Metro cúbico'),
    (_company, 'L',  'Litro'),
    (_company, 'BR', 'Barra'),
    (_company, 'PCT','Pacote'),
    (_company, 'H',  'Hora')
  ON CONFLICT DO NOTHING;

  SELECT id INTO _kg FROM unidades_medida WHERE company_id=_company AND sigla='KG';
  SELECT id INTO _un FROM unidades_medida WHERE company_id=_company AND sigla='UN';
  SELECT id INTO _pc FROM unidades_medida WHERE company_id=_company AND sigla='PÇ';
  SELECT id INTO _m  FROM unidades_medida WHERE company_id=_company AND sigla='M';
  SELECT id INTO _m2 FROM unidades_medida WHERE company_id=_company AND sigla='M²';
  SELECT id INTO _m3 FROM unidades_medida WHERE company_id=_company AND sigla='M³';
  SELECT id INTO _sc FROM unidades_medida WHERE company_id=_company AND sigla='SC';
  SELECT id INTO _l  FROM unidades_medida WHERE company_id=_company AND sigla='L';
  SELECT id INTO _t  FROM unidades_medida WHERE company_id=_company AND sigla='T';
  SELECT id INTO _br FROM unidades_medida WHERE company_id=_company AND sigla='BR';
  SELECT id INTO _pct FROM unidades_medida WHERE company_id=_company AND sigla='PCT';
  SELECT id INTO _h  FROM unidades_medida WHERE company_id=_company AND sigla='H';

  -- Conversões padrão (SC -> 50KG, T -> 1000KG)
  UPDATE unidades_medida SET unidade_base_id=_kg, fator_conversao=50 WHERE id=_sc AND fator_conversao=1;
  UPDATE unidades_medida SET unidade_base_id=_kg, fator_conversao=1000 WHERE id=_t AND fator_conversao=1;

  -- Categorias raiz
  INSERT INTO insumo_categorias (company_id, nome, ordem) VALUES
    (_company,'Cimento',1),(_company,'Agregados',2),(_company,'Aço',3),
    (_company,'Madeira/Forma',4),(_company,'Cobertura',5),(_company,'Fixadores',6),
    (_company,'Elétrica',7),(_company,'Hidráulica',8),(_company,'Esgoto',9),
    (_company,'Drenagem',10),(_company,'PPCI',11),(_company,'Pintura',12),
    (_company,'Acabamentos',13),(_company,'Ferramentas',14),(_company,'Equipamentos',15),
    (_company,'EPIs',16),(_company,'Locações',17),(_company,'Serviços',18),
    (_company,'Concreto',19),(_company,'Estrutura Metálica',20)
  ON CONFLICT DO NOTHING;

  SELECT id INTO _cat_cimento     FROM insumo_categorias WHERE company_id=_company AND nome='Cimento' AND parent_id IS NULL;
  SELECT id INTO _cat_agregados   FROM insumo_categorias WHERE company_id=_company AND nome='Agregados' AND parent_id IS NULL;
  SELECT id INTO _cat_aco         FROM insumo_categorias WHERE company_id=_company AND nome='Aço' AND parent_id IS NULL;
  SELECT id INTO _cat_madeira     FROM insumo_categorias WHERE company_id=_company AND nome='Madeira/Forma' AND parent_id IS NULL;
  SELECT id INTO _cat_cobertura   FROM insumo_categorias WHERE company_id=_company AND nome='Cobertura' AND parent_id IS NULL;
  SELECT id INTO _cat_fixadores   FROM insumo_categorias WHERE company_id=_company AND nome='Fixadores' AND parent_id IS NULL;
  SELECT id INTO _cat_eletrica    FROM insumo_categorias WHERE company_id=_company AND nome='Elétrica' AND parent_id IS NULL;
  SELECT id INTO _cat_hidraulica  FROM insumo_categorias WHERE company_id=_company AND nome='Hidráulica' AND parent_id IS NULL;
  SELECT id INTO _cat_pintura     FROM insumo_categorias WHERE company_id=_company AND nome='Pintura' AND parent_id IS NULL;
  SELECT id INTO _cat_epi         FROM insumo_categorias WHERE company_id=_company AND nome='EPIs' AND parent_id IS NULL;
  SELECT id INTO _cat_ferramentas FROM insumo_categorias WHERE company_id=_company AND nome='Ferramentas' AND parent_id IS NULL;

  -- Insumos base populares
  INSERT INTO insumos_mestre (company_id, codigo, descricao, categoria_id, unidade_id) VALUES
    -- Cimento
    (_company,'CIM-001','CIMENTO CP II - SACO 50 KG',_cat_cimento,_sc),
    (_company,'CIM-002','CIMENTO CP IV - SACO 50 KG',_cat_cimento,_sc),
    (_company,'CIM-003','CIMENTO CP V ARI - SACO 50 KG',_cat_cimento,_sc),
    (_company,'CIM-004','CAL HIDRATADA - SACO 20 KG',_cat_cimento,_sc),
    -- Agregados
    (_company,'AGR-001','AREIA MÉDIA LAVADA - M³',_cat_agregados,_m3),
    (_company,'AGR-002','AREIA FINA LAVADA - M³',_cat_agregados,_m3),
    (_company,'AGR-003','AREIA GROSSA - M³',_cat_agregados,_m3),
    (_company,'AGR-004','BRITA Nº 0 - M³',_cat_agregados,_m3),
    (_company,'AGR-005','BRITA Nº 1 - M³',_cat_agregados,_m3),
    (_company,'AGR-006','BRITA Nº 2 - M³',_cat_agregados,_m3),
    (_company,'AGR-007','PEDRISCO - M³',_cat_agregados,_m3),
    (_company,'AGR-008','PÓ DE BRITA - M³',_cat_agregados,_m3),
    -- Aço
    (_company,'ACO-001','FERRO CA50 6,3 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-002','FERRO CA50 8,0 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-003','FERRO CA50 10 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-004','FERRO CA50 12,5 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-005','FERRO CA60 4,2 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-006','FERRO CA60 5,0 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-007','TELA SOLDADA Q-92 - M²',_cat_aco,_m2),
    (_company,'ACO-008','ARAME RECOZIDO 18 - KG',_cat_aco,_kg),
    -- Madeira/Forma
    (_company,'MAD-001','TÁBUA PINUS 2,5x30 CM - M',_cat_madeira,_m),
    (_company,'MAD-002','SARRAFO PINUS 2,5x10 CM - M',_cat_madeira,_m),
    (_company,'MAD-003','CAIBRO PINUS 5x6 CM - M',_cat_madeira,_m),
    (_company,'MAD-004','COMPENSADO PLASTIFICADO 18MM - M²',_cat_madeira,_m2),
    -- Cobertura
    (_company,'COB-001','TELHA ALUZINCO 0,50 MM - M²',_cat_cobertura,_m2),
    (_company,'COB-002','TELHA FIBROCIMENTO 6MM - M²',_cat_cobertura,_m2),
    (_company,'COB-003','TELHA CERÂMICA PORTUGUESA - UN',_cat_cobertura,_un),
    -- Fixadores
    (_company,'FIX-001','PREGO 18x27 - KG',_cat_fixadores,_kg),
    (_company,'FIX-002','PREGO 17x21 - KG',_cat_fixadores,_kg),
    (_company,'FIX-003','PARAFUSO AUTOBROCANTE 4,2x32 - UN',_cat_fixadores,_un),
    (_company,'FIX-004','BUCHA NYLON S8 - UN',_cat_fixadores,_un),
    -- Elétrica
    (_company,'ELE-001','ELETRODUTO PVC 3/4" - M',_cat_eletrica,_m),
    (_company,'ELE-002','CABO FLEXÍVEL 2,5MM² - M',_cat_eletrica,_m),
    (_company,'ELE-003','CABO FLEXÍVEL 4MM² - M',_cat_eletrica,_m),
    (_company,'ELE-004','DISJUNTOR MONOPOLAR 16A - UN',_cat_eletrica,_un),
    (_company,'ELE-005','TOMADA 2P+T 10A - UN',_cat_eletrica,_un),
    -- Hidráulica
    (_company,'HID-001','TUBO PVC SOLDÁVEL 25MM - M',_cat_hidraulica,_m),
    (_company,'HID-002','TUBO PVC SOLDÁVEL 32MM - M',_cat_hidraulica,_m),
    (_company,'HID-003','JOELHO PVC SOLDÁVEL 25MM - UN',_cat_hidraulica,_un),
    (_company,'HID-004','REGISTRO ESFERA 25MM - UN',_cat_hidraulica,_un),
    -- Pintura
    (_company,'PIN-001','TINTA ACRÍLICA FOSCA - LATA 18L',_cat_pintura,_un),
    (_company,'PIN-002','SELADOR ACRÍLICO - LATA 18L',_cat_pintura,_un),
    (_company,'PIN-003','MASSA CORRIDA PVA - BALDE 25KG',_cat_pintura,_un),
    -- EPIs
    (_company,'EPI-001','CAPACETE DE SEGURANÇA - UN',_cat_epi,_un),
    (_company,'EPI-002','LUVA NITRÍLICA - PAR',_cat_epi,_un),
    (_company,'EPI-003','BOTINA DE SEGURANÇA - PAR',_cat_epi,_un),
    (_company,'EPI-004','ÓCULOS DE PROTEÇÃO - UN',_cat_epi,_un),
    -- Ferramentas
    (_company,'FER-001','COLHER DE PEDREIRO - UN',_cat_ferramentas,_un),
    (_company,'FER-002','DESEMPENADEIRA AÇO - UN',_cat_ferramentas,_un),
    (_company,'FER-003','CARRINHO DE MÃO - UN',_cat_ferramentas,_un)
  ON CONFLICT DO NOTHING;
END $$;

GRANT EXECUTE ON FUNCTION public.seed_insumos_base(uuid) TO authenticated;
