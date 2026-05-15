import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Plus,
  Shield,
  Pencil,
  Copy,
  Trash2,
  ChevronDown,
  MessageSquare,
  Users,
  Tag,
  UsersRound,
  Zap,
  BarChart3,
  ScrollText,
  Timer,
  Megaphone,
  Inbox,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/funcoes-permissoes")({ component: Page });

type PermDef = { key: string; label: string };
type ModuleDef = { id: string; label: string; icon: React.ComponentType<{ className?: string }>; perms: PermDef[] };

const MODULES: ModuleDef[] = [
  {
    id: "conversas",
    label: "Conversas",
    icon: MessageSquare,
    perms: [
      { key: "view_all", label: "Ver todas as conversas" },
      { key: "view_assigned", label: "Ver apenas atribuídas" },
      { key: "view_team", label: "Ver apenas da equipe" },
      { key: "reply", label: "Responder conversas" },
      { key: "assign", label: "Atribuir conversas" },
      { key: "transfer", label: "Transferir conversas" },
      { key: "resolve", label: "Resolver conversas" },
      { key: "reopen", label: "Reabrir conversas" },
      { key: "delete", label: "Excluir conversas" },
      { key: "export", label: "Exportar conversas" },
    ],
  },
  {
    id: "contatos",
    label: "Contatos",
    icon: Users,
    perms: [
      { key: "view", label: "Ver contatos" },
      { key: "create", label: "Criar contatos" },
      { key: "edit", label: "Editar contatos" },
      { key: "delete", label: "Excluir contatos" },
      { key: "export", label: "Exportar contatos" },
    ],
  },
  {
    id: "etiquetas",
    label: "Etiquetas",
    icon: Tag,
    perms: [
      { key: "view", label: "Ver etiquetas" },
      { key: "create", label: "Criar etiquetas" },
      { key: "edit", label: "Editar etiquetas" },
      { key: "delete", label: "Excluir etiquetas" },
      { key: "apply", label: "Aplicar etiquetas em conversas" },
    ],
  },
  {
    id: "equipes",
    label: "Equipes",
    icon: UsersRound,
    perms: [
      { key: "view", label: "Ver equipes" },
      { key: "create", label: "Criar equipes" },
      { key: "edit", label: "Editar equipes" },
      { key: "delete", label: "Excluir equipes" },
      { key: "manage_members", label: "Gerenciar membros" },
    ],
  },
  {
    id: "automacoes",
    label: "Automações",
    icon: Zap,
    perms: [
      { key: "view", label: "Ver automações" },
      { key: "create", label: "Criar automações" },
      { key: "edit", label: "Editar automações" },
      { key: "toggle", label: "Ativar/desativar automações" },
      { key: "delete", label: "Excluir automações" },
    ],
  },
  {
    id: "relatorios",
    label: "Relatórios",
    icon: BarChart3,
    perms: [
      { key: "own", label: "Ver relatórios próprios" },
      { key: "team", label: "Ver relatórios da equipe" },
      { key: "global", label: "Ver relatórios globais" },
      { key: "export", label: "Exportar relatórios" },
    ],
  },
  {
    id: "auditoria",
    label: "Auditoria",
    icon: ScrollText,
    perms: [
      { key: "view", label: "Ver logs de auditoria" },
      { key: "export", label: "Exportar logs" },
    ],
  },
  {
    id: "sla",
    label: "SLA",
    icon: Timer,
    perms: [
      { key: "view", label: "Ver métricas SLA" },
      { key: "configure", label: "Configurar regras SLA" },
    ],
  },
  {
    id: "campanhas",
    label: "Campanhas",
    icon: Megaphone,
    perms: [
      { key: "view", label: "Ver campanhas" },
      { key: "create", label: "Criar campanhas" },
      { key: "edit", label: "Editar campanhas" },
      { key: "execute", label: "Executar campanhas" },
      { key: "delete", label: "Excluir campanhas" },
    ],
  },
  {
    id: "caixas",
    label: "Caixas de Entrada",
    icon: Inbox,
    perms: [
      { key: "view_all", label: "Ver todas as caixas" },
      { key: "create", label: "Criar caixas" },
      { key: "edit", label: "Editar caixas" },
      { key: "delete", label: "Excluir caixas" },
    ],
  },
  {
    id: "configuracoes",
    label: "Configurações",
    icon: SettingsIcon,
    perms: [
      { key: "view", label: "Ver configurações" },
      { key: "edit", label: "Editar configurações" },
      { key: "manage_agents", label: "Gerenciar agentes" },
      { key: "manage_roles", label: "Gerenciar funções" },
    ],
  },
];

type Permissions = Record<string, Record<string, boolean>>;
type Role = {
  id: string;
  name: string;
  description: string;
  system: boolean;
  users: number;
  createdAt: string;
  permissions: Permissions;
  badgeColor: string;
};

