
-- =====================
-- TABELA: editais
-- =====================
CREATE TABLE public.editais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  oportunidade_id UUID REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  orgao TEXT,
  numero_edital TEXT,
  modalidade TEXT,
  objeto TEXT,
  valor_estimado NUMERIC,
  data_abertura TIMESTAMPTZ,
  url_origem TEXT,
  origem TEXT NOT NULL DEFAULT 'manual', -- manual | pncp | upload
  status TEXT NOT NULL DEFAULT 'novo', -- novo | processando | analisado | erro | arquivado
  resumo_ia TEXT,
  ia_modelo TEXT,
  ia_processado_em TIMESTAMPTZ,
  ia_erro TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_editais_company ON public.editais(company_id);
CREATE INDEX idx_editais_oportunidade ON public.editais(oportunidade_id) WHERE oportunidade_id IS NOT NULL;
CREATE INDEX idx_editais_status ON public.editais(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.editais TO authenticated;
GRANT ALL ON public.editais TO service_role;

ALTER TABLE public.editais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "editais_select_members" ON public.editais FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = editais.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "editais_insert_members" ON public.editais FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = editais.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "editais_update_members" ON public.editais FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = editais.company_id AND cm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = editais.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "editais_delete_members" ON public.editais FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = editais.company_id AND cm.user_id = auth.uid()));

CREATE TRIGGER trg_editais_updated_at BEFORE UPDATE ON public.editais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- TABELA: edital_documentos
-- =====================
CREATE TABLE public.edital_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  storage_path TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'edital', -- edital | anexo | termo_referencia | planilha
  texto_extraido TEXT,
  paginas INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_edital_documentos_edital ON public.edital_documentos(edital_id);
CREATE INDEX idx_edital_documentos_company ON public.edital_documentos(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.edital_documentos TO authenticated;
GRANT ALL ON public.edital_documentos TO service_role;

ALTER TABLE public.edital_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edital_documentos_select_members" ON public.edital_documentos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_documentos.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "edital_documentos_insert_members" ON public.edital_documentos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_documentos.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "edital_documentos_update_members" ON public.edital_documentos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_documentos.company_id AND cm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_documentos.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "edital_documentos_delete_members" ON public.edital_documentos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_documentos.company_id AND cm.user_id = auth.uid()));

-- =====================
-- TABELA: edital_checklist
-- =====================
CREATE TABLE public.edital_checklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  edital_id UUID NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL, -- habilitacao_juridica | regularidade_fiscal | qualificacao_tecnica | qualificacao_economica | documentos_proposta | outros
  requisito TEXT NOT NULL,
  obrigatorio BOOLEAN NOT NULL DEFAULT true,
  pagina_referencia INTEGER,
  trecho_edital TEXT,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | ok | faltante | nao_aplicavel
  observacoes TEXT,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_edital_checklist_edital ON public.edital_checklist(edital_id);
CREATE INDEX idx_edital_checklist_company ON public.edital_checklist(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.edital_checklist TO authenticated;
GRANT ALL ON public.edital_checklist TO service_role;

ALTER TABLE public.edital_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edital_checklist_select_members" ON public.edital_checklist FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "edital_checklist_insert_members" ON public.edital_checklist FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "edital_checklist_update_members" ON public.edital_checklist FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist.company_id AND cm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist.company_id AND cm.user_id = auth.uid()));

CREATE POLICY "edital_checklist_delete_members" ON public.edital_checklist FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist.company_id AND cm.user_id = auth.uid()));

CREATE TRIGGER trg_edital_checklist_updated_at BEFORE UPDATE ON public.edital_checklist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
