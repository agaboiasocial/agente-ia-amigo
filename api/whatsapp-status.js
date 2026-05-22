export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { instanceName } = req.body || {};
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
    return res.status(200).json({
      state,
      connected: state === "open",
      profileName: body?.instance?.profileName || null,
      phoneNumber: body?.instance?.owner || body?.instance?.wuid || null,
    });
  } catch (error) {
    console.error("whatsapp-status error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
