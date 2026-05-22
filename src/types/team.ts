// Team / organization member types adapted for IAS

export type OrgMemberRole =
  | "owner"
  | "org_admin"
  | "manager"
  | "salesperson"
  | "agent"
  | "secretary"
  | "finance"
  | "viewer";

export const ORG_MEMBER_ROLES: { value: OrgMemberRole; label: string; description: string }[] = [
  { value: "owner", label: "Proprietário", description: "Acesso total à organização" },
  { value: "org_admin", label: "Admin", description: "Gerencia equipe e configurações" },
  { value: "manager", label: "Gerente", description: "Supervisiona equipe e relatórios" },
  { value: "salesperson", label: "Vendedor", description: "Gerencia leads e pipeline" },
  { value: "agent", label: "Agente", description: "Atende conversas e leads atribuídos" },
  { value: "secretary", label: "Secretária", description: "Gerencia agenda e contatos" },
  { value: "finance", label: "Financeiro", description: "Acesso a relatórios financeiros" },
  { value: "viewer", label: "Visualizador", description: "Apenas visualização" },
];

export const ASSIGNABLE_ORG_ROLES = ORG_MEMBER_ROLES.filter(
  (r) => r.value !== "owner"
);

export const ORG_ROLE_PERMISSIONS: Record<OrgMemberRole, string[]> = {
  owner: ["*"],
  org_admin: [
    "leads.view", "leads.create", "leads.edit", "leads.delete",
    "pipeline.view", "pipeline.edit",
    "team.view", "team.manage",
    "reports.view", "finance.view",
    "settings.view", "settings.edit",
    "chat.view", "chat.send",
    "contacts.view", "contacts.edit",
  ],
  manager: [
    "leads.view", "leads.create", "leads.edit",
    "pipeline.view", "pipeline.edit",
    "team.view",
    "reports.view",
    "chat.view", "chat.send",
    "contacts.view", "contacts.edit",
  ],
  salesperson: [
    "leads.view", "leads.create", "leads.edit",
    "pipeline.view", "pipeline.edit",
    "chat.view", "chat.send",
    "contacts.view", "contacts.edit",
  ],
  agent: [
    "leads.view",
    "pipeline.view",
    "chat.view", "chat.send",
    "contacts.view",
  ],
  secretary: [
    "leads.view", "leads.create",
    "contacts.view", "contacts.edit",
    "chat.view",
  ],
  finance: [
    "leads.view",
    "reports.view", "finance.view",
    "contacts.view",
  ],
  viewer: [
    "leads.view",
    "pipeline.view",
    "contacts.view",
  ],
};

export function hasOrgPermission(role: OrgMemberRole | null, permission: string): boolean {
  if (!role) return false;
  const perms = ORG_ROLE_PERMISSIONS[role];
  return perms.includes("*") || perms.includes(permission);
}

export function isOrgAdminRole(role: OrgMemberRole | null): boolean {
  return role === "owner" || role === "org_admin";
}

export interface Notification {
  id: string;
  user_id: string;
  account_id?: string | null;
  conversation_id?: string | null;
  contact_id?: string | null;
  team_id?: string | null;
  type: string;
  category?: "message" | "assignment" | "system" | string;
  source?: string | null;
  priority?: string | null;
  title: string;
  description: string | null;
  link: string | null;
  metadata?: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
}
