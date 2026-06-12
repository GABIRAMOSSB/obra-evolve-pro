
-- 1) Tighten sinapi-imagens storage INSERT: remove permissive policy; editor policy remains.
DROP POLICY IF EXISTS "Authenticated write sinapi imagens" ON storage.objects;

-- 2) Scope Realtime channel subscriptions for signature notifications by company membership.
-- The app subscribes to topic 'signature-notifications:<company_id>'. Other topics keep
-- existing behaviour. Postgres_changes on signature_* tables already respects RLS, but we
-- also restrict the channel topic itself so only members of the company may subscribe.
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated realtime scoped by company" ON realtime.messages;

CREATE POLICY "Authenticated realtime scoped by company"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'signature-notifications:%' THEN
      public.is_company_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    ELSE true
  END
);

CREATE POLICY "Authenticated realtime broadcast scoped by company"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN realtime.topic() LIKE 'signature-notifications:%' THEN
      public.is_company_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
    ELSE true
  END
);
