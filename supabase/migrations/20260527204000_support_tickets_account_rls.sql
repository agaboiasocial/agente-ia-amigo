-- Support Center: real account-scoped support tickets.
-- Keeps compatibility with older support_tickets schemas that used description/agent_id.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid,
  user_id uuid,
  subject text NOT NULL,
  message text,
  description text NOT NULL,
  category text DEFAULT 'Dúvida',
  priority text DEFAULT 'Média',
  status text DEFAULT 'open',
  attachment_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS message text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'Dúvida',
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'Média',
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.support_tickets
   SET message = COALESCE(message, description),
       description = COALESCE(description, message, subject),
       status = CASE
         WHEN status IN ('Aberto', 'open') THEN 'open'
         WHEN status IN ('Em andamento', 'in_progress') THEN 'in_progress'
         WHEN status IN ('Resolvido', 'resolved') THEN 'resolved'
         ELSE COALESCE(status, 'open')
       END;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'support_tickets'
       AND column_name = 'agent_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.support_tickets
         SET user_id = COALESCE(user_id, agent_id)
    $sql$;
  END IF;
END $$;

UPDATE public.support_tickets st
   SET account_id = p.account_id
  FROM public.profiles p
 WHERE st.account_id IS NULL
   AND st.user_id = p.user_id;

ALTER TABLE public.support_tickets
  ALTER COLUMN description SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'open',
  ALTER COLUMN priority SET DEFAULT 'Média',
  ALTER COLUMN category SET DEFAULT 'Dúvida';

CREATE INDEX IF NOT EXISTS idx_support_tickets_account_created
  ON public.support_tickets(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_created
  ON public.support_tickets(user_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agents read own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "agents create own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "agents update own tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "admins delete tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_account" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_own_or_admin" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_delete_admin" ON public.support_tickets;

CREATE POLICY "support_tickets_select_account"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT am.account_id
        FROM public.account_members am
       WHERE am.user_id = auth.uid()
         AND am.is_active = true
         AND am.role IN ('owner', 'org_admin')
    )
  );

CREATE POLICY "support_tickets_insert_own"
  ON public.support_tickets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

CREATE POLICY "support_tickets_update_own_or_admin"
  ON public.support_tickets
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT am.account_id
        FROM public.account_members am
       WHERE am.user_id = auth.uid()
         AND am.is_active = true
         AND am.role IN ('owner', 'org_admin')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT am.account_id
        FROM public.account_members am
       WHERE am.user_id = auth.uid()
         AND am.is_active = true
         AND am.role IN ('owner', 'org_admin')
    )
  );

CREATE POLICY "support_tickets_delete_admin"
  ON public.support_tickets
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT am.account_id
        FROM public.account_members am
       WHERE am.user_id = auth.uid()
         AND am.is_active = true
         AND am.role IN ('owner', 'org_admin')
    )
  );

NOTIFY pgrst, 'reload schema';
