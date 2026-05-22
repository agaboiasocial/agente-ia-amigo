-- IAS Inbox Notification Center
-- Extends notifications without dropping existing data or changing auth/RLS.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS conversation_id uuid,
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS team_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications(user_id, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_account_category
  ON public.notifications(account_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_conversation
  ON public.notifications(conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.ias_create_inbox_notification(
  p_user_id uuid,
  p_account_id uuid,
  p_conversation_id uuid,
  p_contact_id uuid,
  p_team_id uuid,
  p_category text,
  p_source text,
  p_priority text,
  p_title text,
  p_description text,
  p_link text,
  p_metadata jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id text;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  v_message_id := COALESCE(p_metadata ->> 'message_id', '');

  IF v_message_id <> '' AND EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = p_user_id
      AND n.category = COALESCE(p_category, 'system')
      AND COALESCE(n.conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(p_conversation_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND COALESCE(n.metadata ->> 'message_id', '') = v_message_id
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    account_id,
    conversation_id,
    contact_id,
    team_id,
    type,
    category,
    source,
    priority,
    title,
    description,
    link,
    metadata
  ) VALUES (
    p_user_id,
    p_account_id,
    p_conversation_id,
    p_contact_id,
    p_team_id,
    COALESCE(p_category, 'system'),
    COALESCE(p_category, 'system'),
    COALESCE(p_source, 'system'),
    COALESCE(p_priority, 'normal'),
    p_title,
    p_description,
    p_link,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ias_resolve_conversation_user_id(p_assigned_agent_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF p_assigned_agent_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.user_id
    INTO v_user_id
  FROM public.profiles p
  WHERE p.user_id = p_assigned_agent_id
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  SELECT a.auth_user_id
    INTO v_user_id
  FROM public.agents a
  WHERE a.id = p_assigned_agent_id
  LIMIT 1;

  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.ias_notify_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation record;
  v_contact_name text;
  v_user_id uuid;
  v_title text;
  v_description text;
  v_message_kind text;
BEGIN
  IF COALESCE(NEW.is_from_contact, false) IS NOT TRUE OR COALESCE(NEW.is_private, false) IS TRUE THEN
    RETURN NEW;
  END IF;

  SELECT c.*, co.name AS contact_name
    INTO v_conversation
  FROM public.conversations c
  LEFT JOIN public.contacts co ON co.id = c.contact_id
  WHERE c.id = NEW.conversation_id;

  IF v_conversation.id IS NULL THEN
    RETURN NEW;
  END IF;

  v_contact_name := COALESCE(v_conversation.contact_name, NEW.sender_name, 'Contato');
  v_message_kind := COALESCE(NEW.message_type, 'text');
  v_title := 'Nova mensagem de ' || v_contact_name;
  v_description := LEFT(
    COALESCE(
      NULLIF(NEW.content, ''),
      CASE
        WHEN v_message_kind IN ('image', 'video', 'audio', 'document') THEN 'Nova mídia recebida'
        ELSE 'Nova mensagem recebida'
      END
    ),
    180
  );

  v_user_id := public.ias_resolve_conversation_user_id(v_conversation.assigned_agent_id);

  IF v_user_id IS NOT NULL THEN
    PERFORM public.ias_create_inbox_notification(
      v_user_id,
      v_conversation.account_id,
      NEW.conversation_id,
      NEW.contact_id,
      v_conversation.assigned_team_id,
      'message',
      COALESCE(v_conversation.channel, 'chat'),
      COALESCE(v_conversation.priority, 'normal'),
      v_title,
      v_description,
      '/conversas',
      jsonb_build_object(
        'message_id', NEW.id,
        'external_message_id', NEW.message_id,
        'message_type', v_message_kind,
        'instance_name', NEW.instance_name
      )
    );
  ELSE
    FOR v_user_id IN
      SELECT p.user_id
      FROM public.profiles p
      WHERE p.account_id IS NOT DISTINCT FROM v_conversation.account_id
    LOOP
      PERFORM public.ias_create_inbox_notification(
        v_user_id,
        v_conversation.account_id,
        NEW.conversation_id,
        NEW.contact_id,
        v_conversation.assigned_team_id,
        'message',
        COALESCE(v_conversation.channel, 'chat'),
        COALESCE(v_conversation.priority, 'normal'),
        v_title,
        v_description,
        '/conversas',
        jsonb_build_object(
          'message_id', NEW.id,
          'external_message_id', NEW.message_id,
          'message_type', v_message_kind,
          'instance_name', NEW.instance_name,
          'scope', 'account'
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ias_notify_conversation_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_contact_name text;
BEGIN
  IF NEW.assigned_agent_id IS NULL
    OR NEW.assigned_agent_id IS NOT DISTINCT FROM OLD.assigned_agent_id THEN
    RETURN NEW;
  END IF;

  v_user_id := public.ias_resolve_conversation_user_id(NEW.assigned_agent_id);

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_contact_name
  FROM public.contacts
  WHERE id = NEW.contact_id
  LIMIT 1;

  PERFORM public.ias_create_inbox_notification(
    v_user_id,
    NEW.account_id,
    NEW.id,
    NEW.contact_id,
    NEW.assigned_team_id,
    'assignment',
    COALESCE(NEW.channel, 'chat'),
    COALESCE(NEW.priority, 'normal'),
    'Conversa atribuída',
    'Você recebeu a conversa de ' || COALESCE(v_contact_name, 'um contato') || '.',
    '/conversas',
    jsonb_build_object('conversation_id', NEW.id, 'scope', 'assigned')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ias_notify_message_insert_after ON public.messages;
CREATE TRIGGER ias_notify_message_insert_after
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.ias_notify_message_insert();

DROP TRIGGER IF EXISTS ias_notify_conversation_assignment_after ON public.conversations;
CREATE TRIGGER ias_notify_conversation_assignment_after
AFTER UPDATE OF assigned_agent_id ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.ias_notify_conversation_assignment();
