
-- ============================================================
-- FASE 1.1: centro_custo + seed expandido de insumos
-- ============================================================

-- 1) Adicionar centro_custo a nfe_item_apropriacoes
ALTER TABLE public.nfe_item_apropriacoes
  ADD COLUMN IF NOT EXISTS centro_custo TEXT,
  ADD COLUMN IF NOT EXISTS frente_servico TEXT,
  ADD COLUMN IF NOT EXISTS local_aplicacao TEXT,
  ADD COLUMN IF NOT EXISTS responsavel TEXT;

-- 2) Adicionar centro_custo a apontamentos_mao_obra
ALTER TABLE public.apontamentos_mao_obra
  ADD COLUMN IF NOT EXISTS centro_custo TEXT,
  ADD COLUMN IF NOT EXISTS frente_servico TEXT;

-- 3) Adicionar centro_custo a estoque_movimentos
ALTER TABLE public.estoque_movimentos
  ADD COLUMN IF NOT EXISTS centro_custo TEXT,
  ADD COLUMN IF NOT EXISTS frente_servico TEXT;

-- 4) Expandir seed_insumos_base com cobertura completa das 20 categorias
CREATE OR REPLACE FUNCTION public.seed_insumos_base(_company uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _kg uuid; _un uuid; _pc uuid; _m uuid; _m2 uuid; _m3 uuid;
  _sc uuid; _l uuid; _t uuid; _br uuid; _pct uuid; _h uuid;
  _cat_concreto uuid; _cat_cimento uuid; _cat_agregados uuid; _cat_aco uuid;
  _cat_madeira uuid; _cat_cobertura uuid; _cat_fixadores uuid;
  _cat_eletrica uuid; _cat_hidraulica uuid; _cat_esgoto uuid;
  _cat_drenagem uuid; _cat_ppci uuid; _cat_pintura uuid;
  _cat_acabamentos uuid; _cat_ferramentas uuid; _cat_equipamentos uuid;
  _cat_epi uuid; _cat_locacoes uuid; _cat_servicos uuid; _cat_metal uuid;
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

  UPDATE unidades_medida SET unidade_base_id=_kg, fator_conversao=50 WHERE id=_sc AND fator_conversao=1;
  UPDATE unidades_medida SET unidade_base_id=_kg, fator_conversao=1000 WHERE id=_t AND fator_conversao=1;

  -- Categorias raiz (20 categorias)
  INSERT INTO insumo_categorias (company_id, nome, ordem) VALUES
    (_company,'Concreto',1),(_company,'Cimento',2),(_company,'Agregados',3),(_company,'Aço',4),
    (_company,'Estrutura Metálica',5),(_company,'Cobertura',6),(_company,'Fixadores',7),
    (_company,'Madeira/Forma',8),(_company,'Elétrica',9),(_company,'Hidráulica',10),
    (_company,'Esgoto',11),(_company,'Drenagem',12),(_company,'PPCI',13),(_company,'Pintura',14),
    (_company,'Acabamentos',15),(_company,'Ferramentas',16),(_company,'Equipamentos',17),
    (_company,'EPIs',18),(_company,'Locações',19),(_company,'Serviços',20)
  ON CONFLICT DO NOTHING;

  SELECT id INTO _cat_concreto    FROM insumo_categorias WHERE company_id=_company AND nome='Concreto' AND parent_id IS NULL;
  SELECT id INTO _cat_cimento     FROM insumo_categorias WHERE company_id=_company AND nome='Cimento' AND parent_id IS NULL;
  SELECT id INTO _cat_agregados   FROM insumo_categorias WHERE company_id=_company AND nome='Agregados' AND parent_id IS NULL;
  SELECT id INTO _cat_aco         FROM insumo_categorias WHERE company_id=_company AND nome='Aço' AND parent_id IS NULL;
  SELECT id INTO _cat_metal       FROM insumo_categorias WHERE company_id=_company AND nome='Estrutura Metálica' AND parent_id IS NULL;
  SELECT id INTO _cat_cobertura   FROM insumo_categorias WHERE company_id=_company AND nome='Cobertura' AND parent_id IS NULL;
  SELECT id INTO _cat_fixadores   FROM insumo_categorias WHERE company_id=_company AND nome='Fixadores' AND parent_id IS NULL;
  SELECT id INTO _cat_madeira     FROM insumo_categorias WHERE company_id=_company AND nome='Madeira/Forma' AND parent_id IS NULL;
  SELECT id INTO _cat_eletrica    FROM insumo_categorias WHERE company_id=_company AND nome='Elétrica' AND parent_id IS NULL;
  SELECT id INTO _cat_hidraulica  FROM insumo_categorias WHERE company_id=_company AND nome='Hidráulica' AND parent_id IS NULL;
  SELECT id INTO _cat_esgoto      FROM insumo_categorias WHERE company_id=_company AND nome='Esgoto' AND parent_id IS NULL;
  SELECT id INTO _cat_drenagem    FROM insumo_categorias WHERE company_id=_company AND nome='Drenagem' AND parent_id IS NULL;
  SELECT id INTO _cat_ppci        FROM insumo_categorias WHERE company_id=_company AND nome='PPCI' AND parent_id IS NULL;
  SELECT id INTO _cat_pintura     FROM insumo_categorias WHERE company_id=_company AND nome='Pintura' AND parent_id IS NULL;
  SELECT id INTO _cat_acabamentos FROM insumo_categorias WHERE company_id=_company AND nome='Acabamentos' AND parent_id IS NULL;
  SELECT id INTO _cat_ferramentas FROM insumo_categorias WHERE company_id=_company AND nome='Ferramentas' AND parent_id IS NULL;
  SELECT id INTO _cat_equipamentos FROM insumo_categorias WHERE company_id=_company AND nome='Equipamentos' AND parent_id IS NULL;
  SELECT id INTO _cat_epi         FROM insumo_categorias WHERE company_id=_company AND nome='EPIs' AND parent_id IS NULL;
  SELECT id INTO _cat_locacoes    FROM insumo_categorias WHERE company_id=_company AND nome='Locações' AND parent_id IS NULL;
  SELECT id INTO _cat_servicos    FROM insumo_categorias WHERE company_id=_company AND nome='Serviços' AND parent_id IS NULL;

  INSERT INTO insumos_mestre (company_id, codigo, descricao, categoria_id, unidade_id) VALUES
    -- Concreto usinado
    (_company,'CON-001','CONCRETO USINADO FCK 15 MPA - M³',_cat_concreto,_m3),
    (_company,'CON-002','CONCRETO USINADO FCK 20 MPA - M³',_cat_concreto,_m3),
    (_company,'CON-003','CONCRETO USINADO FCK 25 MPA - M³',_cat_concreto,_m3),
    (_company,'CON-004','CONCRETO USINADO FCK 30 MPA - M³',_cat_concreto,_m3),
    (_company,'CON-005','CONCRETO USINADO FCK 35 MPA - M³',_cat_concreto,_m3),
    (_company,'CON-006','CONCRETO USINADO FCK 40 MPA - M³',_cat_concreto,_m3),
    (_company,'CON-007','GRAUTE FLUIDO 30 MPA - M³',_cat_concreto,_m3),
    (_company,'CON-008','ARGAMASSA INDUSTRIALIZADA AC-I - SACO 20KG',_cat_concreto,_sc),
    (_company,'CON-009','ARGAMASSA INDUSTRIALIZADA AC-II - SACO 20KG',_cat_concreto,_sc),
    (_company,'CON-010','ARGAMASSA INDUSTRIALIZADA AC-III - SACO 20KG',_cat_concreto,_sc),
    -- Cimento
    (_company,'CIM-001','CIMENTO CP II - SACO 50 KG',_cat_cimento,_sc),
    (_company,'CIM-002','CIMENTO CP IV - SACO 50 KG',_cat_cimento,_sc),
    (_company,'CIM-003','CIMENTO CP V ARI - SACO 50 KG',_cat_cimento,_sc),
    (_company,'CIM-004','CIMENTO CP II Z 32 - SACO 50 KG',_cat_cimento,_sc),
    (_company,'CIM-005','CIMENTO BRANCO ESTRUTURAL - SACO 40 KG',_cat_cimento,_sc),
    (_company,'CIM-006','CAL HIDRATADA CH-I - SACO 20 KG',_cat_cimento,_sc),
    (_company,'CIM-007','CAL HIDRATADA CH-III - SACO 20 KG',_cat_cimento,_sc),
    (_company,'CIM-008','GESSO PARA REVESTIMENTO - SACO 40KG',_cat_cimento,_sc),
    -- Agregados
    (_company,'AGR-001','AREIA MÉDIA LAVADA - M³',_cat_agregados,_m3),
    (_company,'AGR-002','AREIA FINA LAVADA - M³',_cat_agregados,_m3),
    (_company,'AGR-003','AREIA GROSSA - M³',_cat_agregados,_m3),
    (_company,'AGR-004','BRITA Nº 0 - M³',_cat_agregados,_m3),
    (_company,'AGR-005','BRITA Nº 1 - M³',_cat_agregados,_m3),
    (_company,'AGR-006','BRITA Nº 2 - M³',_cat_agregados,_m3),
    (_company,'AGR-007','BRITA Nº 3 - M³',_cat_agregados,_m3),
    (_company,'AGR-008','PEDRISCO - M³',_cat_agregados,_m3),
    (_company,'AGR-009','PÓ DE BRITA - M³',_cat_agregados,_m3),
    (_company,'AGR-010','BICA CORRIDA - M³',_cat_agregados,_m3),
    (_company,'AGR-011','RACHÃO - M³',_cat_agregados,_m3),
    (_company,'AGR-012','SAIBRO - M³',_cat_agregados,_m3),
    -- Aço
    (_company,'ACO-001','FERRO CA50 6,3 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-002','FERRO CA50 8,0 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-003','FERRO CA50 10 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-004','FERRO CA50 12,5 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-005','FERRO CA50 16 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-006','FERRO CA50 20 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-007','FERRO CA50 25 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-008','FERRO CA60 4,2 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-009','FERRO CA60 5,0 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-010','FERRO CA60 6,0 MM - BARRA 12M',_cat_aco,_br),
    (_company,'ACO-011','TELA SOLDADA Q-92 - M²',_cat_aco,_m2),
    (_company,'ACO-012','TELA SOLDADA Q-138 - M²',_cat_aco,_m2),
    (_company,'ACO-013','TELA SOLDADA Q-196 - M²',_cat_aco,_m2),
    (_company,'ACO-014','TELA SOLDADA Q-246 - M²',_cat_aco,_m2),
    (_company,'ACO-015','ARAME RECOZIDO 18 - KG',_cat_aco,_kg),
    (_company,'ACO-016','ARAME GALVANIZADO 12 - KG',_cat_aco,_kg),
    (_company,'ACO-017','ESPAÇADOR PLÁSTICO PARA AÇO - UN',_cat_aco,_un),
    -- Estrutura Metálica
    (_company,'EMT-001','PERFIL U 100X40 - M',_cat_metal,_m),
    (_company,'EMT-002','PERFIL U 150X50 - M',_cat_metal,_m),
    (_company,'EMT-003','PERFIL I W150 - M',_cat_metal,_m),
    (_company,'EMT-004','PERFIL I W200 - M',_cat_metal,_m),
    (_company,'EMT-005','TUBO METALON 30X30 - M',_cat_metal,_m),
    (_company,'EMT-006','TUBO METALON 40X40 - M',_cat_metal,_m),
    (_company,'EMT-007','TUBO METALON 50X50 - M',_cat_metal,_m),
    (_company,'EMT-008','CHAPA AÇO 1/8" - M²',_cat_metal,_m2),
    (_company,'EMT-009','CHAPA XADREZ 3/16" - M²',_cat_metal,_m2),
    -- Cobertura
    (_company,'COB-001','TELHA ALUZINCO 0,50 MM - M²',_cat_cobertura,_m2),
    (_company,'COB-002','TELHA ALUZINCO 0,65 MM - M²',_cat_cobertura,_m2),
    (_company,'COB-003','TELHA FIBROCIMENTO 6MM - M²',_cat_cobertura,_m2),
    (_company,'COB-004','TELHA FIBROCIMENTO 8MM - M²',_cat_cobertura,_m2),
    (_company,'COB-005','TELHA CERÂMICA PORTUGUESA - UN',_cat_cobertura,_un),
    (_company,'COB-006','TELHA CERÂMICA ROMANA - UN',_cat_cobertura,_un),
    (_company,'COB-007','TELHA SANDWICH 30MM EPS - M²',_cat_cobertura,_m2),
    (_company,'COB-008','CUMEEIRA ALUZINCO 0,50MM - M',_cat_cobertura,_m),
    (_company,'COB-009','RUFO ALUZINCO 0,50MM - M',_cat_cobertura,_m),
    (_company,'COB-010','CALHA GALVANIZADA - M',_cat_cobertura,_m),
    (_company,'COB-011','CONDUTOR PVC 100MM - M',_cat_cobertura,_m),
    (_company,'COB-012','MANTA ASFÁLTICA 3MM - M²',_cat_cobertura,_m2),
    (_company,'COB-013','MANTA ASFÁLTICA 4MM ALUMINIZADA - M²',_cat_cobertura,_m2),
    -- Fixadores
    (_company,'FIX-001','PREGO 18X27 - KG',_cat_fixadores,_kg),
    (_company,'FIX-002','PREGO 17X21 - KG',_cat_fixadores,_kg),
    (_company,'FIX-003','PREGO 22X48 - KG',_cat_fixadores,_kg),
    (_company,'FIX-004','PARAFUSO AUTOBROCANTE 4,2X32 - UN',_cat_fixadores,_un),
    (_company,'FIX-005','PARAFUSO AUTOBROCANTE 4,8X19 - UN',_cat_fixadores,_un),
    (_company,'FIX-006','PARAFUSO PHILLIPS 4,5X40 - UN',_cat_fixadores,_un),
    (_company,'FIX-007','BUCHA NYLON S6 - UN',_cat_fixadores,_un),
    (_company,'FIX-008','BUCHA NYLON S8 - UN',_cat_fixadores,_un),
    (_company,'FIX-009','BUCHA NYLON S10 - UN',_cat_fixadores,_un),
    (_company,'FIX-010','CHUMBADOR PARABOLT 3/8" - UN',_cat_fixadores,_un),
    (_company,'FIX-011','CHUMBADOR PARABOLT 1/2" - UN',_cat_fixadores,_un),
    -- Madeira/Forma
    (_company,'MAD-001','TÁBUA PINUS 2,5X30 CM - M',_cat_madeira,_m),
    (_company,'MAD-002','SARRAFO PINUS 2,5X10 CM - M',_cat_madeira,_m),
    (_company,'MAD-003','CAIBRO PINUS 5X6 CM - M',_cat_madeira,_m),
    (_company,'MAD-004','VIGA PINUS 6X12 CM - M',_cat_madeira,_m),
    (_company,'MAD-005','COMPENSADO PLASTIFICADO 12MM - M²',_cat_madeira,_m2),
    (_company,'MAD-006','COMPENSADO PLASTIFICADO 18MM - M²',_cat_madeira,_m2),
    (_company,'MAD-007','COMPENSADO RESINADO 14MM - M²',_cat_madeira,_m2),
    (_company,'MAD-008','DESMOLDANTE PARA FORMA - L',_cat_madeira,_l),
    -- Elétrica
    (_company,'ELE-001','ELETRODUTO PVC 3/4" - M',_cat_eletrica,_m),
    (_company,'ELE-002','ELETRODUTO PVC 1" - M',_cat_eletrica,_m),
    (_company,'ELE-003','ELETRODUTO PVC 1.1/4" - M',_cat_eletrica,_m),
    (_company,'ELE-004','ELETRODUTO FERRO GALVANIZADO 3/4" - M',_cat_eletrica,_m),
    (_company,'ELE-005','CABO FLEXÍVEL 1,5MM² - M',_cat_eletrica,_m),
    (_company,'ELE-006','CABO FLEXÍVEL 2,5MM² - M',_cat_eletrica,_m),
    (_company,'ELE-007','CABO FLEXÍVEL 4MM² - M',_cat_eletrica,_m),
    (_company,'ELE-008','CABO FLEXÍVEL 6MM² - M',_cat_eletrica,_m),
    (_company,'ELE-009','CABO FLEXÍVEL 10MM² - M',_cat_eletrica,_m),
    (_company,'ELE-010','CABO FLEXÍVEL 16MM² - M',_cat_eletrica,_m),
    (_company,'ELE-011','DISJUNTOR MONOPOLAR 10A - UN',_cat_eletrica,_un),
    (_company,'ELE-012','DISJUNTOR MONOPOLAR 16A - UN',_cat_eletrica,_un),
    (_company,'ELE-013','DISJUNTOR MONOPOLAR 20A - UN',_cat_eletrica,_un),
    (_company,'ELE-014','DISJUNTOR MONOPOLAR 25A - UN',_cat_eletrica,_un),
    (_company,'ELE-015','DISJUNTOR BIPOLAR 32A - UN',_cat_eletrica,_un),
    (_company,'ELE-016','DISJUNTOR TRIPOLAR 50A - UN',_cat_eletrica,_un),
    (_company,'ELE-017','TOMADA 2P+T 10A - UN',_cat_eletrica,_un),
    (_company,'ELE-018','TOMADA 2P+T 20A - UN',_cat_eletrica,_un),
    (_company,'ELE-019','INTERRUPTOR SIMPLES - UN',_cat_eletrica,_un),
    (_company,'ELE-020','INTERRUPTOR PARALELO - UN',_cat_eletrica,_un),
    (_company,'ELE-021','CAIXA 4X2 PVC - UN',_cat_eletrica,_un),
    (_company,'ELE-022','CAIXA 4X4 PVC - UN',_cat_eletrica,_un),
    (_company,'ELE-023','QUADRO DISTRIBUIÇÃO 12 DISJUNTORES - UN',_cat_eletrica,_un),
    (_company,'ELE-024','LUMINÁRIA LED 18W - UN',_cat_eletrica,_un),
    (_company,'ELE-025','LÂMPADA LED 9W E27 - UN',_cat_eletrica,_un),
    -- Hidráulica
    (_company,'HID-001','TUBO PVC SOLDÁVEL 20MM - M',_cat_hidraulica,_m),
    (_company,'HID-002','TUBO PVC SOLDÁVEL 25MM - M',_cat_hidraulica,_m),
    (_company,'HID-003','TUBO PVC SOLDÁVEL 32MM - M',_cat_hidraulica,_m),
    (_company,'HID-004','TUBO PVC SOLDÁVEL 40MM - M',_cat_hidraulica,_m),
    (_company,'HID-005','TUBO PVC SOLDÁVEL 50MM - M',_cat_hidraulica,_m),
    (_company,'HID-006','JOELHO PVC SOLDÁVEL 25MM - UN',_cat_hidraulica,_un),
    (_company,'HID-007','JOELHO PVC SOLDÁVEL 32MM - UN',_cat_hidraulica,_un),
    (_company,'HID-008','TÊ PVC SOLDÁVEL 25MM - UN',_cat_hidraulica,_un),
    (_company,'HID-009','TÊ PVC SOLDÁVEL 32MM - UN',_cat_hidraulica,_un),
    (_company,'HID-010','REGISTRO ESFERA 25MM - UN',_cat_hidraulica,_un),
    (_company,'HID-011','REGISTRO GAVETA 3/4" - UN',_cat_hidraulica,_un),
    (_company,'HID-012','TORNEIRA LAVATÓRIO CROMADA - UN',_cat_hidraulica,_un),
    (_company,'HID-013','TORNEIRA DE JARDIM 3/4" - UN',_cat_hidraulica,_un),
    (_company,'HID-014','VÁLVULA DE DESCARGA - UN',_cat_hidraulica,_un),
    (_company,'HID-015','CAIXA D''ÁGUA 500L POLIETILENO - UN',_cat_hidraulica,_un),
    (_company,'HID-016','CAIXA D''ÁGUA 1000L POLIETILENO - UN',_cat_hidraulica,_un),
    (_company,'HID-017','ADESIVO PVC 175G - UN',_cat_hidraulica,_un),
    (_company,'HID-018','FITA VEDA ROSCA 18MM X 50M - UN',_cat_hidraulica,_un),
    -- Esgoto
    (_company,'ESG-001','TUBO PVC ESGOTO 40MM - M',_cat_esgoto,_m),
    (_company,'ESG-002','TUBO PVC ESGOTO 50MM - M',_cat_esgoto,_m),
    (_company,'ESG-003','TUBO PVC ESGOTO 75MM - M',_cat_esgoto,_m),
    (_company,'ESG-004','TUBO PVC ESGOTO 100MM - M',_cat_esgoto,_m),
    (_company,'ESG-005','TUBO PVC ESGOTO 150MM - M',_cat_esgoto,_m),
    (_company,'ESG-006','JOELHO 90° PVC ESGOTO 100MM - UN',_cat_esgoto,_un),
    (_company,'ESG-007','TÊ PVC ESGOTO 100MM - UN',_cat_esgoto,_un),
    (_company,'ESG-008','CAIXA SIFONADA PVC 100X150X50 - UN',_cat_esgoto,_un),
    (_company,'ESG-009','CAIXA DE GORDURA PVC - UN',_cat_esgoto,_un),
    (_company,'ESG-010','VASO SANITÁRIO COM CAIXA - UN',_cat_esgoto,_un),
    -- Drenagem
    (_company,'DRE-001','TUBO PEAD CORRUGADO 150MM - M',_cat_drenagem,_m),
    (_company,'DRE-002','TUBO PEAD CORRUGADO 200MM - M',_cat_drenagem,_m),
    (_company,'DRE-003','TUBO CONCRETO 300MM - M',_cat_drenagem,_m),
    (_company,'DRE-004','TUBO CONCRETO 400MM - M',_cat_drenagem,_m),
    (_company,'DRE-005','TUBO CONCRETO 600MM - M',_cat_drenagem,_m),
    (_company,'DRE-006','GRELHA CONCRETO 30X100 - UN',_cat_drenagem,_un),
    (_company,'DRE-007','GRELHA FERRO FUNDIDO 30X100 - UN',_cat_drenagem,_un),
    (_company,'DRE-008','BOCA DE LOBO PRÉ-MOLDADA - UN',_cat_drenagem,_un),
    (_company,'DRE-009','POÇO DE VISITA 1,5M - UN',_cat_drenagem,_un),
    -- PPCI
    (_company,'PPC-001','EXTINTOR ABC 4KG - UN',_cat_ppci,_un),
    (_company,'PPC-002','EXTINTOR ABC 6KG - UN',_cat_ppci,_un),
    (_company,'PPC-003','EXTINTOR CO2 6KG - UN',_cat_ppci,_un),
    (_company,'PPC-004','HIDRANTE COMPLETO - UN',_cat_ppci,_un),
    (_company,'PPC-005','MANGUEIRA INCÊNDIO 1.1/2" - UN',_cat_ppci,_un),
    (_company,'PPC-006','SINALIZAÇÃO ROTA DE FUGA - UN',_cat_ppci,_un),
    (_company,'PPC-007','LUMINÁRIA EMERGÊNCIA LED - UN',_cat_ppci,_un),
    (_company,'PPC-008','DETECTOR DE FUMAÇA - UN',_cat_ppci,_un),
    (_company,'PPC-009','PORTA CORTA-FOGO P-90 - UN',_cat_ppci,_un),
    -- Pintura
    (_company,'PIN-001','TINTA ACRÍLICA FOSCA - LATA 18L',_cat_pintura,_un),
    (_company,'PIN-002','TINTA ACRÍLICA ACETINADA - LATA 18L',_cat_pintura,_un),
    (_company,'PIN-003','TINTA ACRÍLICA SEMI-BRILHO - LATA 18L',_cat_pintura,_un),
    (_company,'PIN-004','TINTA LÁTEX PVA - LATA 18L',_cat_pintura,_un),
    (_company,'PIN-005','TINTA ESMALTE SINTÉTICO - GALÃO 3,6L',_cat_pintura,_un),
    (_company,'PIN-006','TEXTURA ACRÍLICA - LATA 18KG',_cat_pintura,_un),
    (_company,'PIN-007','SELADOR ACRÍLICO - LATA 18L',_cat_pintura,_un),
    (_company,'PIN-008','FUNDO PREPARADOR - GALÃO 3,6L',_cat_pintura,_un),
    (_company,'PIN-009','MASSA CORRIDA PVA - BALDE 25KG',_cat_pintura,_un),
    (_company,'PIN-010','MASSA ACRÍLICA - BALDE 25KG',_cat_pintura,_un),
    (_company,'PIN-011','ROLO DE LÃ 23CM - UN',_cat_pintura,_un),
    (_company,'PIN-012','PINCEL 2" - UN',_cat_pintura,_un),
    (_company,'PIN-013','LIXA 100 - UN',_cat_pintura,_un),
    (_company,'PIN-014','LIXA 150 - UN',_cat_pintura,_un),
    -- Acabamentos
    (_company,'ACA-001','PISO CERÂMICO 45X45 - M²',_cat_acabamentos,_m2),
    (_company,'ACA-002','PISO CERÂMICO 60X60 - M²',_cat_acabamentos,_m2),
    (_company,'ACA-003','PORCELANATO 60X60 POLIDO - M²',_cat_acabamentos,_m2),
    (_company,'ACA-004','PORCELANATO 80X80 ACETINADO - M²',_cat_acabamentos,_m2),
    (_company,'ACA-005','REVESTIMENTO CERÂMICO 30X60 - M²',_cat_acabamentos,_m2),
    (_company,'ACA-006','RODAPÉ CERÂMICO 8CM - M',_cat_acabamentos,_m),
    (_company,'ACA-007','REJUNTE 5KG - UN',_cat_acabamentos,_un),
    (_company,'ACA-008','REBAIXO GESSO 60X60 - M²',_cat_acabamentos,_m2),
    (_company,'ACA-009','PLACA GESSO ACARTONADO 12,5MM - M²',_cat_acabamentos,_m2),
    (_company,'ACA-010','PERFIL DRYWALL 70MM - M',_cat_acabamentos,_m),
    (_company,'ACA-011','PORTA MADEIRA SEMI-OCA 80CM - UN',_cat_acabamentos,_un),
    (_company,'ACA-012','BATENTE MADEIRA - UN',_cat_acabamentos,_un),
    (_company,'ACA-013','JANELA ALUMÍNIO 1,20X1,00 - UN',_cat_acabamentos,_un),
    (_company,'ACA-014','VIDRO TEMPERADO 8MM - M²',_cat_acabamentos,_m2),
    -- Ferramentas
    (_company,'FER-001','COLHER DE PEDREIRO - UN',_cat_ferramentas,_un),
    (_company,'FER-002','DESEMPENADEIRA AÇO - UN',_cat_ferramentas,_un),
    (_company,'FER-003','DESEMPENADEIRA PVC - UN',_cat_ferramentas,_un),
    (_company,'FER-004','CARRINHO DE MÃO - UN',_cat_ferramentas,_un),
    (_company,'FER-005','PÁ DE BICO - UN',_cat_ferramentas,_un),
    (_company,'FER-006','ENXADA - UN',_cat_ferramentas,_un),
    (_company,'FER-007','PICARETA - UN',_cat_ferramentas,_un),
    (_company,'FER-008','MARRETA 1KG - UN',_cat_ferramentas,_un),
    (_company,'FER-009','MARTELO - UN',_cat_ferramentas,_un),
    (_company,'FER-010','TRENA 5M - UN',_cat_ferramentas,_un),
    (_company,'FER-011','NÍVEL DE BOLHA 60CM - UN',_cat_ferramentas,_un),
    (_company,'FER-012','ESQUADRO 30CM - UN',_cat_ferramentas,_un),
    -- Equipamentos
    (_company,'EQU-001','BETONEIRA 400L - DIÁRIA',_cat_equipamentos,_un),
    (_company,'EQU-002','VIBRADOR DE IMERSÃO - DIÁRIA',_cat_equipamentos,_un),
    (_company,'EQU-003','COMPACTADOR DE SOLO - DIÁRIA',_cat_equipamentos,_un),
    (_company,'EQU-004','SERRA CIRCULAR DE BANCADA - DIÁRIA',_cat_equipamentos,_un),
    (_company,'EQU-005','POLICORTE - DIÁRIA',_cat_equipamentos,_un),
    (_company,'EQU-006','MARTELETE - DIÁRIA',_cat_equipamentos,_un),
    (_company,'EQU-007','GERADOR 5KVA - DIÁRIA',_cat_equipamentos,_un),
    -- EPIs
    (_company,'EPI-001','CAPACETE DE SEGURANÇA - UN',_cat_epi,_un),
    (_company,'EPI-002','LUVA NITRÍLICA - PAR',_cat_epi,_un),
    (_company,'EPI-003','LUVA RASPA - PAR',_cat_epi,_un),
    (_company,'EPI-004','BOTINA DE SEGURANÇA - PAR',_cat_epi,_un),
    (_company,'EPI-005','ÓCULOS DE PROTEÇÃO - UN',_cat_epi,_un),
    (_company,'EPI-006','PROTETOR AURICULAR PLUG - PAR',_cat_epi,_un),
    (_company,'EPI-007','PROTETOR AURICULAR CONCHA - UN',_cat_epi,_un),
    (_company,'EPI-008','MÁSCARA PFF2 - UN',_cat_epi,_un),
    (_company,'EPI-009','CINTO PARAQUEDISTA - UN',_cat_epi,_un),
    (_company,'EPI-010','TALABARTE Y ABS - UN',_cat_epi,_un),
    (_company,'EPI-011','UNIFORME (CALÇA+CAMISA) - UN',_cat_epi,_un),
    (_company,'EPI-012','CAPA DE CHUVA - UN',_cat_epi,_un),
    -- Locações
    (_company,'LOC-001','LOCAÇÃO ESCORAMENTO METÁLICO - UN/MÊS',_cat_locacoes,_un),
    (_company,'LOC-002','LOCAÇÃO ANDAIME FACHADEIRO - M²/MÊS',_cat_locacoes,_m2),
    (_company,'LOC-003','LOCAÇÃO ANDAIME TUBULAR - M²/MÊS',_cat_locacoes,_m2),
    (_company,'LOC-004','LOCAÇÃO BANHEIRO QUÍMICO - MÊS',_cat_locacoes,_un),
    (_company,'LOC-005','LOCAÇÃO CONTAINER ESCRITÓRIO - MÊS',_cat_locacoes,_un),
    (_company,'LOC-006','LOCAÇÃO TAPUME GALVANIZADO - M/MÊS',_cat_locacoes,_m),
    -- Serviços
    (_company,'SER-001','FRETE CAMINHÃO TOCO - VIAGEM',_cat_servicos,_un),
    (_company,'SER-002','FRETE CAMINHÃO TRUCK - VIAGEM',_cat_servicos,_un),
    (_company,'SER-003','MUNCK - HORA',_cat_servicos,_h),
    (_company,'SER-004','BOMBA DE CONCRETO - HORA',_cat_servicos,_h),
    (_company,'SER-005','RETROESCAVADEIRA - HORA',_cat_servicos,_h),
    (_company,'SER-006','ESCAVADEIRA HIDRÁULICA - HORA',_cat_servicos,_h),
    (_company,'SER-007','MOTONIVELADORA - HORA',_cat_servicos,_h),
    (_company,'SER-008','CAMINHÃO BASCULANTE - HORA',_cat_servicos,_h),
    (_company,'SER-009','CONCRETAGEM TERCEIRIZADA - M³',_cat_servicos,_m3),
    (_company,'SER-010','SONDAGEM SPT - M',_cat_servicos,_m),
    (_company,'SER-011','TOPOGRAFIA - DIÁRIA',_cat_servicos,_un)
  ON CONFLICT DO NOTHING;
END $function$;
