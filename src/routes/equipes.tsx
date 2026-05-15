import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAgents } from "@/lib/data";
import {
  Plus,
  Pencil,
  Trash2,
  Users as UsersIcon,
  X,
  ChevronLeft,
  Search,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/equipes")({ component: EquipesPage });

const ROLES = [
  { value: "coordenador", label: "Coordenador", color: "#8B5CF6" },
  { value: "gerente", label: "Gerente", color: "#0B3A5D" },
  { value: "secretario", label: "Secretário", color: "#06B6D4" },
  { value: "agente", label: "Agente", color: "#2FAE7C" },
  { value: "administrador", label: "Administrador", color: "#EF4444" },
  { value: "financeiro", label: "Financeiro", color: "#F2C94C" },
  { value: "corretor", label: "Corretor", color: "#F97316" },
  { value: "corretora", label: "Corretora", color: "#F97316" },
  { value: "marketing", label: "Marketing", color: "#EC4899" },
] as const;

type RoleValue = typeof ROLES[number]["value"];

function roleMeta(v: string) {
  return ROLES.find((r) => r.value === v) ?? { label: v, color: "#64748B" };
}

interface TeamRow {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  auto_assign: boolean;
  allow_self_assign: boolean;
}

interface MemberRow {
  id: string;
  team_id: string;
  user_id: string;
  role: RoleValue;
}

// ---------- Hooks ----------
function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("teams")
        .select("id, name, description, active, auto_assign, allow_self_assign")
        .order("name");
      if (error) throw error;
      return (data ?? []) as TeamRow[];
    },
  });
}

function useTeamMembers() {
  return useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("team_members")
        .select("id, team_id, user_id, role");
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });
}

function useTeamConvCounts() {
  return useQuery({
    queryKey: ["team_conv_counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await (supabase as any)
        .from("conversations")
        .select("team_id");
      if (error) throw error;
      const out: Record<string, number> = {};
      for (const r of (data ?? []) as { team_id: string | null }[]) {
        if (r.team_id) out[r.team_id] = (out[r.team_id] ?? 0) + 1;
      }
      return out;
    },
  });
}

// ---------- Page ----------
function EquipesPage() {
  const { data: teams = [], isLoading } = useTeams();
  const { data: members = [] } = useTeamMembers();
  const { data: agents = [] } = useAgents();
  const { data: counts = {} } = useTeamConvCounts();
  const qc = useQueryClient();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<TeamRow | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      qc.invalidateQueries({ queryKey: ["team_conv_counts"] });
      toast.success("Equipe excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const agentMap = useMemo(() => {
    const m = new Map(agents.map((a) => [a.user_id, a]));
    return m;
  }, [agents]);

  if (detailsId) {
    return (
      <TeamDetails
        teamId={detailsId}
        onBack={() => setDetailsId(null)}
        onEdit={(t) => {
          setEditing(t);
          setWizardOpen(true);
        }}
      />
    );
  }

  return (
    <AppLayout title="Equipes">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "#0B3A5D" }}>
              Equipes
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Organize seus agentes em equipes para distribuir conversas.
            </p>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setWizardOpen(true);
            }}
            className="h-10 px-4 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:opacity-95"
            style={{ background: "#2FAE7C" }}
          >
            <Plus className="h-4 w-4" /> Nova Equipe
          </button>
        </div>

        {isLoading ? (
          <div className="bg-card rounded-xl border p-8 text-center text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : teams.length === 0 ? (
          <EmptyState onCreate={() => setWizardOpen(true)} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teams.map((t) => {
              const tm = members.filter((m) => m.team_id === t.id);
              return (
                <div
                  key={t.id}
                  className="bg-card rounded-xl border p-5 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setDetailsId(t.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate" style={{ color: "#0B3A5D" }}>
                          {t.name}
                        </h3>
                        {t.active ? (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: "#2FAE7C20", color: "#2FAE7C" }}
                          >
                            Ativa
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                            Inativa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 min-h-[2rem]">
                        {t.description || "Sem descrição"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <AvatarStack
                      members={tm.map((m) => agentMap.get(m.user_id)).filter(Boolean) as { display_name: string; avatar_initials: string | null }[]}
                    />
                    <div className="text-xs text-muted-foreground">
                      <div>
                        <strong className="text-foreground">{tm.length}</strong> membros
                      </div>
                      <div>
                        <strong className="text-foreground">{counts[t.id] ?? 0}</strong> conversas
                      </div>
                    </div>
                  </div>

                  <div
                    className="mt-4 flex items-center justify-end gap-1 pt-3 border-t"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setEditing(t);
                        setWizardOpen(true);
                      }}
                      className="h-8 px-3 rounded-lg text-xs font-medium hover:bg-background border flex items-center gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Excluir equipe "${t.name}"?`)) deleteMutation.mutate(t.id);
                      }}
                      className="h-8 px-3 rounded-lg text-xs font-medium hover:bg-destructive/10 text-destructive border flex items-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {wizardOpen && (
        <TeamWizard
          initial={editing}
          existingMembers={editing ? members.filter((m) => m.team_id === editing.id) : []}
          onClose={() => {
            setWizardOpen(false);
            setEditing(null);
          }}
        />
      )}
    </AppLayout>
  );
}

