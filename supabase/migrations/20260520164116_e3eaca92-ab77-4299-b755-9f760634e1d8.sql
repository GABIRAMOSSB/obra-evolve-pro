
CREATE OR REPLACE FUNCTION public.get_company_member_emails(_company uuid)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cm.user_id, u.email::text
  FROM public.company_members cm
  JOIN auth.users u ON u.id = cm.user_id
  WHERE cm.company_id = _company
    AND public.is_company_member(auth.uid(), _company);
$$;

GRANT EXECUTE ON FUNCTION public.get_company_member_emails(uuid) TO authenticated;
