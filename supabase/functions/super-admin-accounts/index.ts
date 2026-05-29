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
      const { error } = await admin.from("accounts").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return errorResponse(error);
  }
});
