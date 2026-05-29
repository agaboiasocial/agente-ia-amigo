import { adminClient, corsHeaders, errorResponse, functionsBaseUrl, json, readJson } from "../_shared/http.ts";
import { ensureWhatsAppInbox, evolutionConfig } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { instanceName, phoneNumber, accountId } = await readJson(req);
    if (!instanceName) return json({ error: "instanceName required" }, 400);

    const { baseUrl, headers } = evolutionConfig();
    const createRes = await fetch(`${baseUrl}/instance/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        ...(phoneNumber ? { number: String(phoneNumber).replace(/\D/g, "") } : {}),
      }),
    });
    const body = await createRes.json().catch(() => null);
    if (!createRes.ok) {
      const msg = (body?.response?.message || body?.message || "").toString().toLowerCase();
      const alreadyExists = createRes.status === 403 || createRes.status === 409 || msg.includes("already") || msg.includes("exists");
      if (!alreadyExists) {
        return json({ error: body?.response?.message || body?.message || `Evolution API: ${createRes.status}` }, 500);
      }
    }

    const connectRes = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers,
    });
    const connectBody = await connectRes.json().catch(() => null);
    const qr =
      body?.qrcode?.base64 || body?.qrcode?.code ||
      connectBody?.base64 || connectBody?.qrcode?.base64 ||
      connectBody?.code || "";
    if (!qr) return json({ error: "QR Code não retornado pela Evolution API" }, 500);

    const webhookUrl = `${functionsBaseUrl()}/whatsapp-webhook/${encodeURIComponent(instanceName)}`;
    await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
        },
      }),
    }).catch(() => null);

    if (accountId) {
      const supa = adminClient();
      const { data: existing } = await supa
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_name", instanceName)
        .maybeSingle();
      if (existing) {
        await supa
          .from("whatsapp_instances")
          .update({ status: "pending", account_id: accountId, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supa.from("whatsapp_instances").insert({
          instance_name: instanceName,
          account_id: accountId,
          status: "pending",
        });
      }
      await ensureWhatsAppInbox({ accountId, instanceName, phoneNumber, profileName: null });
    }

    return json({ qrCode: qr, instanceName, webhookUrl });
  } catch (error) {
    return errorResponse(error);
  }
});
