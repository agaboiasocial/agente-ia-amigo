/**
 * whatsapp-webhook — Supabase Edge Function
 * Based on whatsapp-lead-hub's working webhook pattern.
 * Adapted for agente-ia-amigo's schema (conversations/messages/contacts).
 */
import { createClient } from "npm:@supabase/supabase-js@2.105.4";
import { evolutionConfig } from "../_shared/whatsapp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(data: unknown = { ok: true }) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function digits(s: string) { return (s || "").replace(/\D/g, ""); }
function jidToNumber(jid: string) { return jid.replace(/@s\.whatsapp\.net|@c\.us/gi, ""); }

// ─── Evolution API helpers ──────────────────────────────────────────────────
function evoFetch(path: string, method = "GET", body?: unknown) {
  const { baseUrl, token } = evolutionConfig();
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { apikey: token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function evoSendText(instance: string, number: string, text: string) {
  try {
    const res = await evoFetch(`/message/sendText/${instance}`, "POST", { number: digits(number), text });
    if (!res.ok) console.error(`[Evo] sendText erro ${res.status}:`, await res.text());
    return await res.json().catch(() => ({}));
  } catch (e) { console.error("[Evo] sendText exception:", e); return null; }
}

async function evoGetBase64(instance: string, data: any) {
  try {
    const res = await evoFetch(`/chat/getBase64FromMediaMessage/${instance}`, "POST", {
      message: { key: data.key, message: data.message },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.base64 ? { base64: json.base64, mimetype: json.mimetype ?? "application/octet-stream" } : null;
  } catch { return null; }
}

// Busca o nome do perfil quando o pushName não vem no payload
async function fetchProfileName(instance: string, number: string): Promise<string | null> {
  try {
    const res = await evoFetch(`/chat/fetchProfile/${instance}`, "POST", { number });
    if (res.ok) {
      const d = await res.json();
      const name = d?.name || d?.pushName || d?.verifiedName || d?.wuid || null;
      if (name && typeof name === "string" && !/^\d+$/.test(name)) return name;
    }
  } catch { /* ignore */ }
  return null;
}

// ─── Storage upload ─────────────────────────────────────────────────────────
async function uploadMedia(supabase: any, base64: string, mimetype: string, convId: string, msgId: string) {
  try {
    const cleanMime = mimetype.split(";")[0].trim();
    const ext = cleanMime.split("/")[1]?.split(";")[0] ?? "bin";
    const path = `media/${convId}/${msgId}.${ext}`;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { error } = await supabase.storage.from("chat-media").upload(path, bytes, { contentType: cleanMime, upsert: true });
    if (error) { console.error("[Storage] upload erro:", error); return null; }
    const { data: urlData } = supabase.storage.from("chat-media").getPublicUrl(path);
    return urlData?.publicUrl ?? null;
  } catch (e) { console.error("[Storage] exception:", e); return null; }
}

// ─── Whisper transcription ──────────────────────────────────────────────────
async function transcribeAudio(base64: string, mimetype: string): Promise<string | null> {
  if (!OPENAI_API_KEY) return null;
  try {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = mimetype.includes("ogg") ? "ogg" : mimetype.includes("mp4") ? "mp4" : "mp3";
    const formData = new FormData();
    formData.append("file", new File([bytes], `audio.${ext}`, { type: mimetype.split(";")[0] }), `audio.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }, body: formData,
    });
    if (!res.ok) { console.error("[Whisper] erro:", res.status); return null; }
    const data = await res.json();
    return data.text?.trim() || null;
  } catch (e) { console.error("[Whisper] exception:", e); return null; }
}

// ─── Parse message ──────────────────────────────────────────────────────────
function parseMessage(data: any) {
  const msg = data.message ?? {};
  if (msg.conversation) return { text: msg.conversation, mediaType: "text", caption: null };
  if (msg.extendedTextMessage) return { text: msg.extendedTextMessage.text, mediaType: "text", caption: null };
  if (msg.imageMessage) return { text: null, mediaType: "image", caption: msg.imageMessage.caption ?? null };
  if (msg.videoMessage) return { text: null, mediaType: "video", caption: msg.videoMessage.caption ?? null };
  if (msg.audioMessage) return { text: null, mediaType: "audio", caption: null };
  if (msg.documentMessage) return { text: null, mediaType: "document", caption: msg.documentMessage.caption ?? null };
  if (msg.stickerMessage) return { text: null, mediaType: "sticker", caption: null };
  return { text: null, mediaType: "unknown", caption: null };
}

// ─── Conversa: marcar entrada/saída (last_message + contador) ───────────────
async function markInbound(supabase: any, convId: string, text: string) {
  try { await supabase.rpc("mark_conversation_inbound", { _conv_id: convId, _text: text }); }
  catch (e) { console.error("[markInbound]", e); }
}
async function markOutbound(supabase: any, convId: string, text: string) {
  try { await supabase.rpc("mark_conversation_outbound", { _conv_id: convId, _text: text }); }
  catch (e) { console.error("[markOutbound]", e); }
}

// ─── Upsert contact + conversation ──────────────────────────────────────────
async function upsertContactAndConversation(supabase: any, accountId: string, phone: string, pushName: string, instanceName: string) {
  // Find or create contact
  const { data: existing } = await supabase.from("contacts")
    .select("id, ai_paused").eq("account_id", accountId).eq("phone_number", phone).maybeSingle();

  let contactId: string;
  let aiPaused = false;

  if (existing) {
    contactId = existing.id;
    aiPaused = existing.ai_paused ?? false;
    const update: any = { last_activity_at: new Date().toISOString() };
    if (pushName) update.name = pushName;
    await supabase.from("contacts").update(update).eq("id", contactId);
  } else {
    const { data: newContact, error } = await supabase.from("contacts").insert({
      account_id: accountId,
      name: pushName || phone,
      phone_number: phone,
      source: "whatsapp",
    }).select("id").single();
    if (error) { console.error("[Contact] insert erro:", error); return null; }
    contactId = newContact.id;
  }

  // Find or create conversation (status check: open|pending|resolved|snoozed)
  const { data: conv } = await supabase.from("conversations")
    .select("id").eq("account_id", accountId).eq("contact_id", contactId)
    .neq("status", "resolved").order("created_at", { ascending: false }).maybeSingle();

  let conversationId: string;
  if (conv) {
    conversationId = conv.id;
    await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  } else {
    const { data: newConv, error } = await supabase.from("conversations").insert({
      account_id: accountId,
      contact_id: contactId,
      channel: "whatsapp",
      status: "open",
      instance_name: instanceName,
      last_message_at: new Date().toISOString(),
    }).select("id").single();
    if (error) { console.error("[Conv] insert erro:", error); return null; }
    conversationId = newConv.id;
  }

  return { contactId, conversationId, aiPaused };
}

// ─── Schedule check ─────────────────────────────────────────────────────────
function isWithinSchedule(settings: any): boolean {
  if (!settings?.schedule_enabled) return true;
  try {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dayNames = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const dayName = dayNames[now.getDay()];
    if (!(settings.schedule_days || []).includes(dayName)) return false;
    const [sH, sM] = (settings.schedule_start || "08:00").split(":").map(Number);
    const [eH, eM] = (settings.schedule_end || "18:00").split(":").map(Number);
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= sH * 60 + sM && cur < eH * 60 + eM;
  } catch { return true; }
}

// ─── AI generation ──────────────────────────────────────────────────────────
async function generateAIResponse(supabase: any, conversationId: string, settings: any, imageBase64: string | null) {
  if (!OPENAI_API_KEY) return null;

  const basePrompt = settings.system_prompt?.trim() ||
    `Você é ${settings.persona_name || "Assistente"}, assistente de atendimento. Responda de forma clara, objetiva e cordial.`;
  const handoffRule = `\n\nREGRA DO SISTEMA: quando precisar transferir para humano, inclua ${settings.handoff_keyword || "#humano"}.`;
  const visionRule = imageBase64 ? "\n\nVocê pode ver imagens. Descreva e responda de acordo." : "";

  const { data: history } = await supabase.from("messages")
    .select("content, is_from_contact, message_type, media_url")
    .eq("conversation_id", conversationId).eq("is_private", false)
    .order("created_at", { ascending: false }).limit(20);

  const messages: any[] = [{ role: "system", content: basePrompt + handoffRule + visionRule }];
  for (const m of (history || []).reverse()) {
    if (!m.content) continue;
    messages.push({ role: m.is_from_contact ? "user" : "assistant", content: m.content });
  }

  // If last user message has an image, add vision
  if (imageBase64 && messages.length > 1) {
    const last = messages[messages.length - 1];
    if (last.role === "user") {
      last.content = [
        { type: "text", text: last.content || "Descreva esta imagem." },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64.substring(0, 500000)}`, detail: "low" } },
      ];
    }
  }

  const model = imageBase64 ? "gpt-4o" : (settings.model || "gpt-4o-mini");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({ model, messages, temperature: settings.temperature ?? 0.7, max_tokens: 600 }),
    });
    if (!res.ok) { console.error("[AI] erro:", res.status); return null; }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) { console.error("[AI] exception:", e); return null; }
}

