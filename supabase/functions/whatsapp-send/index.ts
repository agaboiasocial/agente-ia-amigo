import { adminClient, corsHeaders, digits, errorResponse, json, readJson, requireUser } from "../_shared/http.ts";
import { evolutionConfig } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { user } = await requireUser(req);
    const { conversationId, body, isNote, senderName, mediaUrl, mediaType, fileName, mimeType } = await readJson(req);
    if (!conversationId || (!body && !mediaUrl)) return json({ error: "conversationId and (body or mediaUrl) required" }, 400);

    const supa = adminClient();
    const { data: conversation, error: convError } = await supa
      .from("conversations")
      .select("id, contact_id, instance_name, account_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (convError) throw convError;
    if (!conversation) throw new Error("Conversa não encontrada");

    const { data: profile } = await supa
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const text = String(body || "").trim();
    const msgType = mediaUrl ? (mediaType || "image") : "text";
    const baseMessage = {
      account_id: conversation.account_id,
      conversation_id: conversationId,
      contact_id: conversation.contact_id,
      instance_name: conversation.instance_name,
      content: text || (mediaUrl ? `[${msgType}]` : ""),
      is_from_contact: false,
      is_private: !!isNote,
      sender_name: isNote ? (senderName || profile?.display_name || "Agente") : "Eu",
      message_type: msgType,
      media_url: mediaUrl || null,
    };

    if (isNote) {
      const { error } = await supa.from("messages").insert(baseMessage);
      if (error) throw error;
      return json({ ok: true, sent: false });
    }

    if (!conversation.contact_id) throw new Error("Conversa sem contato vinculado");
    const { data: contact, error: contactError } = await supa
      .from("contacts")
      .select("phone_number")
      .eq("id", conversation.contact_id)
      .maybeSingle();
    if (contactError) throw contactError;

    const instanceName = conversation.instance_name;
    const number = digits(contact?.phone_number);
    if (!instanceName) throw new Error("Conversa sem instância WhatsApp");
    if (!number) throw new Error("Contato sem número de WhatsApp");

    const { baseUrl, headers } = evolutionConfig();
    const outboundMedia = typeof mediaUrl === "string" && mediaUrl.startsWith("data:")
      ? mediaUrl.split(",")[1] || mediaUrl
      : mediaUrl;

    let evoRes: Response;
    if (mediaUrl) {
      if (msgType === "audio") {
        evoRes = await fetch(`${baseUrl}/message/sendWhatsAppAudio/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ number, audio: outboundMedia }),
        });
      } else {
        evoRes = await fetch(`${baseUrl}/message/sendMedia/${encodeURIComponent(instanceName)}`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            number,
            mediatype: msgType,
            media: outboundMedia,
            mimetype: mimeType || undefined,
            caption: text || undefined,
            fileName: fileName || (msgType === "document" ? (text || "document") : undefined),
          }),
        });
      }
    } else {
      evoRes = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ number, text }),
      });
    }

    const apiBody = await evoRes.json().catch(() => null);
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
    if (insertError) throw insertError;

    const lastMsg = text || `[${msgType}]`;
    // Resposta do agente → conversa deixa de aguardar e zera o contador de não-lidas
    await supa
      .from("conversations")
      .update({
        last_message: lastMsg,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_message_from_contact: false,
        unread_count: 0,
      })
      .eq("id", conversationId);

    return json({ ok: true, sent: true });
  } catch (error) {
    return errorResponse(error);
  }
});
