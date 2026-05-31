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
    (_company, 'Betoneira 400L',                'proprio', 'H',   15.00, 'Betoneira elétrica 400 litros'),
    (_company, 'Betoneira 600L',                'proprio', 'H',   22.00, 'Betoneira elétrica 600 litros'),
    (_company, 'Vibrador de imersão',           'proprio', 'H',   12.00, 'Vibrador de concreto, mangote 35mm'),
    (_company, 'Régua vibratória',              'proprio', 'H',   18.00, 'Régua vibratória para concreto'),
    (_company, 'Compactador de solo (sapo)',    'proprio', 'H',   25.00, 'Compactador tipo sapo a gasolina'),
    (_company, 'Placa vibratória',              'proprio', 'H',   20.00, 'Placa vibratória reversível'),
    (_company, 'Rolo compactador pequeno',      'locado',  'H',   85.00, 'Rolo compactador 1-3t'),
    (_company, 'Rolo compactador grande',       'locado',  'H',  180.00, 'Rolo compactador 7-12t'),
    (_company, 'Retroescavadeira',              'locado',  'H',  180.00, 'Retroescavadeira tipo JCB / Case 580'),
    (_company, 'Escavadeira hidráulica',        'locado',  'H',  250.00, 'Escavadeira hidráulica 20t'),
    (_company, 'Mini-escavadeira',              'locado',  'H',  140.00, 'Mini-escavadeira 1-3t'),
    (_company, 'Pá carregadeira',               'locado',  'H',  220.00, 'Pá carregadeira sobre pneus'),
    (_company, 'Motoniveladora',                'locado',  'H',  280.00, 'Patrol motoniveladora'),
    (_company, 'Trator de esteira',             'locado',  'H',  300.00, 'Trator de esteira D6'),
    (_company, 'Caminhão basculante',           'locado',  'H',  150.00, 'Caminhão basculante toco'),
    (_company, 'Caminhão truck basculante',     'locado',  'H',  190.00, 'Caminhão truck basculante 10m³'),
    (_company, 'Caminhão munck',                'locado',  'H',  220.00, 'Caminhão munck com guindaste'),
    (_company, 'Caminhão pipa',                 'locado',  'H',  170.00, 'Caminhão pipa 10.000 L'),
    (_company, 'Caminhão betoneira',            'locado',  'H',  200.00, 'Caminhão betoneira / mixer'),
    (_company, 'Bomba lança de concreto',       'locado',  'H',  350.00, 'Bomba lança autopropelida'),
    (_company, 'Bomba estacionária de concreto','locado',  'H',  180.00, 'Bomba estacionária de concreto'),
    (_company, 'Guincho de coluna',             'proprio', 'H',   18.00, 'Guincho elétrico de coluna'),
    (_company, 'Elevador de obra (cremalheira)','locado',  'H',   45.00, 'Elevador de carga e passageiros'),
    (_company, 'Grua',                          'locado',  'H',  280.00, 'Grua torre para edificação'),
    (_company, 'Plataforma elevatória tesoura', 'locado',  'H',   95.00, 'Plataforma tipo tesoura 10m'),
    (_company, 'Plataforma elevatória articulada','locado','H',  140.00, 'Plataforma articulada 16m'),
    (_company, 'Manipulador telescópico',       'locado',  'H',  180.00, 'Manipulador telescópico'),
    (_company, 'Empilhadeira',                  'locado',  'H',   90.00, 'Empilhadeira a combustão'),
    (_company, 'Andaime fachadeiro (módulo)',   'locado',  'DIA',  3.50, 'Andaime fachadeiro por módulo/dia'),
    (_company, 'Andaime tubular (módulo)',      'locado',  'DIA',  2.80, 'Andaime tubular por módulo/dia'),
    (_company, 'Escoramento metálico (escora)', 'locado',  'DIA',  0.80, 'Escora metálica por unidade/dia'),
    (_company, 'Gerador de energia 5 kVA',      'locado',  'H',   25.00, 'Gerador a diesel 5 kVA'),
    (_company, 'Gerador de energia 50 kVA',     'locado',  'H',   85.00, 'Gerador a diesel 50 kVA'),
    (_company, 'Compressor de ar',              'proprio', 'H',   28.00, 'Compressor de ar 10 pés'),
    (_company, 'Martelete rompedor',            'proprio', 'H',   12.00, 'Martelete rompedor elétrico'),
    (_company, 'Rompedor pneumático',           'locado',  'H',   45.00, 'Rompedor pneumático grande'),
    (_company, 'Furadeira de impacto',          'proprio', 'H',    4.00, 'Furadeira industrial'),
    (_company, 'Serra circular de bancada',     'proprio', 'H',    8.00, 'Serra circular para madeira'),
    (_company, 'Serra mármore',                 'proprio', 'H',    6.00, 'Serra mármore para cerâmica'),
    (_company, 'Policorte',                     'proprio', 'H',    8.00, 'Policorte para metais'),
    (_company, 'Lixadeira de piso',             'locado',  'H',   35.00, 'Lixadeira politriz para concreto'),
    (_company, 'Acabadora de superfície',       'locado',  'H',   55.00, 'Acabadora helicóptero para concreto'),
    (_company, 'Máquina de solda',              'proprio', 'H',   18.00, 'Máquina de solda 250A'),
    (_company, 'Maçarico oxicorte',             'proprio', 'H',   22.00, 'Conjunto oxicorte completo'),
    (_company, 'Bomba submersível',             'proprio', 'H',   15.00, 'Bomba submersível para esgotamento'),
    (_company, 'Motobomba autoescorvante',      'proprio', 'H',   18.00, 'Motobomba a gasolina'),
    (_company, 'Bate-estacas',                  'locado',  'H',  320.00, 'Bate-estacas / cravadora'),
    (_company, 'Perfuratriz para estaca',       'locado',  'H',  280.00, 'Perfuratriz hidráulica'),
    (_company, 'Perfuratriz manual (trado)',    'proprio', 'H',   18.00, 'Trado motorizado'),
    (_company, 'Container escritório',          'locado',  'DIA',  8.00, 'Container 6m para escritório'),
    (_company, 'Banheiro químico',              'locado',  'DIA',  6.00, 'Banheiro químico portátil')
  ON CONFLICT DO NOTHING;
END $function$;