-- Auto-create a WhatsApp inbox for every connected whatsapp_instances row.
-- The instance must already have account_id, which is set by the connect API.

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

CREATE INDEX IF NOT EXISTS idx_inboxes_account_instance
  ON public.inboxes(account_id, instance_name);

CREATE OR REPLACE FUNCTION public.ensure_whatsapp_inbox(
  p_account_id uuid,
  p_instance_name text,
  p_phone text DEFAULT NULL,
  p_profile_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inbox_id uuid;
  v_label text;
  v_config jsonb;
BEGIN
  IF p_account_id IS NULL OR p_instance_name IS NULL OR length(trim(p_instance_name)) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_inbox_id
    FROM public.inboxes
   WHERE account_id = p_account_id
     AND instance_name = p_instance_name
   ORDER BY created_at ASC NULLS LAST
   LIMIT 1;

  IF v_inbox_id IS NOT NULL THEN
    UPDATE public.inboxes
       SET status = 'active',
           active = true,
           channel = COALESCE(channel, 'WhatsApp'),
           config = COALESCE(NULLIF(config, '{}'::jsonb), jsonb_build_object(
             'provider', 'evolution',
             'instance_name', p_instance_name,
             'phone_number', NULLIF(p_phone, '')
           )),
           channel_config = COALESCE(NULLIF(channel_config, '{}'::jsonb), jsonb_build_object(
             'provider', 'evolution',
             'instance_name', p_instance_name,
             'phone_number', NULLIF(p_phone, '')
           )),
           updated_at = now()
     WHERE id = v_inbox_id;
    RETURN v_inbox_id;
  END IF;

  v_label := COALESCE(NULLIF(p_profile_name, ''), NULLIF(p_phone, ''), p_instance_name);
  v_config := jsonb_build_object(
    'provider', 'evolution',
    'instance_name', p_instance_name,
    'phone_number', NULLIF(p_phone, '')
  );

  INSERT INTO public.inboxes (
    account_id,
    name,
    channel,
    instance_name,
    config,
    channel_config,
    active,
    status,
    widget_color,
    welcome_message,
    greeting_message
  )
  VALUES (
    p_account_id,
    'WhatsApp - ' || v_label,
    'WhatsApp',
    p_instance_name,
    v_config,
    v_config,
    true,
    'active',
    '#25D366',
    'Olá! Como podemos ajudar?',
    'Olá! Como podemos ajudar?'
  )
  RETURNING id INTO v_inbox_id;

  RETURN v_inbox_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_whatsapp_connection(
  p_instance text,
  p_state text,
  p_phone text,
  p_profile_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_account_id uuid;
BEGIN
  IF p_instance IS NULL OR length(p_instance) = 0 THEN
    RETURN;
  END IF;

  v_status := CASE
    WHEN p_state = 'open' THEN 'connected'
    WHEN p_state = 'connecting' THEN 'connecting'
    ELSE 'disconnected'
  END;

  SELECT account_id INTO v_account_id
    FROM public.whatsapp_instances
   WHERE instance_name = p_instance
   LIMIT 1;

  INSERT INTO public.whatsapp_instances (instance_name, status, phone_number, profile_name, updated_at, account_id)
  VALUES (p_instance, v_status, NULLIF(p_phone, ''), NULLIF(p_profile_name, ''), now(), v_account_id)
  ON CONFLICT (instance_name) DO UPDATE
    SET status = v_status,
        phone_number = COALESCE(NULLIF(p_phone, ''), public.whatsapp_instances.phone_number),
        profile_name = COALESCE(NULLIF(p_profile_name, ''), public.whatsapp_instances.profile_name),
        updated_at = now()
  RETURNING account_id INTO v_account_id;

  IF v_status = 'connected' THEN
    PERFORM public.ensure_whatsapp_inbox(v_account_id, p_instance, p_phone, p_profile_name);
  END IF;
END;
$$;

INSERT INTO public.inboxes (
  account_id,
  name,
  channel,
  instance_name,
  config,
  channel_config,
  active,
  status,
  widget_color,
  welcome_message,
  greeting_message
)
SELECT
  wi.account_id,
  'WhatsApp - ' || COALESCE(NULLIF(wi.profile_name, ''), NULLIF(wi.phone_number, ''), wi.instance_name),
  'WhatsApp',
  wi.instance_name,
  jsonb_build_object('provider', 'evolution', 'instance_name', wi.instance_name, 'phone_number', wi.phone_number),
  jsonb_build_object('provider', 'evolution', 'instance_name', wi.instance_name, 'phone_number', wi.phone_number),
  true,
  'active',
  '#25D366',
  'Olá! Como podemos ajudar?',
  'Olá! Como podemos ajudar?'
FROM public.whatsapp_instances wi
WHERE wi.account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
      FROM public.inboxes i
     WHERE i.account_id = wi.account_id
       AND i.instance_name = wi.instance_name
  );

NOTIFY pgrst, 'reload schema';
