
CREATE TABLE public.company_signatarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  telefone TEXT,
  cargo TEXT,
  tipo TEXT NOT NULL DEFAULT 'procurador'
    CHECK (tipo IN ('socio', 'administrador', 'procurador', 'representante', 'outro')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX company_signatarios_company_idx ON public.company_signatarios(company_id);
CREATE INDEX company_signatarios_ativo_idx ON public.company_signatarios(company_id, ativo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_signatarios TO authenticated;
GRANT ALL ON public.company_signatarios TO service_role;

ALTER TABLE public.company_signatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view signatarios" ON public.company_signatarios
  FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors mutate signatarios" ON public.company_signatarios
  FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
         OR public.has_company_role(auth.uid(), company_id, 'admin'::company_role))
  WITH CHECK (public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
              OR public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE TRIGGER company_signatarios_updated_at BEFORE UPDATE ON public.company_signatarios
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.procuracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  signatario_id UUID NOT NULL REFERENCES public.company_signatarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'particular' CHECK (tipo IN ('publica', 'particular')),
  numero TEXT,
  cartorio TEXT,
  data_outorga DATE NOT NULL,
  data_validade DATE,
  poderes_gerais BOOLEAN NOT NULL DEFAULT false,
  escopo JSONB NOT NULL DEFAULT '{}'::jsonb,
  poderes_especificos TEXT,
  substabelecimento BOOLEAN NOT NULL DEFAULT false,
  arquivo_path TEXT,
  status TEXT NOT NULL DEFAULT 'vigente'
    CHECK (status IN ('vigente', 'expirada', 'revogada', 'suspensa')),
  revogada_em TIMESTAMPTZ,
  revogada_motivo TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX procuracoes_company_idx ON public.procuracoes(company_id);
CREATE INDEX procuracoes_signatario_idx ON public.procuracoes(signatario_id);
CREATE INDEX procuracoes_status_idx ON public.procuracoes(company_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.procuracoes TO authenticated;
GRANT ALL ON public.procuracoes TO service_role;

ALTER TABLE public.procuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view procuracoes" ON public.procuracoes
  FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors mutate procuracoes" ON public.procuracoes
  FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
         OR public.has_company_role(auth.uid(), company_id, 'admin'::company_role))
  WITH CHECK (public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
              OR public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE TRIGGER procuracoes_updated_at BEFORE UPDATE ON public.procuracoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
