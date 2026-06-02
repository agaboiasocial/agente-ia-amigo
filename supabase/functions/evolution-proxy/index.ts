/**
 * evolution-proxy — Supabase Edge Function
 * Proxy seguro para a Evolution API (padrão whatsapp-lead-hub).
 * JWT verificado pela plataforma Supabase.
 */
import { adminClient, corsHeaders, json, readJson, functionsBaseUrl } from "../_shared/http.ts";
import { evolutionConfig, ensureWhatsAppInbox } from "../_shared/whatsapp.ts";

const WEBHOOK_EVENTS = [
  "MESSAGES_UPSERT",
  "CONNECTION_UPDATE",
  "QRCODE_UPDATED",
  "SEND_MESSAGE",
  "MESSAGES_UPDATE",
];

function evoFetch(baseUrl: string, apiKey: string, path: string, method = "GET", body?: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function webhookLooksOk(state: any, expectedUrl: string): boolean {
  if (!state) return false;
  const url = state.url ?? "";
  const enabled = state.enabled ?? true;
  const events = state.events ?? [];
  const base64 = state.webhookBase64 ?? state.webhook_base64 ?? false;
  return enabled && url === expectedUrl && events.includes("MESSAGES_UPSERT") && base64 === true;
}

async function fetchWebhookState(baseUrl: string, apiKey: string, inst: string) {
  try {
    const r = await evoFetch(baseUrl, apiKey, `/webhook/find/${inst}`);
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

async function configureWebhook(baseUrl: string, apiKey: string, inst: string, webhookUrl: string) {
  const steps: Record<string, unknown> = {};

  // 1. Nested camelCase (Evolution v2)
  try {
    const r = await evoFetch(baseUrl, apiKey, `/webhook/set/${inst}`, "POST", {
      webhook: { enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: true, events: WEBHOOK_EVENTS },
    });
    steps.nested = { status: r.status };
  } catch (e) { steps.nested = { error: String(e) }; }

  let state = await fetchWebhookState(baseUrl, apiKey, inst);
  let ok = webhookLooksOk(state, webhookUrl);

  // 2. Flat snake_case (Evolution v1)
  if (!ok) {
    try {
      const r = await evoFetch(baseUrl, apiKey, `/webhook/set/${inst}`, "POST", {
        enabled: true, url: webhookUrl, webhook_by_events: false, webhook_base64: true, events: WEBHOOK_EVENTS,
      });
      steps.flat = { status: r.status };
    } catch (e) { steps.flat = { error: String(e) }; }
    state = await fetchWebhookState(baseUrl, apiKey, inst);
    ok = webhookLooksOk(state, webhookUrl);
  }

  // 3. Flat camelCase
  if (!ok) {
    try {
      const r = await evoFetch(baseUrl, apiKey, `/webhook/set/${inst}`, "POST", {
        enabled: true, url: webhookUrl, webhookByEvents: false, webhookBase64: true, events: WEBHOOK_EVENTS,
      });
      steps.flatCamel = { status: r.status };
    } catch (e) { steps.flatCamel = { error: String(e) }; }
    state = await fetchWebhookState(baseUrl, apiKey, inst);
    ok = webhookLooksOk(state, webhookUrl);
  }

  if (!ok) console.error(`[webhook] ${inst} — NÃO persistiu. Estado:`, JSON.stringify(state));
  else console.log(`[webhook] ${inst} — configurado: ${webhookUrl}`);

  return { steps, state, verified: ok, webhookUrl };
}

async function configureSettings(baseUrl: string, apiKey: string, inst: string) {
  const body = { rejectCall: false, groupsIgnore: true, alwaysOnline: false, readMessages: false, readStatus: false, syncFullHistory: false };
  try {
    const r = await evoFetch(baseUrl, apiKey, `/settings/set/${inst}`, "POST", { settings: body });
    if (!r.ok) await evoFetch(baseUrl, apiKey, `/settings/set/${inst}`, "POST", body);
  } catch { /* ignore */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const { action, instanceName, accountId, path, method, body } = await readJson(req);
    const { baseUrl, token: apiKey } = evolutionConfig();
    const supa = adminClient();

    // ── Action: setup — create instance + configure webhook + get QR ──
    if (action === "setup") {
      if (!instanceName) return json({ error: "instanceName required" }, 400);
      const inst = String(instanceName).trim();
      const webhookUrl = `${functionsBaseUrl()}/whatsapp-webhook/${encodeURIComponent(inst)}`;
      let qr: string | null = null;
      const steps: Record<string, unknown> = {};

      // 1. Create instance WITH webhook
      try {
        const r = await evoFetch(baseUrl, apiKey, "/instance/create", "POST", {
          instanceName: inst,
          qrcode: false,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            enabled: true, url: webhookUrl,
            webhookByEvents: false, webhookBase64: true, events: WEBHOOK_EVENTS,
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
      const webhookResult = await configureWebhook(baseUrl, apiKey, inst, webhookUrl);
      steps.webhook = webhookResult.steps;
      steps.webhookVerified = webhookResult.verified;

      // 3. Configure settings (ignore groups)
      await configureSettings(baseUrl, apiKey, inst);

      // 4. Save to DB
      if (accountId) {
        try {
          const { data: existing } = await supa.from("whatsapp_instances").select("id").eq("instance_name", inst).maybeSingle();
          if (existing) {
            await supa.from("whatsapp_instances").update({ status: "pending", account_id: accountId }).eq("id", existing.id);
          } else {
            await supa.from("whatsapp_instances").insert({ instance_name: inst, account_id: accountId, status: "pending" });
          }
          await ensureWhatsAppInbox({ accountId, instanceName: inst, phoneNumber: null, profileName: null });
        } catch (e) { console.error("[setup] db error:", e); }
      }

      // 5. Connect and get QR
      try {
        const r = await evoFetch(baseUrl, apiKey, `/instance/connect/${encodeURIComponent(inst)}`);
        const d = await r.json().catch(() => ({}));
        steps.connect = { status: r.status };
        qr = d?.qrcode?.base64 ?? d?.base64 ?? d?.qr ?? d?.qrcode?.code ?? d?.code ?? null;
      } catch (e) { console.error("[setup] connect error:", e); }

      return json({ ok: webhookResult.verified, instance: inst, qr, webhookUrl, webhookVerified: webhookResult.verified, steps });
    }

    // ── Action: configure-webhook ──
    if (action === "configure-webhook") {
      const inst = String(instanceName || "").trim();
      if (!inst) return json({ error: "instanceName required" }, 400);
      const webhookUrl = `${functionsBaseUrl()}/whatsapp-webhook/${encodeURIComponent(inst)}`;
      const webhookResult = await configureWebhook(baseUrl, apiKey, inst, webhookUrl);
      await configureSettings(baseUrl, apiKey, inst);
      return json({ ok: webhookResult.verified, instance: inst, webhookUrl, verified: webhookResult.verified, steps: webhookResult.steps });
    }

    // ── Action: disable-webhook ──
    if (action === "disable-webhook") {
      const inst = String(instanceName || "").trim();
      if (!inst) return json({ error: "instanceName required" }, 400);
      try {
        await evoFetch(baseUrl, apiKey, `/webhook/set/${inst}`, "POST", { webhook: { enabled: false, url: "", events: [] } });
        await evoFetch(baseUrl, apiKey, `/webhook/set/${inst}`, "POST", { enabled: false, url: "", events: [] });
      } catch { /* ignore */ }
      return json({ ok: true });
    }

    // ── Action: status ──
    if (action === "status") {
      const inst = String(instanceName || "").trim();
      if (!inst) return json({ error: "instanceName required" }, 400);
      try {
        const r = await evoFetch(baseUrl, apiKey, `/instance/connectionState/${encodeURIComponent(inst)}`);
        const d = await r.json().catch(() => ({}));
        const state = d?.instance?.state ?? d?.state ?? "unknown";
        const name = d?.instance?.profileName ?? d?.profileName ?? null;
        const rawPhone = d?.instance?.owner ?? d?.instance?.wuid ?? d?.owner ?? d?.wuid ?? null;
        const phone = rawPhone ? String(rawPhone).split("@")[0].replace(/\D/g, "") : null;
        const normalizedStatus = state === "open" || state === "connected"
          ? "connected"
          : state === "connecting" || state === "pending"
            ? "connecting"
            : "disconnected";

        if (accountId || normalizedStatus === "connected") {
          const update: Record<string, unknown> = {
            status: normalizedStatus,
            updated_at: new Date().toISOString(),
          };
          if (accountId) update.account_id = accountId;
          if (name) {
            update.name = name;
            update.profile_name = name;
          }
          if (phone) update.phone_number = phone;

          const { data: updatedInstance } = await supa
            .from("whatsapp_instances")
            .update(update)
            .eq("instance_name", inst)
            .select("account_id, instance_name")
            .maybeSingle();

          const resolvedAccountId = updatedInstance?.account_id || accountId || null;
          if (normalizedStatus === "connected" && resolvedAccountId) {
            await ensureWhatsAppInbox({
              accountId: resolvedAccountId,
              instanceName: inst,
              phoneNumber: phone,
              profileName: name,
            });
          }
        }

        return json({ connected: state === "open", state, profileName: name, phoneNumber: phone });
      } catch {
        return json({ connected: false, state: "unknown", profileName: null, phoneNumber: null });
      }
    }

    // ── Action: disconnect ──
    if (action === "disconnect") {
      const inst = String(instanceName || "").trim();
      const deleteInstance = (body as any)?.deleteInstance ?? false;
      if (!inst) return json({ error: "instanceName required" }, 400);
      try {
        await evoFetch(baseUrl, apiKey, `/webhook/set/${inst}`, "POST", { webhook: { enabled: false, url: "", events: [] } }).catch(() => null);
        if (deleteInstance) {
          await evoFetch(baseUrl, apiKey, `/instance/delete/${encodeURIComponent(inst)}`, "DELETE");
        } else {
          await evoFetch(baseUrl, apiKey, `/instance/logout/${encodeURIComponent(inst)}`, "DELETE");
        }
        const supa2 = adminClient();
        await supa2.from("whatsapp_instances").update({ status: "disconnected" }).eq("instance_name", inst);
      } catch (e) { console.error("[disconnect] error:", e); }
      return json({ ok: true });
    }

    // ── Action: refresh ──
    if (action === "refresh") {
      const inst = String(instanceName || "").trim();
      if (!inst) return json({ error: "instanceName required" }, 400);
      try {
        const r = await evoFetch(baseUrl, apiKey, `/instance/connectionState/${encodeURIComponent(inst)}`);
        const d = await r.json().catch(() => ({}));
        const state = d?.instance?.state ?? d?.state ?? "unknown";
        const phone = d?.instance?.wuid ? d.instance.wuid.split("@")[0] : null;
        const name = d?.instance?.profileName ?? d?.profileName ?? null;
        const supa2 = adminClient();
        await supa2.from("whatsapp_instances")
          .update({ status: state === "open" ? "connected" : "disconnected", name: name || inst })
          .eq("instance_name", inst);
        return json({ state, profileName: name, phoneNumber: phone });
      } catch {
        return json({ state: "unknown" });
      }
    }

    // ── Generic proxy ──
    if (path) {
      const r = await evoFetch(baseUrl, apiKey, path, method ?? "GET", body);
      const data = await r.json().catch(() => ({}));
      return json(data, r.status);
    }

    return json({ error: "action or path required" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    console.error("[evolution-proxy] unhandled:", msg);
    return json({ error: msg }, 500);
  }
});
