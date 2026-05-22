import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const results = {};

  // 1. Check env vars
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  results.hasSupabaseUrl = !!url;
  results.hasServiceKey = !!serviceKey;
  results.serviceKeyPrefix = serviceKey ? serviceKey.substring(0, 20) + "..." : "MISSING";

  if (!url || !serviceKey) {
    return res.status(200).json({ error: "Missing env vars", results });
  }

  // 2. Try creating client and calling RPC
  try {
    const supa = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Test RPC process_whatsapp_message
    const { data, error } = await supa.rpc("process_whatsapp_message", {
      p_instance: "zammm",
      p_phone: "11999999999",
      p_push_name: "Debug Test",
      p_message_id: "DEBUG_RPC_TEST_" + Date.now(),
      p_content: "Debug RPC test",
      p_message_type: "text",
      p_media_url: "",
      p_from_me: false,
      p_raw: {},
    });

    results.rpcData = data;
    results.rpcError = error ? { message: error.message, details: error.details, hint: error.hint, code: error.code } : null;
  } catch (e) {
    results.exception = e.message;
  }

  // 3. Try direct insert into messages
  try {
    const supa = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supa
      .from("messages")
      .insert({
        content: "Direct insert test " + Date.now(),
        instance_name: "zammm",
        is_from_contact: true,
        message_type: "text",
        sender_name: "Debug Direct",
      })
      .select("id")
      .single();

    results.directInsert = data;
    results.directInsertError = error ? { message: error.message, details: error.details, code: error.code } : null;
  } catch (e) {
    results.directInsertException = e.message;
  }

  // 4. Check if whatsapp_instances has zammm
  try {
    const supa = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supa
      .from("whatsapp_instances")
      .select("id, instance_name, status, account_id")
      .eq("instance_name", "zammm")
      .maybeSingle();

    results.instance = data;
    results.instanceError = error ? error.message : null;
  } catch (e) {
    results.instanceException = e.message;
  }

  // 5. Check recent conversations
  try {
    const supa = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supa
      .from("conversations")
      .select("id, contact_id, instance_name, account_id, status, last_message, last_message_at")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(5);

    results.recentConversations = data;
    results.conversationsError = error ? error.message : null;
  } catch (e) {
    results.conversationsException = e.message;
  }

  // 6. Check recent messages
  try {
    const supa = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supa
      .from("messages")
      .select("id, content, conversation_id, instance_name, is_from_contact, created_at, sender_name")
      .order("created_at", { ascending: false })
      .limit(5);

    results.recentMessages = data;
    results.messagesError = error ? error.message : null;
  } catch (e) {
    results.messagesException = e.message;
  }

  return res.status(200).json(results);
}
