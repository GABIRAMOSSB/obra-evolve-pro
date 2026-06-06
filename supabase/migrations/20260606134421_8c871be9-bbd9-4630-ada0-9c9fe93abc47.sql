
CREATE TABLE public.declaracoes_licitacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  conteudo text NOT NULL,
  signatario_id uuid REFERENCES public.company_signatarios(id) ON DELETE SET NULL,
  procuracao_id uuid REFERENCES public.procuracoes(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  edital_id uuid REFERENCES public.editais(id) ON DELETE SET NULL,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  observacoes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT declaracoes_licitacao_tipo_check CHECK (tipo IN (
    'habilitacao','me_epp','menor','idoneidade','elaboracao_independente',
    'cumprimento_requisitos','reserva_cargos','nepotismo','outro'
  ))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.declaracoes_licitacao TO authenticated;
GRANT ALL ON public.declaracoes_licitacao TO service_role;

CREATE INDEX declaracoes_licitacao_company_idx ON public.declaracoes_licitacao(company_id);
CREATE INDEX declaracoes_licitacao_oportunidade_idx ON public.declaracoes_licitacao(oportunidade_id) WHERE oportunidade_id IS NOT NULL;
CREATE INDEX declaracoes_licitacao_edital_idx ON public.declaracoes_licitacao(edital_id) WHERE edital_id IS NOT NULL;

ALTER TABLE public.declaracoes_licitacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view declaracoes"
  ON public.declaracoes_licitacao FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Editors mutate declaracoes"
  ON public.declaracoes_licitacao FOR ALL
  TO authenticated
  USING (has_company_role(auth.uid(), company_id, 'editor'::company_role) OR has_company_role(auth.uid(), company_id, 'admin'::company_role))
  WITH CHECK (has_company_role(auth.uid(), company_id, 'editor'::company_role) OR has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE TRIGGER declaracoes_licitacao_updated_at
  BEFORE UPDATE ON public.declaracoes_licitacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
