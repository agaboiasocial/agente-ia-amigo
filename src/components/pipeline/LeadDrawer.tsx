import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { normalizeContactPhone } from "@/lib/data";
import type { PipelineLead, PipelineStage, LeadNote, LeadTask, LeadMovement } from "@/types/pipeline";
import { toast } from "sonner";
import {
  X, Save, StickyNote, ListChecks, History, User, Phone, Mail,
  DollarSign, Tag, CheckCircle2, Circle, Plus, ArrowRight,
} from "lucide-react";

const sb = supabase as any;

interface Props {
  lead: PipelineLead | null;
  stages: PipelineStage[];
  onClose: () => void;
  onMoveToStage: (leadId: string, stageId: string) => void;
}

export function LeadDrawer({ lead, stages, onClose, onMoveToStage }: Props) {
  const [tab, setTab] = useState<"details" | "notes" | "tasks" | "history">("details");

  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="flex-1" onClick={onClose} />
      <aside className="w-full max-w-lg bg-card border-l shadow-2xl flex flex-col animate-in slide-in-from-right">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-brand truncate">{lead.name}</h2>
            <p className="text-xs text-muted-foreground">{lead.phone ?? lead.email ?? "Sem contato"}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-background grid place-items-center shrink-0">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex border-b">
          {(["details", "notes", "tasks", "history"] as const).map((t) => {
            const icons = { details: User, notes: StickyNote, tasks: ListChecks, history: History };
            const labels = { details: "Detalhes", notes: "Notas", tasks: "Tarefas", history: "Histórico" };
            const Icon = icons[t];
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                  tab === t ? "border-success text-success" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" /> {labels[t]}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-auto">
          {tab === "details" && <DetailsTab lead={lead} stages={stages} onMoveToStage={onMoveToStage} />}
          {tab === "notes" && <NotesTab contactId={lead.id} />}
          {tab === "tasks" && <TasksTab contactId={lead.id} />}
          {tab === "history" && <HistoryTab contactId={lead.id} />}
        </div>
      </aside>
    </div>
  );
}

/* ── Details Tab ── */
function DetailsTab({ lead, stages, onMoveToStage }: { lead: PipelineLead; stages: PipelineStage[]; onMoveToStage: (id: string, stageId: string) => void }) {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone ?? "",
    email: lead.email ?? "",
    estimated_value: String(lead.estimated_value),
    source: lead.source,
    tags: lead.labels.join(", "),
    notes: lead.notes ?? "",
  });

  useEffect(() => {
    setForm({
      name: lead.name,
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      estimated_value: String(lead.estimated_value),
      source: lead.source,
      tags: lead.labels.join(", "),
      notes: lead.notes ?? "",
    });
  }, [lead]);

  const save = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Conta atual não identificada. Recarregue a página e tente novamente.");
      const phone = normalizeContactPhone(form.phone);
      const tags = form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      const { error } = await sb.from("contacts").update({
        name: form.name.trim(), phone_number: phone, email: form.email || null,
        estimated_value: Number(form.estimated_value) || 0, source: form.source, tags, notes: form.notes || null,
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id).eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] }); toast.success("Lead atualizado"); setEditing(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Informações</span>
        <button onClick={() => editing ? save.mutate() : setEditing(true)} className="h-7 px-3 rounded text-xs font-medium bg-success/15 text-success flex items-center gap-1">
          {editing ? <><Save className="h-3 w-3" /> Salvar</> : "Editar"}
        </button>
      </div>

      <div className="space-y-3">
        <InfoRow icon={User} label="Nome" value={editing ? <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputSm} /> : lead.name} />
        <InfoRow icon={Phone} label="Telefone" value={editing ? <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputSm} /> : (lead.phone ?? "—")} />
        <InfoRow icon={Mail} label="Email" value={editing ? <input value={form.email} onChange={(e) => set("email", e.target.value)} className={inputSm} /> : (lead.email ?? "—")} />
        <InfoRow icon={DollarSign} label="Valor" value={editing ? <input type="number" value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} className={inputSm} /> : `R$ ${Number(lead.estimated_value).toFixed(2)}`} />
        <InfoRow icon={Tag} label="Origem" value={editing ? <select value={form.source} onChange={(e) => set("source", e.target.value)} className={inputSm}><option value="manual">Manual</option><option value="whatsapp">WhatsApp</option><option value="website">Website</option><option value="instagram">Instagram</option><option value="indicacao">Indicação</option></select> : lead.source} />
        <InfoRow
          icon={Tag}
          label="Tags"
          value={
            editing ? (
              <input value={form.tags} onChange={(e) => set("tags", e.target.value)} className={inputSm} placeholder="VIP, Urgente" />
            ) : lead.labels.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {lead.labels.map((tag) => (
                  <span key={tag} className="rounded bg-warning/30 px-1.5 py-0.5 text-[10px] font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            ) : "—"
          }
        />
      </div>

      <div className="pt-3 border-t">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mover para etapa</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => onMoveToStage(lead.id, s.id)}
              disabled={s.id === lead.stage_id}
              className={`h-7 px-3 rounded-full text-xs font-medium flex items-center gap-1 transition-colors ${
                s.id === lead.stage_id ? "bg-foreground/10 text-foreground" : "border hover:bg-background"
              }`}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}
              {s.id === lead.stage_id && <CheckCircle2 className="h-3 w-3" />}
            </button>
          ))}
        </div>
      </div>

      {(editing || lead.notes) && (
        <div className="pt-3 border-t">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações</span>
          {editing ? (
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputSm + " mt-2 min-h-[64px]"} />
          ) : (
            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{lead.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Notes Tab ── */
function NotesTab({ contactId }: { contactId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["lead_notes", contactId],
    queryFn: async (): Promise<LeadNote[]> => {
      const { data, error } = await sb.from("lead_notes").select("*, author:profiles!lead_notes_author_id_fkey(display_name, avatar_initials)").eq("contact_id", contactId).order("created_at", { ascending: false });
      if (error) {
        const { data: d2, error: e2 } = await sb.from("lead_notes").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
        if (e2) throw e2;
        return (d2 ?? []) as LeadNote[];
      }
      return (data ?? []) as LeadNote[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Escreva uma nota");
      const { error } = await sb.from("lead_notes").insert({ contact_id: contactId, author_id: user?.id ?? null, content: text.trim() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead_notes", contactId] }); setText(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-5">
      <div className="flex gap-2 mb-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escrever nota..." rows={2} className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40" />
        <button onClick={() => add.mutate()} disabled={add.isPending} className="h-10 px-3 rounded-lg bg-success text-success-foreground text-xs font-semibold self-end">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma nota ainda</p>
        ) : notes.map((n) => (
          <div key={n.id} className="rounded-lg border bg-background p-3">
            <p className="text-sm whitespace-pre-wrap">{n.content}</p>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
              <span>{n.author?.display_name ?? "Agente"}</span>
              <span>·</span>
              <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Tasks Tab ── */
function TasksTab({ contactId }: { contactId: string }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["lead_tasks", contactId],
    queryFn: async (): Promise<LeadTask[]> => {
      const { data, error } = await sb.from("lead_tasks").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LeadTask[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Informe o título");
      const { error } = await sb.from("lead_tasks").insert({ contact_id: contactId, title: title.trim() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead_tasks", contactId] }); setTitle(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (task: LeadTask) => {
      const { error } = await sb.from("lead_tasks").update({
        is_completed: !task.is_completed,
        completed_at: !task.is_completed ? new Date().toISOString() : null,
      }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead_tasks", contactId] }),
  });

  return (
    <div className="p-5">
      <div className="flex gap-2 mb-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nova tarefa..." className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40" onKeyDown={(e) => e.key === "Enter" && add.mutate()} />
        <button onClick={() => add.mutate()} disabled={add.isPending} className="h-10 px-3 rounded-lg bg-success text-success-foreground text-xs font-semibold">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa</p>
        ) : tasks.map((t) => (
          <button key={t.id} onClick={() => toggle.mutate(t)} className="w-full flex items-center gap-3 rounded-lg border bg-background p-3 text-left hover:bg-background/80 transition-colors">
            {t.is_completed ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className={`text-sm flex-1 ${t.is_completed ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── History Tab ── */
function HistoryTab({ contactId }: { contactId: string }) {
  const { data: movements = [] } = useQuery({
    queryKey: ["lead_movements", contactId],
    queryFn: async (): Promise<LeadMovement[]> => {
      const { data, error } = await sb.from("lead_movements").select("*, from_stage:pipeline_stages!lead_movements_from_stage_id_fkey(name, color), to_stage:pipeline_stages!lead_movements_to_stage_id_fkey(name, color)").eq("contact_id", contactId).order("created_at", { ascending: false });
      if (error) {
        const { data: d2, error: e2 } = await sb.from("lead_movements").select("*").eq("contact_id", contactId).order("created_at", { ascending: false });
        if (e2) throw e2;
        return (d2 ?? []) as LeadMovement[];
      }
      return (data ?? []) as LeadMovement[];
    },
  });

  return (
    <div className="p-5">
      {movements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma movimentação registrada</p>
      ) : (
        <div className="space-y-3">
          {movements.map((m) => (
            <div key={m.id} className="flex items-start gap-3">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-brand shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs">
                  {m.from_stage && (
                    <>
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-background border text-[10px]">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.from_stage.color }} />
                        {m.from_stage.name}
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </>
                  )}
                  {m.to_stage && (
                    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-background border text-[10px]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.to_stage.color }} />
                      {m.to_stage.name}
                    </span>
                  )}
                </div>
                {m.loss_reason && <p className="text-[11px] text-destructive mt-0.5">Motivo: {m.loss_reason.name}</p>}
                <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */
const inputSm = "w-full h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40";

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="flex-1 text-sm min-w-0">{value}</div>
    </div>
  );
}
