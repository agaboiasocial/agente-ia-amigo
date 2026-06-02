import { adminClient, corsHeaders, errorResponse, json, readJson } from "../_shared/http.ts";
import { ensureWhatsAppInbox, evolutionConfig } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { instanceName, instanceId, accountId } = await readJson(req);
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

    const supa = adminClient();
    const normalizedStatus = connected ? "connected" : state === "connecting" ? "connecting" : "disconnected";
    const cleanPhone = phoneNumber ? String(phoneNumber).replace(/\D/g, "") : null;
    const updateData: Record<string, unknown> = {
      status: normalizedStatus,
      updated_at: new Date().toISOString(),
    };
    if (cleanPhone) updateData.phone_number = cleanPhone;
    if (profileName) updateData.profile_name = profileName;
    if (accountId) updateData.account_id = accountId;

    let updateQuery = supa.from("whatsapp_instances").update(updateData);
    updateQuery = instanceId
      ? updateQuery.eq("id", instanceId)
      : updateQuery.eq("instance_name", instanceName);

    const { data: updatedInstance, error } = await updateQuery
      .select("account_id, instance_name")
      .maybeSingle();
    if (error) throw error;

    const resolvedAccountId = updatedInstance?.account_id || accountId || null;
    if (normalizedStatus === "connected" && resolvedAccountId) {
      await ensureWhatsAppInbox({
        accountId: resolvedAccountId,
        instanceName: updatedInstance?.instance_name || instanceName,
        phoneNumber: cleanPhone,
        profileName,
      });
    }

    return json({ state, connected, profileName, phoneNumber });
  } catch (error) {
    return errorResponse(error);
  }
});
