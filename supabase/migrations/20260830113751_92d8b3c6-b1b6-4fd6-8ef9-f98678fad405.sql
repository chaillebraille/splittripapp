-- 0. Fresh start
DELETE FROM public.expense_splits;
DELETE FROM public.expenses;
DELETE FROM public.members;
DELETE FROM public.groups;

-- 1. Profiles
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (user_id, email, display_name)
SELECT id, email, COALESCE(raw_user_meta_data ->> 'display_name', email) FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- 2. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- 3. Sharing
CREATE TYPE public.share_role AS ENUM ('viewer', 'editor');

CREATE TABLE public.group_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.share_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_shares TO authenticated;
GRANT ALL ON public.group_shares TO service_role;
ALTER TABLE public.group_shares ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_group_shares_updated_at BEFORE UPDATE ON public.group_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  role public.share_role NOT NULL DEFAULT 'viewer',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz,
  revoked_at timestamptz,
  uses integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invites TO authenticated;
GRANT ALL ON public.group_invites TO service_role;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_group_invites_updated_at BEFORE UPDATE ON public.group_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Access helpers (security definer, avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_group_owner(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = _group_id AND g.created_by = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_read_group(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = _group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM public.group_shares s WHERE s.group_id = _group_id AND s.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_write_group(_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = _group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM public.group_shares s WHERE s.group_id = _group_id AND s.user_id = auth.uid() AND s.role = 'editor');
$$;

-- 5. Sharing policies
CREATE POLICY "Owners manage shares" ON public.group_shares
  FOR ALL TO authenticated
  USING (public.is_group_owner(group_id))
  WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY "Users can see their own share rows" ON public.group_shares
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can leave a shared trip" ON public.group_shares
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Owners manage invites" ON public.group_invites
  FOR ALL TO authenticated
  USING (public.is_group_owner(group_id))
  WITH CHECK (public.is_group_owner(group_id));

-- 6. Rewritten data policies
DROP POLICY IF EXISTS "Users can manage their own trips" ON public.groups;
CREATE POLICY "Read owned or shared trips" ON public.groups
  FOR SELECT TO authenticated USING (public.can_read_group(id));
CREATE POLICY "Create own trips" ON public.groups
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner or editor can update trips" ON public.groups
  FOR UPDATE TO authenticated USING (public.can_write_group(id)) WITH CHECK (public.can_write_group(id));
CREATE POLICY "Owner can delete trips" ON public.groups
  FOR DELETE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can manage members of their trips" ON public.members;
CREATE POLICY "Read members of readable trips" ON public.members
  FOR SELECT TO authenticated USING (public.can_read_group(group_id));
CREATE POLICY "Owner manages members" ON public.members
  FOR INSERT TO authenticated WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY "Owner updates members" ON public.members
  FOR UPDATE TO authenticated USING (public.is_group_owner(group_id)) WITH CHECK (public.is_group_owner(group_id));
CREATE POLICY "Owner deletes members" ON public.members
  FOR DELETE TO authenticated USING (public.is_group_owner(group_id));

DROP POLICY IF EXISTS "Users can manage expenses of their trips" ON public.expenses;
CREATE POLICY "Read expenses of readable trips" ON public.expenses
  FOR SELECT TO authenticated USING (public.can_read_group(group_id));
CREATE POLICY "Editors write expenses" ON public.expenses
  FOR INSERT TO authenticated WITH CHECK (public.can_write_group(group_id));
CREATE POLICY "Editors update expenses" ON public.expenses
  FOR UPDATE TO authenticated USING (public.can_write_group(group_id)) WITH CHECK (public.can_write_group(group_id));
CREATE POLICY "Editors delete expenses" ON public.expenses
  FOR DELETE TO authenticated USING (public.can_write_group(group_id));

DROP POLICY IF EXISTS "Users can manage splits of their trips" ON public.expense_splits;
CREATE POLICY "Read splits of readable trips" ON public.expense_splits
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.expenses e WHERE e.id = expense_splits.expense_id AND public.can_read_group(e.group_id)));
CREATE POLICY "Editors write splits" ON public.expense_splits
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses e WHERE e.id = expense_splits.expense_id AND public.can_write_group(e.group_id)));
CREATE POLICY "Editors update splits" ON public.expense_splits
  FOR UPDATE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.expenses e WHERE e.id = expense_splits.expense_id AND public.can_write_group(e.group_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.expenses e WHERE e.id = expense_splits.expense_id AND public.can_write_group(e.group_id)));
CREATE POLICY "Editors delete splits" ON public.expense_splits
  FOR DELETE TO authenticated USING (EXISTS (
    SELECT 1 FROM public.expenses e WHERE e.id = expense_splits.expense_id AND public.can_write_group(e.group_id)));

-- 7. Invite redemption (security definer: joiner may not read the invite row)
CREATE OR REPLACE FUNCTION public.redeem_group_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.group_invites%ROWTYPE;
  owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO inv FROM public.group_invites WHERE code = _code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid invite'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'This invite has been revoked'; END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'This invite has expired'; END IF;

  SELECT created_by INTO owner FROM public.groups WHERE id = inv.group_id;
  IF owner = auth.uid() THEN RETURN inv.group_id; END IF;

  INSERT INTO public.group_shares (group_id, user_id, role)
  VALUES (inv.group_id, auth.uid(), inv.role)
  ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();

  UPDATE public.group_invites SET uses = uses + 1 WHERE id = inv.id;
  RETURN inv.group_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.redeem_group_invite(text) TO authenticated;