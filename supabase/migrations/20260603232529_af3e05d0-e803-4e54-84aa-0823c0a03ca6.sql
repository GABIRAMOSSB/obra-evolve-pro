
-- =========================================================
-- ZapSign integration — base schema (Wave 1)
-- =========================================================

-- 1) signature_requests
CREATE TABLE public.signature_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  obra_id text NOT NULL,                              -- lives in company_workspaces.workspace JSON
  document_path text NOT NULL,                        -- path in obra-documentos bucket
  document_name text NOT NULL,
  document_folder text NOT NULL,
  status text NOT NULL DEFAULT 'draft',               -- draft|preparing|awaiting_placement|placement_done|awaiting_signature|partially_signed|signed|refused|expired|canceled|error
  zapsign_document_token text,
  zapsign_open_id text,
  authentication_mode text NOT NULL DEFAULT 'assinaturaTela-tokenWhatsapp',
  expiration_date timestamptz,
  original_file_hash text,
  signed_file_path text,
  signed_file_hash text,
  signed_at timestamptz,
  canceled_at timestamptz,
  cancellation_reason text,
  error_message text,
  sandbox boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_requests TO authenticated;
GRANT ALL ON public.signature_requests TO service_role;
ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view signature_requests"
  ON public.signature_requests FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins and editors can insert signature_requests"
  ON public.signature_requests FOR INSERT TO authenticated
  WITH CHECK (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Admins and editors can update signature_requests"
  ON public.signature_requests FOR UPDATE TO authenticated
  USING (
    public.has_company_role(auth.uid(), company_id, 'admin'::company_role)
    OR public.has_company_role(auth.uid(), company_id, 'editor'::company_role)
  );

CREATE POLICY "Admins can delete signature_requests"
  ON public.signature_requests FOR DELETE TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

CREATE INDEX idx_sig_req_company ON public.signature_requests(company_id);
CREATE INDEX idx_sig_req_obra ON public.signature_requests(company_id, obra_id);
CREATE INDEX idx_sig_req_status ON public.signature_requests(status);
CREATE INDEX idx_sig_req_zapsign ON public.signature_requests(zapsign_document_token) WHERE zapsign_document_token IS NOT NULL;

-- 2) signature_signers
CREATE TABLE public.signature_signers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id uuid NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  email text,
  phone_country text DEFAULT '55',
  phone_number text,
  role text,
  company text,
  signing_order integer,
  mandatory boolean NOT NULL DEFAULT true,
  auth_mode text NOT NULL DEFAULT 'assinaturaTela-tokenWhatsapp',
  custom_message text,
  send_automatic_email boolean NOT NULL DEFAULT false,
  send_automatic_whatsapp boolean NOT NULL DEFAULT false,
  zapsign_signer_token text,
  zapsign_sign_url text,
  status text NOT NULL DEFAULT 'pending',             -- pending|sent|viewed|signed|refused
  signed_at timestamptz,
  refused_at timestamptz,
  refusal_reason text,
  last_shared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_signers TO authenticated;
GRANT ALL ON public.signature_signers TO service_role;
ALTER TABLE public.signature_signers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view signers via request"
  ON public.signature_signers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND public.is_company_member(auth.uid(), sr.company_id)
  ));

CREATE POLICY "Editors can mutate signers"
  ON public.signature_signers FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND (public.has_company_role(auth.uid(), sr.company_id, 'admin'::company_role)
        OR public.has_company_role(auth.uid(), sr.company_id, 'editor'::company_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND (public.has_company_role(auth.uid(), sr.company_id, 'admin'::company_role)
        OR public.has_company_role(auth.uid(), sr.company_id, 'editor'::company_role))
  ));

CREATE INDEX idx_sig_signers_request ON public.signature_signers(signature_request_id);
CREATE INDEX idx_sig_signers_token ON public.signature_signers(zapsign_signer_token) WHERE zapsign_signer_token IS NOT NULL;

