import { createClient } from "npm:@supabase/supabase-js@2.105.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function methodNotAllowed() {
  return json({ error: "Method not allowed" }, 405);
}

export function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function userClient(accessToken?: string | null) {
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_ANON_KEY") ||
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ||
    Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) throw new Error("Supabase anon key not configured");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

export function bearer(req: Request) {
  return (req.headers.get("authorization") || "").replace("Bearer ", "");
}

export async function requireUser(req: Request) {
  const token = bearer(req);
  if (!token) throw new Error("Não autenticado");
  const supa = userClient(token);
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) throw new Error("Não autenticado");
  return { user, token };
}

export async function requirePlatformAdmin(req: Request) {
  const { user } = await requireUser(req);
  const admin = adminClient();
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles?.some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Acesso restrito a administradores");
  }
  return user;
}

export async function readJson(req: Request) {
  if (req.method === "GET") return {};
  return await req.json().catch(() => ({}));
}

export function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro interno";
  const status = message === "Não autenticado" ? 401 : message.includes("restrito") ? 403 : 500;
  return json({ error: message }, status);
}

export function digits(value: string | null | undefined) {
  return (value || "").replace(/\D/g, "");
}

export function functionsBaseUrl() {
  const explicit = Deno.env.get("PUBLIC_SUPABASE_FUNCTIONS_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  const url = Deno.env.get("SUPABASE_URL") || Deno.env.get("VITE_SUPABASE_URL");
  if (!url) throw new Error("SUPABASE_URL not configured");
  return `${url.replace(/\/+$/, "")}/functions/v1`;
}
