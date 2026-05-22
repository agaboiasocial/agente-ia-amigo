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
  const accessToken = (req.headers.authorization || "").replace("Bearer ", "");
  if (!accessToken) return res.status(401).json({ error: "Não autenticado" });

  try {
    const currentUser = await assertAdmin(accessToken);
    const admin = getAdminClient();

    // LIST
    if (req.method === "GET") {
      const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 });
      if (error) throw new Error(error.message);

      const ids = list.users.map((u) => u.id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        admin.from("profiles").select("user_id, display_name").in("user_id", ids),
        admin.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);

      const result = list.users.map((u) => {
        const prof = profiles?.find((p) => p.user_id === u.id);
        const userRoles = roles?.filter((r) => r.user_id === u.id).map((r) => r.role) ?? [];
        return {
          id: u.id,
          email: u.email ?? "",
          displayName: prof?.display_name ?? u.email ?? "",
          roles: userRoles,
          createdAt: u.created_at,
        };
      });
      return res.status(200).json(result);
    }

    // CREATE
    if (req.method === "POST") {
      const { email, password, displayName, role = "agente" } = req.body || {};
      if (!email || !password || !displayName) {
        return res.status(400).json({ error: "email, password, displayName required" });
      }

      const initials = displayName.replace(/[^A-Za-z ]/g, "").trim().slice(0, 2).toUpperCase();

      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");

      const userId = created.user.id;
      await admin
        .from("profiles")
        .upsert({ user_id: userId, display_name: displayName, avatar_initials: initials }, { onConflict: "user_id" });

      if (role === "admin") {
        await admin.from("user_roles").insert({ user_id: userId, role: "admin" });
      }

      return res.status(200).json({ ok: true, userId });
    }

    // DELETE
    if (req.method === "DELETE") {
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ error: "userId required" });
      if (userId === currentUser.id) return res.status(400).json({ error: "Você não pode remover sua própria conta" });

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
