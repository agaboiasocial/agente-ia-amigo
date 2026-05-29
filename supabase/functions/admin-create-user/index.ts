/**
 * admin-create-user — Creates auth users without logging out the admin.
 * Based on whatsapp-lead-hub's admin-create-user.
 * Adapted for agente-ia-amigo schema (accounts/account_members/profiles).
 */
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonRes({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) return jsonRes({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);

    // Check platform admin
    const { data: roleData } = await admin.from("user_roles").select("role").eq("user_id", caller.id).single();
    const isPlatformAdmin = roleData?.role === "admin";

    // Check org admin
    let callerAccountId: string | null = null;
    let isOrgAdmin = false;
    if (!isPlatformAdmin) {
      const { data: profile } = await admin.from("profiles").select("account_id").eq("user_id", caller.id).single();
      callerAccountId = profile?.account_id;
      if (callerAccountId) {
        const { data: member } = await admin.from("account_members")
          .select("role").eq("user_id", caller.id).eq("account_id", callerAccountId).eq("is_active", true).single();
        isOrgAdmin = member?.role === "owner" || member?.role === "org_admin";
      }
    }

    if (!isPlatformAdmin && !isOrgAdmin) return jsonRes({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json();

    // ── Change password action ──
    if (body.action === "change_password") {
      if (!body.user_id || !body.password) return jsonRes({ error: "user_id e password obrigatórios" }, 400);
      const { error } = await admin.auth.admin.updateUserById(body.user_id, { password: body.password });
      if (error) return jsonRes({ error: error.message }, 400);
      return jsonRes({ success: true, message: "Senha atualizada" });
    }

    const { email, password, full_name, account_id, org_role } = body;
    if (!email || !full_name) return jsonRes({ error: "Email e nome são obrigatórios" }, 400);

    const effectiveAccountId = isPlatformAdmin ? account_id : callerAccountId;
    if (!isPlatformAdmin && account_id && account_id !== callerAccountId) {
      return jsonRes({ error: "Você só pode criar usuários na sua organização" }, 403);
    }

    const effectiveRole = org_role || "member";

    // Check if user exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    let userId: string;
    let isNew = false;

    if (existingUser) {
      userId = existingUser.id;
      // Check if already in this account
      if (effectiveAccountId) {
        const { data: existing } = await admin.from("account_members")
          .select("id, is_active").eq("user_id", userId).eq("account_id", effectiveAccountId).maybeSingle();
        if (existing?.is_active) {
          return jsonRes({ success: true, message: "Usuário já é membro desta organização", user: { id: userId, email, already_member: true } });
        }
        if (existing) {
          await admin.from("account_members").update({ is_active: true, role: effectiveRole }).eq("id", existing.id);
        }
      }
    } else {
      // Validate password
      if (!password || password.length < 6) return jsonRes({ error: "Senha deve ter pelo menos 6 caracteres" }, 400);

      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { full_name },
      });
      if (createErr) return jsonRes({ error: createErr.message }, 400);
      if (!newUser.user) return jsonRes({ error: "Falha ao criar usuário" }, 500);

      userId = newUser.user.id;
      isNew = true;

      // Create profile
      await admin.from("profiles").upsert({
        user_id: userId, email, display_name: full_name,
        account_id: effectiveAccountId || null,
      }, { onConflict: "user_id" });

      // Create user role (agente by default)
      await admin.from("user_roles").upsert({
        user_id: userId, role: "agente",
      }, { onConflict: "user_id" });
    }

    // Add to account_members
    if (effectiveAccountId) {
      const { data: existing } = await admin.from("account_members")
        .select("id").eq("user_id", userId).eq("account_id", effectiveAccountId).maybeSingle();
      if (existing) {
        await admin.from("account_members").update({ role: effectiveRole, is_active: true }).eq("id", existing.id);
      } else {
        await admin.from("account_members").insert({
          user_id: userId, account_id: effectiveAccountId, role: effectiveRole, is_active: true,
        });
      }
      // Update profile account_id
      await admin.from("profiles").update({ account_id: effectiveAccountId }).eq("user_id", userId);
    }

    return jsonRes({ success: true, message: isNew ? "Colaborador criado" : "Colaborador adicionado", user: { id: userId, email, full_name, is_new: isNew } });
  } catch (err) {
    console.error("[admin-create-user]", err);
    return jsonRes({ error: (err as Error).message || "Erro interno" }, 500);
  }
});
