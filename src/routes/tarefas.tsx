import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ListChecks, Loader2, Check, Trash2, Calendar, Flag, User } from "lucide-react";

export const Route = createFileRoute("/tarefas")({ component: TarefasPage });

const sb = supabase as any;

type Task = {
  id: string;
  title: string;
  due_date: string | null;
  priority: string | null;
  is_completed: boolean | null;
  created_at: string | null;
  contact_id: string | null;
  contacts?: { name: string | null; account_id: string | null } | null;
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

type StatusFilter = "pending" | "done" | "all";

function TarefasPage() {
  const { accountId } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["all_tasks", accountId],
    enabled: !!accountId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("contact_tasks")
        .select("id, title, due_date, priority, is_completed, created_at, contact_id, contacts!inner(name, account_id)")
        .eq("contacts.account_id", accountId)
        .order("is_completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["all_tasks", accountId] });

  const toggleMut = useMutation({
    mutationFn: async (t: Task) => {
      const { error } = await sb.from("contact_tasks")
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

  const filtered = tasks.filter((t) => {
    if (status === "pending" && t.is_completed) return false;
    if (status === "done" && !t.is_completed) return false;
    if (priorityFilter !== "all" && (t.priority ?? "medium") !== priorityFilter) return false;
    return true;
  });

  const pending = tasks.filter((t) => !t.is_completed).length;
  const overdueCount = tasks.filter((t) => t.due_date && !t.is_completed && new Date(t.due_date) < new Date(new Date().toDateString())).length;
  const doneCount = tasks.filter((t) => t.is_completed).length;

  return (
    <AppLayout title="Tarefas">
      <div className="space-y-5">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Pendentes", value: pending, color: "text-brand" },
            { label: "Atrasadas", value: overdueCount, color: "text-destructive" },
            { label: "Concluídas", value: doneCount, color: "text-success" },
          ].map((c) => (
            <div key={c.label} className="bg-card border rounded-xl p-4 text-center">
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden">
            {([["pending", "Pendentes"], ["done", "Concluídas"], ["all", "Todas"]] as const).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setStatus(v)}
                className={`h-9 px-3 text-sm font-medium ${status === v ? "bg-success text-success-foreground" : "bg-background hover:bg-muted"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border bg-background text-sm"
          >
            <option value="all">Todas as prioridades</option>
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <ListChecks className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhuma tarefa {status === "pending" ? "pendente" : status === "done" ? "concluída" : ""}.</p>
            <p className="text-xs text-muted-foreground mt-1">Crie tarefas pelo menu ⋮ de cada conversa.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => {
              const p = prio(t.priority);
              const overdue = t.due_date && !t.is_completed && new Date(t.due_date) < new Date(new Date().toDateString());
              return (
                <div key={t.id} className={`flex items-start gap-3 rounded-xl border bg-card p-3 sm:p-4 ${t.is_completed ? "opacity-60" : ""}`}>
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
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <User className="h-3 w-3" /> {t.contacts?.name || "Contato"}
                      </span>
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
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
