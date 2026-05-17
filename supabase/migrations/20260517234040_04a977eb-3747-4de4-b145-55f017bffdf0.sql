
CREATE TABLE public.user_workspaces (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace JSONB NOT NULL DEFAULT '{"obras":[],"activeId":null}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace"
  ON public.user_workspaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workspace"
  ON public.user_workspaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workspace"
  ON public.user_workspaces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own workspace"
  ON public.user_workspaces FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_workspaces_set_updated_at
  BEFORE UPDATE ON public.user_workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
