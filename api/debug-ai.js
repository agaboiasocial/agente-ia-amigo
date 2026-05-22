import { createClient } from "@supabase/supabase-js";

/**
 * Debug endpoint to diagnose AI processing issues.
 * GET /api/debug-ai — shows config state and tests OpenAI connection
 */
export default async function handler(req, res) {
  const results = {};

  // 1. Check env vars
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const evoUrl = process.env.EVOLUTION_API_URL;
  const evoToken = process.env.EVOLUTION_API_TOKEN;

  results.envVars = {
    hasSupabaseUrl: !!url,
    hasServiceKey: !!serviceKey,
    hasOpenaiKey: !!openaiKey,
    openaiKeyPrefix: openaiKey ? openaiKey.substring(0, 8) + "..." : "MISSING",
    hasEvolutionUrl: !!evoUrl,
    evolutionUrl: evoUrl || "MISSING",
    hasEvolutionToken: !!evoToken,
  };

  if (!url || !serviceKey) {
    return res.status(200).json({ error: "Missing Supabase env vars", results });
  }

  const supa = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Check ai_settings
  try {
    const { data, error } = await supa.from("ai_settings").select("*").limit(1).maybeSingle();
    results.aiSettings = data ? {
      id: data.id,
      is_active: data.is_active,
      persona_name: data.persona_name,
      model: data.model,
      buffer_seconds: data.buffer_seconds,
      account_id: data.account_id,
      handoff_keyword: data.handoff_keyword,
      schedule_enabled: data.schedule_enabled,
    } : null;
    results.aiSettingsError = error ? error.message : null;
  } catch (e) {
    results.aiSettingsException = e.message;
  }

  // 3. Check recent conversations with contacts
  try {
    const { data, error } = await supa
      .from("conversations")
      .select("id, contact_id, account_id, instance_name, status, last_message_at, contact:contacts(id, name, phone_number, ai_paused)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(3);
    results.recentConversations = data;
    results.conversationsError = error ? error.message : null;
  } catch (e) {
    results.conversationsException = e.message;
  }

  // 4. Test OpenAI connection
  if (openaiKey) {
    try {
      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "Diga apenas: OK" }],
          max_tokens: 10,
        }),
      });
      const openaiBody = await openaiRes.json();
      results.openaiTest = {
        status: openaiRes.status,
        ok: openaiRes.ok,
        response: openaiBody.choices?.[0]?.message?.content || null,
        error: openaiBody.error || null,
      };
    } catch (e) {
      results.openaiTestException = e.message;
    }
  } else {
    results.openaiTest = { error: "OPENAI_API_KEY not configured" };
  }

  // 5. Check recent messages to see if AI responses exist
  try {
    const { data, error } = await supa
      .from("messages")
      .select("id, content, sender_name, is_from_contact, instance_name, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    results.recentMessages = data;
    results.messagesError = error ? error.message : null;
  } catch (e) {
    results.messagesException = e.message;
  }

  return res.status(200).json(results);
}
