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

      // Try RPC first, fallback to manual cascade
      const { error: rpcErr } = await admin.rpc("delete_account_cascade", { _account_id: id });
      if (rpcErr) {
        // Fallback: manual cascade delete
        const safe = async (fn: () => Promise<unknown>) => {
          try { await fn(); } catch { /* ignore */ }
        };

        // Get child IDs
        const { data: convs } = await admin.from("conversations").select("id").eq("account_id", id);
        const cIds = (convs || []).map((c: { id: string }) => c.id);
        const { data: teams } = await admin.from("teams").select("id").eq("account_id", id);
        const tIds = (teams || []).map((t: { id: string }) => t.id);
        const { data: inboxes } = await admin.from("inboxes").select("id").eq("account_id", id);
        const iIds = (inboxes || []).map((i: { id: string }) => i.id);
        const { data: leads } = await admin.from("pipeline_leads").select("id").eq("account_id", id);
        const lIds = (leads || []).map((l: { id: string }) => l.id);

        // Deep children first
        if (cIds.length) await safe(() => admin.from("messages").delete().in("conversation_id", cIds));
        if (lIds.length) await safe(() => admin.from("pipeline_lead_activities").delete().in("lead_id", lIds));
        if (tIds.length) await safe(() => admin.from("team_members").delete().in("team_id", tIds));
        if (iIds.length) await safe(() => admin.from("inbox_members").delete().in("inbox_id", iIds));

        // Account-level tables
        const tables = [
          "conversations", "pipeline_leads", "pipeline_stages", "contacts",
          "teams", "inboxes", "ai_settings", "automations", "support_tickets",
          "account_members", "notifications", "quick_replies", "labels",
          "payment_schedules",
        ];
        for (const t of tables) await safe(() => admin.from(t).delete().eq("account_id", id));

        // Unlink (don't delete)
        await safe(() => admin.from("profiles").update({ account_id: null }).eq("account_id", id));
        await safe(() => admin.from("whatsapp_instances").update({ account_id: null }).eq("account_id", id));

        // Final delete
        const { error } = await admin.from("accounts").delete().eq("id", id);
        if (error) throw new Error(`Falha ao excluir conta: ${error.message}`);
      }
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return errorResponse(error);
  }
});
