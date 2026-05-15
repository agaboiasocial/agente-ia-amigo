import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const RoleEnum = z.enum(["admin", "agente"]);

const CreateInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(100),
  displayName: z.string().trim().min(1).max(120),
  role: RoleEnum.default("agente"),
});

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!data?.some((r: { role: string }) => r.role === "admin")) {
    throw new Error("Acesso restrito a administradores");
  }
}

export const checkSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);

    return { isAdmin: !!data?.some((r: { role: string }) => r.role === "admin") };
  });

export const createAgentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    const initials = data.displayName
      .replace(/[^A-Za-z ]/g, "")
      .trim()
      .slice(0, 2)
      .toUpperCase();

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Falha ao criar usuário");

    const userId = created.user.id;

    // handle_new_user trigger inserts profile + 'agente' role automatically.
    // Make sure the profile reflects the requested name/initials.
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { user_id: userId, display_name: data.displayName, avatar_initials: initials } as never,
        { onConflict: "user_id" },
      );

    // If admin requested, add the admin role (keep 'agente' too — additive).
    if (data.role === "admin") {
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" } as never);
    }

    return { ok: true, userId };
  });

const ListInput = z.object({}).optional();

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(() => ({}))
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);

    const ids = list.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id, display_name").in("user_id", ids),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", ids),
    ]);

    return list.users.map((u) => {
      const prof = profiles?.find((p: { user_id: string }) => p.user_id === u.id);
      const userRoles =
        roles?.filter((r: { user_id: string }) => r.user_id === u.id).map((r) => r.role) ?? [];
      return {
        id: u.id,
        email: u.email ?? "",
        displayName: (prof as { display_name?: string } | undefined)?.display_name ?? u.email ?? "",
        roles: userRoles as string[],
        createdAt: u.created_at,
      };
    });
  });

const DeleteInput = z.object({ userId: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DeleteInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode remover sua própria conta");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
