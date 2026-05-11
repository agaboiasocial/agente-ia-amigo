import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuditLogs, useAgents } from "@/lib/data";
import {
  Send, UserPlus, StickyNote, CheckCircle2, ArrowLeftRight, Search, Download, ShieldCheck,
} from "lucide-react";

export const Route = createFileRoute("/auditoria")({ component: AuditoriaPage });

const actionMeta: Record<string, { label: string; icon: any; color: string }> = {
  mensagem_enviada: { label: "Mensagem enviada", icon: Send, color: "text-success bg-success/10" },
  conversa_atribuida: { label: "Conversa atribuída", icon: UserPlus, color: "text-brand bg-brand/10" },
  nota_adicionada: { label: "Nota adicionada", icon: StickyNote, color: "text-warning-foreground bg-warning/30" },
  conversa_resolvida: { label: "Conversa resolvida", icon: CheckCircle2, color: "text-success bg-success/15" },
  transferencia: { label: "Transferência", icon: ArrowLeftRight, color: "text-[oklch(0.55_0.18_280)] bg-[oklch(0.55_0.18_280)]/10" },
};

function AuditoriaPage() {
  const [q, setQ] = useState("");
  const [agentId, setAgentId] = useState("Todos");
  const [action, setAction] = useState("Todos");
  const { data: logs = [] } = useAuditLogs();
  const { data: agents = [] } = useAgents();

  const agentName = (id: string | null) =>
    agents.find(a => a.user_id === id)?.display_name ?? "—";

  const list = useMemo(() => logs.filter(l =>
    (agentId === "Todos" || l.agent_id === agentId) &&
    (action === "Todos" || l.action === action) &&
    (q === "" || (l.details ?? "").toLowerCase().includes(q.toLowerCase()))
  ), [logs, q, agentId, action]);

  const exportCSV = () => {
    const rows = [["Data/Hora","Agente","Ação","Conversa","Contato","Detalhes"]];
    list.forEach(l => rows.push([
      new Date(l.created_at).toLocaleString("pt-BR"),
      agentName(l.agent_id),
      actionMeta[l.action]?.label ?? l.action,
      l.conversation_id ?? "",
      l.contact_id ?? "",
      l.details ?? "",
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "auditoria.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout title="Auditoria" actions={
      <button onClick={exportCSV} className="h-9 px-4 rounded-lg bg-brand text-brand-foreground text-sm font-semibold flex items-center gap-2 hover:opacity-95">
        <Download className="h-4 w-4" /> Exportar CSV
      </button>
    }>
      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar nos detalhes..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success" />
          </div>
          <select value={agentId} onChange={(e)=>setAgentId(e.target.value)} className="h-10 px-3 rounded-lg border bg-background text-sm">
            <option value="Todos">Todos os agentes</option>
            {agents.map(a=> <option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}
          </select>
          <select value={action} onChange={(e)=>setAction(e.target.value)} className="h-10 px-3 rounded-lg border bg-background text-sm">
            <option value="Todos">Todas as ações</option>
            {Object.entries(actionMeta).map(([k,v])=> <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Data / Hora</th>
                <th className="text-left px-5 py-3">Agente</th>
                <th className="text-left px-5 py-3">Ação</th>
                <th className="text-left px-5 py-3">Conversa</th>
                <th className="text-left px-5 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const m = actionMeta[l.action] ?? { label: l.action, icon: ShieldCheck, color: "text-muted-foreground bg-background" };
                const Icon = m.icon;
                return (
                  <tr key={l.id} className="border-t hover:bg-background transition-colors">
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-5 py-3 font-medium">{agentName(l.agent_id)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md font-medium ${m.color}`}>
                        <Icon className="h-3.5 w-3.5" /> {m.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-brand font-mono text-xs">{l.conversation_id?.slice(0, 8) ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{l.details}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && (
            <div className="p-12 text-center">
              <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum registro encontrado</p>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t text-xs text-muted-foreground">
          Mostrando {list.length} de {logs.length} registros
        </div>
      </div>
    </AppLayout>
  );
}