function emptyPerms(): Permissions {
  const p: Permissions = {};
  MODULES.forEach((m) => {
    p[m.id] = {};
    m.perms.forEach((pp) => (p[m.id][pp.key] = false));
  });
  return p;
}
function fullPerms(): Permissions {
  const p = emptyPerms();
  Object.keys(p).forEach((k) => Object.keys(p[k]).forEach((kk) => (p[k][kk] = true)));
  return p;
}
function adminPerms(): Permissions {
  return fullPerms();
}
function agentePerms(): Permissions {
  const p = emptyPerms();
  p.conversas = { ...p.conversas, view_assigned: true, reply: true, resolve: true, reopen: true };
  p.contatos = { ...p.contatos, view: true, create: true, edit: true };
  p.etiquetas = { ...p.etiquetas, view: true, apply: true };
  return p;
}

const SYSTEM_ROLES: Role[] = [
  { id: "sys-super", name: "Super Admin", description: "Acesso total à plataforma e ao Super Admin Console.", system: true, users: 1, createdAt: "—", permissions: fullPerms(), badgeColor: "#0B3A5D" },
  { id: "sys-admin", name: "Administrador", description: "Acesso a tudo, exceto Super Admin Console.", system: true, users: 3, createdAt: "—", permissions: adminPerms(), badgeColor: "#2FAE7C" },
  { id: "sys-agente", name: "Agente", description: "Acesso a conversas atribuídas e contatos.", system: true, users: 12, createdAt: "—", permissions: agentePerms(), badgeColor: "#F2C94C" },
];

const STORAGE_KEY = "ias.custom-roles.v1";

function loadCustom(): Role[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Role[]) : [];
  } catch {
    return [];
  }
}
function saveCustom(roles: Role[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(roles));
}

