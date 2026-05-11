-- ===== Roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'agente');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "users see their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== Updated-at helper =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_initials text,
  online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "user updates own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "user inserts own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin manages profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto profile + role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
  v_initials text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1));
  v_initials := upper(substr(regexp_replace(v_name, '[^A-Za-z ]', '', 'g'), 1, 2));
  INSERT INTO public.profiles (user_id, display_name, avatar_initials)
    VALUES (NEW.id, v_name, v_initials);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'agente');
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== Contacts =====
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  channel text NOT NULL DEFAULT 'WhatsApp',
  labels text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read contacts" ON public.contacts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write contacts" ON public.contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Conversations =====
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'WhatsApp',
  status text NOT NULL DEFAULT 'aberta',
  stage text NOT NULL DEFAULT 'novo',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message text,
  last_message_at timestamptz,
  unread boolean NOT NULL DEFAULT false,
  sla_minutes integer DEFAULT 60,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read conversations" ON public.conversations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write conversations" ON public.conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER conversations_updated_at BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_conversations_status ON public.conversations(status);
CREATE INDEX idx_conversations_stage ON public.conversations(stage);

-- ===== Messages =====
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  author text NOT NULL CHECK (author IN ('cliente','agente')),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  is_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read messages" ON public.messages
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated write messages" ON public.messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_messages_conv ON public.messages(conversation_id, created_at);

-- ===== Audit logs =====
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read audit" ON public.audit_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated insert audit" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

-- ===== Quick replies =====
CREATE TABLE public.quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL UNIQUE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quick_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read quick replies" ON public.quick_replies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages quick replies" ON public.quick_replies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER quick_replies_updated_at BEFORE UPDATE ON public.quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== Labels =====
CREATE TABLE public.labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#2FAE7C',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read labels" ON public.labels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manages labels" ON public.labels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));