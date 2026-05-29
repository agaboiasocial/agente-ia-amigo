const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;

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
  const url = new URL(edgeFunctionUrl(name, options.path));
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (SUPABASE_ANON_KEY) headers["apikey"] = SUPABASE_ANON_KEY;
  if (options.token) headers["Authorization"] = `Bearer ${options.token}`;
  else if (SUPABASE_ANON_KEY) headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;

  const response = await fetch(url.toString(), {
    method: options.method ?? "POST",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error || `Edge Function ${name}: ${response.status}`);
  }
  return json as T;
}
