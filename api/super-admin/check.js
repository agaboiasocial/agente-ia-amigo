import { createClient } from "@supabase/supabase-js";

function getClient(accessToken) {
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const accessToken = (req.headers.authorization || "").replace("Bearer ", "");
    if (!accessToken) return res.status(401).json({ error: "Não autenticado" });

    const supa = getClient(accessToken);
    const { data: { user }, error: authError } = await supa.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: "Não autenticado" });

    const { data: roles } = await supa
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = !!roles?.some((r) => r.role === "admin");
    return res.status(200).json({ isAdmin });
  } catch (error) {
    console.error("check-admin error:", error);
    return res.status(500).json({ error: error.message });
  }
}
