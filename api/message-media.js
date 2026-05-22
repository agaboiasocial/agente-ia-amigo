import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function findBase64(value) {
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

function findMime(value, fallback) {
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

function stripDataUrl(value) {
  if (!value?.startsWith?.("data:")) return { base64: value, mime: null };
  const match = value.match(/^data:([^;]+);base64,(.*)$/);
  return { base64: match?.[2] || value, mime: match?.[1] || null };
}

async function getEvolutionBase64(instanceName, rawData) {
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
  const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_TOKEN;
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN || !instanceName || !rawData) return null;

  const apiBase = EVOLUTION_API_URL.replace(/\/+$/, "");
  const payloads = [
    { message: rawData, convertToMp4: false },
    { message: { key: rawData.key, message: rawData.message }, convertToMp4: false },
    { key: rawData.key, message: rawData.message, convertToMp4: false },
  ];

  for (const payload of payloads) {
    try {
      const response = await fetch(
        `${apiBase}/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_TOKEN },
          body: JSON.stringify(payload),
        },
      );
      const json = await response.json().catch(() => null);
      if (!response.ok) continue;
      const base64 =
        json?.base64 ||
        json?.data?.base64 ||
        json?.media ||
        json?.data?.media ||
        json?.message?.base64 ||
        null;
      if (base64) {
        return {
          base64,
          mime: json?.mimetype || json?.data?.mimetype || json?.mimeType || json?.data?.mimeType || null,
        };
      }
    } catch {
      // Try the next known Evolution payload shape.
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id required" });

    const supa = getAdminClient();
    const { data: message, error } = await supa
      .from("messages")
      .select("id, media_url, message_type, raw_data, instance_name")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!message) return res.status(404).json({ error: "message not found" });

    const fallbackMime =
      message.message_type === "image"
        ? "image/jpeg"
        : message.message_type === "video"
          ? "video/mp4"
          : message.message_type === "audio"
            ? "audio/ogg"
            : "application/octet-stream";

    if (message.media_url?.startsWith?.("http")) {
      const isWhatsappMedia =
        message.media_url.includes("whatsapp.net") ||
        message.media_url.includes("mmg.whatsapp") ||
        message.media_url.includes("pps.whatsapp");
      if (!isWhatsappMedia) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.redirect(302, message.media_url);
      }
    }

    const localBase64 = findBase64(message.raw_data);
    const recovered = localBase64
      ? { base64: localBase64, mime: findMime(message.raw_data, fallbackMime) }
      : await getEvolutionBase64(message.instance_name, message.raw_data);

    const source = recovered?.base64 || message.media_url;
    if (!source) return res.status(404).json({ error: "media unavailable" });

    const { base64, mime } = stripDataUrl(source);
    const buffer = Buffer.from(base64, "base64");
    res.setHeader("Content-Type", recovered?.mime || mime || fallbackMime);
    res.setHeader("Cache-Control", "public, max-age=86400");
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("message-media error:", error);
    return res.status(500).json({ error: error.message || "Erro interno" });
  }
}
