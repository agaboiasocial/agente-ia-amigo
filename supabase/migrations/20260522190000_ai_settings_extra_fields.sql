-- Add notification_group_jid and ignore_numbers to ai_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_settings' AND column_name='notification_group_jid') THEN
    ALTER TABLE ai_settings ADD COLUMN notification_group_jid text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_settings' AND column_name='ignore_numbers') THEN
    ALTER TABLE ai_settings ADD COLUMN ignore_numbers text[] DEFAULT '{}';
  END IF;
END$$;
