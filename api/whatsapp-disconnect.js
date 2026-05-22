import { createClient } from "@supabase/supabase-js";

// Use service role to bypass RLS (server-side trusted operation)
function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// User client to verify auth
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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { instanceName, deleteInstance = true } = req.body || {};
    if (!instanceName) return res.status(400).json({ error: "instanceName required" });

    // Verify user is authenticated
    const accessToken = (req.headers.authorization || "").replace("Bearer ", "");
    if (accessToken) {
      const userSupa = getUserClient(accessToken);
      const { data: { user }, error: authErr } = await userSupa.auth.getUser();
      if (authErr || !user) return res.status(401).json({ error: "Não autenticado" });
    }

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN };
    const name = encodeURIComponent(instanceName);

    // Logout (disconnect device)
    let logoutOk = false;
    try {
      const lr = await fetch(`${baseUrl}/instance/logout/${name}`, { method: "DELETE", headers });
      logoutOk = lr.ok;
      console.log("logout response:", lr.status);
    } catch (e) {
      console.warn("logout failed", e);
    }

    // Remove instance from Evolution
    let deleteOk = false;
    if (deleteInstance) {
      try {
        const dr = await fetch(`${baseUrl}/instance/delete/${name}`, { method: "DELETE", headers });
        deleteOk = dr.ok;
        console.log("delete response:", dr.status);
      } catch (e) {
        console.warn("delete failed", e);
      }
    }

    // Update our DB using admin client (bypasses RLS)
    const supa = getAdminClient();

    if (deleteInstance) {
      const { error: dbErr } = await supa.from("whatsapp_instances").delete().eq("instance_name", instanceName);
      if (dbErr) console.error("DB delete error:", dbErr);
    } else {
      const { error: dbErr } = await supa
        .from("whatsapp_instances")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("instance_name", instanceName);
      if (dbErr) console.error("DB update error:", dbErr);
    }

    return res.status(200).json({ ok: true, evolution: { logoutOk, deleteOk } });
  } catch (error) {
    console.error("whatsapp-disconnect error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