// ---------- Avatar stack ----------
function AvatarStack({
  members,
}: {
  members: { display_name: string; avatar_initials: string | null }[];
}) {
  const visible = members.slice(0, 5);
  const extra = members.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((m, i) => (
        <div
          key={i}
          className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold text-white ring-2 ring-card"
          style={{ background: "#0B3A5D" }}
          title={m.display_name}
        >
          {m.avatar_initials ?? m.display_name.slice(0, 2).toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div
          className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold ring-2 ring-card bg-muted text-foreground"
        >
          +{extra}
        </div>
      )}
      {members.length === 0 && (
        <div className="h-8 px-3 rounded-full grid place-items-center text-[10px] text-muted-foreground bg-muted">
          Sem membros
        </div>
      )}
    </div>
  );
}

// ---------- Empty state ----------
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-card rounded-xl border p-12 text-center">
      <div
        className="h-16 w-16 rounded-full mx-auto grid place-items-center mb-4"
        style={{ background: "#2FAE7C15" }}
      >
        <UsersIcon className="h-8 w-8" style={{ color: "#2FAE7C" }} />
      </div>
      <div className="font-semibold" style={{ color: "#0B3A5D" }}>
        Nenhuma equipe criada
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Organize seus agentes em equipes para melhor produtividade
      </p>
      <button
        onClick={onCreate}
        className="mt-5 h-10 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2"
        style={{ background: "#2FAE7C" }}
      >
        <Plus className="h-4 w-4" /> Criar primeira equipe
      </button>
    </div>
  );
}

// ---------- Wizard ----------
type SelectedMember = { user_id: string; role: RoleValue };

