-- helpers: keep_id = oldest row per (company_id, lower(nome))
WITH keepers AS (
  SELECT DISTINCT ON (company_id, lower(nome)) id AS keep_id, company_id, lower(nome) AS lname
  FROM public.funcoes_mao_obra
  ORDER BY company_id, lower(nome), created_at ASC, id
)
UPDATE public.apontamentos_mao_obra a
SET funcao_id = k.keep_id
FROM public.funcoes_mao_obra f
JOIN keepers k ON k.company_id = f.company_id AND k.lname = lower(f.nome)
WHERE a.funcao_id = f.id AND f.id <> k.keep_id;

WITH keepers AS (
  SELECT DISTINCT ON (company_id, lower(nome)) id AS keep_id, company_id, lower(nome) AS lname
  FROM public.funcoes_mao_obra
  ORDER BY company_id, lower(nome), created_at ASC, id
)
UPDATE public.funcionarios fu
SET funcao_id = k.keep_id
FROM public.funcoes_mao_obra f
JOIN keepers k ON k.company_id = f.company_id AND k.lname = lower(f.nome)
WHERE fu.funcao_id = f.id AND f.id <> k.keep_id;

DELETE FROM public.funcoes_mao_obra a
USING public.funcoes_mao_obra b
WHERE a.company_id = b.company_id
  AND lower(a.nome) = lower(b.nome)
  AND a.created_at > b.created_at;

ALTER TABLE public.funcoes_mao_obra
  ADD CONSTRAINT funcoes_mao_obra_company_nome_key UNIQUE (company_id, nome);

-- equipamentos
WITH keepers AS (
  SELECT DISTINCT ON (company_id, lower(nome)) id AS keep_id, company_id, lower(nome) AS lname
  FROM public.equipamentos
  ORDER BY company_id, lower(nome), created_at ASC, id
)
UPDATE public.apontamentos_mao_obra a
SET equipamento_id = k.keep_id
FROM public.equipamentos e
JOIN keepers k ON k.company_id = e.company_id AND k.lname = lower(e.nome)
WHERE a.equipamento_id = e.id AND e.id <> k.keep_id;

DELETE FROM public.equipamentos a
USING public.equipamentos b
WHERE a.company_id = b.company_id
  AND lower(a.nome) = lower(b.nome)
  AND a.created_at > b.created_at;

ALTER TABLE public.equipamentos
  ADD CONSTRAINT equipamentos_company_nome_key UNIQUE (company_id, nome);