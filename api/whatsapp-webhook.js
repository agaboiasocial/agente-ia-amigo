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

function mediaUrlFrom(media, msg, item) {
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

  if (!raw) return null;
  if (typeof raw !== "string") return null;
  if (raw.startsWith("data:") || raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `data:${mimetype};base64,${raw}`;
}

function extractText(msg, item) {
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

// ========== AI Processing (inline) ==========

function isWithinSchedule(settings) {
  if (!settings.schedule_enabled) return true;
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const currentTime = `${hour}:${minute}`;
  const dayMap = {
    "dom": "dom", "seg": "seg", "ter": "ter", "qua": "qua",
    "qui": "qui", "sex": "sex", "sáb": "sáb", "sab": "sáb",
  };
  const currentDay = dayMap[weekday.toLowerCase().replace(".", "")] || weekday.toLowerCase();
  const allowedDays = (settings.schedule_days || []).map((d) => d.toLowerCase());
  if (!allowedDays.includes(currentDay)) return false;
  const start = settings.schedule_start || "08:00";
  const end = settings.schedule_end || "18:00";
  return currentTime >= start && currentTime <= end;
}

async function buildConversationHistory(supa, conversationId, maxMessages = 20) {
  const { data: messages } = await supa
    .from("messages")
    .select("content, is_from_contact, sender_name, created_at")
    .eq("conversation_id", conversationId)
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(maxMessages);
  if (!messages || messages.length === 0) return [];
  return messages.reverse().map((m) => ({
    role: m.is_from_contact ? "user" : "assistant",
    content: m.content || "",
  }));
}

async function callOpenAI(systemPrompt, history, model, temperature) {
  const apiKey = process.env.OPENAI_API_KEY;
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
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function sendWhatsApp(instanceName, number, text) {
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
  const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) throw new Error("Evolution API não configurada");
  const apiBase = EVOLUTION_API_URL.replace(/\/+$/, "");
  const evoRes = await fetch(`${apiBase}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN },
    body: JSON.stringify({ number: digits(number), text }),
  });
  let apiBody = null;
  try { apiBody = await evoRes.json(); } catch { apiBody = null; }
  if (!evoRes.ok) {
    const message = apiBody?.response?.message || apiBody?.message || `Evolution API: ${evoRes.status}`;
    throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
  }
  return apiBody;
}

async function processAI(supa, conversationId, contactId, instanceName, accountId) {
  // 1. Load AI settings
  let query = supa.from("ai_settings").select("*");
  if (accountId) query = query.eq("account_id", accountId);
  const { data: settings } = await query.limit(1).maybeSingle();
  if (!settings) {
    // Fallback: try without account filter
    const { data: fallback } = await supa.from("ai_settings").select("*").eq("is_active", true).limit(1).maybeSingle();
    if (!fallback) { console.log("[AI] No settings found"); return; }
    Object.assign(settings || {}, fallback);
    // Re-check with fallback
    return processAIWithSettings(supa, fallback, conversationId, contactId, instanceName);
  }
  if (!settings.is_active) { console.log("[AI] Disabled"); return; }
  return processAIWithSettings(supa, settings, conversationId, contactId, instanceName);
}

async function processAIWithSettings(supa, settings, conversationId, contactId, instanceName) {
  // 2. Check contact
  const { data: contact } = await supa
    .from("contacts")
    .select("id, phone_number, name, ai_paused")
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) { console.log("[AI] Contact not found"); return; }
  if (contact.ai_paused) { console.log("[AI] Paused for", contact.name); return; }

  // 2b. Check ignore list
  const ignoreNumbers = settings.ignore_numbers || [];
  const contactDigits = digits(contact.phone_number);
  if (ignoreNumbers.some((n) => digits(n) === contactDigits)) {
    console.log("[AI] Number ignored:", contact.phone_number);
    return;
  }

  // 3. Check schedule
  if (!isWithinSchedule(settings)) {
    if (settings.off_hours_message) {
      console.log("[AI] Off hours — sending message");
      await sendAndSave(supa, instanceName, contact, conversationId, contactId, settings.off_hours_message);
    }
    return;
  }

  // 4. Buffer
  const bufferSeconds = settings.buffer_seconds ?? 3;
  if (bufferSeconds > 0) {
    await new Promise((r) => setTimeout(r, bufferSeconds * 1000));
  }

  // 5. Build history
  const history = await buildConversationHistory(supa, conversationId);
  if (history.length === 0) { console.log("[AI] No messages"); return; }

  // 6. System prompt
  const personaName = settings.persona_name || "Assistente";
  const handoffKeyword = settings.handoff_keyword || "#humano";
  let systemPrompt = settings.system_prompt ||
    `Você é ${personaName}, assistente de atendimento. Responda de forma clara, objetiva e cordial.`;
  systemPrompt += `\n\nREGRA DO SISTEMA (obrigatória):
Quando o atendimento precisar ir para um humano — por exemplo, o cliente pedir um atendente, reclamar de algo que só um humano resolve, ou o assunto sair do seu escopo — inclua o código ${handoffKeyword} em algum lugar da sua resposta.
Esse código é removido automaticamente antes de chegar ao cliente. NUNCA mencione esse código diretamente ao cliente.`;

  // 7. Call OpenAI
  console.log("[AI] Calling OpenAI model:", settings.model);
  let aiResponse = await callOpenAI(systemPrompt, history, settings.model, settings.temperature);
  if (!aiResponse?.trim()) { console.log("[AI] Empty response"); return; }

  // 8. Detect handoff
  const handoffDetected = aiResponse.includes(handoffKeyword);
  if (handoffDetected) {
    aiResponse = aiResponse.replace(new RegExp(handoffKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").trim();
    await supa.from("contacts").update({ ai_paused: true, updated_at: new Date().toISOString() }).eq("id", contactId);
    console.log("[AI] Handoff detected, pausing AI for", contact.name);

    // Notify group
    if (settings.notification_group_jid) {
      try {
        const notif = `🔔 *Handoff*\nContato: ${contact.name || contact.phone_number}\nTel: ${contact.phone_number}\n\nIA pausada. Agente humano deve assumir.`;
        await sendWhatsApp(instanceName, settings.notification_group_jid, notif);
      } catch (e) { console.error("[AI] Group notification error:", e.message); }
    }
  }

  // 9. Send response
  if (aiResponse.trim()) {
    await sendAndSave(supa, instanceName, contact, conversationId, contactId, aiResponse);
  }
  console.log("[AI] Response sent to", contact.name, "handoff:", handoffDetected);
}

async function sendAndSave(supa, instanceName, contact, conversationId, contactId, fullText) {
  const parts = fullText.split(/\n\n+/).map((p) => p.trim()).filter((p) => p.length > 0);
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1000));
    const apiBody = await sendWhatsApp(instanceName, contact.phone_number, parts[i]);
    const messageId = apiBody?.key?.id || apiBody?.message?.key?.id || apiBody?.data?.key?.id || null;
    await supa.from("messages").insert({
      conversation_id: conversationId,
      contact_id: contactId,
      instance_name: instanceName,
      message_id: messageId,
      content: parts[i],
      is_from_contact: false,
      is_private: false,
      sender_name: "IAS",
      message_type: "text",
      raw_data: apiBody,
    });
  }
  await supa.from("conversations").update({
    last_message: parts[parts.length - 1],
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", conversationId);
}

// ========== Message & Connection Handlers ==========

async function handleMessageUpsert(instanceName, item) {
  const key = item?.key || {};
  const remoteJid = key.remoteJid || "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return;
  const phone = jidToPhone(remoteJid);
  if (!phone) return;
  const fromMe = !!key.fromMe;
  const messageId = key.id || "";
  const pushName = item?.pushName || phone;
  const { content, type, mediaUrl } = extractText(item?.message, item);

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

  // Trigger AI for incoming text messages (not fromMe)
  if (!fromMe && conversationId && type === "text" && content) {
    try {
      const { data: conv } = await supa
        .from("conversations")
        .select("id, contact_id, account_id")
        .eq("id", conversationId)
        .maybeSingle();

      if (conv?.contact_id) {
        await processAI(supa, conv.id, conv.contact_id, instanceName, conv.account_id);
      }
    } catch (e) {
      console.error("[AI] Error:", e.message);
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

// ========== Main Handler ==========

export default async function handler(req, res) {
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
