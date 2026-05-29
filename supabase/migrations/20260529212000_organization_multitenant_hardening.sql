-- Organization multi-tenant hardening.
-- In this project, accounts are the tenant/organization table.

CREATE OR REPLACE FUNCTION public.user_account_ids(_user_id uuid)
RETURNS TABLE(account_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.account_id
    FROM public.profiles p
   WHERE p.user_id = _user_id
     AND p.account_id IS NOT NULL
  UNION
  SELECT am.account_id
    FROM public.account_members am
   WHERE am.user_id = _user_id
     AND am.is_active = true
$$;

CREATE OR REPLACE FUNCTION public.can_access_account(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _account_id IS NOT NULL
     AND (
       public.has_role(_user_id, 'admin')
       OR EXISTS (
         SELECT 1 FROM public.user_account_ids(_user_id) uai
          WHERE uai.account_id = _account_id
       )
     )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_account(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _account_id IS NOT NULL
     AND (
       public.has_role(_user_id, 'admin')
       OR EXISTS (
         SELECT 1
           FROM public.account_members am
          WHERE am.user_id = _user_id
            AND am.account_id = _account_id
            AND am.is_active = true
            AND am.role IN ('owner', 'org_admin')
       )
     )
$$;

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_account_members_user_active
  ON public.account_members(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_account_members_account_role
  ON public.account_members(account_id, role, is_active);

DROP POLICY IF EXISTS "users read own account" ON public.accounts;
DROP POLICY IF EXISTS "accounts_select_own_or_admin" ON public.accounts;
DROP POLICY IF EXISTS "accounts_insert_admin" ON public.accounts;
DROP POLICY IF EXISTS "accounts_update_admin" ON public.accounts;
DROP POLICY IF EXISTS "accounts_delete_admin" ON public.accounts;

CREATE POLICY "accounts_select_own_or_admin"
  ON public.accounts FOR SELECT TO authenticated
  USING (public.can_access_account(auth.uid(), id));

CREATE POLICY "accounts_insert_admin"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "accounts_update_admin"
  ON public.accounts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "accounts_delete_admin"
  ON public.accounts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "org_admins manage own org members" ON public.account_members;
DROP POLICY IF EXISTS "users read own membership" ON public.account_members;
DROP POLICY IF EXISTS "account_members_select_visible" ON public.account_members;
DROP POLICY IF EXISTS "account_members_insert_manage" ON public.account_members;
DROP POLICY IF EXISTS "account_members_update_manage" ON public.account_members;
DROP POLICY IF EXISTS "account_members_delete_manage" ON public.account_members;

CREATE POLICY "account_members_select_visible"
  ON public.account_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_manage_account(auth.uid(), account_id)
  );

CREATE POLICY "account_members_insert_manage"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_account(auth.uid(), account_id));

CREATE POLICY "account_members_update_manage"
  ON public.account_members FOR UPDATE TO authenticated
  USING (public.can_manage_account(auth.uid(), account_id))
  WITH CHECK (public.can_manage_account(auth.uid(), account_id));

CREATE POLICY "account_members_delete_manage"
  ON public.account_members FOR DELETE TO authenticated
  USING (public.can_manage_account(auth.uid(), account_id));

DROP POLICY IF EXISTS "authenticated read profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own_account" ON public.profiles;

CREATE POLICY "profiles_select_own_account"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.can_access_account(auth.uid(), account_id)
  );

DROP POLICY IF EXISTS "team_members_select_own_account" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_own_account" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_own_account" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_own_account" ON public.team_members;

CREATE POLICY "team_members_select_own_account"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.teams t
       WHERE t.id = team_members.team_id
         AND public.can_access_account(auth.uid(), t.account_id)
    )
  );

CREATE POLICY "team_members_insert_own_account"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.teams t
       WHERE t.id = team_members.team_id
         AND public.can_manage_account(auth.uid(), t.account_id)
    )
  );

CREATE POLICY "team_members_update_own_account"
  ON public.team_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.teams t
       WHERE t.id = team_members.team_id
         AND public.can_manage_account(auth.uid(), t.account_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.teams t
       WHERE t.id = team_members.team_id
         AND public.can_manage_account(auth.uid(), t.account_id)
    )
  );

CREATE POLICY "team_members_delete_own_account"
  ON public.team_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.teams t
       WHERE t.id = team_members.team_id
         AND public.can_manage_account(auth.uid(), t.account_id)
    )
  );
