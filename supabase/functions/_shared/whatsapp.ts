import { adminClient, digits } from "./http.ts";

export function evolutionConfig() {
  const url = Deno.env.get("EVOLUTION_API_URL");
  const token = Deno.env.get("EVOLUTION_API_TOKEN");
  if (!url || !token) throw new Error("Evolution API não configurada");
  return {
    baseUrl: url.replace(/\/+$/, ""),
    token,
    headers: { "Content-Type": "application/json", apikey: token },
  };
}

export async function ensureWhatsAppInbox({
  accountId,
  instanceName,
  phoneNumber,
  profileName,
}: {
  accountId?: string | null;
  instanceName?: string | null;
  phoneNumber?: string | null;
  profileName?: string | null;
}) {
  if (!accountId || !instanceName) return null;
  const supa = adminClient();

  const { data: existing, error: findError } = await supa
    .from("inboxes")
    .select("id")
    .eq("account_id", accountId)
    .eq("instance_name", instanceName)
    .maybeSingle();
  if (findError) throw findError;
  if (existing?.id) return existing;

  const label = profileName || phoneNumber || instanceName;
  const channelConfig = {
    provider: "evolution",
    instance_name: instanceName,
    phone_number: phoneNumber || null,
  };

  const { data, error } = await supa
    .from("inboxes")
    .insert({
      account_id: accountId,
      name: `WhatsApp - ${label}`,
      channel: "WhatsApp",
      instance_name: instanceName,
      config: channelConfig,
      channel_config: channelConfig,
      active: true,
      status: "active",
      widget_color: "#25D366",
      welcome_message: "Olá! Como podemos ajudar?",
      greeting_message: "Olá! Como podemos ajudar?",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function sendWhatsApp(instanceName: string, phone: string, text: string) {
  const { baseUrl, headers } = evolutionConfig();
  const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ number: digits(phone), text }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const message = body?.response?.message || body?.message || `Evolution API: ${res.status}`;
    throw new Error(Array.isArray(message) ? message.join(", ") : String(message));
  }
  return body;
}
