CREATE OR REPLACE FUNCTION public.seed_equipamentos_base(_company uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_company_member(auth.uid(), _company) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO equipamentos (company_id, nome, tipo, unidade, custo_hora, descricao) VALUES
    -- Concreto / argamassa
    (_company, 'Betoneira 150L',                'proprio', 'H',    8.00, 'Betoneira elétrica 150 litros'),
    (_company, 'Betoneira 250L',                'proprio', 'H',   12.00, 'Betoneira elétrica 250 litros'),
    (_company, 'Betoneira 400L',                'proprio', 'H',   15.00, 'Betoneira elétrica 400 litros'),
    (_company, 'Betoneira 600L',                'proprio', 'H',   22.00, 'Betoneira elétrica 600 litros'),
    (_company, 'Misturador de argamassa',       'proprio', 'H',   14.00, 'Misturador horizontal de argamassa'),
    (_company, 'Argamassadeira',                'proprio', 'H',   16.00, 'Argamassadeira / amassadeira'),
    (_company, 'Projetor de argamassa',         'locado',  'H',   55.00, 'Projetor pneumático de argamassa'),
    (_company, 'Vibrador de imersão',           'proprio', 'H',   12.00, 'Vibrador de concreto, mangote 35mm'),
    (_company, 'Vibrador de imersão alta freq.','proprio', 'H',   18.00, 'Vibrador alta frequência mangote 50mm'),
    (_company, 'Régua vibratória',              'proprio', 'H',   18.00, 'Régua vibratória para concreto'),
    (_company, 'Régua treliçada',               'locado',  'H',   45.00, 'Régua treliçada vibratória'),
    (_company, 'Acabadora de superfície',       'locado',  'H',   55.00, 'Acabadora helicóptero para concreto'),
    (_company, 'Alisadora dupla (ride-on)',     'locado',  'H',  120.00, 'Alisadora dupla operador embarcado'),
    (_company, 'Lixadeira de piso',             'locado',  'H',   35.00, 'Lixadeira politriz para concreto'),
    (_company, 'Politriz de piso',              'locado',  'H',   45.00, 'Politriz para piso de alta brilho'),
    (_company, 'Cortadora de piso',             'locado',  'H',   35.00, 'Cortadora de juntas a gasolina'),
    (_company, 'Bomba lança de concreto',       'locado',  'H',  350.00, 'Bomba lança autopropelida'),
    (_company, 'Bomba estacionária de concreto','locado',  'H',  180.00, 'Bomba estacionária de concreto'),
    (_company, 'Caminhão betoneira',            'locado',  'H',  200.00, 'Caminhão betoneira / mixer'),

    -- Compactação / terraplenagem
    (_company, 'Compactador de solo (sapo)',    'proprio', 'H',   25.00, 'Compactador tipo sapo a gasolina'),
    (_company, 'Placa vibratória',              'proprio', 'H',   20.00, 'Placa vibratória reversível'),
    (_company, 'Rolo compactador pequeno',      'locado',  'H',   85.00, 'Rolo compactador 1-3t'),
    (_company, 'Rolo compactador médio',        'locado',  'H',  130.00, 'Rolo compactador 4-6t'),
    (_company, 'Rolo compactador grande',       'locado',  'H',  180.00, 'Rolo compactador 7-12t'),
    (_company, 'Rolo pé-de-carneiro',           'locado',  'H',  200.00, 'Rolo compactador pé-de-carneiro'),
    (_company, 'Rolo pneumático',               'locado',  'H',  170.00, 'Rolo compactador pneumático'),
    (_company, 'Retroescavadeira',              'locado',  'H',  180.00, 'Retroescavadeira tipo JCB / Case 580'),
    (_company, 'Escavadeira hidráulica 14t',    'locado',  'H',  220.00, 'Escavadeira hidráulica 14t'),
    (_company, 'Escavadeira hidráulica 20t',    'locado',  'H',  250.00, 'Escavadeira hidráulica 20t'),
    (_company, 'Escavadeira hidráulica 30t',    'locado',  'H',  320.00, 'Escavadeira hidráulica 30t'),
    (_company, 'Mini-escavadeira',              'locado',  'H',  140.00, 'Mini-escavadeira 1-3t'),
    (_company, 'Pá carregadeira',               'locado',  'H',  220.00, 'Pá carregadeira sobre pneus'),
    (_company, 'Mini carregadeira (bobcat)',    'locado',  'H',  130.00, 'Mini carregadeira tipo Bobcat'),
    (_company, 'Motoniveladora',                'locado',  'H',  280.00, 'Patrol motoniveladora'),
    (_company, 'Trator de esteira D4',          'locado',  'H',  240.00, 'Trator de esteira D4'),
    (_company, 'Trator de esteira D6',          'locado',  'H',  300.00, 'Trator de esteira D6'),
    (_company, 'Trator de esteira D8',          'locado',  'H',  380.00, 'Trator de esteira D8'),
    (_company, 'Trator agrícola',               'locado',  'H',  120.00, 'Trator agrícola com implementos'),
    (_company, 'Scraper',                       'locado',  'H',  280.00, 'Scraper / motoescreiper'),

    -- Transporte
    (_company, 'Caminhão basculante toco',      'locado',  'H',  150.00, 'Caminhão basculante toco 6m³'),
    (_company, 'Caminhão truck basculante',     'locado',  'H',  190.00, 'Caminhão truck basculante 10m³'),
    (_company, 'Caminhão traçado basculante',   'locado',  'H',  220.00, 'Caminhão traçado basculante 12m³'),
    (_company, 'Caminhão munck',                'locado',  'H',  220.00, 'Caminhão munck com guindaste'),
    (_company, 'Caminhão pipa 8.000L',          'locado',  'H',  150.00, 'Caminhão pipa 8.000 L'),
    (_company, 'Caminhão pipa 10.000L',         'locado',  'H',  170.00, 'Caminhão pipa 10.000 L'),
    (_company, 'Caminhão pipa 20.000L',         'locado',  'H',  220.00, 'Caminhão pipa 20.000 L'),
    (_company, 'Caminhão prancha',              'locado',  'H',  260.00, 'Caminhão prancha para máquinas'),
    (_company, 'Caminhão carroceria',           'locado',  'H',  130.00, 'Caminhão carroceria de madeira'),
    (_company, 'Caminhão baú',                  'locado',  'H',  140.00, 'Caminhão baú para transporte'),
    (_company, 'Caminhão coletor',              'locado',  'H',  180.00, 'Caminhão coletor de entulho'),
    (_company, 'Caçamba estacionária',          'locado',  'DIA', 25.00, 'Caçamba estacionária para entulho'),
    (_company, 'Carrinho de mão',               'proprio', 'DIA',  1.00, 'Carrinho de mão / giricar'),
    (_company, 'Carrinho metálico',             'proprio', 'DIA',  1.50, 'Carrinho metálico para concreto'),

    -- Içamento / elevação
    (_company, 'Guincho de coluna',             'proprio', 'H',   18.00, 'Guincho elétrico de coluna'),
    (_company, 'Guincho de pé / velox',         'proprio', 'H',   12.00, 'Guincho velox para obra'),
    (_company, 'Elevador de obra (cremalheira)','locado',  'H',   45.00, 'Elevador de carga e passageiros'),
    (_company, 'Grua torre',                    'locado',  'H',  280.00, 'Grua torre para edificação'),
    (_company, 'Grua autoascensional',          'locado',  'H',  350.00, 'Grua autoascensional grande porte'),
    (_company, 'Guindaste sobre pneus',         'locado',  'H',  380.00, 'Guindaste hidráulico móvel'),
    (_company, 'Plataforma elevatória tesoura', 'locado',  'H',   95.00, 'Plataforma tipo tesoura 10m'),
    (_company, 'Plataforma elevatória articulada','locado','H',  140.00, 'Plataforma articulada 16m'),
    (_company, 'Manipulador telescópico',       'locado',  'H',  180.00, 'Manipulador telescópico'),
    (_company, 'Empilhadeira a combustão',      'locado',  'H',   90.00, 'Empilhadeira a combustão 2,5t'),
    (_company, 'Empilhadeira elétrica',         'locado',  'H',   75.00, 'Empilhadeira elétrica'),
    (_company, 'Talha elétrica',                'proprio', 'H',   14.00, 'Talha elétrica 1t'),
    (_company, 'Talha manual',                  'proprio', 'DIA',  3.00, 'Talha manual / Tirfor'),

    -- Andaimes / escoramento / formas
    (_company, 'Andaime fachadeiro (módulo)',   'locado',  'DIA',  3.50, 'Andaime fachadeiro por módulo/dia'),
    (_company, 'Andaime tubular (módulo)',      'locado',  'DIA',  2.80, 'Andaime tubular por módulo/dia'),
    (_company, 'Andaime suspenso (balancim)',   'locado',  'DIA', 25.00, 'Andaime suspenso motorizado'),
    (_company, 'Escoramento metálico (escora)', 'locado',  'DIA',  0.80, 'Escora metálica por unidade/dia'),
    (_company, 'Cimbramento de torres',         'locado',  'DIA', 12.00, 'Torre de cimbramento por unidade/dia'),
    (_company, 'Forma metálica de pilar',       'locado',  'DIA',  8.00, 'Forma metálica para pilar / m²'),
    (_company, 'Forma metálica de laje',        'locado',  'DIA',  6.00, 'Forma metálica para laje / m²'),

    -- Energia / pneumática / hidráulica
    (_company, 'Gerador 5 kVA',                 'locado',  'H',   25.00, 'Gerador a diesel 5 kVA'),
    (_company, 'Gerador 15 kVA',                'locado',  'H',   45.00, 'Gerador a diesel 15 kVA'),
    (_company, 'Gerador 50 kVA',                'locado',  'H',   85.00, 'Gerador a diesel 50 kVA'),
    (_company, 'Gerador 100 kVA',               'locado',  'H',  140.00, 'Gerador a diesel 100 kVA'),
    (_company, 'Gerador 250 kVA',               'locado',  'H',  220.00, 'Gerador a diesel 250 kVA'),
    (_company, 'Torre de iluminação',           'locado',  'DIA', 35.00, 'Torre de iluminação móvel'),
    (_company, 'Refletor LED de obra',          'proprio', 'DIA',  3.00, 'Refletor LED 200W'),
    (_company, 'Compressor de ar 10 pés',       'proprio', 'H',   28.00, 'Compressor de ar 10 pés'),
    (_company, 'Compressor de ar 20 pés',       'locado',  'H',   55.00, 'Compressor de ar 20 pés'),
    (_company, 'Compressor pneumático grande',  'locado',  'H',  110.00, 'Compressor 175 pcm'),
    (_company, 'Bomba submersível',             'proprio', 'H',   15.00, 'Bomba submersível para esgotamento'),
    (_company, 'Motobomba autoescorvante',      'proprio', 'H',   18.00, 'Motobomba a gasolina'),
    (_company, 'Bomba de recalque',             'proprio', 'H',   22.00, 'Bomba de recalque para água'),
    (_company, 'Bomba dosadora',                'proprio', 'H',   10.00, 'Bomba dosadora química'),

    -- Ferramentas / pequenos equipamentos
    (_company, 'Martelete rompedor',            'proprio', 'H',   12.00, 'Martelete rompedor elétrico'),
    (_company, 'Martelete demolidor grande',    'proprio', 'H',   18.00, 'Martelete demolidor 10kg'),
    (_company, 'Rompedor pneumático',           'locado',  'H',   45.00, 'Rompedor pneumático grande'),
    (_company, 'Furadeira de impacto',          'proprio', 'H',    4.00, 'Furadeira industrial'),
    (_company, 'Parafusadeira',                 'proprio', 'H',    3.00, 'Parafusadeira a bateria'),
    (_company, 'Serra circular de bancada',     'proprio', 'H',    8.00, 'Serra circular para madeira'),
    (_company, 'Serra circular manual',         'proprio', 'H',    6.00, 'Serra circular manual'),
    (_company, 'Serra mármore',                 'proprio', 'H',    6.00, 'Serra mármore para cerâmica'),
    (_company, 'Serra de bancada para azulejo', 'proprio', 'H',    9.00, 'Serra de bancada para cerâmica'),
    (_company, 'Cortador de cerâmica manual',   'proprio', 'DIA',  2.00, 'Cortador manual de cerâmica'),
    (_company, 'Policorte',                     'proprio', 'H',    8.00, 'Policorte para metais'),
    (_company, 'Esmerilhadeira / lixadeira',    'proprio', 'H',    5.00, 'Esmerilhadeira angular'),
    (_company, 'Lixadeira orbital',             'proprio', 'H',    4.00, 'Lixadeira orbital'),
    (_company, 'Máquina de solda 250A',         'proprio', 'H',   18.00, 'Máquina de solda 250A'),
    (_company, 'Máquina de solda MIG',          'proprio', 'H',   28.00, 'Máquina de solda MIG/MAG'),
    (_company, 'Maçarico oxicorte',             'proprio', 'H',   22.00, 'Conjunto oxicorte completo'),
    (_company, 'Dobradeira de ferro',           'proprio', 'H',   12.00, 'Dobradeira / bancada de ferreiro'),
    (_company, 'Cortadora de vergalhão',        'proprio', 'H',   14.00, 'Cortadora elétrica de vergalhão'),
    (_company, 'Vibroprensa para blocos',       'locado',  'H',   90.00, 'Vibroprensa para blocos de concreto'),
    (_company, 'Pistola de pintura',            'proprio', 'H',    8.00, 'Pistola airless de pintura'),
    (_company, 'Compressor de pintura',         'proprio', 'H',   12.00, 'Compressor para pintura'),
    (_company, 'Hidrojato de alta pressão',     'locado',  'H',   45.00, 'Hidrojato de alta pressão'),
    (_company, 'Roçadeira',                     'proprio', 'H',   10.00, 'Roçadeira a gasolina'),
    (_company, 'Motosserra',                    'proprio', 'H',   12.00, 'Motosserra a gasolina'),
    (_company, 'Aspirador industrial',          'proprio', 'DIA',  8.00, 'Aspirador industrial pó/água'),

    -- Fundação / sondagem
    (_company, 'Bate-estacas',                  'locado',  'H',  320.00, 'Bate-estacas / cravadora'),
    (_company, 'Perfuratriz para estaca',       'locado',  'H',  280.00, 'Perfuratriz hidráulica de estaca'),
    (_company, 'Perfuratriz manual (trado)',    'proprio', 'H',   18.00, 'Trado motorizado'),
    (_company, 'Estaca hélice contínua',        'locado',  'H',  420.00, 'Equipamento hélice contínua'),
    (_company, 'Sondagem SPT',                  'locado',  'H',   95.00, 'Equipamento de sondagem SPT'),
    (_company, 'Rompedor hidráulico (escav.)',  'locado',  'H',  120.00, 'Rompedor hidráulico para escavadeira'),

    -- Topografia / instrumentação
    (_company, 'Estação total',                 'proprio', 'DIA', 65.00, 'Estação total topográfica'),
    (_company, 'Nível ótico',                   'proprio', 'DIA', 18.00, 'Nível ótico topográfico'),
    (_company, 'Nível a laser',                 'proprio', 'DIA', 12.00, 'Nível a laser rotativo'),
    (_company, 'GPS topográfico (RTK)',         'locado',  'DIA',150.00, 'GPS topográfico RTK'),
    (_company, 'Drone para levantamento',       'proprio', 'DIA', 80.00, 'Drone para aerolevantamento'),
    (_company, 'Termo-higrômetro',              'proprio', 'DIA',  3.00, 'Termo-higrômetro para concreto'),
    (_company, 'Esclerômetro',                  'proprio', 'DIA',  8.00, 'Esclerômetro para concreto'),

    -- Apoio / canteiro
    (_company, 'Container escritório',          'locado',  'DIA',  8.00, 'Container 6m para escritório'),
    (_company, 'Container almoxarifado',        'locado',  'DIA',  7.00, 'Container almoxarifado'),
    (_company, 'Container vestiário',           'locado',  'DIA',  9.00, 'Container vestiário'),
    (_company, 'Banheiro químico',              'locado',  'DIA',  6.00, 'Banheiro químico portátil'),
    (_company, 'Tapume metálico (m linear)',    'locado',  'DIA',  0.50, 'Tapume metálico galvanizado'),
    (_company, 'Bebedouro industrial',          'proprio', 'DIA',  2.00, 'Bebedouro industrial para canteiro'),
    (_company, 'Extintor de incêndio',          'proprio', 'DIA',  0.50, 'Extintor PQS / CO₂'),
    (_company, 'Rádio comunicador (par)',       'proprio', 'DIA',  4.00, 'Par de rádios HT'),
    (_company, 'Veículo utilitário (pickup)',   'locado',  'DIA',180.00, 'Pickup 4x4 para apoio'),
    (_company, 'Van de transporte',             'locado',  'DIA',220.00, 'Van para transporte de equipe')
  ON CONFLICT DO NOTHING;
END $function$;