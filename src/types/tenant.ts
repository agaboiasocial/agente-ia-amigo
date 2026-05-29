export type OrganizationRole = "owner" | "org_admin" | "member";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  locale: string;
  plan_type: string;
  plan_value: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  account_id: string;
  user_id: string;
  role: OrganizationRole;
  is_active: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationTeam {
  id: string;
  organization_id: string;
  account_id: string;
  name: string;
  description: string | null;
  active: boolean;
  auto_assign: boolean;
  allow_self_assign: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface OrganizationTeamMember {
  id: string;
  team_id: string;
  user_id: string | null;
  agent_id?: string | null;
  role: string | null;
  created_at?: string | null;
}

export function accountIdToOrganizationId(accountId: string | null | undefined) {
  return accountId ?? null;
}

export function organizationIdToAccountId(organizationId: string | null | undefined) {
  return organizationId ?? null;
}
