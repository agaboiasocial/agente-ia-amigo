import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { instanceName, instanceId } = req.body || {};
    if (!instanceName) return res.status(400).json({ error: "instanceName required" });

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const response = await fetch(
      `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`,
      { method: "GET", headers: { apikey: EVOLUTION_API_TOKEN } }
    );

    let body = null;
    try { body = await response.json(); } catch {}

    const state = body?.instance?.state || body?.state || "unknown";
    const connected = state === "open";
    const profileName = body?.instance?.profileName || null;
    const phoneNumber = body?.instance?.owner || body?.instance?.wuid || null;

    // Update DB with admin client (bypasses RLS)
    if (instanceId) {
      const supa = getAdminClient();
      const updateData = {
        status: connected ? "connected" : state === "connecting" ? "connecting" : "disconnected",
        updated_at: new Date().toISOString(),
      };
      if (phoneNumber) updateData.phone_number = phoneNumber.replace(/\D/g, "");
      if (profileName) updateData.profile_name = profileName;

      const { error } = await supa
        .from("whatsapp_instances")
        .update(updateData)
        .eq("id", instanceId);
      if (error) console.warn("DB update failed:", error);
    }

    return res.status(200).json({
      state,
      connected,
      profileName,
      phoneNumber,
    });
  } catch (error) {
    console.error("whatsapp-refresh error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
