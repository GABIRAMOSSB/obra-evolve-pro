-- Tabela de Notas Fiscais (cabeçalho)
CREATE TABLE public.notas_fiscais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  obra_id TEXT,
  chave_acesso TEXT NOT NULL,
  numero TEXT NOT NULL,
  serie TEXT,
  modelo TEXT,
  natureza_operacao TEXT,
  data_emissao TIMESTAMP WITH TIME ZONE,
  data_entrada TIMESTAMP WITH TIME ZONE,
  emitente_cnpj TEXT,
  emitente_nome TEXT,
  emitente_ie TEXT,
  emitente_uf TEXT,
  destinatario_cnpj TEXT,
  destinatario_nome TEXT,
  valor_produtos NUMERIC(15,2) DEFAULT 0,
  valor_frete NUMERIC(15,2) DEFAULT 0,
  valor_desconto NUMERIC(15,2) DEFAULT 0,
  valor_outras NUMERIC(15,2) DEFAULT 0,
  valor_icms NUMERIC(15,2) DEFAULT 0,
  valor_ipi NUMERIC(15,2) DEFAULT 0,
  valor_total NUMERIC(15,2) DEFAULT 0,
  xml_content TEXT,
  status TEXT NOT NULL DEFAULT 'importada',
  observacoes TEXT,
  imported_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, chave_acesso)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notas_fiscais TO authenticated;
GRANT ALL ON public.notas_fiscais TO service_role;

ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view notas" ON public.notas_fiscais
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert notas" ON public.notas_fiscais
  FOR INSERT WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role) OR
    public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );
CREATE POLICY "Editors update notas" ON public.notas_fiscais
  FOR UPDATE USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role) OR
    public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );
CREATE POLICY "Admins delete notas" ON public.notas_fiscais
  FOR DELETE USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE INDEX idx_notas_fiscais_company ON public.notas_fiscais(company_id);
CREATE INDEX idx_notas_fiscais_obra ON public.notas_fiscais(obra_id);
CREATE INDEX idx_notas_fiscais_emitente ON public.notas_fiscais(emitente_cnpj);
CREATE INDEX idx_notas_fiscais_data ON public.notas_fiscais(data_emissao DESC);

CREATE TRIGGER trg_notas_fiscais_updated
  BEFORE UPDATE ON public.notas_fiscais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabela de Itens da NF-e
CREATE TABLE public.nota_fiscal_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  nota_fiscal_id UUID NOT NULL REFERENCES public.notas_fiscais(id) ON DELETE CASCADE,
  numero_item INTEGER NOT NULL,
  codigo_produto TEXT,
  descricao TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT,
  unidade TEXT,
  quantidade NUMERIC(15,4) NOT NULL DEFAULT 0,
  valor_unitario NUMERIC(15,6) NOT NULL DEFAULT 0,
  valor_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_desconto NUMERIC(15,2) DEFAULT 0,
  valor_frete NUMERIC(15,2) DEFAULT 0,
  insumo_id UUID REFERENCES public.insumos_mestre(id) ON DELETE SET NULL,
  match_status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nota_fiscal_itens TO authenticated;
GRANT ALL ON public.nota_fiscal_itens TO service_role;

ALTER TABLE public.nota_fiscal_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view itens" ON public.nota_fiscal_itens
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert itens" ON public.nota_fiscal_itens
  FOR INSERT WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role) OR
    public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );
CREATE POLICY "Editors update itens" ON public.nota_fiscal_itens
  FOR UPDATE USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role) OR
    public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );
CREATE POLICY "Editors delete itens" ON public.nota_fiscal_itens
  FOR DELETE USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role) OR
    public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE INDEX idx_nf_itens_nota ON public.nota_fiscal_itens(nota_fiscal_id);
CREATE INDEX idx_nf_itens_company ON public.nota_fiscal_itens(company_id);
CREATE INDEX idx_nf_itens_insumo ON public.nota_fiscal_itens(insumo_id);

CREATE TRIGGER trg_nf_itens_updated
  BEFORE UPDATE ON public.nota_fiscal_itens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();