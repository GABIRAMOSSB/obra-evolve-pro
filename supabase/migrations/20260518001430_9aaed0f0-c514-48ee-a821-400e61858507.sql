
-- Enum de papéis
CREATE TYPE public.company_role AS ENUM ('admin', 'member');

-- Tabela companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Empresa',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Tabela company_members
CREATE TABLE public.company_members (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.company_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id),
  UNIQUE (user_id) -- uma empresa por usuário
);
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Tabela company_invites
CREATE TABLE public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.company_role NOT NULL DEFAULT 'member',
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  invited_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz
);
CREATE INDEX idx_company_invites_email ON public.company_invites (lower(email)) WHERE accepted_at IS NULL;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- Tabela company_workspaces (dados compartilhados)
CREATE TABLE public.company_workspaces (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  workspace jsonb NOT NULL DEFAULT '{"obras": [], "activeId": null}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.company_workspaces ENABLE ROW LEVEL SECURITY;

-- Funções security definer (evitam recursão em RLS)
CREATE OR REPLACE FUNCTION public.is_company_member(_user uuid, _company uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _user AND company_id = _company);
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(_user uuid, _company uuid, _role public.company_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _user AND company_id = _company AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_company()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid() LIMIT 1;
$$;

-- RLS: companies
CREATE POLICY "Members can view their company" ON public.companies
  FOR SELECT USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "Admins can update their company" ON public.companies
  FOR UPDATE USING (public.has_company_role(auth.uid(), id, 'admin'));

-- RLS: company_members
CREATE POLICY "Members can view fellow members" ON public.company_members
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins can insert members" ON public.company_members
  FOR INSERT WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "Admins can update members" ON public.company_members
  FOR UPDATE USING (public.has_company_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "Admins can remove members or user can leave" ON public.company_members
  FOR DELETE USING (
    public.has_company_role(auth.uid(), company_id, 'admin') OR auth.uid() = user_id
  );

-- RLS: company_invites
CREATE POLICY "Admins manage invites - select" ON public.company_invites
  FOR SELECT USING (public.has_company_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "Admins manage invites - insert" ON public.company_invites
  FOR INSERT WITH CHECK (public.has_company_role(auth.uid(), company_id, 'admin'));
CREATE POLICY "Admins manage invites - delete" ON public.company_invites
  FOR DELETE USING (public.has_company_role(auth.uid(), company_id, 'admin'));

-- RLS: company_workspaces
CREATE POLICY "Members can view workspace" ON public.company_workspaces
  FOR SELECT USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can insert workspace" ON public.company_workspaces
  FOR INSERT WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members can update workspace" ON public.company_workspaces
  FOR UPDATE USING (public.is_company_member(auth.uid(), company_id));

-- Triggers updated_at
CREATE TRIGGER companies_updated_at BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER company_workspaces_updated_at BEFORE UPDATE ON public.company_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função para aceitar convite via token
CREATE OR REPLACE FUNCTION public.accept_company_invite(_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invite public.company_invites%ROWTYPE;
  _user_email text;
  _old_company uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT * INTO _invite FROM public.company_invites WHERE token = _token;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF _invite.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invite_already_accepted'; END IF;
  IF _invite.expires_at < now() THEN RAISE EXCEPTION 'invite_expired'; END IF;

  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  IF lower(_user_email) <> lower(_invite.email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  -- Remover de empresa atual (se for o último admin, transferir antes não — vamos só sair).
  SELECT company_id INTO _old_company FROM public.company_members WHERE user_id = auth.uid();
  IF _old_company IS NOT NULL THEN
    DELETE FROM public.company_members WHERE user_id = auth.uid();
    -- Se empresa ficou sem membros, remover
    IF NOT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _old_company) THEN
      DELETE FROM public.companies WHERE id = _old_company;
    END IF;
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role)
    VALUES (_invite.company_id, auth.uid(), _invite.role);
  UPDATE public.company_invites SET accepted_at = now() WHERE id = _invite.id;
  RETURN _invite.company_id;
END $$;

-- Função para o usuário ler dados de um convite pelo token (sem ser admin)
CREATE OR REPLACE FUNCTION public.get_invite_info(_token uuid)
RETURNS TABLE(company_id uuid, company_name text, email text, role public.company_role, expires_at timestamptz, accepted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT ci.company_id, c.name, ci.email, ci.role, ci.expires_at, ci.accepted_at IS NOT NULL
  FROM public.company_invites ci
  JOIN public.companies c ON c.id = ci.company_id
  WHERE ci.token = _token;
$$;

-- Trigger handle_new_user: ao criar usuário, aceitar convite OU criar empresa
CREATE OR REPLACE FUNCTION public.handle_new_user_company()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _invite public.company_invites%ROWTYPE;
  _new_company uuid;
BEGIN
  SELECT * INTO _invite FROM public.company_invites
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.company_members (company_id, user_id, role)
      VALUES (_invite.company_id, NEW.id, _invite.role);
    UPDATE public.company_invites SET accepted_at = now() WHERE id = _invite.id;
  ELSE
    INSERT INTO public.companies (name, owner_id) VALUES ('Minha Empresa', NEW.id) RETURNING id INTO _new_company;
    INSERT INTO public.company_members (company_id, user_id, role) VALUES (_new_company, NEW.id, 'admin');
    INSERT INTO public.company_workspaces (company_id) VALUES (_new_company);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created_company
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_company();

-- Backfill: para cada user_workspaces existente, criar empresa + membro admin + workspace
DO $$
DECLARE
  _row record;
  _company_id uuid;
BEGIN
  FOR _row IN SELECT user_id, workspace FROM public.user_workspaces LOOP
    -- pular se já é membro de alguma empresa
    IF EXISTS (SELECT 1 FROM public.company_members WHERE user_id = _row.user_id) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.companies (name, owner_id) VALUES ('Minha Empresa', _row.user_id) RETURNING id INTO _company_id;
    INSERT INTO public.company_members (company_id, user_id, role) VALUES (_company_id, _row.user_id, 'admin');
    INSERT INTO public.company_workspaces (company_id, workspace) VALUES (_company_id, _row.workspace);
  END LOOP;
END $$;
