-- Isolate IAS agent settings per account.
-- This migration is additive and preserves legacy/global rows.

ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS account_id uuid;

CREATE INDEX IF NOT EXISTS idx_ai_settings_account_id
  ON public.ai_settings(account_id);

-- Backfill a legacy global row to the first known account only when possible.
-- Existing data is kept; missing accounts receive their own copied/default row below.
UPDATE public.ai_settings s
   SET account_id = (
     SELECT p.account_id
       FROM public.profiles p
      WHERE p.account_id IS NOT NULL
      ORDER BY p.created_at
      LIMIT 1
   )
 WHERE s.account_id IS NULL
   AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.account_id IS NOT NULL);

-- If older code wrote an invalid account_id, detach it instead of failing the FK.
UPDATE public.ai_settings s
   SET account_id = NULL
 WHERE s.account_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.accounts a WHERE a.id = s.account_id
   );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = 'ai_settings'
       AND constraint_name = 'ai_settings_account_id_fkey'
  ) THEN
    ALTER TABLE public.ai_settings
      ADD CONSTRAINT ai_settings_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.ai_settings
  VALIDATE CONSTRAINT ai_settings_account_id_fkey;

-- Ensure every existing account has an initial IAS settings row.
INSERT INTO public.ai_settings (
  account_id,
  persona_name,
  system_prompt,
  model,
  temperature,
  is_active,
  schedule_enabled,
  schedule_days,
  schedule_start,
  schedule_end,
  off_hours_message,
  handoff_keyword,
  buffer_seconds,
  notification_group_jid,
  ignore_numbers
)
SELECT
  a.id,
  COALESCE(template.persona_name, 'IAS Assistente'),
  COALESCE(
    template.system_prompt,
    'Você é o IAS, atendente virtual da empresa. Seja cordial, objetivo e use português brasileiro. Sempre que não souber, ofereça transferir para um agente humano.'
  ),
  COALESCE(template.model, 'gpt-4o-mini'),
  COALESCE(template.temperature, 0.7),
  COALESCE(template.is_active, true),
  COALESCE(template.schedule_enabled, false),
  COALESCE(template.schedule_days, ARRAY['seg','ter','qua','qui','sex']),
  COALESCE(template.schedule_start, '09:00'),
  COALESCE(template.schedule_end, '18:00'),
  COALESCE(template.off_hours_message, 'Estamos fora do horário de atendimento.'),
  COALESCE(template.handoff_keyword, '#humano'),
  COALESCE(template.buffer_seconds, 3),
  template.notification_group_jid,
  COALESCE(template.ignore_numbers, '{}')
FROM public.accounts a
LEFT JOIN LATERAL (
  SELECT *
    FROM public.ai_settings s
   WHERE s.account_id IS NOT DISTINCT FROM a.id
      OR s.account_id IS NOT NULL
   ORDER BY (s.account_id IS NOT DISTINCT FROM a.id) DESC, s.created_at ASC
   LIMIT 1
) template ON true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_settings existing
   WHERE existing.account_id = a.id
);

-- New accounts get independent settings automatically.
CREATE OR REPLACE FUNCTION public.create_default_ai_settings_for_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_settings (
    account_id,
    persona_name,
    system_prompt,
    model,
    temperature,
    is_active,
    schedule_enabled,
    schedule_days,
    schedule_start,
    schedule_end,
    off_hours_message,
    handoff_keyword,
    buffer_seconds
  )
  VALUES (
    NEW.id,
    'IAS Assistente',
    'Você é o IAS, atendente virtual da empresa. Seja cordial, objetivo e use português brasileiro. Sempre que não souber, ofereça transferir para um agente humano.',
    'gpt-4o-mini',
    0.7,
    true,
    false,
    ARRAY['seg','ter','qua','qui','sex'],
    '09:00',
    '18:00',
    'Estamos fora do horário de atendimento.',
    '#humano',
    3
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_default_ai_settings_for_account_after_insert ON public.accounts;
CREATE TRIGGER create_default_ai_settings_for_account_after_insert
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_ai_settings_for_account();

-- Replace permissive global policy with account-scoped policies.
DROP POLICY IF EXISTS "ai_settings_all" ON public.ai_settings;
DROP POLICY IF EXISTS "ai_settings_select_own_account" ON public.ai_settings;
DROP POLICY IF EXISTS "ai_settings_insert_own_account" ON public.ai_settings;
DROP POLICY IF EXISTS "ai_settings_update_own_account" ON public.ai_settings;
DROP POLICY IF EXISTS "ai_settings_delete_admins" ON public.ai_settings;

CREATE POLICY "ai_settings_select_own_account"
  ON public.ai_settings FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id
        FROM public.profiles p
       WHERE p.user_id = auth.uid()
    )
    OR account_id IN (
      SELECT am.account_id
        FROM public.account_members am
       WHERE am.user_id = auth.uid()
         AND am.is_active = true
    )
  );

CREATE POLICY "ai_settings_insert_own_account"
  ON public.ai_settings FOR INSERT TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR account_id IN (
        SELECT p.account_id
          FROM public.profiles p
         WHERE p.user_id = auth.uid()
      )
      OR account_id IN (
        SELECT am.account_id
          FROM public.account_members am
         WHERE am.user_id = auth.uid()
           AND am.is_active = true
           AND am.role IN ('owner', 'org_admin')
      )
    )
  );

CREATE POLICY "ai_settings_update_own_account"
  ON public.ai_settings FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id
        FROM public.profiles p
       WHERE p.user_id = auth.uid()
    )
    OR account_id IN (
      SELECT am.account_id
        FROM public.account_members am
       WHERE am.user_id = auth.uid()
         AND am.is_active = true
         AND am.role IN ('owner', 'org_admin')
    )
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR account_id IN (
        SELECT p.account_id
          FROM public.profiles p
         WHERE p.user_id = auth.uid()
      )
      OR account_id IN (
        SELECT am.account_id
          FROM public.account_members am
         WHERE am.user_id = auth.uid()
           AND am.is_active = true
           AND am.role IN ('owner', 'org_admin')
      )
    )
  );

CREATE POLICY "ai_settings_delete_admins"
  ON public.ai_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
