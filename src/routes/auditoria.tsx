import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { auditLogs, agents } from "@/lib/mock-data";
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
  const [agent, setAgent] = useState("Todos");
  const [action, setAction] = useState("Todos");

  const list = useMemo(() => auditLogs.filter(l =>
    (agent === "Todos" || l.agent === agent) &&
    (action === "Todos" || l.action === action) &&
    (q === "" || l.contact.toLowerCase().includes(q.toLowerCase()) || l.details.toLowerCase().includes(q.toLowerCase()))
  ), [q, agent, action]);

  const exportCSV = () => {
    const rows = [["Data/Hora","Agente","Ação","Conversa","Contato","Detalhes"]];
    list.forEach(l => rows.push([l.time, l.agent, actionMeta[l.action].label, l.convId, l.contact, l.details]));
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
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Buscar por contato ou detalhes..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success" />
          </div>
          <select value={agent} onChange={(e)=>setAgent(e.target.value)} className="h-10 px-3 rounded-lg border bg-background text-sm">
            <option>Todos</option>
            {agents.map(a=> <option key={a.id}>{a.name}</option>)}
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
                <th className="text-left px-5 py-3">Contato</th>
                <th className="text-left px-5 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {list.map((l) => {
                const m = actionMeta[l.action];
                const Icon = m.icon;
                return (
                  <tr key={l.id} className="border-t hover:bg-background transition-colors">
                    <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">{l.time}</td>
                    <td className="px-5 py-3 font-medium">{l.agent}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md font-medium ${m.color}`}>
                        <Icon className="h-3.5 w-3.5" /> {m.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-brand font-mono text-xs">{l.convId}</td>
                    <td className="px-5 py-3">{l.contact}</td>
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
        <div className="px-5 py-3 border-t flex items-center justify-between text-xs text-muted-foreground">
          <span>Mostrando {list.length} de {auditLogs.length} registros</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 rounded-md border hover:bg-background">Anterior</button>
            <button className="px-3 py-1 rounded-md bg-brand text-brand-foreground">1</button>
            <button className="px-3 py-1 rounded-md border hover:bg-background">2</button>
            <button className="px-3 py-1 rounded-md border hover:bg-background">Próximo</button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
