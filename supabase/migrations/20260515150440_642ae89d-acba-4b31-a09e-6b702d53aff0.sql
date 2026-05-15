
-- Extend labels with description and sidebar visibility
ALTER TABLE public.labels
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS show_in_sidebar boolean NOT NULL DEFAULT false;

-- Allow authenticated users to manage labels (not only admins) so the UI works for any agent
DROP POLICY IF EXISTS "auth insert labels" ON public.labels;
DROP POLICY IF EXISTS "auth update labels" ON public.labels;
DROP POLICY IF EXISTS "auth delete labels" ON public.labels;

CREATE POLICY "auth insert labels" ON public.labels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update labels" ON public.labels
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete labels" ON public.labels
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- Join table: conversations <-> labels
CREATE TABLE IF NOT EXISTS public.conversation_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, label_id)
);

ALTER TABLE public.conversation_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read conv labels" ON public.conversation_labels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert conv labels" ON public.conversation_labels
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete conv labels" ON public.conversation_labels
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_conversation_labels_label ON public.conversation_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_conversation_labels_conversation ON public.conversation_labels(conversation_id);
