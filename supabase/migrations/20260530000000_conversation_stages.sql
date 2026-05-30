-- ===== Conversation Kanban stages (editable per account) =====
CREATE TABLE IF NOT EXISTS public.conversation_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#94A3B8',
  position int NOT NULL DEFAULT 0,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, key)
);

ALTER TABLE public.conversation_stages ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read/manage stages of their own account
DROP POLICY IF EXISTS "read own conversation_stages" ON public.conversation_stages;
CREATE POLICY "read own conversation_stages" ON public.conversation_stages
  FOR SELECT TO authenticated
  USING (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "manage own conversation_stages" ON public.conversation_stages;
CREATE POLICY "manage own conversation_stages" ON public.conversation_stages
  FOR ALL TO authenticated
  USING (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_conversation_stages_account ON public.conversation_stages(account_id, position);
