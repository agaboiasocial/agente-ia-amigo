import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { toast } from "sonner";
import { Loader2, LifeBuoy, Inbox, Clock, CheckCircle2, XCircle } from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/super-admin/tickets")({ component: Page });

type StatusKey = "open" | "in_progress" | "resolved" | "closed";

const STATUS: { key: StatusKey; label: string; cls: string }[] = [
  { key: "open", label: "Aberto", cls: "bg-amber-100 text-amber-700" },
  { key: "in_progress", label: "Em andamento", cls: "bg-[#0B3A5D]/10 text-[#0B3A5D]" },
  { key: "resolved", label: "Resolvido", cls: "bg-[#2FAE7C]/15 text-[#2FAE7C]" },
  { key: "closed", label: "Fechado", cls: "bg-slate-200 text-slate-600" },
];

interface TicketRow {
  id: string;
  subject: string;
  category: string | null;
  priority: string | null;
  description: string | null;
  message: string | null;
  status: string;
  created_at: string;
  account_id: string | null;
  account_name: string;
  user_id: string | null;
  requester: string;
}

function normStatus(s: string | null): StatusKey {
  if (s === "in_progress" || s === "resolved" || s === "closed") return s;
  return "open";
}

function useTickets() {
  return useQuery({
    queryKey: ["admin_tickets"],
    queryFn: async (): Promise<TicketRow[]> => {
      const [{ data: tickets }, { data: accounts }, { data: profiles }] = await Promise.all([
        sb.from("support_tickets").select("*").order("created_at", { ascending: false }),
        sb.from("accounts").select("id, name"),
        sb.from("profiles").select("user_id, display_name"),
      ]);
      const acct = new Map<string, string>(((accounts ?? []) as any[]).map((a) => [a.id, a.name]));
      const prof = new Map<string, string>(((profiles ?? []) as any[]).map((p) => [p.user_id, p.display_name]));
      return ((tickets ?? []) as any[]).map((t) => ({
        ...t,
        account_name: t.account_id ? (acct.get(t.account_id) ?? "—") : "—",
        requester: t.user_id ? (prof.get(t.user_id) ?? "—") : "—",
      }));
    },
  });
}

function Page() {
  const qc = useQueryClient();
  const { data: tickets = [], isLoading } = useTickets();
  const [filter, setFilter] = useState<StatusKey | "all">("all");
  const [selected, setSelected] = useState<TicketRow | null>(null);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusKey }) => {
      const { error } = await sb.from("support_tickets").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_tickets"] }); toast.success("Status atualizado"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const counts = {
    open: tickets.filter((t) => normStatus(t.status) === "open").length,
    in_progress: tickets.filter((t) => normStatus(t.status) === "in_progress").length,
    resolved: tickets.filter((t) => normStatus(t.status) === "resolved").length,
    closed: tickets.filter((t) => normStatus(t.status) === "closed").length,
  };

  const filtered = filter === "all" ? tickets : tickets.filter((t) => normStatus(t.status) === filter);
  const statusInfo = (s: string) => STATUS.find((x) => x.key === normStatus(s))!;

  return (
    <SuperAdminLayout title="Chamados">
      {isLoading ? (
        <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-5">
          {/* Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <SummaryCard label="Abertos" value={counts.open} icon={Inbox} />
            <SummaryCard label="Em andamento" value={counts.in_progress} icon={Clock} />
            <SummaryCard label="Resolvidos" value={counts.resolved} icon={CheckCircle2} />
            <SummaryCard label="Fechados" value={counts.closed} icon={XCircle} />
          </div>

          {/* Filtro */}
          <div className="flex items-center gap-1 flex-wrap">
            {(["all", ...STATUS.map((s) => s.key)] as const).map((k) => (
              <button key={k} onClick={() => setFilter(k as any)}
                className={`text-xs px-3 py-1.5 rounded-lg border ${filter === k ? "bg-[#0B3A5D] text-white border-[#0B3A5D]" : "hover:bg-slate-50"}`}>
                {k === "all" ? "Todos" : STATUS.find((s) => s.key === k)?.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {filtered.length === 0 ? (
            <div className="bg-white rounded-lg border p-12 text-center">
              <LifeBuoy className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">Nenhum chamado nesta categoria.</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3">Assunto</th>
                    <th className="text-left px-4 py-3">Organização</th>
                    <th className="text-left px-4 py-3">Solicitante</th>
                    <th className="text-left px-4 py-3">Prioridade</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="text-left px-4 py-3">Aberto em</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const st = statusInfo(t.status);
                    return (
                      <tr key={t.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(t)}>
                        <td className="px-4 py-3 font-medium text-slate-900 max-w-[240px] truncate">{t.subject}</td>
                        <td className="px-4 py-3 text-slate-600">{t.account_name}</td>
                        <td className="px-4 py-3 text-slate-600">{t.requester}</td>
                        <td className="px-4 py-3 text-slate-600">{t.priority ?? "—"}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={normStatus(t.status)}
                            onChange={(e) => setStatus.mutate({ id: t.id, status: e.target.value as StatusKey })}
                            className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${st.cls}`}
                          >
                            {STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{new Date(t.created_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Detalhe */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#0B3A5D]">{selected.subject}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{selected.account_name} · {selected.requester} · {new Date(selected.created_at).toLocaleString("pt-BR")}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${statusInfo(selected.status).cls}`}>{statusInfo(selected.status).label}</span>
            </div>
            <div className="flex gap-2 text-xs">
              {selected.category && <span className="px-2 py-0.5 rounded-full bg-slate-100">{selected.category}</span>}
              {selected.priority && <span className="px-2 py-0.5 rounded-full bg-slate-100">Prioridade: {selected.priority}</span>}
            </div>
            <div className="text-sm text-slate-700 whitespace-pre-wrap border rounded-lg p-3 bg-slate-50">
              {selected.description || selected.message || "Sem descrição"}
            </div>
            <div className="flex items-center gap-2 pt-2">
              <span className="text-xs text-slate-500">Alterar status:</span>
              {STATUS.map((s) => (
                <button key={s.key}
                  onClick={() => { setStatus.mutate({ id: selected.id, status: s.key }); setSelected({ ...selected, status: s.key }); }}
                  className={`text-xs px-2.5 py-1 rounded-full ${normStatus(selected.status) === s.key ? s.cls + " ring-1 ring-current" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Inbox }) {
  return (
    <div className="bg-white rounded-lg border p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-500">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="text-2xl font-bold text-[#0B3A5D]">{value}</div>
    </div>
  );
}
