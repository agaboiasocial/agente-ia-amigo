import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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

function digits(s) {
  return (s || "").replace(/\D/g, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { conversationId, body, isNote, senderName, mediaUrl, mediaType } = req.body || {};
    if (!conversationId || (!body && !mediaUrl)) {
      return res.status(400).json({ error: "conversationId and (body or mediaUrl) required" });
    }

    // Verify user is authenticated
    const accessToken = (req.headers.authorization || "").replace("Bearer ", "");
    if (!accessToken) return res.status(401).json({ error: "Não autenticado" });

    const userSupa = getUserClient(accessToken);
    const { data: { user }, error: authError } = await userSupa.auth.getUser();
    if (authError || !user) return res.status(401).json({ error: "Não autenticado" });

    // Use admin client for DB operations (bypasses RLS)
    const supa = getAdminClient();

    // Get conversation
    const { data: conversation, error: convError } = await supa
      .from("conversations")
      .select("id, contact_id, instance_name")
      .eq("id", conversationId)
      .maybeSingle();
    if (convError) throw new Error(convError.message);
    if (!conversation) throw new Error("Conversa não encontrada");

    // Get agent profile
    const { data: profile } = await supa
      .from("profiles")
      .select("user_id, display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const finalSenderName = senderName || profile?.display_name || "Agente";
    const text = (body || "").trim();

    // Determine message type
    const msgType = mediaUrl ? (mediaType || "image") : "text";

    const baseMessage = {
      conversation_id: conversationId,
      contact_id: conversation.contact_id,
      instance_name: conversation.instance_name,
      content: text || (mediaUrl ? `[${msgType}]` : ""),
      is_from_contact: false,
      is_private: !!isNote,
      sender_name: isNote ? finalSenderName : "Eu",
      message_type: msgType,
      media_url: mediaUrl || null,
    };

    // If it's a note, just insert and return
    if (isNote) {
      const { error } = await supa.from("messages").insert(baseMessage);
      if (error) throw new Error(error.message);
      return res.status(200).json({ ok: true, sent: false });
    }

    // Need contact phone to send via WhatsApp
    if (!conversation.contact_id) throw new Error("Conversa sem contato vinculado");

    const { data: contact, error: contactError } = await supa
      .from("contacts")
      .select("phone_number")
      .eq("id", conversation.contact_id)
      .maybeSingle();
    if (contactError) throw new Error(contactError.message);

    const instanceName = conversation.instance_name;
    const number = digits(contact?.phone_number);
    if (!instanceName) throw new Error("Conversa sem instância WhatsApp");
    if (!number) throw new Error("Contato sem número de WhatsApp");

    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
    if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
      throw new Error("Evolution API não configurada");
    }
    const apiBase = EVOLUTION_API_URL.replace(/\/+$/, "");

    let evoRes;
    let apiBody = null;

    if (mediaUrl) {
      // Send media message
      const endpointMap = {
        image: "sendMedia",
        video: "sendMedia",
        audio: "sendWhatsAppAudio",
        document: "sendMedia",
      };
      const endpoint = endpointMap[msgType] || "sendMedia";

      const mediaPayload = {
        number,
        mediatype: msgType === "audio" ? "audio" : msgType,
        media: mediaUrl,
        caption: text || undefined,
        fileName: msgType === "document" ? (text || "document") : undefined,
      };

      // For audio, Evolution API v2 uses sendWhatsAppAudio with different payload
      if (msgType === "audio") {
        evoRes = await fetch(`${apiBase}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN },
          body: JSON.stringify({ number, audio: mediaUrl }),
        });
      } else {
        evoRes = await fetch(`${apiBase}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN },
          body: JSON.stringify(mediaPayload),
        });
      }
    } else {
      // Send text message
      evoRes = await fetch(`${apiBase}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN },
        body: JSON.stringify({ number, text }),
      });
    }

    try { apiBody = await evoRes.json(); } catch { apiBody = null; }
    if (!evoRes.ok) {
      const message = apiBody?.response?.message || apiBody?.message || `Evolution API: ${evoRes.status}`;
      throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
    }

    const messageId = apiBody?.key?.id || apiBody?.message?.key?.id || apiBody?.data?.key?.id || null;
    const { error: insertError } = await supa.from("messages").insert({
      ...baseMessage,
      message_id: messageId,
      raw_data: apiBody,
    });
    if (insertError) throw new Error(insertError.message);

    const lastMsg = text || `[${msgType}]`;
    await supa
      .from("conversations")
      .update({ last_message: lastMsg, last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return res.status(200).json({ ok: true, sent: true });
  } catch (error) {
    console.error("whatsapp-send error:", error);
    return res.status(500).json({ error: error.message || "Erro interno" });
  }
}
