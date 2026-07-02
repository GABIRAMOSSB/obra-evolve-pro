
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_company_created ON public.notifications(company_id, created_at DESC);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own_company"
  ON public.notifications FOR SELECT TO authenticated
  USING (
    public.has_company_role(company_id, ARRAY['admin','editor','member'])
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (
    public.has_company_role(company_id, ARRAY['admin','editor','member'])
    AND (user_id IS NULL OR user_id = auth.uid())
  )
  WITH CHECK (
    public.has_company_role(company_id, ARRAY['admin','editor','member'])
    AND (user_id IS NULL OR user_id = auth.uid())
  );

CREATE POLICY "notifications_insert_editors"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_company_role(company_id, ARRAY['admin','editor']));

CREATE POLICY "notifications_delete_admin"
  ON public.notifications FOR DELETE TO authenticated
  USING (public.has_company_role(company_id, ARRAY['admin']));
