
DROP POLICY IF EXISTS "Members can insert workspace" ON public.company_workspaces;
DROP POLICY IF EXISTS "Members can update workspace" ON public.company_workspaces;

CREATE POLICY "Admins can insert workspace"
ON public.company_workspaces
FOR INSERT
WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin'));

CREATE POLICY "Admins can update workspace"
ON public.company_workspaces
FOR UPDATE
USING (public.has_company_role(auth.uid(), company_id, 'admin'));
