-- Fix manual contact creation by using tenant-scoped contacts and lowercase channels.
-- Manual contacts use channel = 'manual'; WhatsApp webhook contacts keep channel = 'whatsapp'.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'contacts'
       AND column_name = 'phone'
  ) THEN
    EXECUTE $sql$
      UPDATE public.contacts
         SET phone_number = regexp_replace(phone, '\D', '', 'g')
       WHERE phone_number IS NULL
         AND phone IS NOT NULL
         AND length(regexp_replace(phone, '\D', '', 'g')) > 0
    $sql$;
  END IF;
END $$;

UPDATE public.contacts
   SET channel = CASE lower(trim(channel))
     WHEN 'whatsapp' THEN 'whatsapp'
     WHEN 'whats app' THEN 'whatsapp'
     WHEN 'web' THEN 'web'
     WHEN 'website' THEN 'web'
     WHEN 'instagram' THEN 'instagram'
     WHEN 'facebook' THEN 'facebook'
     WHEN 'telegram' THEN 'telegram'
     WHEN 'email' THEN 'email'
     WHEN 'manual' THEN 'manual'
     WHEN 'crm' THEN 'crm'
     ELSE 'manual'
   END
 WHERE channel IS NULL
    OR channel <> lower(trim(channel))
    OR lower(trim(channel)) IN ('whats app', 'website')
    OR lower(trim(channel)) NOT IN ('manual', 'whatsapp', 'web', 'instagram', 'facebook', 'telegram', 'email', 'crm');

ALTER TABLE public.contacts
  ALTER COLUMN channel SET DEFAULT 'manual',
  ALTER COLUMN channel SET NOT NULL;

ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_channel_check;
ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_channel_check
  CHECK (channel IN ('manual', 'whatsapp', 'web', 'instagram', 'facebook', 'telegram', 'email', 'crm'));

CREATE INDEX IF NOT EXISTS idx_contacts_account_phone_number
  ON public.contacts(account_id, phone_number)
  WHERE phone_number IS NOT NULL;

NOTIFY pgrst, 'reload schema';
