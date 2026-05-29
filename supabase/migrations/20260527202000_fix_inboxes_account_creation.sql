-- Fix inbox creation by making inboxes account-scoped and compatible with
-- both legacy UI columns and current generated Supabase types.

CREATE TABLE IF NOT EXISTS public.inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.inboxes
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS widget_color text,
  ADD COLUMN IF NOT EXISTS welcome_message text,
  ADD COLUMN IF NOT EXISTS greeting_message text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS instance_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.inboxes
   SET channel_config = config
 WHERE channel_config = '{}'::jsonb
   AND config IS NOT NULL
   AND config <> '{}'::jsonb;

UPDATE public.inboxes
   SET config = channel_config
 WHERE config = '{}'::jsonb
   AND channel_config IS NOT NULL
   AND channel_config <> '{}'::jsonb;

UPDATE public.inboxes
   SET active = COALESCE(active, status IS DISTINCT FROM 'inactive'),
       status = CASE WHEN COALESCE(active, status IS DISTINCT FROM 'inactive') THEN 'active' ELSE 'inactive' END,
       welcome_message = COALESCE(welcome_message, greeting_message),
       greeting_message = COALESCE(greeting_message, welcome_message),
       widget_color = COALESCE(widget_color, '#2FAE7C');

CREATE TABLE IF NOT EXISTS public.inbox_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE,
  user_id uuid,
  team_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL) OR (team_id IS NOT NULL))
);

ALTER TABLE public.inbox_members
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS inbox_id uuid REFERENCES public.inboxes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inboxes_account_id ON public.inboxes(account_id);
CREATE INDEX IF NOT EXISTS idx_inboxes_account_channel ON public.inboxes(account_id, channel);
CREATE INDEX IF NOT EXISTS idx_inbox_members_inbox_id ON public.inbox_members(inbox_id);
CREATE INDEX IF NOT EXISTS idx_inbox_members_user_id ON public.inbox_members(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_members_unique_user
  ON public.inbox_members(inbox_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS inbox_members_unique_team
  ON public.inbox_members(inbox_id, team_id)
  WHERE team_id IS NOT NULL;

ALTER TABLE public.inboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth read inboxes" ON public.inboxes;
DROP POLICY IF EXISTS "auth insert inboxes" ON public.inboxes;
DROP POLICY IF EXISTS "auth update inboxes" ON public.inboxes;
DROP POLICY IF EXISTS "auth delete inboxes" ON public.inboxes;
DROP POLICY IF EXISTS "inboxes_select_own_account" ON public.inboxes;
DROP POLICY IF EXISTS "inboxes_insert_own_account" ON public.inboxes;
DROP POLICY IF EXISTS "inboxes_update_own_account" ON public.inboxes;
DROP POLICY IF EXISTS "inboxes_delete_own_account" ON public.inboxes;

CREATE POLICY "inboxes_select_own_account"
  ON public.inboxes
  FOR SELECT
  TO authenticated
  USING (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

CREATE POLICY "inboxes_insert_own_account"
  ON public.inboxes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

CREATE POLICY "inboxes_update_own_account"
  ON public.inboxes
  FOR UPDATE
  TO authenticated
  USING (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  )
  WITH CHECK (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

CREATE POLICY "inboxes_delete_own_account"
  ON public.inboxes
  FOR DELETE
  TO authenticated
  USING (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

DROP POLICY IF EXISTS "auth read inbox_members" ON public.inbox_members;
DROP POLICY IF EXISTS "auth insert inbox_members" ON public.inbox_members;
DROP POLICY IF EXISTS "auth delete inbox_members" ON public.inbox_members;
DROP POLICY IF EXISTS "admins insert inbox_members" ON public.inbox_members;
DROP POLICY IF EXISTS "admins delete inbox_members" ON public.inbox_members;
DROP POLICY IF EXISTS "inbox_members_select_own_account" ON public.inbox_members;
DROP POLICY IF EXISTS "inbox_members_insert_own_account" ON public.inbox_members;
DROP POLICY IF EXISTS "inbox_members_delete_own_account" ON public.inbox_members;

CREATE POLICY "inbox_members_select_own_account"
  ON public.inbox_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.inboxes i
       WHERE i.id = inbox_members.inbox_id
         AND i.account_id IN (
           SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
           UNION
           SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
         )
    )
  );

CREATE POLICY "inbox_members_insert_own_account"
  ON public.inbox_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
        FROM public.inboxes i
       WHERE i.id = inbox_members.inbox_id
         AND i.account_id IN (
           SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
           UNION
           SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
         )
    )
  );

CREATE POLICY "inbox_members_delete_own_account"
  ON public.inbox_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.inboxes i
       WHERE i.id = inbox_members.inbox_id
         AND i.account_id IN (
           SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
           UNION
           SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
         )
    )
  );

NOTIFY pgrst, 'reload schema';
