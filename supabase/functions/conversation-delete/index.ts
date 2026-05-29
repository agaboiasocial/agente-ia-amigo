import { adminClient, corsHeaders, errorResponse, json, readJson, requireUser } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await requireUser(req);
    const { conversationId } = await readJson(req);
    if (!conversationId) return json({ error: "conversationId required" }, 400);

    const supa = adminClient();
    await supa.from("messages").delete().eq("conversation_id", conversationId);
    await supa.from("conversation_labels").delete().eq("conversation_id", conversationId);
    const { error } = await supa.from("conversations").delete().eq("id", conversationId);
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