// ─── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return ok({ error: "Method not allowed" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  let payload: any;
  try { payload = await req.json(); } catch { return ok({ error: "Invalid JSON" }); }

  const urlParts = new URL(req.url).pathname.split("/").filter(Boolean);
  const lastPart = urlParts[urlParts.length - 1];
  const instanceFromPath = lastPart && lastPart !== "whatsapp-webhook" ? lastPart : null;
  const instance = payload.instance ?? instanceFromPath;
  const event = payload.event || payload.type || "";
  const data = payload.data ?? payload;

  console.log(`[WH] event=${event} instance=${instance}`);

  // Only process message events
  if (!event?.toLowerCase().includes("messages") || !data?.key) {
    if (event?.toLowerCase().includes("connection")) {
      // Handle connection update
      try {
        const state = data?.state || data?.status || "";
        const phone = data?.wuid ? jidToNumber(data.wuid) : "";
        const profileName = data?.profileName || "";
        if (state && instance) {
          const normalizedStatus = state === "open" || state === "connected"
            ? "connected"
            : state === "connecting" || state === "pending"
              ? "connecting"
              : "disconnected";
          await supabase.from("whatsapp_instances")
            .update({
              status: normalizedStatus,
              name: profileName || instance,
              profile_name: profileName || null,
              phone_number: phone ? digits(phone) : null,
              updated_at: new Date().toISOString(),
            })
            .eq("instance_name", instance);
        }
      } catch (e) { console.error("[WH] connection update error:", e); }
    }
    return ok({ skipped: "not_message" });
  }

  const { remoteJid, fromMe } = data.key;
  if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") {
    return ok({ skipped: "group_or_status" });
  }

  const senderNumber = jidToNumber(remoteJid);
  const parsed = parseMessage(data);
  console.log(`[WH] De=${senderNumber} Tipo=${parsed.mediaType} fromMe=${fromMe}`);

  // ── Find account by instance ──────────────────────────────────────────────
  const { data: inst } = await supabase.from("whatsapp_instances")
    .select("account_id").eq("instance_name", instance).maybeSingle();
  const accountId = inst?.account_id;
  if (!accountId) {
    console.error(`[WH] Account not found for instance=${instance}`);
    return ok({ error: "Account not found" });
  }

  // ── Load AI settings ──────────────────────────────────────────────────────
  const { data: settings } = await supabase.from("ai_settings")
    .select("*").eq("account_id", accountId)
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const aiActive = settings?.is_active ?? false;

  // ── Check ignored numbers ─────────────────────────────────────────────────
  const ignoreNumbers = settings?.ignore_numbers || [];
  if (ignoreNumbers.some((n: string) => digits(n) === digits(senderNumber))) {
    return ok({ skipped: "ignored_number" });
  }

  // ── Upsert contact + conversation ─────────────────────────────────────────
  let clientName = fromMe ? "" : (data.pushName || "");
  // Se não veio nome no payload, tenta buscar o perfil na Evolution API
  if (!clientName && !fromMe) {
    clientName = (await fetchProfileName(instance, senderNumber)) || "";
  }
  const result = await upsertContactAndConversation(supabase, accountId, senderNumber, clientName, instance);
  if (!result) return ok({ error: "Failed to upsert" });
  const { contactId, conversationId, aiPaused } = result;

  // ── Download media ────────────────────────────────────────────────────────
  let mediaUrl: string | null = null;
  let transcribedText: string | null = null;
  let imageBase64: string | null = null;

  if (parsed.mediaType !== "text" && parsed.mediaType !== "unknown") {
    const msgObj = data.message ?? {};
    const mediaKey = Object.keys(msgObj).find((k) => k.endsWith("Message"));
    const mediaObj = mediaKey ? msgObj[mediaKey] : null;
    const payloadBase64 = mediaObj?.base64 ?? null;
    const payloadMime = mediaObj?.mimetype ?? "application/octet-stream";

    let mediaData: { base64: string; mimetype: string } | null = null;
    if (payloadBase64) {
      mediaData = { base64: payloadBase64, mimetype: payloadMime };
    } else {
      mediaData = await evoGetBase64(instance, data);
    }

    if (mediaData) {
      if (parsed.mediaType === "audio") {
        transcribedText = await transcribeAudio(mediaData.base64, mediaData.mimetype);
        console.log(`[WH] Transcrição: ${transcribedText?.slice(0, 80)}`);
      }
      if (parsed.mediaType === "image") {
        imageBase64 = mediaData.base64;
      }
      mediaUrl = await uploadMedia(supabase, mediaData.base64, mediaData.mimetype, conversationId, data.key.id);
    }
  }

  const effectiveText = transcribedText ?? parsed.text ?? parsed.caption ?? null;
  const mediaLabel: Record<string, string> = {
    image: "[Imagem]", audio: "[Áudio]", video: "[Vídeo]",
    document: "[Documento]", sticker: "[Figurinha]",
  };
  const contentToSave = effectiveText ?? mediaLabel[parsed.mediaType] ?? "[Mensagem]";

  // ── fromMe: echo check ────────────────────────────────────────────────────
  if (fromMe) {
    const since = new Date(Date.now() - 120000).toISOString();
    const { data: dup } = await supabase.from("messages")
      .select("id").eq("conversation_id", conversationId)
      .eq("is_from_contact", false).eq("content", contentToSave)
      .gte("created_at", since).limit(1).maybeSingle();

    if (dup) return ok({ skipped: "echo" });

    // Agent message from phone — save and pause AI
    await supabase.from("messages").insert({
      conversation_id: conversationId, contact_id: contactId, instance_name: instance,
      message_id: data.key.id, content: contentToSave, is_from_contact: false,
      is_private: false, sender_name: "Agente", message_type: parsed.mediaType, media_url: mediaUrl,
    });
    await supabase.from("contacts").update({ ai_paused: true }).eq("id", contactId);
    await markOutbound(supabase, conversationId, contentToSave);
    console.log(`[WH] Agent message from phone — AI paused`);
    return ok({ agent_message: true });
  }

  // ── Save client message ───────────────────────────────────────────────────
  await supabase.from("messages").insert({
    conversation_id: conversationId, contact_id: contactId, instance_name: instance,
    message_id: data.key.id, content: contentToSave, is_from_contact: true,
    is_private: false, sender_name: data.pushName || senderNumber,
    message_type: parsed.mediaType, media_url: mediaUrl,
  });
  // Atualiza conversa: último texto, aguardando resposta, contador++
  await markInbound(supabase, conversationId, contentToSave);

  // ── AI disabled or paused → stop ──────────────────────────────────────────
  if (!aiActive) return ok({ ai: "disabled" });
  if (aiPaused) return ok({ ai: "paused" });
  if (!effectiveText && parsed.mediaType !== "image") return ok({ ai: "no_content" });

  // ── Buffer ────────────────────────────────────────────────────────────────
  const bufferMs = (settings?.buffer_seconds ?? 3) * 1000;
  const arrivedAt = new Date().toISOString();
  if (bufferMs > 0) await new Promise((r) => setTimeout(r, bufferMs));

  // Check if newer message arrived during buffer
  const { data: newer } = await supabase.from("messages")
    .select("id").eq("conversation_id", conversationId).eq("is_from_contact", true)
    .gt("created_at", arrivedAt).limit(1).maybeSingle();
  if (newer) return ok({ ai: "buffered_by_newer" });

  // ── Schedule check ────────────────────────────────────────────────────────
  if (!isWithinSchedule(settings)) {
    const offMsg = settings?.off_hours_message || "Estamos fora do horário de atendimento. Retornaremos em breve!";
    await evoSendText(instance, senderNumber, offMsg);
    await supabase.from("messages").insert({
      conversation_id: conversationId, contact_id: contactId, instance_name: instance,
      content: offMsg, is_from_contact: false, is_private: false, sender_name: "IAS", message_type: "text",
    });
    await markOutbound(supabase, conversationId, offMsg);
    return ok({ ai: "off_hours" });
  }

  // ── Generate AI response ──────────────────────────────────────────────────
  const aiResponse = await generateAIResponse(supabase, conversationId, settings, imageBase64);
  if (!aiResponse) return ok({ ai: "no_response" });

  // ── Handoff detection ─────────────────────────────────────────────────────
  const handoffKeyword = settings?.handoff_keyword || "#humano";
  const needsHandoff = aiResponse.includes(handoffKeyword);
  if (needsHandoff) {
    await supabase.from("contacts").update({ ai_paused: true }).eq("id", contactId);
    if (settings?.notification_group_jid) {
      const { data: contact } = await supabase.from("contacts").select("name, phone_number").eq("id", contactId).maybeSingle();
      let notifyText = `🔔 *Lead aguarda atendimento humano*\n*Nome:* ${contact?.name || senderNumber}\n*Telefone:* ${senderNumber}`;
      // Generate summary
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: JSON.stringify({
            model: "gpt-4o-mini", temperature: 0.3, max_tokens: 300,
            messages: [
              { role: "system", content: "Resuma a conversa em 3-4 linhas em português. Foque no motivo do contato." },
              ...(await supabase.from("messages").select("content, is_from_contact").eq("conversation_id", conversationId).order("created_at").limit(30))
                .data?.map((m: any) => ({ role: m.is_from_contact ? "user" : "assistant", content: m.content })) || [],
            ],
          }),
        });
        const summaryData = await res.json();
        const summary = summaryData.choices?.[0]?.message?.content?.trim();
        if (summary) notifyText += `\n\n📋 *Resumo:*\n${summary}`;
      } catch { /* ignore */ }
      await evoSendText(instance, settings.notification_group_jid, notifyText);
    }
  }

  const cleanResponse = aiResponse.replace(new RegExp(handoffKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "").trim();
  if (!cleanResponse) return ok({ ai: "empty_after_handoff" });

  // ── Send split response ───────────────────────────────────────────────────
  const parts = cleanResponse.split(/\n\n+/).map((p: string) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const apiBody = await evoSendText(instance, senderNumber, parts[i]);
    const msgId = apiBody?.key?.id || apiBody?.message?.key?.id || null;
    await supabase.from("messages").insert({
      conversation_id: conversationId, contact_id: contactId, instance_name: instance,
      message_id: msgId, content: parts[i], is_from_contact: false,
      is_private: false, sender_name: "IAS", message_type: "text",
    });
    if (i < parts.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }
  // IA respondeu → conversa deixa de aguardar, contador zera
  await markOutbound(supabase, conversationId, cleanResponse);

  console.log(`[WH] ✓ Conv=${conversationId} parts=${parts.length} handoff=${needsHandoff}`);
  return ok({ messages_sent: parts.length, needs_handoff: needsHandoff });
});
