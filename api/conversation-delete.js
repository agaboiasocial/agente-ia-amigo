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

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { conversationId } = req.body || {};
    if (!conversationId) return res.status(400).json({ error: "conversationId required" });

    // Verify auth
    const accessToken = (req.headers.authorization || "").replace("Bearer ", "");
    if (!accessToken) return res.status(401).json({ error: "Não autenticado" });

    const userSupa = getUserClient(accessToken);
    const { data: { user }, error: authErr } = await userSupa.auth.getUser();
    if (authErr || !user) return res.status(401).json({ error: "Não autenticado" });

    const supa = getAdminClient();

    // Delete messages first (FK constraint)
    const { error: msgErr } = await supa
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);
    if (msgErr) console.warn("Error deleting messages:", msgErr.message);

    // Delete conversation labels
    const { error: labErr } = await supa
      .from("conversation_labels")
      .delete()
      .eq("conversation_id", conversationId);
    if (labErr) console.warn("Error deleting labels:", labErr.message);

    // Delete the conversation
    const { data: deleted, error: convErr } = await supa
      .from("conversations")
      .delete()
      .eq("id", conversationId)
      .select("id");

    if (convErr) throw new Error(convErr.message);

    return res.status(200).json({ ok: true, deleted: deleted?.length || 0 });
  } catch (error) {
    console.error("conversation-delete error:", error);
    return res.status(500).json({ error: error.message || "Erro interno" });
  }
}
