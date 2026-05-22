-- Fix: process_whatsapp_message agora herda account_id da whatsapp_instances
-- Isso garante que conversas e contatos criados pelo webhook tenham account_id

CREATE OR REPLACE FUNCTION public.process_whatsapp_message(
  p_instance text,
  p_phone text,
  p_push_name text,
  p_message_id text,
  p_content text,
  p_message_type text,
  p_media_url text,
  p_from_me boolean,
  p_raw jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_conversation_id uuid;
  v_account_id uuid;
BEGIN
  IF p_instance IS NULL OR length(p_instance) = 0 THEN
    RETURN NULL;
  END IF;

  IF p_phone IS NULL OR length(p_phone) = 0 THEN
    RETURN NULL;
  END IF;

  -- Upsert instance and get account_id
  INSERT INTO public.whatsapp_instances (instance_name, status, updated_at)
  VALUES (p_instance, 'connected', now())
  ON CONFLICT (instance_name) DO UPDATE
    SET status = COALESCE(NULLIF(public.whatsapp_instances.status, ''), 'connected'),
        updated_at = now();

  SELECT account_id INTO v_account_id
    FROM public.whatsapp_instances
   WHERE instance_name = p_instance;

  -- Upsert contact WITH account_id
  SELECT id INTO v_contact_id FROM public.contacts WHERE phone_number = p_phone LIMIT 1;
  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts (name, phone_number, channel, account_id)
    VALUES (COALESCE(NULLIF(p_push_name, ''), p_phone), p_phone, 'whatsapp', v_account_id)
    RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.contacts
       SET name = COALESCE(NULLIF(p_push_name, ''), name),
           updated_at = now(),
           account_id = COALESCE(public.contacts.account_id, v_account_id)
     WHERE id = v_contact_id AND (name IS NULL OR name = phone_number);
  END IF;

  -- Find or create conversation WITH account_id
  SELECT id INTO v_conversation_id
    FROM public.conversations
   WHERE contact_id = v_contact_id
     AND instance_name = p_instance
     AND status IN ('open','pending')
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      contact_id, instance_name, channel, status, last_message, last_message_at, account_id
    ) VALUES (
      v_contact_id, p_instance, 'whatsapp', 'open', p_content, now(), v_account_id
    ) RETURNING id INTO v_conversation_id;
  ELSE
    UPDATE public.conversations
       SET last_message = p_content,
           last_message_at = now(),
           updated_at = now(),
           account_id = COALESCE(public.conversations.account_id, v_account_id)
     WHERE id = v_conversation_id;
  END IF;

  -- Insert message
  INSERT INTO public.messages (
    conversation_id, contact_id, instance_name, message_id, content,
    message_type, media_url, sender_name, is_from_contact, raw_data
  ) VALUES (
    v_conversation_id, v_contact_id, p_instance, p_message_id, p_content,
    COALESCE(p_message_type,'text'), p_media_url,
    CASE WHEN p_from_me THEN 'Eu' ELSE COALESCE(NULLIF(p_push_name,''), p_phone) END,
    NOT p_from_me, p_raw
  );

  RETURN v_conversation_id;
END;
$$;

-- Also fix process_whatsapp_connection to set account_id
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
BEGIN
  IF p_instance IS NULL OR length(p_instance) = 0 THEN
    RETURN;
  END IF;

  v_status := CASE
    WHEN p_state = 'open' THEN 'connected'
    WHEN p_state = 'connecting' THEN 'connecting'
    ELSE 'disconnected'
  END;

  INSERT INTO public.whatsapp_instances (instance_name, status, phone_number, profile_name, updated_at)
  VALUES (p_instance, v_status, NULLIF(p_phone, ''), NULLIF(p_profile_name, ''), now())
  ON CONFLICT (instance_name) DO UPDATE
    SET status = v_status,
        phone_number = COALESCE(NULLIF(p_phone, ''), public.whatsapp_instances.phone_number),
        profile_name = COALESCE(NULLIF(p_profile_name, ''), public.whatsapp_instances.profile_name),
        updated_at = now();
END;
$$;

-- Fix existing conversations/contacts that have null account_id
UPDATE public.conversations c
   SET account_id = wi.account_id
  FROM public.whatsapp_instances wi
 WHERE c.instance_name = wi.instance_name
   AND c.account_id IS NULL
   AND wi.account_id IS NOT NULL;

UPDATE public.contacts co
   SET account_id = c.account_id
  FROM public.conversations c
 WHERE co.id = c.contact_id
   AND co.account_id IS NULL
   AND c.account_id IS NOT NULL;
