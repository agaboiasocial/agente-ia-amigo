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
    const { instanceName, deleteInstance = true } = req.body || {};
    if (!instanceName) return res.status(400).json({ error: "instanceName required" });

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN };
    const name = encodeURIComponent(instanceName);

    // Logout (disconnect device)
    try {
      await fetch(`${baseUrl}/instance/logout/${name}`, { method: "DELETE", headers });
    } catch (e) {
      console.warn("logout failed", e);
    }

    // Optionally remove instance from Evolution
    if (deleteInstance) {
      try {
        await fetch(`${baseUrl}/instance/delete/${name}`, { method: "DELETE", headers });
      } catch (e) {
        console.warn("delete failed", e);
      }
    }

    // Update our DB
    const accessToken = (req.headers.authorization || "").replace("Bearer ", "");
    const supa = getClient(accessToken || null);

    if (deleteInstance) {
      await supa.from("whatsapp_instances").delete().eq("instance_name", instanceName);
    } else {
      await supa
        .from("whatsapp_instances")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("instance_name", instanceName);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("whatsapp-disconnect error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
