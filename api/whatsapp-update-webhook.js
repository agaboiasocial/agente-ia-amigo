export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { instanceName } = req.body || {};
    if (!instanceName) return res.status(400).json({ error: "instanceName required" });

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
    const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://agente-ia-amigo.vercel.app";

    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const webhookUrl = `${PUBLIC_APP_URL}/api/whatsapp-webhook/${encodeURIComponent(instanceName)}`;

    const wRes = await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
      }),
    });

    let body = null;
    try { body = await wRes.json(); } catch {}

    return res.status(200).json({ ok: wRes.ok, webhookUrl, response: body });
  } catch (error) {
    console.error("update-webhook error:", error);
    return res.status(500).json({ error: error.message });
  }
}
