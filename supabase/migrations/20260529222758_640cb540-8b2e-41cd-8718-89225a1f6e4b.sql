
-- 1. obra-fotos bucket: restrict writes/listing to authenticated users
DROP POLICY IF EXISTS "Public insert obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public update obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public delete obra-fotos" ON storage.objects;
DROP POLICY IF EXISTS "Public read obra-fotos" ON storage.objects;

CREATE POLICY "Authenticated can insert obra-fotos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'obra-fotos' AND auth.uid() = owner);

CREATE POLICY "Owners can update obra-fotos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'obra-fotos' AND auth.uid() = owner);

CREATE POLICY "Owners can delete obra-fotos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'obra-fotos' AND auth.uid() = owner);

-- Listing/metadata only to authenticated. Public URLs continue to work
-- because the bucket is public, which serves files independently of RLS.
CREATE POLICY "Authenticated can list obra-fotos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'obra-fotos');

-- 2. companies: allow authenticated users to create their own company
CREATE POLICY "Users can create their own company"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- 3. company_invites: allow an invitee to read their own invite by email
CREATE POLICY "Invitees can view their own invite"
  ON public.company_invites FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- Allow invitee to mark invite accepted (update accepted_at) for their email
CREATE POLICY "Invitees can accept their own invite"
  ON public.company_invites FOR UPDATE TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));
