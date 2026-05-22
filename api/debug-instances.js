import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      return res.status(200).json({
        error: "Missing env vars",
        hasUrl: !!url,
        hasServiceKey: !!key,
        hasAnonKey: !!process.env.SUPABASE_PUBLISHABLE_KEY,
      });
    }

    const supa = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // POST = test delete
    if (req.method === "POST") {
      const { instanceName } = req.body || {};
      const { data, error, count, status, statusText } = await supa
        .from("whatsapp_instances")
        .delete()
        .eq("instance_name", instanceName)
        .select();

      return res.status(200).json({
        action: "delete",
        instanceName,
        deletedRows: data,
        error: error?.message || null,
        errorDetails: error || null,
        count,
        status,
        statusText,
      });
    }

    // GET = list
    const { data, error } = await supa
      .from("whatsapp_instances")
      .select("id, instance_name, phone_number, profile_name, status, account_id");

    return res.status(200).json({ instances: data, error: error?.message || null });
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}
