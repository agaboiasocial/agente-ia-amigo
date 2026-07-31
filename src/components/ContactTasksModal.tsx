import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X, Plus, Loader2, Check, Trash2, Calendar, Flag } from "lucide-react";

const sb = supabase as any;

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: string | null;
  is_completed: boolean | null;
  created_at: string | null;
};

const PRIORITIES = [
  { value: "low", label: "Baixa", color: "#64748b" },
  { value: "medium", label: "Média", color: "#2FAE7C" },
  { value: "high", label: "Alta", color: "#e0a800" },
  { value: "urgent", label: "Urgente", color: "#dc2626" },
];

function prio(v: string | null) {
  return PRIORITIES.find((p) => p.value === v) ?? PRIORITIES[1];
}

export function ContactTasksModal({
  contactId,
  contactName,
  onClose,
}: {
  contactId: string;
  contactName?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["contact_tasks", contactId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("contact_tasks")
        .select("*")
        .eq("contact_id", contactId)
        .order("is_completed", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["contact_tasks", contactId] });

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("contact_tasks").insert({
        contact_id: contactId,
        title: title.trim(),
        due_date: dueDate || null,
        priority,
        is_completed: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDueDate("");
      setPriority("medium");
      invalidate();
      toast.success("Tarefa criada");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar tarefa"),
  });

  const toggleMut = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await sb
        .from("contact_tasks")
        .update({ is_completed: !t.is_completed, updated_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contact_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tarefa excluída"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  const onAdd = () => {
    if (!title.trim()) { toast.error("Informe o título da tarefa"); return; }
    addMut.mutate();
  };

  const pending = tasks.filter((t) => !t.is_completed).length;

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col"
      >
        <div className="p-4 sm:p-5 border-b flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-brand">Tarefas</h3>
            <p className="text-xs text-muted-foreground truncate">
              {contactName ? `${contactName} · ` : ""}{pending} pendente{pending === 1 ? "" : "s"}
            </p>
          </div>
          <button onClick={onClose} className="h-9 w-9 grid place-items-center text-muted-foreground rounded-lg hover:bg-background" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nova tarefa */}
        <div className="p-4 sm:p-5 border-b space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAdd(); }}
            placeholder="Nova tarefa… (ex: Enviar orçamento)"
            className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border bg-background text-sm flex-1 min-w-0">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-transparent outline-none text-sm w-full" />
            </label>
            <label className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border bg-background text-sm">
              <Flag className="h-4 w-4 shrink-0" style={{ color: prio(priority).color }} />
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="bg-transparent outline-none text-sm">
                {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <button
              onClick={onAdd}
              disabled={addMut.isPending}
              className="h-9 px-3 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60 shrink-0"
            >
              {addMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">Nenhuma tarefa para este contato.</div>
          ) : (
            tasks.map((t) => {
              const p = prio(t.priority);
              const overdue = t.due_date && !t.is_completed && new Date(t.due_date) < new Date(new Date().toDateString());
              return (
                <div key={t.id} className={`flex items-start gap-3 rounded-xl border p-3 ${t.is_completed ? "opacity-60" : ""}`}>
                  <button
                    onClick={() => toggleMut.mutate(t)}
                    className={`mt-0.5 h-5 w-5 rounded-md border grid place-items-center shrink-0 ${t.is_completed ? "bg-success border-success text-success-foreground" : "border-muted-foreground/40"}`}
                    aria-label={t.is_completed ? "Reabrir" : "Concluir"}
                  >
                    {t.is_completed && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${t.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{t.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full" style={{ background: `${p.color}22`, color: p.color }}>
                        <Flag className="h-3 w-3" /> {p.label}
                      </span>
                      {t.due_date && (
                        <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                          <Calendar className="h-3 w-3" /> {new Date(t.due_date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => delMut.mutate(t.id)} className="h-8 w-8 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0" aria-label="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
