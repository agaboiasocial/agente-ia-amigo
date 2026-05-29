import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function ensureWhatsAppInbox(supa, { accountId, instanceName, phoneNumber, profileName }) {
  if (!accountId || !instanceName) return null;

  const { data: existing, error: findError } = await supa
    .from("inboxes")
    .select("id")
    .eq("account_id", accountId)
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing;

  const name = profileName || phoneNumber || instanceName;
  const channelConfig = {
    provider: "evolution",
    instance_name: instanceName,
    phone_number: phoneNumber || null,
  };

  const { data, error } = await supa
    .from("inboxes")
    .insert({
      account_id: accountId,
      name: `WhatsApp - ${name}`,
      channel: "WhatsApp",
      instance_name: instanceName,
      config: channelConfig,
      channel_config: channelConfig,
      active: true,
      status: "active",
      widget_color: "#25D366",
      welcome_message: "Olá! Como podemos ajudar?",
      greeting_message: "Olá! Como podemos ajudar?",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { instanceName, phoneNumber, accountId } = req.body || {};
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
    const webhookUrl = `${PUBLIC_APP_URL}/api/whatsapp-webhook/${encodeURIComponent(instanceName)}`;
    try {
      await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers,
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
    } catch (e) {
      console.warn("webhook set error", e);
    }

    // Save instance to DB so it appears in "Canais Conectados" immediately
    if (accountId) {
      try {
        const supa = getAdminClient();
        // Check if instance already exists
        const { data: existing } = await supa
          .from("whatsapp_instances")
          .select("id")
          .eq("instance_name", instanceName)
          .maybeSingle();
        if (existing) {
          await supa
            .from("whatsapp_instances")
            .update({ status: "pending", account_id: accountId, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supa.from("whatsapp_instances").insert({
            instance_name: instanceName,
            account_id: accountId,
            status: "pending",
          });
        }
        await ensureWhatsAppInbox(supa, { accountId, instanceName, phoneNumber, profileName: null });
      } catch (e) {
        console.warn("Failed to save instance/inbox to DB:", e);
      }
    }

    return res.status(200).json({ qrCode: qr, instanceName, webhookUrl });
  } catch (error) {
    console.error("whatsapp-connect error:", error);
    return res.status(500).json({ error: error.message || "Internal error" });
  }
}
