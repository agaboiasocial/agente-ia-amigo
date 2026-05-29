import { adminClient, corsHeaders, errorResponse, json } from "../_shared/http.ts";
import { evolutionConfig } from "../_shared/whatsapp.ts";

function findBase64(value: any) {
  if (!value || typeof value !== "object") return null;
  const candidates = [
    value.base64,
    value.data?.base64,
    value.message?.base64,
    value.message?.imageMessage?.base64,
    value.message?.imageMessage?.jpegThumbnail,
    value.message?.videoMessage?.base64,
    value.message?.audioMessage?.base64,
    value.message?.documentMessage?.base64,
    value.message?.stickerMessage?.base64,
  ];
  return candidates.find((item) => typeof item === "string" && item.length > 0) || null;
}

function findMime(value: any, fallback: string) {
  return (
    value?.message?.imageMessage?.mimetype ||
    value?.message?.videoMessage?.mimetype ||
    value?.message?.audioMessage?.mimetype ||
    value?.message?.documentMessage?.mimetype ||
    value?.message?.stickerMessage?.mimetype ||
    fallback ||
    "application/octet-stream"
  );
}

function stripDataUrl(value: string) {
  if (!value?.startsWith?.("data:")) return { base64: value, mime: null };
  const match = value.match(/^data:([^;]+);base64,(.*)$/);
  return { base64: match?.[2] || value, mime: match?.[1] || null };
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getEvolutionBase64(instanceName: string, rawData: any) {
  if (!instanceName || !rawData) return null;
  const { baseUrl, headers } = evolutionConfig();
  const payloads = [
    { message: rawData, convertToMp4: false },
    { message: { key: rawData.key, message: rawData.message }, convertToMp4: false },
    { key: rawData.key, message: rawData.message, convertToMp4: false },
  ];

  for (const payload of payloads) {
    const response = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }).catch(() => null);
    if (!response?.ok) continue;
    const body = await response.json().catch(() => null);
    const base64 = body?.base64 || body?.data?.base64 || body?.media || body?.data?.media || body?.message?.base64 || null;
    if (base64) {
      return {
        base64,
        mime: body?.mimetype || body?.data?.mimetype || body?.mimeType || body?.data?.mimeType || null,
      };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ error: "id required" }, 400);

    const supa = adminClient();
    const { data: message, error } = await supa
      .from("messages")
      .select("id, media_url, message_type, raw_data, instance_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!message) return json({ error: "message not found" }, 404);

    const fallbackMime =
      message.message_type === "image" ? "image/jpeg" :
      message.message_type === "video" ? "video/mp4" :
      message.message_type === "audio" ? "audio/ogg" :
      "application/octet-stream";

    if (message.media_url?.startsWith?.("http")) {
      const isWhatsappMedia =
        message.media_url.includes("whatsapp.net") ||
        message.media_url.includes("mmg.whatsapp") ||
        message.media_url.includes("pps.whatsapp");
      if (!isWhatsappMedia) {
        return Response.redirect(message.media_url, 302);
      }
    }

    const localBase64 = findBase64(message.raw_data);
    const recovered = localBase64
      ? { base64: localBase64, mime: findMime(message.raw_data, fallbackMime) }
      : await getEvolutionBase64(message.instance_name, message.raw_data);
    const source = recovered?.base64 || message.media_url;
    if (!source) return json({ error: "media unavailable" }, 404);

    const { base64, mime } = stripDataUrl(source);
    return new Response(base64ToBytes(base64), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": recovered?.mime || mime || fallbackMime,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
});
