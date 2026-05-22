import { createClient } from "@supabase/supabase-js";

/**
 * AI Process — Motor de IA para responder mensagens WhatsApp automaticamente
 *
 * Fluxo:
 * 1. Webhook recebe mensagem → chama este endpoint via fetch interno
 * 2. Carrega ai_settings da conta
 * 3. Verifica: IA ativa? Contato com ai_paused? Dentro do horário?
 * 4. Buffer: espera N segundos para agrupar mensagens rápidas
 * 5. Monta histórico de conversa → chama OpenAI
 * 6. Detecta handoff keyword → pausa IA e notifica
 * 7. Envia resposta via Evolution API
 * 8. Salva resposta no banco
 */

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function digits(s) {
  return (s || "").replace(/\D/g, "");
}

// Check if current time is within schedule
function isWithinSchedule(settings) {
  if (!settings.schedule_enabled) return true; // No schedule = always active

  const now = new Date();
  const tz = "America/Sao_Paulo";
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
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

  // Map Portuguese weekday abbreviations
  const dayMap = {
    "dom": "dom", "dom.": "dom",
    "seg": "seg", "seg.": "seg",
    "ter": "ter", "ter.": "ter",
    "qua": "qua", "qua.": "qua",
    "qui": "qui", "qui.": "qui",
    "sex": "sex", "sex.": "sex",
    "sáb": "sáb", "sáb.": "sáb", "sab": "sáb",
  };

  const currentDay = dayMap[weekday.toLowerCase().replace(".", "")] || weekday.toLowerCase();
  const allowedDays = (settings.schedule_days || []).map((d) => d.toLowerCase());

  if (!allowedDays.includes(currentDay)) return false;

  const start = settings.schedule_start || "08:00";
  const end = settings.schedule_end || "18:00";

  return currentTime >= start && currentTime <= end;
}

// Build conversation history for AI context
async function buildConversationHistory(supa, conversationId, maxMessages = 20) {
  const { data: messages } = await supa
    .from("messages")
    .select("content, is_from_contact, sender_name, created_at")
    .eq("conversation_id", conversationId)
    .eq("is_private", false)
    .order("created_at", { ascending: false })
    .limit(maxMessages);

  if (!messages || messages.length === 0) return [];

  // Reverse to chronological order
  return messages.reverse().map((m) => ({
    role: m.is_from_contact ? "user" : "assistant",
    content: m.content || "",
  }));
}

