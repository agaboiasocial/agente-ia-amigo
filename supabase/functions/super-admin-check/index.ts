import { corsHeaders, errorResponse, json, requirePlatformAdmin } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    await requirePlatformAdmin(req);
    return json({ isAdmin: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("restrito")) return json({ isAdmin: false }, 200);
    return errorResponse(error);
  }
});
