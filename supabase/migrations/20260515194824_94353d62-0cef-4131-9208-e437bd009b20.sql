
CREATE TABLE IF NOT EXISTS public.inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  widget_color text DEFAULT '#2FAE7C',
  welcome_message text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read inboxes" ON public.inboxes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert inboxes" ON public.inboxes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update inboxes" ON public.inboxes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete inboxes" ON public.inboxes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER inboxes_updated_at BEFORE UPDATE ON public.inboxes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.inbox_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_id uuid NOT NULL REFERENCES public.inboxes(id) ON DELETE CASCADE,
  user_id uuid,
  team_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((user_id IS NOT NULL) OR (team_id IS NOT NULL))
);

ALTER TABLE public.inbox_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read inbox_members" ON public.inbox_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert inbox_members" ON public.inbox_members FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete inbox_members" ON public.inbox_members FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS inbox_id uuid REFERENCES public.inboxes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_id ON public.conversations(inbox_id);
CREATE INDEX IF NOT EXISTS idx_inbox_members_inbox_id ON public.inbox_members(inbox_id);
