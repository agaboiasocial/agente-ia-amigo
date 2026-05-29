import { adminClient, corsHeaders, errorResponse, json, readJson, requireUser } from "../_shared/http.ts";
import { evolutionConfig } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await requireUser(req);
    const { instanceName, deleteInstance = true } = await readJson(req);
    if (!instanceName) return json({ error: "instanceName required" }, 400);

    const { baseUrl, headers } = evolutionConfig();
    const name = encodeURIComponent(instanceName);
    const logoutRes = await fetch(`${baseUrl}/instance/logout/${name}`, { method: "DELETE", headers }).catch(() => null);
    let deleteRes: Response | null = null;
    if (deleteInstance) {
      deleteRes = await fetch(`${baseUrl}/instance/delete/${name}`, { method: "DELETE", headers }).catch(() => null);
    }

    const supa = adminClient();
    const dbResults: Record<string, unknown> = {};
    if (deleteInstance) {
      const { error: msgErr } = await supa.from("messages").update({ instance_name: null }).eq("instance_name", instanceName);
      dbResults.messagesCleared = msgErr ? msgErr.message : "ok";
      const { error: convErr } = await supa.from("conversations").update({ instance_name: null }).eq("instance_name", instanceName);
      dbResults.conversationsCleared = convErr ? convErr.message : "ok";
      const { data: deleted, error: dbErr } = await supa
        .from("whatsapp_instances")
        .delete()
        .eq("instance_name", instanceName)
        .select("id");
      dbResults.instanceDeleted = dbErr ? dbErr.message : `${deleted?.length || 0} rows`;
    } else {
      const { error: dbErr } = await supa
        .from("whatsapp_instances")
        .update({ status: "disconnected", updated_at: new Date().toISOString() })
        .eq("instance_name", instanceName);
      dbResults.instanceUpdated = dbErr ? dbErr.message : "ok";
    }

    return json({
      ok: true,
      evolution: { logoutOk: !!logoutRes?.ok, deleteOk: !!deleteRes?.ok },
      db: dbResults,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
