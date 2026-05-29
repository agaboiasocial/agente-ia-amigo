import { corsHeaders, errorResponse, json, readJson } from "../_shared/http.ts";
import { evolutionConfig } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { instanceName } = await readJson(req);
    if (!instanceName) return json({ error: "instanceName required" }, 400);
    const { baseUrl, token } = evolutionConfig();
    const res = await fetch(`${baseUrl}/instance/connectionState/${encodeURIComponent(instanceName)}`, {
      method: "GET",
      headers: { apikey: token },
    });
    const body = await res.json().catch(() => null);
    const state = body?.instance?.state || body?.state || "unknown";
    return json({
      state,
      connected: state === "open",
      profileName: body?.instance?.profileName || null,
      phoneNumber: body?.instance?.owner || body?.instance?.wuid || null,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