// Call OpenAI API
async function callOpenAI(systemPrompt, history, model, temperature) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const messages = [
    { role: "system", content: systemPrompt },
    ...history,
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// Send WhatsApp message via Evolution API
async function sendWhatsApp(instanceName, phone, text) {
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
  const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    throw new Error("Evolution API não configurada");
  }

  const apiBase = EVOLUTION_API_URL.replace(/\/+$/, "");
  const number = digits(phone);

  const evoRes = await fetch(
    `${apiBase}/message/sendText/${encodeURIComponent(instanceName)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_API_TOKEN,
      },
      body: JSON.stringify({ number, text }),
    }
  );

  let apiBody = null;
  try { apiBody = await evoRes.json(); } catch { apiBody = null; }

  if (!evoRes.ok) {
    const message = apiBody?.response?.message || apiBody?.message || `Evolution API: ${evoRes.status}`;
    throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
  }

  return apiBody;
}

// Split long responses and send with delay (like whatsapp-lead-hub)
async function sendSplitMessages(instanceName, phone, fullText, supa, conversationId, contactId) {
  // Split by double line breaks for natural message splitting
  const parts = fullText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  for (let i = 0; i < parts.length; i++) {
    const text = parts[i];

    // Small delay between parts (except first)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const apiBody = await sendWhatsApp(instanceName, phone, text);
    const messageId = apiBody?.key?.id || apiBody?.message?.key?.id || apiBody?.data?.key?.id || null;

    // Save AI response to messages table
    await supa.from("messages").insert({
      conversation_id: conversationId,
      contact_id: contactId,
      instance_name: instanceName,
      message_id: messageId,
      content: text,
      is_from_contact: false,
      is_private: false,
      sender_name: "IAS",
      message_type: "text",
      raw_data: apiBody,
    });
  }

  // Update conversation metadata
  const lastPart = parts[parts.length - 1];
  await supa
    .from("conversations")
    .update({
      last_message: lastPart,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { conversationId, contactId, instanceName, accountId } = req.body || {};

    if (!conversationId || !contactId || !instanceName) {
      return res.status(400).json({ error: "conversationId, contactId, instanceName required" });
    }

    const supa = getAdminClient();

    // 1. Load AI settings for this account
    let query = supa.from("ai_settings").select("*");
    if (accountId) {
      query = query.eq("account_id", accountId);
    }
    const { data: settings } = await query.limit(1).maybeSingle();

    // If no settings or AI is disabled, skip
    if (!settings || !settings.is_active) {
      return res.status(200).json({ ok: true, skipped: true, reason: "AI disabled" });
    }

    // 2. Check if contact has ai_paused
    const { data: contact } = await supa
      .from("contacts")
      .select("id, phone_number, name, ai_paused")
      .eq("id", contactId)
      .maybeSingle();

    if (!contact) {
      return res.status(200).json({ ok: true, skipped: true, reason: "Contact not found" });
    }

    if (contact.ai_paused) {
      return res.status(200).json({ ok: true, skipped: true, reason: "AI paused for contact" });
    }

    // 2b. Check if number is in ignore list
    const ignoreNumbers = settings.ignore_numbers || [];
    const contactDigits = digits(contact.phone_number);
    if (ignoreNumbers.length > 0 && ignoreNumbers.some((n) => digits(n) === contactDigits)) {
      return res.status(200).json({ ok: true, skipped: true, reason: "Number in ignore list" });
    }

    // 3. Check schedule
    if (!isWithinSchedule(settings)) {
      // Send off-hours message if configured
      if (settings.off_hours_message) {
        await sendSplitMessages(
          instanceName,
          contact.phone_number,
          settings.off_hours_message,
          supa,
          conversationId,
          contactId
        );
        return res.status(200).json({ ok: true, sent: true, offHours: true });
      }
      return res.status(200).json({ ok: true, skipped: true, reason: "Outside schedule" });
    }

    // 4. Buffer — wait for additional messages
    const bufferSeconds = settings.buffer_seconds ?? 3;
    if (bufferSeconds > 0) {
      await new Promise((resolve) => setTimeout(resolve, bufferSeconds * 1000));

      // Check if there are newer unprocessed messages (someone else picked it up)
      const { data: newerMessages } = await supa
        .from("messages")
        .select("id, created_at")
        .eq("conversation_id", conversationId)
        .eq("is_from_contact", true)
        .gt("created_at", new Date(Date.now() - bufferSeconds * 1000).toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      // If there's a message that arrived AFTER the buffer started, let that invocation handle it
      if (newerMessages && newerMessages.length > 0) {
        const newestMsgTime = new Date(newerMessages[0].created_at).getTime();
        const bufferStartTime = Date.now() - bufferSeconds * 1000;
        // If the newest message arrived less than buffer_seconds ago, defer
        if (newestMsgTime > bufferStartTime + 500) {
          return res.status(200).json({ ok: true, skipped: true, reason: "Deferred to newer message" });
        }
      }
    }

    // 5. Build conversation history
    const history = await buildConversationHistory(supa, conversationId);

    if (history.length === 0) {
      return res.status(200).json({ ok: true, skipped: true, reason: "No messages" });
    }

    // 6. Build system prompt with handoff injection
    const personaName = settings.persona_name || "Assistente";
    const handoffKeyword = settings.handoff_keyword || "#humano";
    let systemPrompt = settings.system_prompt ||
      `Você é ${personaName}, assistente de atendimento. Responda de forma clara, objetiva e cordial. Faça uma pergunta por vez.`;

    // Inject handoff rule
    systemPrompt += `\n\nREGRA DO SISTEMA (obrigatória):
Quando o atendimento precisar ir para um humano — por exemplo, o cliente pedir um atendente, reclamar de algo que só um humano resolve, ou o assunto sair do seu escopo — inclua o código ${handoffKeyword} em algum lugar da sua resposta.
Esse código é removido automaticamente antes de chegar ao cliente. NUNCA mencione esse código diretamente ao cliente.`;

    // 7. Call OpenAI
    let aiResponse = await callOpenAI(
      systemPrompt,
      history,
      settings.model || "gpt-4o-mini",
      settings.temperature ?? 0.7
    );

    if (!aiResponse || aiResponse.trim().length === 0) {
      return res.status(200).json({ ok: true, skipped: true, reason: "Empty AI response" });
    }

    // 8. Detect handoff keyword
    const handoffDetected = aiResponse.includes(handoffKeyword);
    if (handoffDetected) {
      // Remove keyword from visible response
      aiResponse = aiResponse.replace(new RegExp(handoffKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"), "").trim();

      // Pause AI for this contact
      await supa
        .from("contacts")
        .update({ ai_paused: true, updated_at: new Date().toISOString() })
        .eq("id", contactId);

      // Send notification to WhatsApp group if configured
      const groupJid = settings.notification_group_jid;
      if (groupJid) {
        try {
          const contactName = contact.name || contact.phone_number;
          const notifText = `🔔 *Handoff solicitado*\n\nContato: ${contactName}\nTelefone: ${contact.phone_number}\n\nA IA pausou o atendimento automático. Um agente humano precisa assumir.`;
          await sendWhatsApp(instanceName, groupJid, notifText);
        } catch (e) {
          console.error("[AI] Error sending handoff notification:", e.message);
        }
      }

      console.log(`[AI] Handoff detected for contact ${contactId}, AI paused`);
    }

    // 9. Send response via WhatsApp (split long messages)
    if (aiResponse.trim().length > 0) {
      await sendSplitMessages(
        instanceName,
        contact.phone_number,
        aiResponse,
        supa,
        conversationId,
        contactId
      );
    }

    return res.status(200).json({
      ok: true,
      sent: true,
      handoff: handoffDetected,
    });
  } catch (error) {
    console.error("[AI] Error processing message:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
