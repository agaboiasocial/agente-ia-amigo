import {
  adminClient,
  corsHeaders,
  errorResponse,
  json,
  readJson,
  requirePlatformAdmin,
} from "../_shared/http.ts";

function initials(displayName: string) {
  return displayName.replace(/[^A-Za-z ]/g, "").trim().slice(0, 2).toUpperCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const currentUser = await requirePlatformAdmin(req);
    const admin = adminClient();

    if (req.method === "GET") {
      const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 500 });
      if (error) throw error;

      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }, { data: members }] = await Promise.all([
        admin.from("profiles").select("user_id, display_name, account_id").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
        admin.from("account_members").select("user_id, account_id, role").in("user_id", ids),
      ]);

      const accountIds = [...new Set([
        ...(profiles || []).map((p) => p.account_id).filter(Boolean),
        ...(members || []).map((m) => m.account_id).filter(Boolean),
      ])];
      const accountMap: Record<string, string> = {};
      if (accountIds.length > 0) {
        const { data: accounts } = await admin.from("accounts").select("id, name").in("id", accountIds);
        (accounts || []).forEach((a) => { accountMap[a.id] = a.name; });
      }

      return json(list.users.map((u) => {
        const prof = profiles?.find((p) => p.user_id === u.id);
        const userRoles = roles?.filter((r) => r.user_id === u.id).map((r) => r.role) ?? [];
        const member = members?.find((m) => m.user_id === u.id);
        const accountId = prof?.account_id || member?.account_id || null;
        return {
          id: u.id,
          email: u.email ?? "",
          displayName: prof?.display_name ?? u.email ?? "",
          roles: userRoles,
          accountId,
          organizationId: accountId,
          accountName: accountId ? (accountMap[accountId] || null) : null,
          orgRole: member?.role || null,
          createdAt: u.created_at,
        };
      }));
    }

    const body = await readJson(req);

    if (req.method === "POST") {
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      const displayName = String(body.displayName || "").trim();
      const role = String(body.role || "agente");
      const accountId = body.accountId ? String(body.accountId) : null;
      const isOrgAdmin = !!body.isOrgAdmin;
      if (!email || !password || !displayName) return json({ error: "email, password e nome são obrigatórios" }, 400);

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (error || !created.user) throw error || new Error("Falha ao criar usuário");

      const userId = created.user.id;
      await admin.from("profiles").upsert({
        user_id: userId,
        display_name: displayName,
        avatar_initials: initials(displayName),
        account_id: accountId,
      }, { onConflict: "user_id" });

      if (role === "admin") {
        await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
      }

      if (accountId) {
        await admin.from("account_members").upsert({
          user_id: userId,
          account_id: accountId,
          role: isOrgAdmin ? "org_admin" : "member",
          is_active: true,
        }, { onConflict: "account_id,user_id" });
      }

      return json({ ok: true, userId });
    }

    if (req.method === "PATCH") {
      const action = String(body.action || "");
      const userId = String(body.userId || "");
      if (!userId) return json({ error: "userId obrigatório" }, 400);

      if (action === "change_password") {
        const password = String(body.password || "");
        if (!password) return json({ error: "Senha obrigatória" }, 400);
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
        return json({ ok: true });
      }

      if (action === "assign_account") {
        const accountId = body.accountId ? String(body.accountId) : null;
        await admin.from("profiles").update({ account_id: accountId }).eq("user_id", userId);
        if (accountId) {
          await admin.from("account_members").upsert({
            user_id: userId,
            account_id: accountId,
            role: "member",
            is_active: true,
          }, { onConflict: "account_id,user_id" });
        } else {
          await admin.from("account_members").delete().eq("user_id", userId);
        }
        return json({ ok: true });
      }

      if (action === "promote_org_admin") {
        const accountId = String(body.accountId || "");
        if (!accountId) return json({ error: "accountId obrigatório" }, 400);
        await admin.from("account_members").upsert({
          user_id: userId,
          account_id: accountId,
          role: "org_admin",
          is_active: true,
        }, { onConflict: "account_id,user_id" });
        return json({ ok: true });
      }

      if (action === "toggle_platform_admin") {
        if (userId === currentUser.id) return json({ error: "Você não pode alterar seu próprio papel" }, 400);
        if (body.makeAdmin) {
          await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
        } else {
          await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        }
        return json({ ok: true });
      }

      return json({ error: `Ação desconhecida: ${action}` }, 400);
    }

    if (req.method === "DELETE") {
      const userId = String(body.userId || "");
      if (!userId) return json({ error: "userId obrigatório" }, 400);
      if (userId === currentUser.id) return json({ error: "Você não pode remover sua própria conta" }, 400);
      await admin.from("account_members").delete().eq("user_id", userId);
      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    return errorResponse(error);
  }
});
