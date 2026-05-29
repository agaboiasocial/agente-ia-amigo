import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  return json({
    ok: true,
    skipped: true,
    reason: "AI processing is handled inside whatsapp-webhook edge function",
  });
});
