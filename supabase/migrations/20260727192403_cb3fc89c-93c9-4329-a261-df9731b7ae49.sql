
-- ============================================================
-- Módulo Subempreiteiros
-- ============================================================

-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.sub_contrato_status AS ENUM ('em_andamento','suspenso','finalizado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sub_medicao_status AS ENUM ('rascunho','em_conferencia','aguardando_assinatura','assinada','liberada_pagamento','paga');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.sub_pagamento_forma AS ENUM ('pix','ted','doc','transferencia','cheque','dinheiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: updated_at
CREATE OR REPLACE FUNCTION public.tg_sub_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============================================================
-- 1) subempreiteiros
-- ============================================================
CREATE TABLE public.subempreiteiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  razao_social text NOT NULL,
  nome_fantasia text,
  cnpj text,
  responsavel text,
  telefone text,
  email text,
  endereco text,
  cidade text,
  uf text,
  cep text,
  banco text,
  agencia text,
  conta text,
  pix text,
  observacoes text,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subempreiteiros TO authenticated;
GRANT ALL ON public.subempreiteiros TO service_role;
ALTER TABLE public.subempreiteiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_empresas_select ON public.subempreiteiros FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY sub_empresas_insert ON public.subempreiteiros FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY sub_empresas_update ON public.subempreiteiros FOR UPDATE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE POLICY sub_empresas_delete ON public.subempreiteiros FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE TRIGGER trg_sub_empresas_touch BEFORE UPDATE ON public.subempreiteiros
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_touch_updated_at();
CREATE INDEX idx_sub_empresas_company ON public.subempreiteiros(company_id);
CREATE INDEX idx_sub_empresas_cnpj ON public.subempreiteiros(company_id, cnpj);

-- ============================================================
-- 2) subempreiteiro_documentos
-- ============================================================
CREATE TABLE public.subempreiteiro_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  subempreiteiro_id uuid NOT NULL REFERENCES public.subempreiteiros(id) ON DELETE CASCADE,
  nome text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subempreiteiro_documentos TO authenticated;
GRANT ALL ON public.subempreiteiro_documentos TO service_role;
ALTER TABLE public.subempreiteiro_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_docs_select ON public.subempreiteiro_documentos FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY sub_docs_write ON public.subempreiteiro_documentos FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE TRIGGER trg_sub_docs_touch BEFORE UPDATE ON public.subempreiteiro_documentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_touch_updated_at();
CREATE INDEX idx_sub_docs_sub ON public.subempreiteiro_documentos(subempreiteiro_id);

-- ============================================================
-- 3) sub_contratos
-- ============================================================
CREATE TABLE public.sub_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id uuid NOT NULL REFERENCES public.obras(id) ON DELETE RESTRICT,
  subempreiteiro_id uuid NOT NULL REFERENCES public.subempreiteiros(id) ON DELETE RESTRICT,
  numero text NOT NULL,
  data_inicio date,
  data_fim date,
  valor_maximo numeric(14,2) NOT NULL DEFAULT 0,
  objeto text,
  responsavel text,
  status public.sub_contrato_status NOT NULL DEFAULT 'em_andamento',
  pdf_storage_path text,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_contratos TO authenticated;
GRANT ALL ON public.sub_contratos TO service_role;
ALTER TABLE public.sub_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_ct_select ON public.sub_contratos FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY sub_ct_write ON public.sub_contratos FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE TRIGGER trg_sub_ct_touch BEFORE UPDATE ON public.sub_contratos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_touch_updated_at();
CREATE INDEX idx_sub_ct_obra ON public.sub_contratos(obra_id);
CREATE INDEX idx_sub_ct_sub ON public.sub_contratos(subempreiteiro_id);
CREATE INDEX idx_sub_ct_company ON public.sub_contratos(company_id);

-- ============================================================
-- 4) sub_contrato_servicos
-- ============================================================
CREATE TABLE public.sub_contrato_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.sub_contratos(id) ON DELETE CASCADE,
  origem_orcamento_item_id uuid REFERENCES public.orcamento_itens(id) ON DELETE SET NULL,
  codigo text,
  descricao text NOT NULL,
  unidade text,
  qtd_contratada numeric(14,4) NOT NULL DEFAULT 0,
  preco_unitario numeric(14,4) NOT NULL DEFAULT 0,
  preco_venda_cliente numeric(14,4),
  qtd_executada numeric(14,4) NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_contrato_servicos TO authenticated;
GRANT ALL ON public.sub_contrato_servicos TO service_role;
ALTER TABLE public.sub_contrato_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_svc_select ON public.sub_contrato_servicos FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY sub_svc_write ON public.sub_contrato_servicos FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE TRIGGER trg_sub_svc_touch BEFORE UPDATE ON public.sub_contrato_servicos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_touch_updated_at();
CREATE INDEX idx_sub_svc_contrato ON public.sub_contrato_servicos(contrato_id);

