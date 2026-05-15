import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ConnectInput = z.object({
  instanceName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  phoneNumber: z.string().max(40).optional().default(""),
});

function baseUrl() {
  const url = process.env.EVOLUTION_API_URL;
  if (!url) throw new Error("EVOLUTION_API_URL não configurado");
  return url.replace(/\/+$/, "");
}
function token() {
  const t = process.env.EVOLUTION_API_TOKEN;
  if (!t) throw new Error("EVOLUTION_API_TOKEN não configurado");
  return t;
}

function digits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}

export const connectWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ConnectInput.parse(input))
  .handler(async ({ data }) => {
    const url = `${baseUrl()}/instance/create`;
    const headers = { "Content-Type": "application/json", apikey: token() };

    // Try to create the instance
    let res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instanceName: data.instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        ...(data.phoneNumber ? { number: data.phoneNumber.replace(/\D/g, "") } : {}),
      }),
    });

    let body: any = null;
    try { body = await res.json(); } catch { /* noop */ }

    // If already exists, fetch a fresh QR via /instance/connect
    if (!res.ok) {
      const msg = (body?.response?.message || body?.message || "").toString().toLowerCase();
      const alreadyExists = res.status === 403 || res.status === 409 || msg.includes("already") || msg.includes("exists");
      if (!alreadyExists) {
        throw new Error(body?.response?.message || body?.message || `Evolution API: ${res.status}`);
      }
    }

    const connectRes = await fetch(`${baseUrl()}/instance/connect/${encodeURIComponent(data.instanceName)}`, {
      method: "GET",
      headers,
    });
    let connectBody: any = null;
    try { connectBody = await connectRes.json(); } catch { /* noop */ }

    const qr =
      body?.qrcode?.base64 ||
      body?.qrcode?.code ||
      connectBody?.base64 ||
      connectBody?.qrcode?.base64 ||
      connectBody?.code ||
      "";

    if (!qr) throw new Error("QR Code não retornado pela Evolution API");

    // Register webhook so messages flow into our DB.
    // Use the stable preview URL by default — it always serves the latest build,
    // even before the project is published. Override with PUBLIC_APP_URL after publish.
    const projectId = process.env.LOVABLE_PROJECT_ID || "b8a4d7ce-8b50-441a-a1a6-fe328bbeae50";
    const publicBase =
      process.env.PUBLIC_APP_URL ||
      `https://project--${projectId}-dev.lovable.app`;
    const webhookUrl = `${publicBase}/api/public/whatsapp-webhook/${encodeURIComponent(data.instanceName)}`;

    try {
      const wRes = await fetch(`${baseUrl()}/webhook/set/${encodeURIComponent(data.instanceName)}`, {
        method: "POST",
        headers,
        // Evolution API v2 expects { webhook: { ... } }
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            webhookBase64: false,
            events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
          },
        }),
      });
      if (!wRes.ok) {
        const txt = await wRes.text().catch(() => "");
        console.warn("webhook set failed", wRes.status, txt);
      }
    } catch (e) {
      console.warn("webhook set error", e);
    }

    // The whatsapp_instances row is created/updated when the connection.update
    // webhook fires after the QR is scanned (handled in the webhook route).

    return { qrCode: qr, instanceName: data.instanceName, webhookUrl };
  });

const StatusInput = z.object({
  instanceName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
});

export const getWhatsAppStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(
      `${baseUrl()}/instance/connectionState/${encodeURIComponent(data.instanceName)}`,
      { method: "GET", headers: { apikey: token() } },
    );
    let body: any = null;
    try { body = await res.json(); } catch { /* noop */ }
    const state = body?.instance?.state || body?.state || "unknown";
    return {
      state, // "open" = connected
      connected: state === "open",
      profileName: body?.instance?.profileName || null,
      phoneNumber: body?.instance?.owner || body?.instance?.wuid || null,
    };
  });
