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
BEGIN
  IF p_instance IS NULL OR length(p_instance) = 0 THEN
    RETURN NULL;
  END IF;

  IF p_phone IS NULL OR length(p_phone) = 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.whatsapp_instances (instance_name, status, updated_at)
  VALUES (p_instance, 'connected', now())
  ON CONFLICT (instance_name) DO UPDATE
    SET status = COALESCE(NULLIF(public.whatsapp_instances.status, ''), 'connected'),
        updated_at = now();

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