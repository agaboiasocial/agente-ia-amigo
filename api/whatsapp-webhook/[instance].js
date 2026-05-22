import { createClient } from "@supabase/supabase-js";

function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
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

async function handleMessageUpsert(instanceName, item) {
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
  const { error } = await supa.rpc("process_whatsapp_message", {
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
  if (error) console.error("rpc process_whatsapp_message", error);
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

  try {
    const payload = req.body || {};
    const event = payload?.event || payload?.type || "";
    const data = payload?.data ?? payload;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) await handleMessageUpsert(instanceName, item);
    } else if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      await handleConnectionUpdate(instanceName, data);
    } else if (data?.key?.remoteJid) {
      await handleMessageUpsert(instanceName, data);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("webhook error", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
