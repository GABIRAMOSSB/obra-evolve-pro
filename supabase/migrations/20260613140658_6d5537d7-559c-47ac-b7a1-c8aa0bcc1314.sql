
-- Tighten realtime.messages: deny by default; only allow private company-scoped topics
DROP POLICY IF EXISTS "Authenticated realtime scoped by company" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated realtime broadcast scoped by company" ON realtime.messages;

CREATE POLICY "Authenticated realtime scoped by company"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'signature-notifications:%'
  AND public.is_company_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
);

CREATE POLICY "Authenticated realtime broadcast scoped by company"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'signature-notifications:%'
  AND public.is_company_member(
        auth.uid(),
        NULLIF(split_part(realtime.topic(), ':', 2), '')::uuid
      )
);

-- Remove sensitive tables from public Realtime publication. They contain CPF, emails,
-- ZapSign tokens and signing URLs; postgres_changes broadcasts bypass row-level filters,
-- so any public channel subscriber could receive cross-company data.
ALTER PUBLICATION supabase_realtime DROP TABLE public.signature_requests;
ALTER PUBLICATION supabase_realtime DROP TABLE public.signature_signers;
