-- Allow editors (in addition to admins) to update the company workspace
DROP POLICY IF EXISTS "Admins can update workspace" ON public.company_workspaces;

CREATE POLICY "Admins and editors can update workspace"
ON public.company_workspaces
FOR UPDATE
USING (
  has_company_role(auth.uid(), company_id, 'admin'::company_role)
  OR has_company_role(auth.uid(), company_id, 'editor'::company_role)
);