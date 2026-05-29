-- Fix Pipeline contacts payloads by standardizing contact labels as contacts.tags.
-- The UI no longer writes contacts.labels. This migration keeps old data if that
-- column exists in an older database, without requiring it in new databases.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS stage_id uuid,
  ADD COLUMN IF NOT EXISTS estimated_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS probability numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS lead_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS won_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS loss_reason_id uuid,
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_contact_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'contacts'
       AND column_name = 'labels'
  ) THEN
    EXECUTE $sql$
      UPDATE public.contacts
         SET tags = labels
       WHERE tags = '{}'
         AND labels IS NOT NULL
    $sql$;
  END IF;
END $$;

UPDATE public.contacts
   SET channel = lower(trim(channel))
 WHERE channel IS NOT NULL
   AND channel <> lower(trim(channel));

ALTER TABLE public.contacts
  ALTER COLUMN tags SET DEFAULT '{}',
  ALTER COLUMN source SET DEFAULT 'manual',
  ALTER COLUMN estimated_value SET DEFAULT 0,
  ALTER COLUMN probability SET DEFAULT 0,
  ALTER COLUMN lead_score SET DEFAULT 0,
  ALTER COLUMN ai_paused SET DEFAULT false,
  ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_contacts_account_stage
  ON public.contacts(account_id, stage_id);

CREATE INDEX IF NOT EXISTS idx_contacts_account_updated
  ON public.contacts(account_id, updated_at DESC);

NOTIFY pgrst, 'reload schema';
