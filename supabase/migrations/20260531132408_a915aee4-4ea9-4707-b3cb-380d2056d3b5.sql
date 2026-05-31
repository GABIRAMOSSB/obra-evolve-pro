CREATE OR REPLACE FUNCTION public.seed_funcoes_base(_company uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_company_member(auth.uid(), _company) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO funcoes_mao_obra (company_id, nome, custo_hora_base, encargos_percentual) VALUES
    -- Direção / engenharia
    (_company, 'Engenheiro Civil',                    120.00, 80),
    (_company, 'Engenheiro de Segurança',             110.00, 80),
    (_company, 'Engenheiro Eletricista',              115.00, 80),
    (_company, 'Engenheiro Mecânico',                 115.00, 80),
    (_company, 'Arquiteto',                           110.00, 80),
    (_company, 'Coordenador de Obras',                 95.00, 80),
    (_company, 'Gerente de Contrato',                 130.00, 80),
    (_company, 'Planejador / Orçamentista',            70.00, 80),
    (_company, 'Estagiário de Engenharia',             18.00, 80),
    -- Supervisão de campo
    (_company, 'Mestre de Obras',                      45.00, 80),
    (_company, 'Encarregado Geral',                    38.00, 80),
    (_company, 'Encarregado de Estrutura',             35.00, 80),
    (_company, 'Encarregado de Acabamento',            35.00, 80),
    (_company, 'Encarregado de Instalações',           35.00, 80),
    (_company, 'Apontador de Obra',                    22.00, 80),
    (_company, 'Almoxarife',                           20.00, 80),
    (_company, 'Auxiliar de Almoxarifado',             16.00, 80),
    -- Segurança
    (_company, 'Técnico de Segurança do Trabalho',     32.00, 80),
    (_company, 'Vigia',                                13.00, 80),
    (_company, 'Porteiro',                             14.00, 80),
    -- Topografia / qualidade
    (_company, 'Topógrafo',                            38.00, 80),
    (_company, 'Auxiliar de Topografia',               18.00, 80),
    (_company, 'Laboratorista (Tecnologia)',           28.00, 80),
    -- Estrutura / fundação
    (_company, 'Pedreiro',                             25.00, 80),
    (_company, 'Meio Oficial Pedreiro',                20.00, 80),
    (_company, 'Servente / Ajudante',                  15.00, 80),
    (_company, 'Carpinteiro de Forma',                 28.00, 80),
    (_company, 'Carpinteiro de Esquadrias',            28.00, 80),
    (_company, 'Armador / Ferreiro',                   28.00, 80),
    (_company, 'Operador de Bate-estacas',             36.00, 80),
    (_company, 'Operador de Perfuratriz',              38.00, 80),
    (_company, 'Poceiro',                              24.00, 80),
    -- Concreto
    (_company, 'Operador de Bomba de Concreto',        38.00, 80),
    (_company, 'Operador de Betoneira',                22.00, 80),
    (_company, 'Acabador de Concreto',                 30.00, 80),
    -- Cobertura / impermeabilização
    (_company, 'Telhadista',                           28.00, 80),
    (_company, 'Impermeabilizador',                    28.00, 80),
    -- Acabamentos
    (_company, 'Azulejista / Ceramista',               28.00, 80),
    (_company, 'Marmorista',                           32.00, 80),
    (_company, 'Gesseiro',                             28.00, 80),
    (_company, 'Aplicador de Drywall',                 28.00, 80),
    (_company, 'Pintor',                               25.00, 80),
    (_company, 'Pintor de Estrutura Metálica',         32.00, 80),
    (_company, 'Aplicador de Textura/Grafiato',        26.00, 80),
    (_company, 'Vidraceiro',                           30.00, 80),
    (_company, 'Serralheiro',                          32.00, 80),
    (_company, 'Soldador',                             35.00, 80),
    (_company, 'Caldeireiro',                          36.00, 80),
    (_company, 'Montador de Estrutura Metálica',       34.00, 80),
    (_company, 'Marceneiro',                           30.00, 80),
    (_company, 'Instalador de Forro',                  26.00, 80),
    (_company, 'Instalador de Piso Vinílico/Laminado', 26.00, 80),
    -- Instalações
    (_company, 'Eletricista Predial',                  32.00, 80),
    (_company, 'Eletricista Industrial',               40.00, 80),
    (_company, 'Auxiliar de Eletricista',              18.00, 80),
    (_company, 'Encanador / Bombeiro Hidráulico',      30.00, 80),
    (_company, 'Auxiliar de Encanador',                16.00, 80),
    (_company, 'Instalador de Gás',                    34.00, 80),
    (_company, 'Instalador de Ar-condicionado',        38.00, 80),
    (_company, 'Instalador de PPCI',                   34.00, 80),
    (_company, 'Cabista / Instalador de Cabeamento',   30.00, 80),
    -- Operadores de máquinas
    (_company, 'Operador de Escavadeira',              42.00, 80),
    (_company, 'Operador de Retroescavadeira',         38.00, 80),
    (_company, 'Operador de Pá Carregadeira',          38.00, 80),
    (_company, 'Operador de Motoniveladora',           42.00, 80),
    (_company, 'Operador de Rolo Compactador',         32.00, 80),
    (_company, 'Operador de Trator de Esteira',        42.00, 80),
    (_company, 'Operador de Grua',                     45.00, 80),
    (_company, 'Operador de Guindaste',                48.00, 80),
    (_company, 'Operador de Plataforma Elevatória',    30.00, 80),
    (_company, 'Operador de Empilhadeira',             26.00, 80),
    (_company, 'Operador de Manipulador Telescópico',  32.00, 80),
    -- Motoristas / transporte
    (_company, 'Motorista de Caminhão Basculante',     24.00, 80),
    (_company, 'Motorista de Caminhão Truck',          26.00, 80),
    (_company, 'Motorista de Caminhão Betoneira',      26.00, 80),
    (_company, 'Motorista de Caminhão Pipa',           24.00, 80),
    (_company, 'Motorista de Caminhão Munck',          28.00, 80),
    (_company, 'Motorista de Veículo Leve',            18.00, 80),
    (_company, 'Caminhoneiro / Carreteiro',            30.00, 80),
    -- Apoio / administrativo / serviços gerais
    (_company, 'Auxiliar Administrativo',              18.00, 80),
    (_company, 'Auxiliar de RH',                       20.00, 80),
    (_company, 'Auxiliar de Compras',                  20.00, 80),
    (_company, 'Cozinheiro de Obra',                   18.00, 80),
    (_company, 'Auxiliar de Cozinha',                  14.00, 80),
    (_company, 'Faxineiro / Auxiliar de Limpeza',      13.00, 80),
    (_company, 'Jardineiro',                           16.00, 80),
    (_company, 'Demolidor',                            22.00, 80),
    (_company, 'Mergulhador (obras submersas)',        80.00, 80)
  ON CONFLICT DO NOTHING;
END $function$;