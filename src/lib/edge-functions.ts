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
  const url = new URL(edgeFunctionUrl(name, options.path));
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString(), {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error || `Edge Function ${name}: ${response.status}`);
  }
  return json as T;
}
