import { adminClient, corsHeaders, errorResponse, json, readJson } from "../_shared/http.ts";
import { ensureWhatsAppInbox, evolutionConfig } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { instanceName, instanceId } = await readJson(req);
    if (!instanceName) return json({ error: "instanceName required" }, 400);

    const { baseUrl, token } = evolutionConfig();
    const response = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers: { apikey: token },
    });
    const body = await response.json().catch(() => null);
    const state = body?.instance?.state || body?.state || "unknown";
    const connected = state === "open";
    const profileName = body?.instance?.profileName || null;
    const phoneNumber = body?.instance?.owner || body?.instance?.wuid || null;

    if (instanceId) {
      const supa = adminClient();
      const updateData: Record<string, unknown> = {
        status: connected ? "connected" : state === "connecting" ? "connecting" : "disconnected",
        updated_at: new Date().toISOString(),
      };
      if (phoneNumber) updateData.phone_number = String(phoneNumber).replace(/\D/g, "");
      if (profileName) updateData.profile_name = profileName;

      const { data: updatedInstance, error } = await supa
        .from("whatsapp_instances")
        .update(updateData)
        .eq("id", instanceId)
        .select("account_id, instance_name")
        .maybeSingle();
      if (error) throw error;
      if (updateData.status === "connected") {
        await ensureWhatsAppInbox({
          accountId: updatedInstance?.account_id,
          instanceName: updatedInstance?.instance_name || instanceName,
          phoneNumber: phoneNumber ? String(phoneNumber).replace(/\D/g, "") : null,
          profileName,
        });
      }
    }

    return json({ state, connected, profileName, phoneNumber });
  } catch (error) {
    return errorResponse(error);
  }
});
