import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Organization, OrganizationMember, OrganizationRole } from "@/types/tenant";

const sb = supabase as any;

export function isOrganizationAdmin(role: OrganizationRole | null | undefined) {
  return role === "owner" || role === "org_admin";
}

export function useCurrentOrganization() {
  const { accountId } = useAuth();

  return useQuery({
    queryKey: ["current-organization", accountId],
    enabled: !!accountId,
    queryFn: async (): Promise<Organization | null> => {
      const { data, error } = await sb
        .from("accounts")
        .select("id, name, slug, locale, plan_type, plan_value, is_active, created_at, updated_at")
        .eq("id", accountId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        plan_value: Number(data.plan_value ?? 0),
      } as Organization;
    },
  });
}

export function useCurrentOrganizationMembership() {
  const { user, accountId } = useAuth();

  return useQuery({
    queryKey: ["current-organization-membership", accountId, user?.id],
    enabled: !!accountId && !!user?.id,
    queryFn: async (): Promise<OrganizationMember | null> => {
      const { data, error } = await sb
        .from("account_members")
        .select("id, account_id, user_id, role, is_active, created_at, updated_at")
        .eq("account_id", accountId)
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        organization_id: data.account_id,
      } as OrganizationMember;
    },
  });
}

export function useCanManageCurrentOrganization() {
  const { isAdmin } = useAuth();
  const membership = useCurrentOrganizationMembership();
  const role = membership.data?.role;

  return {
    ...membership,
    canManage: isAdmin || isOrganizationAdmin(role),
  };
}
