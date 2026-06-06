
-- ============ BIBLIOTECA DE DOCUMENTOS ============
CREATE TABLE public.biblioteca_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL, -- habilitacao_juridica | regularidade_fiscal | qualificacao_tecnica | qualificacao_economica | documentos_proposta | outros
  nome TEXT NOT NULL,
  descricao TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  storage_path TEXT NOT NULL,
  data_emissao DATE,
  data_validade DATE,
  emissor TEXT,
  numero_documento TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_biblioteca_company ON public.biblioteca_documentos(company_id);
CREATE INDEX idx_biblioteca_categoria ON public.biblioteca_documentos(company_id, categoria);
CREATE INDEX idx_biblioteca_tags ON public.biblioteca_documentos USING GIN(tags);
CREATE INDEX idx_biblioteca_validade ON public.biblioteca_documentos(company_id, data_validade) WHERE data_validade IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.biblioteca_documentos TO authenticated;
GRANT ALL ON public.biblioteca_documentos TO service_role;
ALTER TABLE public.biblioteca_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "biblioteca_select" ON public.biblioteca_documentos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = biblioteca_documentos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "biblioteca_insert" ON public.biblioteca_documentos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = biblioteca_documentos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "biblioteca_update" ON public.biblioteca_documentos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = biblioteca_documentos.company_id AND cm.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = biblioteca_documentos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "biblioteca_delete" ON public.biblioteca_documentos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = biblioteca_documentos.company_id AND cm.user_id = auth.uid()));

CREATE TRIGGER trg_biblioteca_updated_at BEFORE UPDATE ON public.biblioteca_documentos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ VÍNCULOS CHECKLIST ↔ BIBLIOTECA ============
CREATE TABLE public.edital_checklist_vinculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_item_id UUID NOT NULL REFERENCES public.edital_checklist(id) ON DELETE CASCADE,
  documento_id UUID NOT NULL REFERENCES public.biblioteca_documentos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(checklist_item_id, documento_id)
);

CREATE INDEX idx_eclv_checklist ON public.edital_checklist_vinculos(checklist_item_id);
CREATE INDEX idx_eclv_documento ON public.edital_checklist_vinculos(documento_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.edital_checklist_vinculos TO authenticated;
GRANT ALL ON public.edital_checklist_vinculos TO service_role;
ALTER TABLE public.edital_checklist_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eclv_select" ON public.edital_checklist_vinculos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist_vinculos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "eclv_insert" ON public.edital_checklist_vinculos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist_vinculos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "eclv_delete" ON public.edital_checklist_vinculos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = edital_checklist_vinculos.company_id AND cm.user_id = auth.uid()));
