
CREATE TABLE public.rdos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  clima_manha TEXT,
  clima_tarde TEXT,
  clima_noite TEXT,
  condicao_trabalho TEXT CHECK (condicao_trabalho IN ('praticavel','impraticavel','parcial') OR condicao_trabalho IS NULL),
  efetivo_total INTEGER NOT NULL DEFAULT 0,
  observacoes TEXT,
  atividades_executadas TEXT,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','fechado','aprovado')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, obra_id, data)
);
CREATE INDEX rdos_company_idx ON public.rdos(company_id);
CREATE INDEX rdos_obra_data_idx ON public.rdos(obra_id, data DESC);

CREATE TABLE public.rdo_equipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  funcao TEXT NOT NULL,
  quantidade INTEGER NOT NULL DEFAULT 0,
  horas_trabalhadas NUMERIC(6,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rdo_equipes_rdo_idx ON public.rdo_equipes(rdo_id);

CREATE TABLE public.rdo_equipamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipamento TEXT NOT NULL,
  horas_operadas NUMERIC(6,2) NOT NULL DEFAULT 0,
  horas_paradas NUMERIC(6,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rdo_equipamentos_rdo_idx ON public.rdo_equipamentos(rdo_id);

CREATE TABLE public.rdo_ocorrencias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rdo_id UUID NOT NULL REFERENCES public.rdos(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('atraso','acidente','seguranca','qualidade','visita','outro')),
  descricao TEXT NOT NULL,
  severidade TEXT CHECK (severidade IN ('baixa','media','alta','critica') OR severidade IS NULL),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX rdo_ocorrencias_rdo_idx ON public.rdo_ocorrencias(rdo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_equipes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_equipamentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rdo_ocorrencias TO authenticated;
GRANT ALL ON public.rdos TO service_role;
GRANT ALL ON public.rdo_equipes TO service_role;
GRANT ALL ON public.rdo_equipamentos TO service_role;
GRANT ALL ON public.rdo_ocorrencias TO service_role;

ALTER TABLE public.rdos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rdo_ocorrencias ENABLE ROW LEVEL SECURITY;

-- rdos policies
CREATE POLICY "members select rdos" ON public.rdos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = rdos.company_id AND cm.user_id = auth.uid()));
CREATE POLICY "editors insert rdos" ON public.rdos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = rdos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors update rdos" ON public.rdos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = rdos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));
CREATE POLICY "editors delete rdos" ON public.rdos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = rdos.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')));

CREATE TRIGGER update_rdos_updated_at BEFORE UPDATE ON public.rdos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- child tables share policies based on company_id
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['rdo_equipes','rdo_equipamentos','rdo_ocorrencias']
  LOOP
    EXECUTE format($f$CREATE POLICY "members select %1$I" ON public.%1$I FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = %1$I.company_id AND cm.user_id = auth.uid()))$f$, t);
    EXECUTE format($f$CREATE POLICY "editors insert %1$I" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = %1$I.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')))$f$, t);
    EXECUTE format($f$CREATE POLICY "editors update %1$I" ON public.%1$I FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = %1$I.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')))$f$, t);
    EXECUTE format($f$CREATE POLICY "editors delete %1$I" ON public.%1$I FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM public.company_members cm WHERE cm.company_id = %1$I.company_id AND cm.user_id = auth.uid() AND cm.role IN ('admin','editor')))$f$, t);
  END LOOP;
END $$;
