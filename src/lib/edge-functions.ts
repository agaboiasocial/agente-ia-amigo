import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export function edgeFunctionUrl(name: string, path = "") {
  if (!SUPABASE_URL) throw new Error("VITE_SUPABASE_URL não configurada");
  const base = SUPABASE_URL.replace(/\/+$/, "");
  const cleanPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${base}/functions/v1/${name}${cleanPath}`;
}

export async function callEdgeFunction<T = unknown>(
  name: string,
  options: {
    method?: string;
    token?: string | null;
    path?: string;
    query?: Record<string, string | number | boolean | null | undefined>;
    body?: unknown;
  } = {},
) {
  // Build query string for path
  const queryStr = Object.entries(options.query ?? {})
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  const fnPath = options.path ? `/${options.path.replace(/^\/+/, "")}` : "";
  const fullPath = queryStr ? `${fnPath}?${queryStr}` : fnPath || undefined;

  const { data, error } = await supabase.functions.invoke(name, {
    method: (options.method as "GET" | "POST" | "PATCH" | "DELETE") ?? "POST",
    body: options.body !== undefined ? options.body : undefined,
    headers: options.token ? { Authorization: `Bearer ${options.token}` } : undefined,
  });

  if (error) {
    throw new Error(error.message || `Edge Function ${name}: erro`);
  }
  return data as T;
}
