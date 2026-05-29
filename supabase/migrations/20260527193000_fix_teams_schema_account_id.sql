-- Fix teams schema expected by the Equipes UI and isolate teams per account.
-- Safe to run on databases where teams/team_members already exist.

DO $$ BEGIN
  CREATE TYPE public.team_role AS ENUM (
    'coordenador','gerente','secretario','agente','administrador','financeiro','corretor','corretora','marketing'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_assign boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_self_assign boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_teams_account_id ON public.teams(account_id);

-- Backfill legacy teams to the first known account so existing teams keep working.
UPDATE public.teams t
   SET account_id = (
     SELECT p.account_id
       FROM public.profiles p
      WHERE p.account_id IS NOT NULL
      ORDER BY p.created_at
      LIMIT 1
   )
 WHERE t.account_id IS NULL
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.account_id IS NOT NULL);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS teams_updated_at ON public.teams;
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.team_role NOT NULL DEFAULT 'agente',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);

DROP POLICY IF EXISTS "auth read teams" ON public.teams;
DROP POLICY IF EXISTS "auth insert teams" ON public.teams;
DROP POLICY IF EXISTS "auth update teams" ON public.teams;
DROP POLICY IF EXISTS "auth delete teams" ON public.teams;
DROP POLICY IF EXISTS "teams_select_own_account" ON public.teams;
DROP POLICY IF EXISTS "teams_insert_own_account" ON public.teams;
DROP POLICY IF EXISTS "teams_update_own_account" ON public.teams;
DROP POLICY IF EXISTS "teams_delete_own_account" ON public.teams;

CREATE POLICY "teams_select_own_account"
  ON public.teams FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
    OR account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

CREATE POLICY "teams_insert_own_account"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR account_id IN (
        SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
      OR account_id IN (
        SELECT am.account_id FROM public.account_members am
        WHERE am.user_id = auth.uid() AND am.is_active = true
      )
    )
  );

CREATE POLICY "teams_update_own_account"
  ON public.teams FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
    OR account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR account_id IN (
        SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      )
      OR account_id IN (
        SELECT am.account_id FROM public.account_members am
        WHERE am.user_id = auth.uid() AND am.is_active = true
      )
    )
  );

CREATE POLICY "teams_delete_own_account"
  ON public.teams FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
    OR account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "auth read team_members" ON public.team_members;
DROP POLICY IF EXISTS "auth insert team_members" ON public.team_members;
DROP POLICY IF EXISTS "auth update team_members" ON public.team_members;
DROP POLICY IF EXISTS "auth delete team_members" ON public.team_members;
DROP POLICY IF EXISTS "team_members_select_own_account" ON public.team_members;
DROP POLICY IF EXISTS "team_members_insert_own_account" ON public.team_members;
DROP POLICY IF EXISTS "team_members_update_own_account" ON public.team_members;
DROP POLICY IF EXISTS "team_members_delete_own_account" ON public.team_members;

CREATE POLICY "team_members_select_own_account"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR t.account_id IN (
            SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
          )
          OR t.account_id IN (
            SELECT am.account_id FROM public.account_members am
            WHERE am.user_id = auth.uid() AND am.is_active = true
          )
        )
    )
  );

CREATE POLICY "team_members_insert_own_account"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR t.account_id IN (
            SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
          )
          OR t.account_id IN (
            SELECT am.account_id FROM public.account_members am
            WHERE am.user_id = auth.uid() AND am.is_active = true
          )
        )
    )
  );

CREATE POLICY "team_members_update_own_account"
  ON public.team_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR t.account_id IN (
            SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
          )
          OR t.account_id IN (
            SELECT am.account_id FROM public.account_members am
            WHERE am.user_id = auth.uid() AND am.is_active = true
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR t.account_id IN (
            SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
          )
          OR t.account_id IN (
            SELECT am.account_id FROM public.account_members am
            WHERE am.user_id = auth.uid() AND am.is_active = true
          )
        )
    )
  );

CREATE POLICY "team_members_delete_own_account"
  ON public.team_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
        AND (
          public.has_role(auth.uid(), 'admin')
          OR t.account_id IN (
            SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
          )
          OR t.account_id IN (
            SELECT am.account_id FROM public.account_members am
            WHERE am.user_id = auth.uid() AND am.is_active = true
          )
        )
    )
  );
