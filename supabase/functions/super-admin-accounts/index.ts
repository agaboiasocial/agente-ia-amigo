import {
  adminClient,
  corsHeaders,
  errorResponse,
  json,
  readJson,
  requirePlatformAdmin,
} from "../_shared/http.ts";

function normalizeSlug(slug: string) {
  return String(slug || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function accountPayload(input: Record<string, unknown>) {
  const name = String(input?.name || "").trim();
  const slug = normalizeSlug(String(input?.slug || name));
  if (!name || !slug) throw new Error("Nome e slug são obrigatórios");
  return {
    name,
    slug,
    locale: String(input?.locale || "pt"),
    plan_type: String(input?.plan_type || "crm"),
    plan_value: Number(input?.plan_value ?? 297),
    is_active: input?.is_active !== false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    await requirePlatformAdmin(req);
    const admin = adminClient();

    if (req.method === "GET") {
      const [{ data: accounts, error }, { data: members }, { data: contacts }] = await Promise.all([
        admin.from("accounts").select("*").order("name"),
        admin.from("account_members").select("account_id, is_active"),
        admin.from("contacts").select("account_id"),
      ]);
      if (error) throw error;

      const memberCounts: Record<string, number> = {};
      (members || []).forEach((m: { account_id: string | null; is_active: boolean | null }) => {
        if (m.account_id && m.is_active !== false) memberCounts[m.account_id] = (memberCounts[m.account_id] || 0) + 1;
      });
      const contactCounts: Record<string, number> = {};
      (contacts || []).forEach((c: { account_id: string | null }) => {
        if (c.account_id) contactCounts[c.account_id] = (contactCounts[c.account_id] || 0) + 1;
      });

      return json((accounts || []).map((a: Record<string, unknown> & { id: string }) => ({
        ...a,
        organization_id: a.id,
        members_count: memberCounts[a.id] || 0,
        contacts_count: contactCounts[a.id] || 0,
      })));
    }

    const body = await readJson(req);

    if (req.method === "POST") {
      const { data, error } = await admin.from("accounts").insert(accountPayload(body)).select("*").single();
      if (error) throw error;
      return json({ ok: true, account: { ...data, organization_id: data.id } }, 201);
    }

    if (req.method === "PATCH") {
      const id = String(body.id || "");
      if (!id) return json({ error: "id obrigatório" }, 400);
      const { data, error } = await admin
        .from("accounts")
        .update(accountPayload(body))
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return json({ ok: true, account: { ...data, organization_id: data.id } });
    }

    if (req.method === "DELETE") {
      const id = String(body.id || "");
      if (!id) return json({ error: "id obrigatório" }, 400);

      const safe = async (fn: () => Promise<unknown>) => {
        try { await fn(); } catch { /* ignore missing tables */ }
      };

      // 1. Get all child IDs we need
      const { data: contactRows } = await admin.from("contacts").select("id").eq("account_id", id);
      const contactIds = (contactRows || []).map((c: { id: string }) => c.id);

      const { data: convRows } = await admin.from("conversations").select("id").eq("account_id", id);
      const convIds = (convRows || []).map((c: { id: string }) => c.id);

      const { data: teamRows } = await admin.from("teams").select("id").eq("account_id", id);
      const teamIds = (teamRows || []).map((t: { id: string }) => t.id);

      const { data: inboxRows } = await admin.from("inboxes").select("id").eq("account_id", id);
      const inboxIds = (inboxRows || []).map((i: { id: string }) => i.id);

      const { data: leadRows } = await admin.from("pipeline_leads").select("id").eq("account_id", id);
      const leadIds = (leadRows || []).map((l: { id: string }) => l.id);

      // 2. Deepest children first (grandchildren)
      if (convIds.length) await safe(() => admin.from("messages").delete().in("conversation_id", convIds));
      if (leadIds.length) await safe(() => admin.from("pipeline_lead_activities").delete().in("lead_id", leadIds));
      if (teamIds.length) await safe(() => admin.from("team_members").delete().in("team_id", teamIds));
      if (inboxIds.length) await safe(() => admin.from("inbox_members").delete().in("inbox_id", inboxIds));
      if (contactIds.length) await safe(() => admin.from("payment_schedules").delete().in("contact_id", contactIds));

      // 3. Children of contacts (conversations + pipeline_leads reference contact_id)
      if (convIds.length) await safe(() => admin.from("conversations").delete().in("id", convIds));
      if (leadIds.length) await safe(() => admin.from("pipeline_leads").delete().in("id", leadIds));

      // 4. Now contacts are free to delete
      if (contactIds.length) await safe(() => admin.from("contacts").delete().in("id", contactIds));

      // 5. Other account-level tables
      await safe(() => admin.from("pipeline_stages").delete().eq("account_id", id));
      await safe(() => admin.from("teams").delete().eq("account_id", id));
      await safe(() => admin.from("inboxes").delete().eq("account_id", id));
      await safe(() => admin.from("ai_settings").delete().eq("account_id", id));
      await safe(() => admin.from("automations").delete().eq("account_id", id));
      await safe(() => admin.from("support_tickets").delete().eq("account_id", id));
      await safe(() => admin.from("account_members").delete().eq("account_id", id));
      await safe(() => admin.from("notifications").delete().eq("account_id", id));
      await safe(() => admin.from("quick_replies").delete().eq("account_id", id));
      await safe(() => admin.from("labels").delete().eq("account_id", id));

      // 6. Unlink (don't delete)
      await safe(() => admin.from("profiles").update({ account_id: null }).eq("account_id", id));
      await safe(() => admin.from("whatsapp_instances").update({ account_id: null }).eq("account_id", id));

      // 7. Final delete
      const { error } = await admin.from("accounts").delete().eq("id", id);
      if (error) throw new Error(`Falha ao excluir conta: ${error.message}`);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return errorResponse(error);
  }
});
