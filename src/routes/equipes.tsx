import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Users, UserPlus, Shield, Edit, Trash2, Mail, ShieldCheck, Lock, Loader2, Plus,
} from "lucide-react";

export const Route = createFileRoute("/equipes")({ component: EquipesPage });

const ROLES = [
  { value: "org_admin", label: "Administrador", description: "Acesso total à organização" },
  { value: "member", label: "Agente", description: "Atendimento e conversas" },
  { value: "owner", label: "Proprietário", description: "Dono da organização" },
] as const;

type OrgRole = "owner" | "org_admin" | "member";

interface Member {
  id: string;
  user_id: string;
  role: OrgRole;
  is_active: boolean;
  profile?: { display_name: string; email: string; user_id: string };
}

function getRoleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
function getRoleBadgeClass(role: string) {
  if (role === "owner" || role === "org_admin") return "bg-brand/10 text-brand";
  return "bg-muted text-muted-foreground";
}
function getInitials(name?: string) {
  if (!name) return "U";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function EquipesPage() {
  const { accountId, user, isAdmin, organizationRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [editRole, setEditRole] = useState<OrgRole>("member");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ email: "", password: "", full_name: "", role: "member" as OrgRole });

  const canManage = isAdmin || organizationRole === "owner" || organizationRole === "org_admin";

  const fetchMembers = async () => {
    if (!accountId) { setLoading(false); return; }
    try {
      const { data: membersData } = await (supabase as any)
        .from("account_members").select("*")
        .eq("account_id", accountId).eq("is_active", true)
        .order("created_at", { ascending: true });

      if (membersData?.length > 0) {
        const userIds = membersData.map((m: any) => m.user_id);
        const { data: profiles } = await (supabase as any)
          .from("profiles").select("user_id, display_name, email")
          .in("user_id", userIds);

        setMembers(membersData.map((m: any) => ({
          ...m,
          profile: profiles?.find((p: any) => p.user_id === m.user_id),
        })));
      } else {
        setMembers([]);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchMembers(); }, [accountId]);

  // Realtime
  useEffect(() => {
    if (!accountId) return;
    const channel = supabase
      .channel("team-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "account_members", filter: `account_id=eq.${accountId}` }, () => fetchMembers())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchMembers())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [accountId]);

  const handleCreate = async () => {
    if (!form.email.trim() || !form.password.trim() || !form.full_name.trim()) {
      toast.error("Preencha todos os campos"); return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: form.email, password: form.password, full_name: form.full_name, account_id: accountId, org_role: form.role },
      });
      if (data?.error) { toast.error(data.error.includes("already") ? "Este email já está cadastrado" : data.error); return; }
      if (error) { toast.error("Erro ao criar colaborador"); return; }
      toast.success("Colaborador criado com sucesso!");
      setCreateOpen(false);
      setForm({ email: "", password: "", full_name: "", role: "member" });
      fetchMembers();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar colaborador");
    } finally { setSaving(false); }
  };

  const handleUpdateRole = async () => {
    if (!selectedMember) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("account_members").update({ role: editRole }).eq("id", selectedMember.id);
      if (error) throw error;
      toast.success("Papel atualizado");
      setEditOpen(false);
      fetchMembers();
    } catch { toast.error("Erro ao atualizar papel"); }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    if (!deleteId) return;
    try {
      const { error } = await (supabase as any).from("account_members").update({ is_active: false }).eq("id", deleteId);
      if (error) throw error;
      setMembers((prev) => prev.filter((m) => m.id !== deleteId));
      toast.success("Colaborador removido");
      setDeleteId(null);
    } catch { toast.error("Erro ao remover"); }
  };

  if (!accountId) {
    return (
      <AppLayout title="Equipe">
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Nenhuma organização vinculada.</p>
        </div>
      </AppLayout>
    );
  }

  if (!canManage) {
    return (
      <AppLayout title="Equipe">
        <div className="text-center py-12">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
          <p className="text-sm text-muted-foreground mt-2">Apenas administradores da organização podem gerenciar a equipe.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Equipe">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-brand">Equipe</h1>
            <p className="text-sm text-muted-foreground">Gerencie os colaboradores da sua empresa</p>
          </div>
          <button onClick={() => setCreateOpen(true)}
            className="h-10 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 hover:opacity-95">
            <UserPlus className="h-4 w-4" /> <span className="hidden sm:inline">Criar Colaborador</span>
          </button>
        </div>

        {/* Info card */}
        <div className="bg-muted/50 border border-dashed rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-brand mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Papéis da Organização</p>
              <p className="text-muted-foreground mt-1">
                Os papéis definidos aqui controlam o acesso dentro da sua empresa.
              </p>
            </div>
          </div>
        </div>

        {/* Members list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground mb-4">Nenhum colaborador cadastrado</p>
            <button onClick={() => setCreateOpen(true)}
              className="h-10 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Criar Primeiro Colaborador
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {members.map((m) => (
              <div key={m.id} className="bg-card border rounded-xl p-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-brand text-brand-foreground grid place-items-center text-sm font-bold shrink-0">
                    {getInitials(m.profile?.display_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {m.profile?.display_name || "Usuário"}
                      {m.user_id === user?.id && <span className="text-xs text-muted-foreground ml-2">(você)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3 shrink-0" /> {m.profile?.email || "Email não disponível"}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadgeClass(m.role)}`}>
                    <Shield className="h-3 w-3" /> {getRoleLabel(m.role)}
                  </span>
                  {m.user_id !== user?.id && (
                    <div className="flex items-center gap-1">
                      {m.role !== "owner" && (
                        <button onClick={() => { setSelectedMember(m); setEditRole(m.role); setEditOpen(true); }}
                          className="h-9 w-9 rounded-lg hover:bg-muted grid place-items-center text-muted-foreground" title="Editar papel">
                          <Edit className="h-4 w-4" />
                        </button>
                      )}
                      <button onClick={() => setDeleteId(m.id)}
                        className="h-9 w-9 rounded-lg hover:bg-destructive/10 grid place-items-center text-muted-foreground hover:text-destructive" title="Remover">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-card border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-brand">Criar Colaborador</h2>
              <p className="text-sm text-muted-foreground mt-1">Crie uma nova conta para sua empresa.</p>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-medium block mb-1">Nome Completo *</span>
                <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Nome do colaborador" className="w-full h-10 px-3 rounded-lg border bg-background text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium block mb-1">Email *</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com" className="w-full h-10 px-3 rounded-lg border bg-background text-sm" />
              </label>
              <label className="block">
                <span className="text-xs font-medium block mb-1">Senha *</span>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Senha segura" className="w-full h-10 px-3 rounded-lg border bg-background text-sm" />
                <p className="text-[10px] text-muted-foreground mt-1">Mínimo 6 caracteres</p>
              </label>
              <label className="block">
                <span className="text-xs font-medium block mb-1">Papel na Organização *</span>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as OrgRole })}
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                  {ROLES.filter((r) => r.value !== "owner").map((r) => (
                    <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setCreateOpen(false)} className="h-9 px-4 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleCreate} disabled={saving}
                className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar Colaborador
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit role modal */}
      {editOpen && selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditOpen(false)}>
          <div className="w-full max-w-sm rounded-xl bg-card border shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h2 className="text-lg font-semibold text-brand">Alterar Papel</h2>
              <p className="text-sm text-muted-foreground">Alterar papel de {selectedMember.profile?.display_name}</p>
            </div>
            <label className="block">
              <span className="text-xs font-medium block mb-1">Novo Papel</span>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value as OrgRole)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                {ROLES.filter((r) => r.value !== "owner").map((r) => (
                  <option key={r.value} value={r.value}>{r.label} — {r.description}</option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditOpen(false)} className="h-9 px-4 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleUpdateRole} disabled={saving}
                className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteId(null)}>
          <div className="w-full max-w-sm rounded-xl bg-card border shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-brand">Remover Colaborador</h2>
            <p className="text-sm text-muted-foreground">Tem certeza? O colaborador perderá acesso ao sistema da sua empresa.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setDeleteId(null)} className="h-9 px-4 rounded-lg border text-sm hover:bg-muted">Cancelar</button>
              <button onClick={handleRemove}
                className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold">Remover</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
