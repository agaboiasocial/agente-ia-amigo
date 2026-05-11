
-- 1) Enable RLS on interacoes_cidadao and restrict access to authenticated users only
ALTER TABLE public.interacoes_cidadao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read interacoes"
  ON public.interacoes_cidadao FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated insert interacoes"
  ON public.interacoes_cidadao FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update interacoes"
  ON public.interacoes_cidadao FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated delete interacoes"
  ON public.interacoes_cidadao FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- 2) Replace permissive ALL policies (USING true) with split policies that require an authenticated user
-- contacts
DROP POLICY IF EXISTS "authenticated write contacts" ON public.contacts;
CREATE POLICY "auth insert contacts" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update contacts" ON public.contacts FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete contacts" ON public.contacts FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- conversations
DROP POLICY IF EXISTS "authenticated write conversations" ON public.conversations;
CREATE POLICY "auth insert conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete conversations" ON public.conversations FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- messages
DROP POLICY IF EXISTS "authenticated write messages" ON public.messages;
CREATE POLICY "auth insert messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update messages" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete messages" ON public.messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- audit_logs: tighten permissive INSERT
DROP POLICY IF EXISTS "authenticated insert audit" ON public.audit_logs;
CREATE POLICY "auth insert audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) SECURITY DEFINER function exposure: revoke EXECUTE on has_role from anon/authenticated.
-- It is only used from RLS policy context, which doesn't require EXECUTE grant.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
