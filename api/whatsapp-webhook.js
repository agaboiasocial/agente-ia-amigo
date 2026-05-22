import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for webhook");
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function digits(s) {
  return (s || "").replace(/\D/g, "");
}
function jidToPhone(jid) {
  if (!jid) return "";
  return digits(jid.split("@")[0]);
}

function extractText(msg) {
  if (!msg) return { content: "", type: "text", mediaUrl: null };
  if (msg.conversation) return { content: msg.conversation, type: "text", mediaUrl: null };
  if (msg.extendedTextMessage?.text) return { content: msg.extendedTextMessage.text, type: "text", mediaUrl: null };
  if (msg.imageMessage) return { content: msg.imageMessage.caption || "[imagem]", type: "image", mediaUrl: msg.imageMessage.url || null };
  if (msg.videoMessage) return { content: msg.videoMessage.caption || "[vídeo]", type: "video", mediaUrl: msg.videoMessage.url || null };
  if (msg.audioMessage) return { content: "[áudio]", type: "audio", mediaUrl: msg.audioMessage.url || null };
  if (msg.documentMessage) return { content: msg.documentMessage.fileName || "[documento]", type: "document", mediaUrl: msg.documentMessage.url || null };
  if (msg.stickerMessage) return { content: "[sticker]", type: "sticker", mediaUrl: null };
  return { content: "[mensagem]", type: "text", mediaUrl: null };
}

async function handleMessageUpsert(instanceName, item, origin) {
  const key = item?.key || {};
  const remoteJid = key.remoteJid || "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return;
  const phone = jidToPhone(remoteJid);
  if (!phone) return;
  const fromMe = !!key.fromMe;
  const messageId = key.id || "";
  const pushName = item?.pushName || phone;
  const { content, type, mediaUrl } = extractText(item?.message);

  const supa = getClient();
  const { data: conversationId, error } = await supa.rpc("process_whatsapp_message", {
    p_instance: instanceName,
    p_phone: phone,
    p_push_name: pushName,
    p_message_id: messageId,
    p_content: content,
    p_message_type: type,
    p_media_url: mediaUrl,
    p_from_me: fromMe,
    p_raw: item,
  });
  if (error) {
    console.error("rpc process_whatsapp_message", error);
    return;
  }

  // Trigger AI processing for incoming contact messages (not fromMe)
  if (!fromMe && conversationId && type === "text" && content) {
    try {
      // Get account_id and contact_id for AI processing
      const { data: conv } = await supa
        .from("conversations")
        .select("id, contact_id, account_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (conv?.contact_id) {
        const aiUrl = (origin || "").replace(/\/+$/, "") + "/api/ai-process";
        fetch(aiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: conv.id,
            contactId: conv.contact_id,
            instanceName,
            accountId: conv.account_id,
          }),
        }).catch((err) => console.error("[AI] trigger error:", err.message));
      }
    } catch (e) {
      console.error("[AI] lookup error:", e.message);
    }
  }
}

async function handleConnectionUpdate(instanceName, data) {
  const supa = getClient();
  const { error } = await supa.rpc("process_whatsapp_connection", {
    p_instance: instanceName,
    p_state: data?.state || data?.status || "",
    p_phone: data?.wuid ? jidToPhone(data.wuid) : "",
    p_profile_name: data?.profileName || "",
  });
  if (error) console.error("rpc process_whatsapp_connection", error);
}

export default async function handler(req, res) {
  // CORS
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey");
    return res.status(204).end();
  }

  const instanceName = req.query.instance;

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, instance: instanceName });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!instanceName) {
    return res.status(400).json({ error: "instance query param required" });
  }

  try {
    const payload = req.body || {};
    const event = payload?.event || payload?.type || "";
    const data = payload?.data ?? payload;

    // Build origin URL for internal API calls (AI processing)
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const origin = `${proto}://${host}`;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) await handleMessageUpsert(instanceName, item, origin);
    } else if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      await handleConnectionUpdate(instanceName, data);
    } else if (data?.key?.remoteJid) {
      await handleMessageUpsert(instanceName, data, origin);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("webhook error", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
