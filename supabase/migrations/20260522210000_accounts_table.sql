-- ===== Accounts (organizations) table =====
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  locale text NOT NULL DEFAULT 'pt',
  plan_type text NOT NULL DEFAULT 'crm',
  plan_value numeric NOT NULL DEFAULT 297,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage accounts" ON public.accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users read own account" ON public.accounts
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT account_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Add account_id to profiles =====
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL;
    CREATE INDEX idx_profiles_account_id ON public.profiles(account_id);
  END IF;
END $$;

-- ===== Account members (org-level roles) =====
CREATE TYPE public.account_member_role AS ENUM ('owner', 'org_admin', 'member');

CREATE TABLE IF NOT EXISTS public.account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.account_member_role NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage account_members" ON public.account_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "org_admins manage own org members" ON public.account_members
  FOR ALL TO authenticated
  USING (
    account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'org_admin')
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT am.account_id FROM public.account_members am
      WHERE am.user_id = auth.uid() AND am.role IN ('owner', 'org_admin')
    )
  );

CREATE POLICY "users read own membership" ON public.account_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER account_members_updated_at BEFORE UPDATE ON public.account_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Helper: check if user is org admin =====
CREATE OR REPLACE FUNCTION public.is_account_admin(_user_id uuid, _account_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE user_id = _user_id
      AND account_id = _account_id
      AND role IN ('owner', 'org_admin')
      AND is_active = true
  )
$$;

-- ===== Link whatsapp_instances.account_id to accounts table =====
-- (The column already exists but without FK — add it if missing)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'whatsapp_instances'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'accounts'
  ) THEN
    -- Only add FK if the column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'whatsapp_instances' AND column_name = 'account_id'
    ) THEN
      ALTER TABLE public.whatsapp_instances
        ADD CONSTRAINT fk_whatsapp_instances_account
        FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;
