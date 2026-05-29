import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getUserClient(accessToken) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

async function assertAdmin(accessToken) {
  const supa = getUserClient(accessToken);
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) throw new Error("Não autenticado");

  const admin = getAdminClient();
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r) => r.role === "admin")) {
    throw new Error("Acesso restrito a administradores");
  }
  return user;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const accessToken = (req.headers.authorization || "").replace("Bearer ", "");
  if (!accessToken) return res.status(401).json({ error: "Não autenticado" });

  try {
    const currentUser = await assertAdmin(accessToken);
    const admin = getAdminClient();

    // ─── LIST ───
    if (req.method === "GET") {
      const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 500 });
      if (error) throw new Error(error.message);

      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }, { data: members }] = await Promise.all([
        admin.from("profiles").select("user_id, display_name, account_id").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
        admin.from("account_members").select("user_id, account_id, role").in("user_id", ids),
      ]);

      // Fetch account names
      const accountIds = [...new Set([
        ...(profiles || []).map((p) => p.account_id).filter(Boolean),
        ...(members || []).map((m) => m.account_id).filter(Boolean),
      ])];
      let accountMap = {};
      if (accountIds.length > 0) {
        const { data: accounts } = await admin.from("accounts").select("id, name").in("id", accountIds);
        (accounts || []).forEach((a) => { accountMap[a.id] = a.name; });
      }

      const result = list.users.map((u) => {
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
          accountName: accountId ? (accountMap[accountId] || null) : null,
          orgRole: member?.role || null,
          createdAt: u.created_at,
        };
      });
      return res.status(200).json(result);
    }

    // ─── CREATE ───
    if (req.method === "POST") {
      const { email, password, displayName, role = "agente", accountId, isOrgAdmin } = req.body || {};
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: "email, password e nome são obrigatórios" });
      }

      const initials = displayName.replace(/[^A-Za-z ]/g, "").trim().slice(0, 2).toUpperCase();

      // Create auth user
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");

      const userId = created.user.id;

      // Upsert profile with account_id
      await admin
        .from("profiles")
        .upsert({
          user_id: userId,
          display_name: displayName,
          avatar_initials: initials,
          account_id: accountId || null,
        }, { onConflict: "user_id" });

      // Set platform role
      if (role === "admin") {
        await admin.from("user_roles").upsert(
          { user_id: userId, role: "admin" },
          { onConflict: "user_id,role" }
        );
      }

      // Create account membership if assigned to org
      if (accountId) {
        const memberRole = isOrgAdmin ? "org_admin" : "member";
        await admin.from("account_members").upsert(
          {
            user_id: userId,
            account_id: accountId,
            role: memberRole,
            is_active: true,
          },
          { onConflict: "account_id,user_id" }
        );
      }

      return res.status(200).json({ ok: true, userId });
    }

    // ─── PATCH (actions) ───
    if (req.method === "PATCH") {
      const { action, userId, ...rest } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId obrigatório" });

      // Change password
      if (action === "change_password") {
        const { password } = rest;
        if (!password) return res.status(400).json({ error: "Senha obrigatória" });
        const { error } = await admin.auth.admin.updateUser(userId, { password });
        if (error) throw new Error(error.message);
        return res.status(200).json({ ok: true });
      }

      // Assign to account
      if (action === "assign_account") {
        const { accountId } = rest;
        // Update profile
        await admin.from("profiles").update({ account_id: accountId || null }).eq("user_id", userId);

        if (accountId) {
          // Upsert membership as member
          await admin.from("account_members").upsert(
            { user_id: userId, account_id: accountId, role: "member", is_active: true },
            { onConflict: "account_id,user_id" }
          );
        } else {
          // Remove all memberships
          await admin.from("account_members").delete().eq("user_id", userId);
        }
        return res.status(200).json({ ok: true });
      }

      // Promote to org admin
      if (action === "promote_org_admin") {
        const { accountId } = rest;
        if (!accountId) return res.status(400).json({ error: "accountId obrigatório" });
        await admin.from("account_members").upsert(
          { user_id: userId, account_id: accountId, role: "org_admin", is_active: true },
          { onConflict: "account_id,user_id" }
        );
        return res.status(200).json({ ok: true });
      }

      // Toggle platform admin
      if (action === "toggle_platform_admin") {
        const { makeAdmin } = rest;
        if (userId === currentUser.id) {
          return res.status(400).json({ error: "Você não pode alterar seu próprio papel" });
        }
        if (makeAdmin) {
          await admin.from("user_roles").upsert(
            { user_id: userId, role: "admin" },
            { onConflict: "user_id,role" }
          );
        } else {
          await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        }
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Ação desconhecida: " + action });
    }

    // ─── DELETE ───
    if (req.method === "DELETE") {
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId obrigatório" });
      if (userId === currentUser.id) return res.status(400).json({ error: "Você não pode remover sua própria conta" });

      // Clean up memberships, profile, then auth user
      await admin.from("account_members").delete().eq("user_id", userId);
      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("super-admin/users error:", error);
    return res.status(500).json({ error: error.message });
  }
}
