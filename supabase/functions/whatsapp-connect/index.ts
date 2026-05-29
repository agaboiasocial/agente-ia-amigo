import { adminClient, corsHeaders, json, readJson, functionsBaseUrl } from "../_shared/http.ts";
import { evolutionConfig, ensureWhatsAppInbox } from "../_shared/whatsapp.ts";

const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
  "SEND_MESSAGE",
  "MESSAGES_UPDATE",
];

function evoFetch(baseUrl: string, token: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { apikey: token, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function fetchWebhookState(baseUrl: string, token: string, inst: string) {
  try {
    const r = await evoFetch(baseUrl, token, `/webhook/find/${inst}`);
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

async function configureWebhook(baseUrl: string, token: string, inst: string, webhookUrl: string) {
  const steps: Record<string, unknown> = {};

  // 1. Nested camelCase (Evolution v2)
  try {
    const r = await evoFetch(baseUrl, token, `/webhook/set/${inst}`, "POST", {
      webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: true, events: WEBHOOK_EVENTS },
    });
    steps.nested = { status: r.status };
    console.log("[webhook] nested", inst, r.status);
  } catch (e) { steps.nested = { error: String(e) }; }

  let state = await fetchWebhookState(baseUrl, token, inst);
  let ok = state?.enabled && state?.url === webhookUrl;

  // 2. Flat snake_case (Evolution v1)
  if (!ok) {
    try {
      const r = await evoFetch(baseUrl, token, `/webhook/set/${inst}`, "POST", {
        enabled: true, url: webhookUrl, webhook_by_events: false, webhook_base64: true, events: WEBHOOK_EVENTS,
      });
      steps.flat = { status: r.status };
    } catch (e) { steps.flat = { error: String(e) }; }
    state = await fetchWebhookState(baseUrl, token, inst);
    ok = state?.enabled && state?.url === webhookUrl;
  }

  // 3. Flat camelCase
  if (!ok) {
    try {
      const r = await evoFetch(baseUrl, token, `/webhook/set/${inst}`, "POST", {
        enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: true, events: WEBHOOK_EVENTS,
      });
      steps.flatCamel = { status: r.status };
    } catch (e) { steps.flatCamel = { error: String(e) }; }
    state = await fetchWebhookState(baseUrl, token, inst);
    ok = state?.enabled && state?.url === webhookUrl;
  }

  if (!ok) console.error(`[webhook] ${inst} — NÃO persistiu. Estado:`, JSON.stringify(state));
  else console.log(`[webhook] ${inst} — configurado: ${webhookUrl}`);

  return { steps, state, verified: ok, webhookUrl };
}

async function configureSettings(baseUrl: string, token: string, inst: string) {
  const body = { rejectCall: false, groupsIgnore: true, alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false };
  try {
    const r = await evoFetch(baseUrl, token, `/settings/set/${inst}`, "POST", { settings: body });
    if (!r.ok) await evoFetch(baseUrl, token, `/settings/set/${inst}`, "POST", body);
  } catch { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { instanceName, phoneNumber, accountId } = await readJson(req);
    if (!instanceName) return json({ error: "instanceName required" }, 400);

    const { baseUrl, token } = evolutionConfig();
    const inst = String(instanceName).trim();
    const webhookUrl = `${functionsBaseUrl()}/whatsapp-webhook/${encodeURIComponent(inst)}`;
    let qr: string | null = null;
    const steps: Record<string, unknown> = {};

    // 1. Create instance WITH webhook (like whatsapp-lead-hub)
    try {
      const r = await evoFetch(baseUrl, token, "/instance/create", "POST", {
        instanceName: inst,
        qrcode: false,
        integration: "WHATSAPP-BAILEYS",
        ...(phoneNumber ? { number: String(phoneNumber).replace(/\D/g, "") } : {}),
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: true,
          events: WEBHOOK_EVENTS,
        },
      });
      const d = await r.json().catch(() => ({}));
      steps.create = { status: r.status };
      console.log("[setup] create", inst, r.status);
    } catch (e) {
      console.error("[setup] create error:", e);
      steps.create = { error: String(e) };
    }

    // 2. Configure webhook with 3-format fallback + verification
    const webhookResult = await configureWebhook(baseUrl, token, inst, webhookUrl);
    steps.webhook = webhookResult;

    // 3. Configure settings (ignore groups)
    await configureSettings(baseUrl, token, inst);

    // 4. Connect and get QR
    try {
      const r = await evoFetch(baseUrl, token, `/instance/connect/${encodeURIComponent(inst)}`);
      const d = await r.json().catch(() => ({}));
      steps.connect = { status: r.status };
      console.log("[setup] connect", r.status, JSON.stringify(d));
      qr = d?.qrcode?.base64 ?? d?.base64 ?? d?.qr ?? d?.qrcode?.code ?? d?.code ?? null;
    } catch (e) {
      console.error("[setup] connect error:", e);
    }

    // 5. Save to database
    if (accountId) {
      try {
        const supa = adminClient();
        const { data: existing } = await supa
          .from("whatsapp_instances")
          .select("id")
          .eq("instance_name", inst)
          .maybeSingle();
        if (existing) {
          await supa.from("whatsapp_instances")
            .update({ status: "pending", account_id: accountId, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
        } else {
          await supa.from("whatsapp_instances").insert({
            instance_name: inst,
            account_id: accountId,
            status: "pending",
          });
        }
        await ensureWhatsAppInbox({ accountId, instanceName: inst, phoneNumber, profileName: null });
      } catch (e) { console.error("[setup] db error:", e); }
    }

    return json({ qrCode: qr, instanceName: inst, webhookUrl, webhookVerified: webhookResult.verified, steps });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro interno";
    console.error("[whatsapp-connect] unhandled:", msg);
    return json({ error: msg }, 500);
  }
});
