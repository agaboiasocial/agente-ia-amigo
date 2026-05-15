-- SECURITY DEFINER function so the public webhook (called by Evolution API)
-- can insert messages/conversations without needing service_role at runtime.
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
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id uuid;
  v_conversation_id uuid;
BEGIN
  IF p_phone IS NULL OR length(p_phone) = 0 THEN
    RETURN NULL;
  END IF;

  -- upsert contact
  SELECT id INTO v_contact_id FROM public.contacts WHERE phone_number = p_phone LIMIT 1;
  IF v_contact_id IS NULL THEN
    INSERT INTO public.contacts (name, phone_number, channel)
    VALUES (COALESCE(NULLIF(p_push_name, ''), p_phone), p_phone, 'whatsapp')
    RETURNING id INTO v_contact_id;
  ELSE
    UPDATE public.contacts
       SET name = COALESCE(NULLIF(p_push_name, ''), name),
           updated_at = now()
     WHERE id = v_contact_id AND (name IS NULL OR name = phone_number);
  END IF;

  -- find open/pending conv for this contact+instance, else create
  SELECT id INTO v_conversation_id
    FROM public.conversations
   WHERE contact_id = v_contact_id
     AND instance_name = p_instance
     AND status IN ('open','pending')
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (
      contact_id, instance_name, channel, status, last_message, last_message_at
    ) VALUES (
      v_contact_id, p_instance, 'whatsapp', 'open', p_content, now()
    ) RETURNING id INTO v_conversation_id;
  ELSE
    UPDATE public.conversations
       SET last_message = p_content,
           last_message_at = now(),
           updated_at = now()
     WHERE id = v_conversation_id;
  END IF;

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

REVOKE ALL ON FUNCTION public.process_whatsapp_message(text,text,text,text,text,text,text,boolean,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_message(text,text,text,text,text,text,text,boolean,jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.process_whatsapp_connection(
  p_instance text,
  p_state text,
  p_phone text,
  p_profile_name text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  v_status := CASE
    WHEN p_state = 'open' THEN 'connected'
    WHEN p_state = 'close' THEN 'disconnected'
    ELSE COALESCE(NULLIF(p_state,''), 'pending')
  END;

  INSERT INTO public.whatsapp_instances (instance_name, status, phone_number, profile_name, updated_at)
  VALUES (p_instance, v_status, NULLIF(p_phone,''), NULLIF(p_profile_name,''), now())
  ON CONFLICT (instance_name) DO UPDATE
    SET status = EXCLUDED.status,
        phone_number = COALESCE(EXCLUDED.phone_number, public.whatsapp_instances.phone_number),
        profile_name = COALESCE(EXCLUDED.profile_name, public.whatsapp_instances.profile_name),
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.process_whatsapp_connection(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_connection(text,text,text,text) TO anon, authenticated, service_role;

-- whatsapp_instances needs a unique constraint on instance_name for ON CONFLICT to work
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_instances_instance_name_key'
  ) THEN
    ALTER TABLE public.whatsapp_instances
      ADD CONSTRAINT whatsapp_instances_instance_name_key UNIQUE (instance_name);
  END IF;
END$$;