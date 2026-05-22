export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { instanceName, phoneNumber } = req.body || {};
    if (!instanceName) return res.status(400).json({ error: "instanceName required" });

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
    const PUBLIC_APP_URL = process.env.PUBLIC_APP_URL || "https://agente-ia-amigo.vercel.app";

    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      return res.status(500).json({ error: "Evolution API not configured" });
    }

    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const headers = { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN };

    // Create instance
    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        ...(phoneNumber ? { number: phoneNumber.replace(/\D/g, "") } : {}),
      }),
    });

    let body = null;
    try { body = await createRes.json(); } catch {}

    if (!createRes.ok) {
      const msg = (body?.response?.message || body?.message || "").toString().toLowerCase();
      const alreadyExists = createRes.status === 403 || createRes.status === 409 || msg.includes("already") || msg.includes("exists");
      if (!alreadyExists) {
        return res.status(500).json({ error: body?.response?.message || body?.message || `Evolution API: ${createRes.status}` });
      }
    }

    // Connect to get QR
    const connectRes = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers,
    });
    let connectBody = null;
    try { connectBody = await connectRes.json(); } catch {}

    const qr =
      body?.qrcode?.base64 || body?.qrcode?.code ||
      connectBody?.base64 || connectBody?.qrcode?.base64 ||
      connectBody?.code || "";

    if (!qr) return res.status(500).json({ error: "QR Code não retornado pela Evolution API" });

    // Set webhook
    const webhookUrl = `${PUBLIC_APP_URL}/api/public/whatsapp-webhook/${encodeURIComponent(instanceName)}`;
    try {
      await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          },
        }),
      });
    } catch (e) {
      console.warn("webhook set error", e);
    }

    return res.status(200).json({ qrCode: qr, instanceName, webhookUrl });
  } catch (error) {
    console.error("whatsapp-connect error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
