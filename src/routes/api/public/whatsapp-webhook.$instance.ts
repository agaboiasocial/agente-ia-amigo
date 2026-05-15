import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Anonymous client — all writes go through SECURITY DEFINER RPCs that bypass RLS.
function getClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function digits(s: string | null | undefined) {
  return (s || "").replace(/\D/g, "");
}
function jidToPhone(jid: string | null | undefined) {
  if (!jid) return "";
  return digits(jid.split("@")[0]);
}

function extractText(msg: any): { content: string; type: string; mediaUrl: string | null } {
  if (!msg) return { content: "", type: "text", mediaUrl: null };
  if (msg.conversation) return { content: msg.conversation, type: "text", mediaUrl: null };
  if (msg.extendedTextMessage?.text) return { content: msg.extendedTextMessage.text, type: "text", mediaUrl: null };
  if (msg.imageMessage) return { content: msg.imageMessage.caption || "[imagem]", type: "image", mediaUrl: msg.imageMessage.url || null };
  if (msg.videoMessage) return { content: msg.videoMessage.caption || "[vídeo]", type: "video", mediaUrl: msg.videoMessage.url || null };
  if (msg.audioMessage) return { content: "[áudio]", type: "audio", mediaUrl: msg.audioMessage.url || null };
  if (msg.documentMessage) return { content: msg.documentMessage.fileName || "[documento]", type: "document", mediaUrl: msg.documentMessage.url || null };
  if (msg.stickerMessage) return { content: "[sticker]", type: "sticker", mediaUrl: null };
  return { content: "[mensagem]", type: "text", mediaUrl: null };
}

async function handleMessageUpsert(instanceName: string, item: any) {
  const key = item?.key || {};
  const remoteJid: string = key.remoteJid || "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return;
  const phone = jidToPhone(remoteJid);
  if (!phone) return;
  const fromMe: boolean = !!key.fromMe;
  const messageId: string = key.id || "";
  const pushName: string = item?.pushName || phone;
  const { content, type, mediaUrl } = extractText(item?.message);

  const supa = getClient();
  const { error } = await supa.rpc("process_whatsapp_message", {
    p_instance: instanceName,
    p_phone: phone,
    p_push_name: pushName,
    p_message_id: messageId,
    p_content: content,
    p_message_type: type,
    p_media_url: mediaUrl,
    p_from_me: fromMe,
    p_raw: item,
  });
  if (error) console.error("rpc process_whatsapp_message", error);
}

async function handleConnectionUpdate(instanceName: string, data: any) {
  const supa = getClient();
  const { error } = await supa.rpc("process_whatsapp_connection", {
    p_instance: instanceName,
    p_state: data?.state || data?.status || "",
    p_phone: data?.wuid ? jidToPhone(data.wuid) : "",
    p_profile_name: data?.profileName || "",
  });
  if (error) console.error("rpc process_whatsapp_connection", error);
}

export const Route = createFileRoute("/api/public/whatsapp-webhook/$instance")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ params }) => jsonResponse({ ok: true, instance: params.instance }),
      POST: async ({ request, params }) => {
        const instanceName = params.instance;
        let payload: any = {};
        try { payload = await request.json(); } catch { /* noop */ }

        const event: string = payload?.event || payload?.type || "";
        const data = payload?.data ?? payload;

        try {
          if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
            const items = Array.isArray(data) ? data : [data];
            for (const item of items) await handleMessageUpsert(instanceName, item);
          } else if (event === "connection.update" || event === "CONNECTION_UPDATE") {
            await handleConnectionUpdate(instanceName, data);
          } else if (data?.key?.remoteJid) {
            await handleMessageUpsert(instanceName, data);
          }
        } catch (e) {
          console.error("webhook error", e);
          return jsonResponse({ ok: false, error: (e as Error).message }, 500);
        }

        return jsonResponse({ ok: true });
      },
    },
  },
});
