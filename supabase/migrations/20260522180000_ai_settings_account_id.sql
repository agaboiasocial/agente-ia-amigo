-- Add account_id to ai_settings for multi-tenant AI configuration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_settings' AND column_name='account_id') THEN
    ALTER TABLE ai_settings ADD COLUMN account_id uuid;
  END IF;
END$$;

-- Update existing ai_settings records to inherit account_id from profiles (first admin)
UPDATE ai_settings a
   SET account_id = (
     SELECT p.account_id FROM profiles p WHERE p.account_id IS NOT NULL LIMIT 1
   )
 WHERE a.account_id IS NULL;
