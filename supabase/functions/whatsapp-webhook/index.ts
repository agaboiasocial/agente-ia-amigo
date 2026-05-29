import { adminClient, corsHeaders, digits, errorResponse, json } from "../_shared/http.ts";
import { sendWhatsApp } from "../_shared/whatsapp.ts";

function jidToPhone(jid: string) {
  return digits((jid || "").split("@")[0]);
}

function mediaUrlFrom(media: any, msg: any, item: any) {
  const mimetype = media?.mimetype || media?.mimeType || "application/octet-stream";
  const raw =
    media?.base64 || media?.media || media?.data ||
    msg?.base64 || item?.base64 || item?.data?.base64 ||
    media?.url || null;
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

// ─── Audio Transcription (Whisper) ──────────────────────────────────────────
async function transcribeAudio(base64Data: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || !base64Data) return "[áudio não transcrito]";

  try {
    // Extract raw base64 (remove data:... prefix if present)
    const raw = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;
    const binaryStr = atob(raw);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const formData = new FormData();
    formData.append("file", new Blob([bytes], { type: "audio/ogg" }), "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!res.ok) {
      console.error("[whisper] error:", res.status, await res.text().catch(() => ""));
      return "[áudio não transcrito]";
    }
    const data = await res.json();
    return data.text?.trim() || "[áudio vazio]";
  } catch (e) {
    console.error("[whisper] exception:", e);
    return "[áudio não transcrito]";
  }
}

// ─── Image Vision (GPT-4o) ──────────────────────────────────────────────────
async function describeImage(base64Data: string, caption: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey || !base64Data) return caption || "[imagem]";

  try {
    const imageUrl = base64Data.startsWith("data:") ? base64Data :
      base64Data.startsWith("http") ? base64Data :
      `data:image/jpeg;base64,${base64Data.includes(",") ? base64Data.split(",")[1] : base64Data}`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Descreva esta imagem de forma breve e objetiva em português. Se houver texto, transcreva-o." },
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          ],
        }],
        max_tokens: 300,
      }),
    });
    if (!res.ok) {
      console.error("[vision] error:", res.status);
      return caption || "[imagem]";
    }
    const data = await res.json();
    const description = data.choices?.[0]?.message?.content?.trim() || "";
    return description ? `[Imagem: ${description}]${caption ? ` Legenda: ${caption}` : ""}` : caption || "[imagem]";
  } catch (e) {
    console.error("[vision] exception:", e);
    return caption || "[imagem]";
  }
}

// ─── Schedule check ─────────────────────────────────────────────────────────
function isWithinSchedule(settings: any): boolean {
  if (!settings?.schedule_enabled) return true; // No schedule = always on
  const days = settings.schedule_days || [];
  const start = settings.schedule_start || "08:00";
  const end = settings.schedule_end || "18:00";

  const now = new Date();
  // Brazil timezone offset (UTC-3)
  const brDate = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const dayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  const dayName = dayNames[brDate.getUTCDay()];
  if (!days.includes(dayName)) return false;

  const hhmm = `${String(brDate.getUTCHours()).padStart(2, "0")}:${String(brDate.getUTCMinutes()).padStart(2, "0")}`;
  return hhmm >= start && hhmm <= end;
}

// ─── Build history ──────────────────────────────────────────────────────────
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

// ─── OpenAI call ────────────────────────────────────────────────────────────
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

// ─── Send split messages (like lead-hub) ────────────────────────────────────
async function sendSplitMessages(instanceName: string, phone: string, text: string) {
  const parts = text.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  let lastResult = null;
  for (const part of parts) {
    lastResult = await sendWhatsApp(instanceName, phone, part);
    if (parts.length > 1) await new Promise(r => setTimeout(r, 800));
  }
  return lastResult;
}