-- ============================================================
-- 5) sub_medicoes
-- ============================================================
CREATE TABLE public.sub_medicoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contrato_id uuid NOT NULL REFERENCES public.sub_contratos(id) ON DELETE RESTRICT,
  numero integer NOT NULL,
  competencia text,
  data_medicao date NOT NULL DEFAULT CURRENT_DATE,
  responsavel_conferencia text,
  status public.sub_medicao_status NOT NULL DEFAULT 'rascunho',
  observacoes text,
  ret_inss numeric(14,2) NOT NULL DEFAULT 0,
  ret_iss numeric(14,2) NOT NULL DEFAULT 0,
  ret_irrf numeric(14,2) NOT NULL DEFAULT 0,
  ret_outras numeric(14,2) NOT NULL DEFAULT 0,
  valor_bruto numeric(14,2) NOT NULL DEFAULT 0,
  valor_liquido numeric(14,2) NOT NULL DEFAULT 0,
  assinatura_base64 text,
  assinatura_nome text,
  signed_at timestamptz,
  signed_by uuid REFERENCES auth.users(id),
  signed_ip text,
  locked_at timestamptz,
  recibo_token uuid NOT NULL DEFAULT gen_random_uuid(),
  recibo_pdf_path text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contrato_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_medicoes TO authenticated;
GRANT ALL ON public.sub_medicoes TO service_role;
ALTER TABLE public.sub_medicoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_med_select ON public.sub_medicoes FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY sub_med_write ON public.sub_medicoes FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE TRIGGER trg_sub_med_touch BEFORE UPDATE ON public.sub_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_touch_updated_at();
CREATE INDEX idx_sub_med_contrato ON public.sub_medicoes(contrato_id);
CREATE INDEX idx_sub_med_status ON public.sub_medicoes(company_id, status);

-- Bloqueia edição pós-assinatura
CREATE OR REPLACE FUNCTION public.tg_sub_med_lock_after_sign()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    -- Permite apenas mudança de status para liberada_pagamento/paga e recibo/pagamentos meta
    IF (NEW.status NOT IN ('assinada','liberada_pagamento','paga'))
       OR NEW.contrato_id IS DISTINCT FROM OLD.contrato_id
       OR NEW.numero IS DISTINCT FROM OLD.numero
       OR NEW.valor_bruto IS DISTINCT FROM OLD.valor_bruto
       OR NEW.valor_liquido IS DISTINCT FROM OLD.valor_liquido
       OR NEW.ret_inss IS DISTINCT FROM OLD.ret_inss
       OR NEW.ret_iss IS DISTINCT FROM OLD.ret_iss
       OR NEW.ret_irrf IS DISTINCT FROM OLD.ret_irrf
       OR NEW.ret_outras IS DISTINCT FROM OLD.ret_outras THEN
      RAISE EXCEPTION 'Medição assinada não pode ser editada.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sub_med_lock BEFORE UPDATE ON public.sub_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_med_lock_after_sign();

-- ============================================================
-- 6) sub_medicao_itens
-- ============================================================
CREATE TABLE public.sub_medicao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  medicao_id uuid NOT NULL REFERENCES public.sub_medicoes(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.sub_contrato_servicos(id) ON DELETE RESTRICT,
  qtd_anterior numeric(14,4) NOT NULL DEFAULT 0,
  qtd_periodo numeric(14,4) NOT NULL DEFAULT 0,
  preco_unitario numeric(14,4) NOT NULL DEFAULT 0,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (medicao_id, servico_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_medicao_itens TO authenticated;
GRANT ALL ON public.sub_medicao_itens TO service_role;
ALTER TABLE public.sub_medicao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_med_itens_select ON public.sub_medicao_itens FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY sub_med_itens_write ON public.sub_medicao_itens FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE TRIGGER trg_sub_med_itens_touch BEFORE UPDATE ON public.sub_medicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_touch_updated_at();
CREATE INDEX idx_sub_med_itens_med ON public.sub_medicao_itens(medicao_id);
CREATE INDEX idx_sub_med_itens_svc ON public.sub_medicao_itens(servico_id);

-- Nunca medir acima do contratado
CREATE OR REPLACE FUNCTION public.tg_sub_med_item_cap()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_contratada numeric(14,4);
  v_ja_medido numeric(14,4);
BEGIN
  SELECT qtd_contratada INTO v_contratada FROM public.sub_contrato_servicos WHERE id = NEW.servico_id;
  IF v_contratada IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(i.qtd_periodo),0) INTO v_ja_medido
    FROM public.sub_medicao_itens i
    JOIN public.sub_medicoes m ON m.id = i.medicao_id
   WHERE i.servico_id = NEW.servico_id
     AND i.id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid);

  IF (v_ja_medido + COALESCE(NEW.qtd_periodo,0)) > v_contratada + 0.0001 THEN
    RAISE EXCEPTION 'Quantidade medida (% ) excede o contratado (%) para o serviço.', (v_ja_medido + NEW.qtd_periodo), v_contratada;
  END IF;

  NEW.valor := ROUND(COALESCE(NEW.qtd_periodo,0) * COALESCE(NEW.preco_unitario,0), 2);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sub_med_item_cap BEFORE INSERT OR UPDATE ON public.sub_medicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_med_item_cap();

