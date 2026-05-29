import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  Plus, Search, Loader2, Trash2, Shield, UserCog, Building2, KeyRound,
  MoreHorizontal, LogIn,
} from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/super-admin/users")({ component: Page });

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  accountId: string | null;
  accountName: string | null;
  orgRole: string | null;
  createdAt: string;
}

interface AccountOption {
  id: string;
  name: string;
}

function Page() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const headers = {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Create form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formIsOrgAdmin, setFormIsOrgAdmin] = useState(true);
  const [formRole, setFormRole] = useState<"agente" | "admin">("agente");

  // Fetch users
  const usersQuery = useQuery({
    queryKey: ["super-admin-users-full"],
    queryFn: async () => {
      const r = await fetch("/api/super-admin/users", { method: "GET", headers });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro ao listar");
      return json as UserRow[];
    },
  });

  // Fetch accounts for select
  const accountsQuery = useQuery({
    queryKey: ["admin_accounts_list"],
    queryFn: async (): Promise<AccountOption[]> => {
      const { data } = await sb.from("accounts").select("id, name").order("name");
      return (data ?? []) as AccountOption[];
    },
  });

  // Create user
  const createMut = useMutation({
    mutationFn: async () => {
      if (!formEmail || !formPassword || !formName) throw new Error("Preencha todos os campos obrigatórios");
      const r = await fetch("/api/super-admin/users", {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: formEmail,
          password: formPassword,
          displayName: formName,
          role: formRole,
          accountId: formAccountId || null,
          isOrgAdmin: formIsOrgAdmin,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro ao criar");
      return json;
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso");
      qc.invalidateQueries({ queryKey: ["super-admin-users-full"] });
      setCreateOpen(false);
      setFormName(""); setFormEmail(""); setFormPassword("");
      setFormAccountId(""); setFormIsOrgAdmin(true); setFormRole("agente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete user
  const deleteMut = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch("/api/super-admin/users", {
        method: "DELETE", headers,
        body: JSON.stringify({ userId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro ao remover");
    },
    onSuccess: () => {
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["super-admin-users-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Change password
  const passwordMut = useMutation({
    mutationFn: async () => {
      if (!passwordTarget || !newPassword) throw new Error("Senha obrigatória");
      const r = await fetch("/api/super-admin/users", {
        method: "PATCH", headers,
        body: JSON.stringify({ action: "change_password", userId: passwordTarget.id, password: newPassword }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro ao alterar senha");
    },
    onSuccess: () => {
      toast.success(`Senha de ${passwordTarget?.name} alterada`);
      setPasswordOpen(false); setNewPassword(""); setPasswordTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Assign to account
  const assignMut = useMutation({
    mutationFn: async ({ userId, accountId }: { userId: string; accountId: string | null }) => {
      const r = await fetch("/api/super-admin/users", {
        method: "PATCH", headers,
        body: JSON.stringify({ action: "assign_account", userId, accountId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro");
    },
    onSuccess: () => {
      toast.success("Organização atualizada");
      qc.invalidateQueries({ queryKey: ["super-admin-users-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Promote to org admin
  const orgAdminMut = useMutation({
    mutationFn: async ({ userId, accountId }: { userId: string; accountId: string }) => {
      const r = await fetch("/api/super-admin/users", {
        method: "PATCH", headers,
        body: JSON.stringify({ action: "promote_org_admin", userId, accountId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro");
    },
    onSuccess: () => {
      toast.success("Promovido a Admin da Organização");
      qc.invalidateQueries({ queryKey: ["super-admin-users-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Toggle platform admin
  const platformAdminMut = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      const r = await fetch("/api/super-admin/users", {
        method: "PATCH", headers,
        body: JSON.stringify({ action: "toggle_platform_admin", userId, makeAdmin }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro");
    },
    onSuccess: () => {
      toast.success("Papel de plataforma atualizado");
      qc.invalidateQueries({ queryKey: ["super-admin-users-full"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (usersQuery.data ?? []).filter((r) =>
    [r.displayName, r.email, r.accountName || ""].some((v) =>
      v.toLowerCase().includes(search.toLowerCase())
    )
  );

  const accounts = accountsQuery.data ?? [];
  const totalUsers = usersQuery.data?.length ?? 0;
  const totalAdmins = usersQuery.data?.filter((u) => u.roles.includes("admin")).length ?? 0;
  const totalWithOrg = usersQuery.data?.filter((u) => u.accountId).length ?? 0;

  return (
    <SuperAdminLayout
      title="Usuários"
      actions={
        <button
          onClick={() => setCreateOpen(true)}
          className="h-9 px-4 rounded-lg bg-[#2FAE7C] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#26926a]"
        >
          <Plus className="h-4 w-4" /> Novo Usuário
        </button>
      }
    >
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total de Usuários", value: totalUsers },
            { label: "Administradores", value: totalAdmins },
            { label: "Com Organização", value: totalWithOrg },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-[#0B3A5D]">{k.value}</div>
              <div className="text-xs text-slate-500">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full h-10 pl-10 pr-4 rounded-lg border bg-white text-sm"
            placeholder="Buscar por nome, email ou organização..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        {usersQuery.isLoading ? (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : usersQuery.error ? (
          <div className="bg-white rounded-lg border p-6 text-red-500 text-sm">
            {(usersQuery.error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center text-slate-500">
            Nenhum usuário encontrado
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Email</th>
                  <th className="text-left px-4 py-3">Papel</th>
                  <th className="text-left px-4 py-3">Organização</th>
                  <th className="text-left px-4 py-3">Papel na Org</th>
                  <th className="text-left px-4 py-3">Criado em</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{u.displayName}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-slate-400 text-xs">—</span>
                        ) : (
                          u.roles.map((role) => (
                            <span
                              key={role}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                role === "admin"
                                  ? "bg-[#0B3A5D]/10 text-[#0B3A5D]"
                                  : "bg-[#2FAE7C]/15 text-[#2FAE7C]"
                              }`}
                            >
                              {role === "admin" && <Shield className="h-3 w-3" />}
                              {role}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.accountName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          <Building2 className="h-3 w-3" /> {u.accountName}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.orgRole ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.orgRole === "owner" || u.orgRole === "org_admin"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                        }`}>
                          {u.orgRole === "owner" && <UserCog className="h-3 w-3" />}
                          {u.orgRole === "org_admin" && <UserCog className="h-3 w-3" />}
                          {u.orgRole === "owner" ? "Dono" : u.orgRole === "org_admin" ? "Admin" : "Membro"}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActions
                        user={u}
                        accounts={accounts}
                        onChangePassword={() => {
                          setPasswordTarget({ id: u.id, name: u.displayName });
                          setNewPassword("");
                          setPasswordOpen(true);
                        }}
                        onAssignAccount={(accountId) => assignMut.mutate({ userId: u.id, accountId })}
                        onPromoteOrgAdmin={() => {
                          if (u.accountId) orgAdminMut.mutate({ userId: u.id, accountId: u.accountId });
                        }}
                        onTogglePlatformAdmin={() => {
                          const isAdmin = u.roles.includes("admin");
                          if (!isAdmin && !confirm("⚠️ Tem certeza que deseja dar acesso de Super Admin?")) return;
                          platformAdminMut.mutate({ userId: u.id, makeAdmin: !isAdmin });
                        }}
                        onDelete={() => {
                          if (confirm(`Remover ${u.displayName}? Esta ação é permanente.`))
                            deleteMut.mutate(u.id);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0B3A5D]">Novo Usuário</h2>
            <p className="text-xs text-slate-500">O usuário receberá acesso imediato ao sistema.</p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1">Nome completo *</label>
                <input className="w-full h-10 px-3 rounded-lg border bg-white text-sm" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="João Silva" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Email *</label>
                <input type="email" className="w-full h-10 px-3 rounded-lg border bg-white text-sm" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="joao@empresa.com" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Senha *</label>
                <input type="password" className="w-full h-10 px-3 rounded-lg border bg-white text-sm" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Organização</label>
                <select className="w-full h-10 px-3 rounded-lg border bg-white text-sm" value={formAccountId} onChange={(e) => setFormAccountId(e.target.value)}>
                  <option value="">Sem organização</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {formAccountId && (
                <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsOrgAdmin}
                    onChange={(e) => setFormIsOrgAdmin(e.target.checked)}
                    className="rounded"
                  />
                  <div>
                    <span className="text-sm font-medium">Admin da Organização</span>
                    <p className="text-[10px] text-slate-500">Poderá gerenciar equipes e membros dentro da org</p>
                  </div>
                </label>
              )}

              <div>
                <label className="text-xs font-medium block mb-1">Papel na plataforma</label>
                <select className="w-full h-10 px-3 rounded-lg border bg-white text-sm" value={formRole} onChange={(e) => setFormRole(e.target.value as any)}>
                  <option value="agente">Agente</option>
                  <option value="admin">Super Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreateOpen(false)} className="h-9 px-4 rounded-lg border text-sm hover:bg-slate-50">Cancelar</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !formEmail || !formPassword || !formName}
                className="h-9 px-4 rounded-lg bg-[#2FAE7C] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Criar Usuário
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordOpen && passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white border shadow-2xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0B3A5D]">Alterar Senha</h2>
            <p className="text-xs text-slate-500">Definir nova senha para <strong>{passwordTarget.name}</strong></p>

            <div>
              <label className="text-xs font-medium block mb-1">Nova senha *</label>
              <input type="password" className="w-full h-10 px-3 rounded-lg border bg-white text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Digite a nova senha" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPasswordOpen(false)} className="h-9 px-4 rounded-lg border text-sm hover:bg-slate-50">Cancelar</button>
              <button
                onClick={() => passwordMut.mutate()}
                disabled={passwordMut.isPending || !newPassword}
                className="h-9 px-4 rounded-lg bg-[#2FAE7C] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {passwordMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Alterar Senha
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}

// ─── Dropdown actions per user ───
function UserActions({
  user,
  accounts,
  onChangePassword,
  onAssignAccount,
  onPromoteOrgAdmin,
  onTogglePlatformAdmin,
  onDelete,
}: {
  user: UserRow;
  accounts: AccountOption[];
  onChangePassword: () => void;
  onAssignAccount: (accountId: string | null) => void;
  onPromoteOrgAdmin: () => void;
  onTogglePlatformAdmin: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isAdmin = user.roles.includes("admin");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-8 w-8 rounded border hover:bg-slate-50 grid place-items-center"
      >
        <MoreHorizontal className="h-4 w-4 text-slate-500" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-50 w-56 rounded-lg bg-white border shadow-lg py-1 max-h-80 overflow-y-auto">
            <button onClick={() => { onChangePassword(); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50">
              <KeyRound className="h-4 w-4" /> Alterar senha
            </button>

            <div className="border-t my-1" />

            {/* Assign to org */}
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => { onAssignAccount(a.id); setOpen(false); }}
                disabled={user.accountId === a.id}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50 disabled:opacity-40"
              >
                <Building2 className="h-4 w-4" /> Vincular a {a.name}
              </button>
            ))}

            {user.accountId && (
              <button onClick={() => { onAssignAccount(null); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50 text-orange-600">
                <Building2 className="h-4 w-4" /> Remover organização
              </button>
            )}

            <div className="border-t my-1" />

            {/* Org admin */}
            {user.accountId && user.orgRole !== "owner" && user.orgRole !== "org_admin" && (
              <button onClick={() => { onPromoteOrgAdmin(); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50">
                <UserCog className="h-4 w-4" /> Tornar Admin da Org
              </button>
            )}

            {/* Platform admin */}
            <button
              onClick={() => { onTogglePlatformAdmin(); setOpen(false); }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50 ${!isAdmin ? "text-red-600" : ""}`}
            >
              <Shield className="h-4 w-4" />
              {isAdmin ? "Remover Super Admin" : "Super Admin (⚠️)"}
            </button>

            <div className="border-t my-1" />

            <button onClick={() => { onDelete(); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-slate-50 text-red-600">
              <Trash2 className="h-4 w-4" /> Excluir usuário
            </button>
          </div>
        </>
      )}
    </div>
  );
}
