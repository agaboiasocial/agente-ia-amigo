
-- 1) whatsapp_instances: admin-only SELECT (sensitive credentials)
DROP POLICY IF EXISTS "Agentes podem ler instancias" ON public.whatsapp_instances;
CREATE POLICY "Admins podem ler instancias"
  ON public.whatsapp_instances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) audit_logs: admin-only SELECT
DROP POLICY IF EXISTS "Agentes podem ler audit" ON public.audit_logs;
CREATE POLICY "Admins podem ler audit"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3) agents: admin-only SELECT (contains emails)
DROP POLICY IF EXISTS "Agentes podem ver agentes" ON public.agents;
CREATE POLICY "Admins podem ver agentes"
  ON public.agents FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) inbox_members: admin-only INSERT/DELETE
DROP POLICY IF EXISTS "auth insert inbox_members" ON public.inbox_members;
DROP POLICY IF EXISTS "auth delete inbox_members" ON public.inbox_members;
CREATE POLICY "admins insert inbox_members"
  ON public.inbox_members FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete inbox_members"
  ON public.inbox_members FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) interacoes_cidadao: restrict UPDATE to admin (DELETE already admin-only)
DROP POLICY IF EXISTS "authenticated update interacoes" ON public.interacoes_cidadao;
CREATE POLICY "admins update interacoes"
  ON public.interacoes_cidadao FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) support_tickets: owner + admin
CREATE POLICY "agents read own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "agents create own tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());
CREATE POLICY "agents update own tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (agent_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete tickets"
  ON public.support_tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7) conversations: replace ALL-true with scoped writes (keep authenticated agent access)
DROP POLICY IF EXISTS "Agentes podem atualizar conversas" ON public.conversations;
CREATE POLICY "Agentes podem inserir conversas"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Agentes podem atualizar conversas"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins podem deletar conversas"
  ON public.conversations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 8) messages: tighten INSERT (must be agent, not impersonating contact)
DROP POLICY IF EXISTS "Agentes podem inserir mensagens" ON public.messages;
CREATE POLICY "Agentes podem inserir mensagens"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND is_from_contact = false);

-- 9) Lock down SECURITY DEFINER functions from API roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_whatsapp_message(text, text, text, text, text, text, text, boolean, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_whatsapp_connection(text, text, text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;

-- 10) Revoke anon SELECT on all public tables (GraphQL exposure)
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