-- Recalcula qtd_executada do serviço quando itens mudam (considera apenas medições assinadas+)
CREATE OR REPLACE FUNCTION public.tg_sub_med_item_recalc_svc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_svc uuid;
BEGIN
  v_svc := COALESCE(NEW.servico_id, OLD.servico_id);
  UPDATE public.sub_contrato_servicos s
     SET qtd_executada = COALESCE((
       SELECT SUM(i.qtd_periodo)
         FROM public.sub_medicao_itens i
         JOIN public.sub_medicoes m ON m.id = i.medicao_id
        WHERE i.servico_id = s.id
          AND m.status IN ('assinada','liberada_pagamento','paga')
     ),0)
   WHERE s.id = v_svc;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_sub_med_item_recalc AFTER INSERT OR UPDATE OR DELETE ON public.sub_medicao_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_med_item_recalc_svc();

-- Também recalcula quando o status da medição muda
CREATE OR REPLACE FUNCTION public.tg_sub_med_status_recalc()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    UPDATE public.sub_contrato_servicos s
       SET qtd_executada = COALESCE((
         SELECT SUM(i.qtd_periodo)
           FROM public.sub_medicao_itens i
           JOIN public.sub_medicoes m ON m.id = i.medicao_id
          WHERE i.servico_id = s.id
            AND m.status IN ('assinada','liberada_pagamento','paga')
       ),0)
     WHERE s.id IN (SELECT servico_id FROM public.sub_medicao_itens WHERE medicao_id = NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sub_med_status_recalc AFTER UPDATE OF status ON public.sub_medicoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_med_status_recalc();

-- ============================================================
-- 7) sub_pagamentos
-- ============================================================
CREATE TABLE public.sub_pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  medicao_id uuid NOT NULL REFERENCES public.sub_medicoes(id) ON DELETE RESTRICT,
  data_pagamento date NOT NULL DEFAULT CURRENT_DATE,
  forma public.sub_pagamento_forma NOT NULL,
  conta_bancaria text,
  numero_comprovante text,
  comprovante_storage_path text,
  valor_pago numeric(14,2) NOT NULL CHECK (valor_pago > 0),
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_pagamentos TO authenticated;
GRANT ALL ON public.sub_pagamentos TO service_role;
ALTER TABLE public.sub_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY sub_pg_select ON public.sub_pagamentos FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
CREATE POLICY sub_pg_write ON public.sub_pagamentos FOR ALL TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin','editor']))
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));
CREATE TRIGGER trg_sub_pg_touch BEFORE UPDATE ON public.sub_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_touch_updated_at();
CREATE INDEX idx_sub_pg_medicao ON public.sub_pagamentos(medicao_id);
CREATE INDEX idx_sub_pg_company ON public.sub_pagamentos(company_id);

-- Valida pagamento: medição assinada+ e sem exceder valor líquido
CREATE OR REPLACE FUNCTION public.tg_sub_pg_validate()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_status public.sub_medicao_status;
  v_liquido numeric(14,2);
  v_pago numeric(14,2);
BEGIN
  SELECT status, valor_liquido INTO v_status, v_liquido
    FROM public.sub_medicoes WHERE id = NEW.medicao_id;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Medição não encontrada.';
  END IF;
  IF v_status NOT IN ('assinada','liberada_pagamento','paga') THEN
    RAISE EXCEPTION 'Somente medições assinadas podem receber pagamentos (status atual: %).', v_status;
  END IF;
  SELECT COALESCE(SUM(valor_pago),0) INTO v_pago
    FROM public.sub_pagamentos
   WHERE medicao_id = NEW.medicao_id
     AND id <> COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid);
  IF (v_pago + NEW.valor_pago) > v_liquido + 0.001 THEN
    RAISE EXCEPTION 'Soma dos pagamentos (%.2f) excede o valor líquido da medição (%.2f).', (v_pago + NEW.valor_pago), v_liquido;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sub_pg_validate BEFORE INSERT OR UPDATE ON public.sub_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_pg_validate();

-- Marca medição como 'paga' quando totalmente paga
CREATE OR REPLACE FUNCTION public.tg_sub_pg_after()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_med uuid;
  v_liquido numeric(14,2);
  v_pago numeric(14,2);
BEGIN
  v_med := COALESCE(NEW.medicao_id, OLD.medicao_id);
  SELECT valor_liquido INTO v_liquido FROM public.sub_medicoes WHERE id = v_med;
  SELECT COALESCE(SUM(valor_pago),0) INTO v_pago FROM public.sub_pagamentos WHERE medicao_id = v_med;
  IF v_liquido IS NOT NULL AND v_pago >= v_liquido - 0.001 AND v_liquido > 0 THEN
    UPDATE public.sub_medicoes SET status = 'paga' WHERE id = v_med AND status <> 'paga';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_sub_pg_after AFTER INSERT OR UPDATE OR DELETE ON public.sub_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_sub_pg_after();
