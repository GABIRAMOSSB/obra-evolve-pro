
-- =========================================================
-- FASE A: Novo modelo de dados do Boletim de Medição
-- Aditivo — não remove nem renomeia nada existente
-- =========================================================

-- ---------- 1. ORCAMENTO_VERSOES ----------
CREATE TABLE IF NOT EXISTS public.orcamento_versoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  contrato_id UUID REFERENCES public.contratos(id) ON DELETE SET NULL,
  numero_versao INTEGER NOT NULL,
  descricao TEXT,
  valor_total_cents BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','congelada','substituida')),
  congelada_em TIMESTAMPTZ,
  congelada_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','import_excel','import_csv','migracao','aditivo')),
  origem_arquivo TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero_versao)
);

CREATE INDEX IF NOT EXISTS orcamento_versoes_company_idx ON public.orcamento_versoes(company_id);
CREATE INDEX IF NOT EXISTS orcamento_versoes_obra_idx ON public.orcamento_versoes(obra_id);
CREATE INDEX IF NOT EXISTS orcamento_versoes_contrato_idx ON public.orcamento_versoes(contrato_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_versoes TO authenticated;
GRANT ALL ON public.orcamento_versoes TO service_role;
ALTER TABLE public.orcamento_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select orcamento_versoes" ON public.orcamento_versoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_versoes.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "Editors insert orcamento_versoes" ON public.orcamento_versoes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_versoes.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "Editors update rascunho orcamento_versoes" ON public.orcamento_versoes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_versoes.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')) AND status = 'rascunho')
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_versoes.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "Admins update any orcamento_versoes" ON public.orcamento_versoes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_versoes.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_versoes.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

CREATE POLICY "Admins delete orcamento_versoes" ON public.orcamento_versoes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_versoes.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

CREATE TRIGGER orcamento_versoes_updated_at BEFORE UPDATE ON public.orcamento_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 2. ORCAMENTO_ITENS ----------
CREATE TABLE IF NOT EXISTS public.orcamento_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  versao_id UUID NOT NULL REFERENCES public.orcamento_versoes(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  item_codigo TEXT NOT NULL,
  item_codigo_pai TEXT,
  nivel INTEGER NOT NULL DEFAULT 1,
  tipo TEXT NOT NULL DEFAULT 'item' CHECK (tipo IN ('etapa','subetapa','grupo','item')),
  descricao TEXT NOT NULL,
  unidade TEXT,
  qtd_contratada NUMERIC(18,4) NOT NULL DEFAULT 0,
  valor_unitario_cents BIGINT NOT NULL DEFAULT 0,
  total_contratado_cents BIGINT NOT NULL DEFAULT 0,
  ordem INTEGER NOT NULL DEFAULT 0,
  sinapi_codigo TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (versao_id, item_codigo)
);

CREATE INDEX IF NOT EXISTS orcamento_itens_versao_idx ON public.orcamento_itens(versao_id);
CREATE INDEX IF NOT EXISTS orcamento_itens_company_idx ON public.orcamento_itens(company_id);
CREATE INDEX IF NOT EXISTS orcamento_itens_obra_codigo_idx ON public.orcamento_itens(obra_id, item_codigo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO authenticated;
GRANT ALL ON public.orcamento_itens TO service_role;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select orcamento_itens" ON public.orcamento_itens FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_itens.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "Editors insert orcamento_itens em rascunho" ON public.orcamento_itens FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_itens.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor'))
  AND EXISTS (SELECT 1 FROM orcamento_versoes v WHERE v.id = orcamento_itens.versao_id AND v.status = 'rascunho')
);

CREATE POLICY "Editors update orcamento_itens em rascunho" ON public.orcamento_itens FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_itens.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor'))
  AND EXISTS (SELECT 1 FROM orcamento_versoes v WHERE v.id = orcamento_itens.versao_id AND v.status = 'rascunho')
)
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_itens.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "Admins delete orcamento_itens em rascunho" ON public.orcamento_itens FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = orcamento_itens.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin')
  AND EXISTS (SELECT 1 FROM orcamento_versoes v WHERE v.id = orcamento_itens.versao_id AND v.status = 'rascunho')
);

