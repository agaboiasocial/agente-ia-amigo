import { adminClient, corsHeaders, digits, errorResponse, json } from "../_shared/http.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";

function jidToPhone(jid: string) {
  return digits((jid || "").split("@")[0]);
}

function mediaUrlFrom(media: any, msg: any, item: any) {
  const mimetype = media?.mimetype || media?.mimeType || "application/octet-stream";
  const raw =
    media?.base64 ||
    media?.media ||
    media?.data ||
    msg?.base64 ||
    item?.base64 ||
    item?.data?.base64 ||
    media?.url ||
    null;
  if (!raw || typeof raw !== "string") return null;
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `data:${mimetype};base64,${raw}`;
}

function extractText(msg: any, item: any) {
  if (!msg) return { content: "", type: "text", mediaUrl: null };
  if (msg.conversation) return { content: msg.conversation, type: "text", mediaUrl: null };
  if (msg.extendedTextMessage?.text) return { content: msg.extendedTextMessage.text, type: "text", mediaUrl: null };
  if (msg.imageMessage) return { content: msg.imageMessage.caption || "[imagem]", type: "image", mediaUrl: mediaUrlFrom(msg.imageMessage, msg, item) };
  if (msg.videoMessage) return { content: msg.videoMessage.caption || "[vídeo]", type: "video", mediaUrl: mediaUrlFrom(msg.videoMessage, msg, item) };
  if (msg.audioMessage) return { content: "[áudio]", type: "audio", mediaUrl: mediaUrlFrom(msg.audioMessage, msg, item) };
  if (msg.documentMessage) return { content: msg.documentMessage.fileName || "[documento]", type: "document", mediaUrl: mediaUrlFrom(msg.documentMessage, msg, item) };
  if (msg.stickerMessage) return { content: "[sticker]", type: "sticker", mediaUrl: mediaUrlFrom(msg.stickerMessage, msg, item) };
  return { content: "[mensagem]", type: "text", mediaUrl: null };
}

async function buildHistory(supa: any, conversationId: string) {
  const { data } = await supa
    .from("messages")
    .select("content, is_from_contact, created_at")
    .eq("conversation_id", conversationId)
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data || []).reverse().map((m: any) => ({
    role: m.is_from_contact ? "user" : "assistant",
    content: m.content || "",
  }));
}

async function callOpenAI(systemPrompt: string, history: any[], model: string, temperature: number) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, ...history],
      temperature: temperature ?? 0.7,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function maybeProcessAI(supa: any, conversationId: string, contactId: string, instanceName: string, accountId: string | null) {
  if (!accountId || !contactId) return;
  const { data: settings } = await supa
    .from("ai_settings")
    .select("*")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!settings?.is_active) return;

  const { data: contact } = await supa
    .from("contacts")
    .select("id, phone_number, name, ai_paused")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact || contact.ai_paused) return;

  const ignoreNumbers = settings.ignore_numbers || [];
  if (ignoreNumbers.some((n: string) => digits(n) === digits(contact.phone_number))) return;

  const bufferSeconds = settings.buffer_seconds ?? 3;
  if (bufferSeconds > 0) await new Promise((resolve) => setTimeout(resolve, bufferSeconds * 1000));

  const history = await buildHistory(supa, conversationId);
  if (history.length === 0) return;

  const personaName = settings.persona_name || "Assistente";
  const handoffKeyword = settings.handoff_keyword || "#humano";
  let systemPrompt = settings.system_prompt ||
    `Você é ${personaName}, assistente de atendimento. Responda de forma clara, objetiva e cordial.`;
  systemPrompt += `\n\nREGRA DO SISTEMA: quando precisar transferir para humano, inclua ${handoffKeyword}.`;

  let aiResponse = await callOpenAI(systemPrompt, history, settings.model || "gpt-4o-mini", settings.temperature ?? 0.7);
  if (!aiResponse?.trim()) return;

  const handoffDetected = aiResponse.includes(handoffKeyword);
  if (handoffDetected) {
    aiResponse = aiResponse.replace(new RegExp(handoffKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").trim();
    await supa.from("contacts").update({ ai_paused: true, updated_at: new Date().toISOString() }).eq("id", contactId);
    if (settings.notification_group_jid) {
      await sendWhatsApp(instanceName, settings.notification_group_jid, `Handoff solicitado para ${contact.name || contact.phone_number}.`).catch(() => null);
    }
  }

  if (!aiResponse.trim()) return;
  const apiBody = await sendWhatsApp(instanceName, contact.phone_number, aiResponse);
  const messageId = apiBody?.key?.id || apiBody?.message?.key?.id || apiBody?.data?.key?.id || null;
  await supa.from("messages").insert({
    conversation_id: conversationId,
    contact_id: contactId,
    instance_name: instanceName,
    message_id: messageId,
    content: aiResponse,
    is_from_contact: false,
    is_private: false,
    sender_name: "IAS",
    message_type: "text",
    raw_data: apiBody,
  });
}

async function handleMessage(instanceName: string, item: any) {
  const key = item?.key || {};
  const remoteJid = key.remoteJid || "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return;

  const phone = jidToPhone(remoteJid);
  if (!phone) return;
  const fromMe = !!key.fromMe;
  const { content, type, mediaUrl } = extractText(item?.message, item);
  const supa = adminClient();

  const { data: conversationId, error } = await supa.rpc("process_whatsapp_message", {
    p_instance: instanceName,
    p_phone: phone,
    p_push_name: item?.pushName || phone,
    p_message_id: key.id || "",
    p_content: content,
    p_message_type: type,
    p_media_url: mediaUrl,
    p_from_me: fromMe,
    p_raw: item,
  });
  if (error || fromMe || !conversationId || !content) return;

  const { data: conv } = await supa
    .from("conversations")
    .select("id, contact_id, account_id")
    .eq("id", conversationId)
    .maybeSingle();
  await maybeProcessAI(supa, conv?.id, conv?.contact_id, instanceName, conv?.account_id);
}

async function handleConnection(instanceName: string, data: any) {
  const supa = adminClient();
  await supa.rpc("process_whatsapp_connection", {
    p_instance: instanceName,
    p_state: data?.state || data?.status || "",
    p_phone: data?.wuid ? jidToPhone(data.wuid) : "",
    p_profile_name: data?.profileName || "",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const instanceName = new URL(req.url).pathname.split("/").filter(Boolean).pop();
    if (!instanceName || instanceName === "whatsapp-webhook") return json({ error: "instance required" }, 400);

    const payload = await req.json().catch(() => ({}));
    const event = payload?.event || payload?.type || "";
    const data = payload?.data ?? payload;

    if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) await handleMessage(instanceName, item);
    } else if (event === "connection.update" || event === "CONNECTION_UPDATE") {
      await handleConnection(instanceName, data);
    } else if (data?.key?.remoteJid) {
      await handleMessage(instanceName, data);
    }

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