-- 3) signature_fields
CREATE TABLE public.signature_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id uuid NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  signer_id uuid NOT NULL REFERENCES public.signature_signers(id) ON DELETE CASCADE,
  page integer NOT NULL DEFAULT 0,
  field_type text NOT NULL DEFAULT 'signature',       -- signature|visto|date|name
  relative_position_left numeric(6,3) NOT NULL,
  relative_position_bottom numeric(6,3) NOT NULL,
  relative_size_x numeric(6,3) NOT NULL,
  relative_size_y numeric(6,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_fields TO authenticated;
GRANT ALL ON public.signature_fields TO service_role;
ALTER TABLE public.signature_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view fields via request"
  ON public.signature_fields FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND public.is_company_member(auth.uid(), sr.company_id)
  ));

CREATE POLICY "Editors can mutate fields"
  ON public.signature_fields FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND (public.has_company_role(auth.uid(), sr.company_id, 'admin'::company_role)
        OR public.has_company_role(auth.uid(), sr.company_id, 'editor'::company_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND (public.has_company_role(auth.uid(), sr.company_id, 'admin'::company_role)
        OR public.has_company_role(auth.uid(), sr.company_id, 'editor'::company_role))
  ));

CREATE INDEX idx_sig_fields_request ON public.signature_fields(signature_request_id);
CREATE INDEX idx_sig_fields_signer ON public.signature_fields(signer_id);

-- 4) signature_events
CREATE TABLE public.signature_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_request_id uuid NOT NULL REFERENCES public.signature_requests(id) ON DELETE CASCADE,
  signer_id uuid REFERENCES public.signature_signers(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_description text,
  external_event_id text,
  payload jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.signature_events TO authenticated;
GRANT ALL ON public.signature_events TO service_role;
ALTER TABLE public.signature_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view events"
  ON public.signature_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND public.is_company_member(auth.uid(), sr.company_id)
  ));

CREATE POLICY "Editors can insert events"
  ON public.signature_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.signature_requests sr
    WHERE sr.id = signature_request_id
      AND (public.has_company_role(auth.uid(), sr.company_id, 'admin'::company_role)
        OR public.has_company_role(auth.uid(), sr.company_id, 'editor'::company_role))
  ));

CREATE INDEX idx_sig_events_request ON public.signature_events(signature_request_id, created_at DESC);
CREATE UNIQUE INDEX idx_sig_events_external ON public.signature_events(external_event_id) WHERE external_event_id IS NOT NULL;

-- 5) signature_settings (1 row por company)
CREATE TABLE public.signature_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  environment text NOT NULL DEFAULT 'sandbox',        -- sandbox|production
  default_auth_mode text NOT NULL DEFAULT 'assinaturaTela-tokenWhatsapp',
  automatic_email boolean NOT NULL DEFAULT false,
  automatic_whatsapp boolean NOT NULL DEFAULT false,
  manual_whatsapp_enabled boolean NOT NULL DEFAULT true,
  webhook_configured boolean NOT NULL DEFAULT false,
  last_connection_test_at timestamptz,
  last_connection_test_status text,
  last_webhook_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.signature_settings TO authenticated;
GRANT ALL ON public.signature_settings TO service_role;
ALTER TABLE public.signature_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view settings"
  ON public.signature_settings FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Admins can mutate settings"
  ON public.signature_settings FOR ALL TO authenticated
  USING (public.has_company_role(auth.uid(), company_id, 'admin'::company_role))
  WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin'::company_role));

-- updated_at triggers (set_updated_at já existe no projeto)
CREATE TRIGGER sig_req_updated_at BEFORE UPDATE ON public.signature_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sig_signers_updated_at BEFORE UPDATE ON public.signature_signers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sig_fields_updated_at BEFORE UPDATE ON public.signature_fields
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER sig_settings_updated_at BEFORE UPDATE ON public.signature_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