// ─── AI processing ──────────────────────────────────────────────────────────
async function maybeProcessAI(
  supa: any, conversationId: string, contactId: string,
  instanceName: string, accountId: string | null,
  messageType: string, mediaUrl: string | null
) {
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

  // Schedule check — send off-hours message if outside schedule
  if (!isWithinSchedule(settings)) {
    const offMsg = settings.off_hours_message || "Estamos fora do horário de atendimento. Retornaremos em breve!";
    // Only send once per conversation (check last message)
    const { data: lastMsgs } = await supa.from("messages")
      .select("content, is_from_contact")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(3);
    const alreadySent = (lastMsgs || []).some((m: any) => !m.is_from_contact && m.content === offMsg);
    if (!alreadySent) {
      await sendWhatsApp(instanceName, contact.phone_number, offMsg).catch(() => null);
      await supa.from("messages").insert({
        conversation_id: conversationId,
        contact_id: contactId,
        instance_name: instanceName,
        content: offMsg,
        is_from_contact: false,
        is_private: false,
        sender_name: "IAS",
        message_type: "text",
      });
    }
    return;
  }

  // Buffer
  const bufferSeconds = settings.buffer_seconds ?? 3;
  if (bufferSeconds > 0) await new Promise((resolve) => setTimeout(resolve, bufferSeconds * 1000));

  // Transcribe audio / describe image before building history
  if (messageType === "audio" && mediaUrl) {
    const transcription = await transcribeAudio(mediaUrl);
    if (transcription && transcription !== "[áudio não transcrito]") {
      await supa.from("messages")
        .update({ content: transcription })
        .eq("conversation_id", conversationId)
        .eq("is_from_contact", true)
        .order("created_at", { ascending: false })
        .limit(1);
    }
  } else if (messageType === "image" && mediaUrl) {
    const description = await describeImage(mediaUrl, "");
    if (description && description !== "[imagem]") {
      await supa.from("messages")
        .update({ content: description })
        .eq("conversation_id", conversationId)
        .eq("is_from_contact", true)
        .order("created_at", { ascending: false })
        .limit(1);
    }
  }

  const history = await buildHistory(supa, conversationId);
  if (history.length === 0) return;

  const personaName = settings.persona_name || "Assistente";
  const handoffKeyword = settings.handoff_keyword || "#humano";
  let systemPrompt = settings.system_prompt ||
    `Você é ${personaName}, assistente de atendimento. Responda de forma clara, objetiva e cordial.`;
  systemPrompt += `\n\nREGRA DO SISTEMA: quando precisar transferir para humano, inclua ${handoffKeyword}.`;

  let aiResponse = await callOpenAI(systemPrompt, history, settings.model || "gpt-4o-mini", settings.temperature ?? 0.7);
  if (!aiResponse?.trim()) return;

  // Handoff detection
  const handoffDetected = aiResponse.includes(handoffKeyword);
  if (handoffDetected) {
    aiResponse = aiResponse.replace(new RegExp(handoffKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").trim();
    await supa.from("contacts").update({ ai_paused: true, updated_at: new Date().toISOString() }).eq("id", contactId);
    // Send notification with conversation summary
    if (settings.notification_group_jid) {
      let summary = `🔔 Handoff: ${contact.name || contact.phone_number}`;
      try {
        const summaryResponse = await callOpenAI(
          "Resuma a conversa abaixo em 2-3 linhas em português. Foque no motivo do contato e o que foi discutido.",
          history.slice(-10),
          "gpt-4o-mini",
          0.3,
        );
        if (summaryResponse) summary += `\n\n📋 Resumo: ${summaryResponse}`;
      } catch { /* ignore */ }
      await sendWhatsApp(instanceName, settings.notification_group_jid, summary).catch(() => null);
    }
  }

  if (!aiResponse.trim()) return;

  // Send split messages (paragraph by paragraph)
  const apiBody = await sendSplitMessages(instanceName, contact.phone_number, aiResponse);
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

// ─── Handle incoming message ────────────────────────────────────────────────
async function handleMessage(instanceName: string, item: any) {
  const key = item?.key || {};
  const remoteJid = key.remoteJid || "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return;

  const phone = jidToPhone(remoteJid);
  if (!phone) return;
  const fromMe = !!key.fromMe;

  // Skip fromMe messages entirely — they are echoes of messages we sent
  // (AI responses, agent messages). The message is already saved when we send it.
  if (fromMe) return;

  const { content, type, mediaUrl } = extractText(item?.message, item);
  if (!content && type === "text") return;
  const supa = adminClient();

  const { data: conversationId, error } = await supa.rpc("process_whatsapp_message", {
    p_instance: instanceName,
    p_phone: phone,
    p_push_name: item?.pushName || phone,
    p_message_id: key.id || "",
    p_content: content,
    p_message_type: type,
    p_media_url: mediaUrl,
    p_from_me: false,
    p_raw: item,
  });
  if (error || !conversationId || !content) return;

  const { data: conv } = await supa
    .from("conversations")
    .select("id, contact_id, account_id")
    .eq("id", conversationId)
    .maybeSingle();
  await maybeProcessAI(supa, conv?.id, conv?.contact_id, instanceName, conv?.account_id, type, mediaUrl);
}

// ─── Handle connection update ───────────────────────────────────────────────
async function handleConnection(instanceName: string, data: any) {
  const supa = adminClient();
  await supa.rpc("process_whatsapp_connection", {
    p_instance: instanceName,
    p_state: data?.state || data?.status || "",
    p_phone: data?.wuid ? jidToPhone(data.wuid) : "",
    p_profile_name: data?.profileName || "",
  });
}

// ─── Main handler ───────────────────────────────────────────────────────────
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