function Page() {
  const [custom, setCustom] = useState<Role[]>([]);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; role?: Role } | null>(null);

  useEffect(() => {
    setCustom(loadCustom());
  }, []);

  const persist = (next: Role[]) => {
    setCustom(next);
    saveCustom(next);
  };

  const onCreate = () => setModal({ mode: "create" });
  const onEdit = (r: Role) => setModal({ mode: "edit", role: r });
  const onDuplicate = (r: Role) => {
    const dup: Role = { ...r, id: crypto.randomUUID(), name: `${r.name} (cópia)`, system: false, users: 0, createdAt: new Date().toISOString(), permissions: JSON.parse(JSON.stringify(r.permissions)) };
    persist([...custom, dup]);
    toast.success("Função duplicada");
  };
  const onDelete = (r: Role) => {
    if (!confirm(`Excluir função "${r.name}"?`)) return;
    persist(custom.filter((x) => x.id !== r.id));
    toast.success("Função excluída");
  };

  const onSave = (data: Omit<Role, "id" | "system" | "users" | "createdAt" | "badgeColor">) => {
    if (modal?.mode === "edit" && modal.role) {
      persist(custom.map((r) => (r.id === modal.role!.id ? { ...r, ...data } : r)));
      toast.success("Função atualizada");
    } else {
      const role: Role = {
        ...data,
        id: crypto.randomUUID(),
        system: false,
        users: 0,
        createdAt: new Date().toISOString(),
        badgeColor: "#2FAE7C",
      };
      persist([...custom, role]);
      toast.success("Função criada");
    }
    setModal(null);
  };

  return (
    <AppLayout
      title="Funções e Permissões"
      actions={
        <button onClick={onCreate} className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 hover:opacity-95">
          <Plus className="h-4 w-4" /> Nova Função
        </button>
      }
    >
      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Funções padrão</h3>
          <div className="grid md:grid-cols-3 gap-4">
            {SYSTEM_ROLES.map((r) => (
              <RoleCard key={r.id} role={r} />
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Funções personalizadas</h3>
          {custom.length === 0 ? (
            <div className="bg-card border rounded-xl p-10 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-success/15 text-success grid place-items-center mb-3">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h4 className="font-semibold text-brand">Apenas funções padrão ativas</h4>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Crie funções personalizadas para controlar o que cada membro pode acessar.
              </p>
              <button onClick={onCreate} className="mt-4 h-10 px-5 rounded-lg bg-success text-success-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95">
                <Plus className="h-4 w-4" /> Criar primeira função
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-4">
              {custom.map((r) => (
                <RoleCard key={r.id} role={r} onEdit={() => onEdit(r)} onDuplicate={() => onDuplicate(r)} onDelete={() => onDelete(r)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {modal && <RoleModal mode={modal.mode} initial={modal.role} onClose={() => setModal(null)} onSave={onSave} />}
    </AppLayout>
  );
}

function RoleCard({
  role,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  role: Role;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const total = MODULES.reduce((acc, m) => acc + m.perms.length, 0);
  const active = MODULES.reduce((acc, m) => acc + m.perms.filter((p) => role.permissions[m.id]?.[p.key]).length, 0);
  return (
    <div className="bg-card border rounded-xl p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg grid place-items-center" style={{ background: `${role.badgeColor}22`, color: role.badgeColor }}>
            <Shield className="h-4 w-4" />
          </div>
          <h4 className="font-semibold text-brand">{role.name}</h4>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${role.system ? "bg-brand text-brand-foreground" : "bg-warning text-foreground"}`}>
          {role.system ? "PADRÃO" : "PERSONALIZADA"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">{role.description}</p>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div className="bg-background rounded-lg p-2">
          <div className="text-sm font-bold text-brand">{role.users}</div>
          <div className="text-[10px] text-muted-foreground">usuários</div>
        </div>
        <div className="bg-background rounded-lg p-2">
          <div className="text-sm font-bold text-success">{active}/{total}</div>
          <div className="text-[10px] text-muted-foreground">permissões</div>
        </div>
        <div className="bg-background rounded-lg p-2">
          <div className="text-sm font-bold text-foreground">
            {role.system ? "—" : new Date(role.createdAt).toLocaleDateString("pt-BR")}
          </div>
          <div className="text-[10px] text-muted-foreground">criada</div>
        </div>
      </div>
      {!role.system && (
        <div className="flex items-center gap-1 mt-4 pt-4 border-t">
          <button onClick={onEdit} className="flex-1 h-8 rounded-lg text-xs font-medium hover:bg-background flex items-center justify-center gap-1 text-foreground">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button onClick={onDuplicate} className="flex-1 h-8 rounded-lg text-xs font-medium hover:bg-background flex items-center justify-center gap-1 text-foreground">
            <Copy className="h-3.5 w-3.5" /> Duplicar
          </button>
          <button onClick={onDelete} className="flex-1 h-8 rounded-lg text-xs font-medium hover:bg-destructive/10 hover:text-destructive flex items-center justify-center gap-1 text-muted-foreground">
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function RoleModal({
  mode,
  initial,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: Role;
  onClose: () => void;
  onSave: (data: { name: string; description: string; permissions: Permissions }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [perms, setPerms] = useState<Permissions>(initial?.permissions ?? emptyPerms());
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(MODULES.map((m) => [m.id, false])));

  const toggleModule = (id: string, on: boolean) => {
    setPerms((prev) => {
      const next = { ...prev, [id]: { ...prev[id] } };
      MODULES.find((m) => m.id === id)!.perms.forEach((p) => (next[id][p.key] = on));
      return next;
    });
  };
  const togglePerm = (mid: string, key: string) => {
    setPerms((prev) => ({ ...prev, [mid]: { ...prev[mid], [key]: !prev[mid]?.[key] } }));
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Informe o nome da função");
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), permissions: perms });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold text-brand">{mode === "edit" ? "Editar Função" : "Nova Função"}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Defina nome, descrição e permissões granulares por módulo.</p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium">Nome da função</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Supervisor de Vendas"
                className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium">Descrição</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descrição"
                className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              />
            </label>
          </div>

          <div className="space-y-2">
            {MODULES.map((m) => (
              <ModuleAccordion
                key={m.id}
                module={m}
                perms={perms[m.id] ?? {}}
                open={!!open[m.id]}
                onOpenChange={(v) => setOpen((p) => ({ ...p, [m.id]: v }))}
                onToggleAll={(on) => toggleModule(m.id, on)}
                onTogglePerm={(k) => togglePerm(m.id, k)}
              />
            ))}
          </div>
        </div>

        <div className="p-5 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border text-sm font-medium hover:bg-background">
            Cancelar
          </button>
          <button onClick={handleSave} className="h-10 px-5 rounded-lg bg-success text-success-foreground text-sm font-semibold hover:opacity-95">
            {mode === "edit" ? "Salvar Alterações" : "Criar Função"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleAccordion({
  module: m,
  perms,
  open,
  onOpenChange,
  onToggleAll,
  onTogglePerm,
}: {
  module: ModuleDef;
  perms: Record<string, boolean>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onToggleAll: (on: boolean) => void;
  onTogglePerm: (key: string) => void;
}) {
  const Icon = m.icon;
  const active = useMemo(() => m.perms.filter((p) => perms[p.key]).length, [m.perms, perms]);
  const total = m.perms.length;
  const allOn = active === total;

  return (
    <div className="border rounded-xl bg-background overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <button onClick={() => onOpenChange(!open)} className="flex items-center gap-2 flex-1 text-left">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
          <div className="h-8 w-8 rounded-lg bg-success/15 text-success grid place-items-center">
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-foreground">{m.label}</div>
            <div className="text-[11px] text-muted-foreground">
              {active} de {total} permissões ativas
            </div>
          </div>
        </button>
        <Toggle checked={allOn} onChange={() => onToggleAll(!allOn)} />
      </div>
      {open && (
        <div className="border-t bg-card px-4 py-3 space-y-2 pl-12">
          {m.perms.map((p) => (
            <label key={p.key} className="flex items-center justify-between gap-3 py-1">
              <span className="text-sm text-foreground">{p.label}</span>
              <Toggle checked={!!perms[p.key]} onChange={() => onTogglePerm(p.key)} />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-success" : "bg-muted-foreground/30"}`}
      aria-pressed={checked}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}
