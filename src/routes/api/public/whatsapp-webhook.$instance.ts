import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

async function handleMessageUpsert(instanceName: string, data: any) {
  const key = data?.key || {};
  const remoteJid: string = key.remoteJid || "";
  if (!remoteJid || remoteJid.endsWith("@g.us")) return; // skip groups for now

  const fromMe: boolean = !!key.fromMe;
  const phone = jidToPhone(remoteJid);
  if (!phone) return;

  const messageId: string = key.id || "";
  const pushName: string = data?.pushName || phone;
  const { content, type, mediaUrl } = extractText(data?.message);

  // upsert contact
  let contactId: string | null = null;
  {
    const { data: existing } = await supabaseAdmin
      .from("contacts")
      .select("id,name")
      .eq("phone_number", phone)
      .maybeSingle();
    if (existing?.id) {
      contactId = existing.id;
      if (!existing.name || existing.name === phone) {
        await supabaseAdmin.from("contacts").update({ name: pushName }).eq("id", contactId);
      }
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("contacts")
        .insert({ name: pushName, phone_number: phone, channel: "whatsapp" })
        .select("id")
        .single();
      if (error) { console.error("contact insert", error); return; }
      contactId = created.id;
    }
  }

  // upsert conversation (one open conv per contact+instance)
  let conversationId: string | null = null;
  {
    const { data: existing } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("contact_id", contactId)
      .eq("instance_name", instanceName)
      .in("status", ["open", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      conversationId = existing.id;
      await supabaseAdmin
        .from("conversations")
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from("conversations")
        .insert({
          contact_id: contactId,
          instance_name: instanceName,
          channel: "whatsapp",
          status: "open",
          last_message: content,
          last_message_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) { console.error("conv insert", error); return; }
      conversationId = created.id;
    }
  }

  // insert message
  const { error: msgErr } = await supabaseAdmin.from("messages").insert({
    conversation_id: conversationId,
    contact_id: contactId,
    instance_name: instanceName,
    message_id: messageId,
    content,
    message_type: type,
    media_url: mediaUrl,
    sender_name: fromMe ? "Eu" : pushName,
    is_from_contact: !fromMe,
    raw_data: data,
  });
  if (msgErr) console.error("message insert", msgErr);
}

async function handleConnectionUpdate(instanceName: string, data: any) {
  const state = data?.state || data?.status || "";
  const status = state === "open" ? "connected" : state === "close" ? "disconnected" : state || "pending";
  await supabaseAdmin
    .from("whatsapp_instances")
    .upsert(
      {
        instance_name: instanceName,
        status,
        phone_number: data?.wuid ? jidToPhone(data.wuid) : undefined,
        profile_name: data?.profileName || undefined,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instance_name" },
    );
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
          } else {
            // Try to handle bare message payloads
            if (data?.key?.remoteJid) await handleMessageUpsert(instanceName, data);
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