function TeamWizard({
  initial,
  existingMembers,
  onClose,
}: {
  initial: TeamRow | null;
  existingMembers: MemberRow[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: agents = [] } = useAgents();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [autoAssign, setAutoAssign] = useState(initial?.auto_assign ?? false);
  const [allowSelf, setAllowSelf] = useState(initial?.allow_self_assign ?? true);
  const [active, setActive] = useState(initial?.active ?? true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedMember[]>(
    existingMembers.map((m) => ({ user_id: m.user_id, role: m.role }))
  );

  const filteredAgents = useMemo(() => {
    const q = search.toLowerCase();
    return agents.filter((a) =>
      a.display_name.toLowerCase().includes(q)
    );
  }, [agents, search]);

  const toggle = (userId: string) => {
    setSelected((s) =>
      s.find((x) => x.user_id === userId)
        ? s.filter((x) => x.user_id !== userId)
        : [...s, { user_id: userId, role: "agente" }]
    );
  };
  const setRole = (userId: string, role: RoleValue) => {
    setSelected((s) => s.map((x) => (x.user_id === userId ? { ...x, role } : x)));
  };
  const remove = (userId: string) =>
    setSelected((s) => s.filter((x) => x.user_id !== userId));

  const saveMutation = useMutation({
    mutationFn: async () => {
      let teamId = initial?.id;
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        auto_assign: autoAssign,
        allow_self_assign: allowSelf,
        active,
      };
      if (teamId) {
        const { error } = await (supabase as any).from("teams").update(payload).eq("id", teamId);
        if (error) throw error;
        // reset members
        const { error: delErr } = await (supabase as any)
          .from("team_members")
          .delete()
          .eq("team_id", teamId);
        if (delErr) throw delErr;
      } else {
        const { data, error } = await (supabase as any)
          .from("teams")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        teamId = (data as { id: string }).id;
      }
      if (selected.length) {
        const rows = selected.map((s) => ({
          team_id: teamId,
          user_id: s.user_id,
          role: s.role,
        }));
        const { error } = await (supabase as any).from("team_members").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["teams"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success(initial ? "Equipe atualizada" : "Equipe criada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const next = () => {
    if (step === 1) {
      if (!name.trim()) {
        toast.error("Informe um nome");
        return;
      }
    }
    setStep((s) => Math.min(3, s + 1));
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-card w-full max-w-2xl rounded-xl shadow-xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-semibold" style={{ color: "#0B3A5D" }}>
              {initial ? "Editar equipe" : "Nova equipe"}
            </h3>
            <Stepper step={step} />
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg grid place-items-center hover:bg-background text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {step === 1 && (
            <>
              <label className="block">
                <span className="text-xs font-medium">Nome da equipe</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Vendas"
                  className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium">Descrição</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
                />
              </label>
              <ToggleRow
                title="Atribuição automática"
                desc="Distribuir novas conversas entre os membros automaticamente"
                checked={autoAssign}
                onChange={setAutoAssign}
              />
              <ToggleRow
                title="Permitir auto-atribuição"
                desc="Agentes podem pegar conversas livres da equipe"
                checked={allowSelf}
                onChange={setAllowSelf}
              />
              <ToggleRow
                title="Equipe ativa"
                desc="Desative para pausar a equipe sem excluir"
                checked={active}
                onChange={setActive}
              />
            </>
          )}

          {step === 2 && (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar agente…"
                    className="w-full h-10 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
                  />
                </div>
                <div className="mt-3 border rounded-lg overflow-y-auto max-h-80">
                  {filteredAgents.length === 0 && (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      Nenhum agente
                    </div>
                  )}
                  {filteredAgents.map((a) => {
                    const isSel = !!selected.find((s) => s.user_id === a.user_id);
                    return (
                      <label
                        key={a.user_id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-background cursor-pointer border-b last:border-0"
                      >
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggle(a.user_id)}
                          className="h-4 w-4 accent-[#2FAE7C]"
                        />
                        <div className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: "#0B3A5D" }}>
                          {a.avatar_initials ?? a.display_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{a.display_name}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-xs font-medium mb-2">
                  Membros selecionados ({selected.length})
                </div>
                <div className="border rounded-lg overflow-y-auto max-h-[22rem]">
                  {selected.length === 0 && (
                    <div className="p-4 text-xs text-muted-foreground text-center">
                      Nenhum selecionado
                    </div>
                  )}
                  {selected.map((s) => {
                    const a = agents.find((x) => x.user_id === s.user_id);
                    if (!a) return null;
                    return (
                      <div
                        key={s.user_id}
                        className="flex items-center gap-2 px-3 py-2 border-b last:border-0"
                      >
                        <div className="h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: "#0B3A5D" }}>
                          {a.avatar_initials ?? a.display_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{a.display_name}</div>
                        </div>
                        <select
                          value={s.role}
                          onChange={(e) => setRole(s.user_id, e.target.value as RoleValue)}
                          className="h-8 px-2 rounded border text-xs bg-background"
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => remove(s.user_id)}
                          className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/10 text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Equipe
                </div>
                <div className="font-semibold" style={{ color: "#0B3A5D" }}>
                  {name}
                </div>
                {description && (
                  <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {autoAssign && (
                    <Pill icon={<CheckCircle2 className="h-3 w-3" />} label="Atribuição automática" />
                  )}
                  {allowSelf && (
                    <Pill icon={<CheckCircle2 className="h-3 w-3" />} label="Auto-atribuição permitida" />
                  )}
                  <Pill
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    label={active ? "Ativa" : "Inativa"}
                  />
                </div>
              </div>

              <div className="rounded-lg border">
                <div className="px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground border-b">
                  Membros ({selected.length})
                </div>
                {selected.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">
                    Nenhum membro
                  </div>
                ) : (
                  selected.map((s) => {
                    const a = agents.find((x) => x.user_id === s.user_id);
                    const r = roleMeta(s.role);
                    return (
                      <div
                        key={s.user_id}
                        className="flex items-center gap-3 px-4 py-2 border-b last:border-0"
                      >
                        <div className="h-7 w-7 rounded-full grid place-items-center text-[10px] font-bold text-white" style={{ background: "#0B3A5D" }}>
                          {a?.avatar_initials ?? a?.display_name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="text-sm flex-1">{a?.display_name}</div>
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
                          style={{ background: r.color }}
                        >
                          {r.label}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t bg-background/50">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="h-10 px-4 rounded-lg text-sm font-semibold border hover:bg-background flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <button
              onClick={next}
              className="h-10 px-5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#2FAE7C" }}
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="h-10 px-5 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "#2FAE7C" }}
            >
              {saveMutation.isPending ? "Salvando…" : initial ? "Salvar Equipe" : "Criar Equipe"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Informações", "Membros", "Confirmação"];
  return (
    <div className="flex items-center gap-2 mt-2">
      {labels.map((l, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div key={l} className="flex items-center gap-2">
            <div
              className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${
                done || active ? "text-white" : "text-muted-foreground bg-muted"
              }`}
              style={done || active ? { background: "#2FAE7C" } : undefined}
            >
              {n}
            </div>
            <span className={`text-xs ${active ? "font-semibold" : "text-muted-foreground"}`}>
              {l}
            </span>
            {n < 3 && <div className="w-6 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between p-3 rounded-lg bg-background border cursor-pointer">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-[#2FAE7C]"
      />
    </label>
  );
}

function Pill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: "#2FAE7C15", color: "#2FAE7C" }}
    >
      {icon} {label}
    </span>
  );
}

// ---------- Details ----------
function TeamDetails({
  teamId,
  onBack,
  onEdit,
}: {
  teamId: string;
  onBack: () => void;
  onEdit: (t: TeamRow) => void;
}) {
  const { data: teams = [] } = useTeams();
  const { data: members = [] } = useTeamMembers();
  const { data: agents = [] } = useAgents();
  const { data: counts = {} } = useTeamConvCounts();

  const team = teams.find((t) => t.id === teamId);
  const tm = members.filter((m) => m.team_id === teamId);

  if (!team) {
    return (
      <AppLayout title="Equipe">
        <div className="text-sm text-muted-foreground">Equipe não encontrada.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={team.name}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="h-9 px-3 rounded-lg text-sm font-medium border hover:bg-background flex items-center gap-1.5"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(team)}
              className="h-9 px-4 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#2FAE7C" }}
            >
              Editar
            </button>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-semibold" style={{ color: "#0B3A5D" }}>
            {team.name}
          </h2>
          {team.description && (
            <p className="text-sm text-muted-foreground mt-1">{team.description}</p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <MetricCard label="Conversas atribuídas" value={counts[team.id] ?? 0} accent="#2FAE7C" />
          <MetricCard label="Tempo médio de resposta" value="—" accent="#0B3A5D" />
          <MetricCard label="Resolvidas hoje" value="—" accent="#F2C94C" />
        </div>

        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-5 py-3 border-b font-semibold text-sm" style={{ color: "#0B3A5D" }}>
            Membros
          </div>
          {tm.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhum membro nesta equipe
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Membro</th>
                  <th className="text-left px-5 py-3">Cargo</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {tm.map((m) => {
                  const a = agents.find((x) => x.user_id === m.user_id);
                  const r = roleMeta(m.role);
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="h-8 w-8 rounded-full grid place-items-center text-[10px] font-bold text-white"
                            style={{ background: "#0B3A5D" }}
                          >
                            {a?.avatar_initials ?? a?.display_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="font-medium">{a?.display_name ?? "—"}</div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-semibold text-white"
                          style={{ background: r.color }}
                        >
                          {r.label}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-2 text-xs">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: a?.online ? "#2FAE7C" : "#94A3B8" }}
                          />
                          {a?.online ? "Online" : "Offline"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