CREATE TRIGGER orcamento_itens_updated_at BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- 3. BOLETIM_APROVACOES ----------
CREATE TABLE IF NOT EXISTS public.boletim_aprovacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  medicao_id UUID NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  aprovador_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovador_nome TEXT,
  papel TEXT NOT NULL DEFAULT 'aprovador' CHECK (papel IN ('responsavel_tecnico','fiscal','gerente','aprovador','contratante')),
  decisao TEXT NOT NULL CHECK (decisao IN ('aprovada','reprovada','solicita_revisao','pendente')),
  justificativa TEXT,
  decidido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boletim_aprovacoes_medicao_idx ON public.boletim_aprovacoes(medicao_id);
CREATE INDEX IF NOT EXISTS boletim_aprovacoes_company_idx ON public.boletim_aprovacoes(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boletim_aprovacoes TO authenticated;
GRANT ALL ON public.boletim_aprovacoes TO service_role;
ALTER TABLE public.boletim_aprovacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select boletim_aprovacoes" ON public.boletim_aprovacoes FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_aprovacoes.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "Editors insert boletim_aprovacoes" ON public.boletim_aprovacoes FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_aprovacoes.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "Admins update boletim_aprovacoes" ON public.boletim_aprovacoes FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_aprovacoes.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_aprovacoes.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

CREATE POLICY "Admins delete boletim_aprovacoes" ON public.boletim_aprovacoes FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_aprovacoes.company_id AND cm.user_id = auth.uid() AND cm.role = 'admin'));

-- ---------- 4. BOLETIM_ANEXOS ----------
CREATE TABLE IF NOT EXISTS public.boletim_anexos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  medicao_id UUID NOT NULL REFERENCES public.medicoes(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  categoria TEXT CHECK (categoria IN ('fotografia','planilha','relatorio','projeto','ata','outro')),
  descricao TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boletim_anexos_medicao_idx ON public.boletim_anexos(medicao_id);
CREATE INDEX IF NOT EXISTS boletim_anexos_company_idx ON public.boletim_anexos(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boletim_anexos TO authenticated;
GRANT ALL ON public.boletim_anexos TO service_role;
ALTER TABLE public.boletim_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select boletim_anexos" ON public.boletim_anexos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_anexos.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "Editors insert boletim_anexos" ON public.boletim_anexos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_anexos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "Editors update boletim_anexos" ON public.boletim_anexos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_anexos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')))
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_anexos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE POLICY "Editors delete boletim_anexos" ON public.boletim_anexos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_anexos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

-- ---------- 5. BOLETIM_AUDIT_LOGS ----------
CREATE TABLE IF NOT EXISTS public.boletim_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  medicao_id UUID REFERENCES public.medicoes(id) ON DELETE CASCADE,
  entidade TEXT NOT NULL,
  entidade_id UUID,
  acao TEXT NOT NULL CHECK (acao IN ('create','update','delete','approve','reject','snapshot','import')),
  campo TEXT,
  valor_anterior JSONB,
  valor_novo JSONB,
  justificativa TEXT,
  ator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ator_nome TEXT,
  ip_origem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boletim_audit_medicao_idx ON public.boletim_audit_logs(medicao_id);
CREATE INDEX IF NOT EXISTS boletim_audit_entidade_idx ON public.boletim_audit_logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS boletim_audit_company_idx ON public.boletim_audit_logs(company_id, created_at DESC);

GRANT SELECT, INSERT ON public.boletim_audit_logs TO authenticated;
GRANT ALL ON public.boletim_audit_logs TO service_role;
ALTER TABLE public.boletim_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members select boletim_audit_logs" ON public.boletim_audit_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_audit_logs.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "Members insert boletim_audit_logs" ON public.boletim_audit_logs FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = boletim_audit_logs.company_id AND cm.user_id = auth.uid()));

-- ---------- 6. LIGAÇÕES OPCIONAIS EM MEDICOES / MEDICAO_ITENS ----------
ALTER TABLE public.medicoes
  ADD COLUMN IF NOT EXISTS versao_orcamento_id UUID REFERENCES public.orcamento_versoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS medicoes_versao_orcamento_idx ON public.medicoes(versao_orcamento_id);

ALTER TABLE public.medicao_itens
  ADD COLUMN IF NOT EXISTS orcamento_item_id UUID REFERENCES public.orcamento_itens(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS justificativa TEXT,
  ADD COLUMN IF NOT EXISTS nivel INTEGER,
  ADD COLUMN IF NOT EXISTS item_codigo_pai TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT;

CREATE INDEX IF NOT EXISTS medicao_itens_orcamento_item_idx ON public.medicao_itens(orcamento_item_id);
