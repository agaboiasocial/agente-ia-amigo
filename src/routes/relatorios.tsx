import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, Clock, CheckCircle2, MessageSquare } from "lucide-react";
import { useConversations, useAgents } from "@/lib/data";

export const Route = createFileRoute("/relatorios")({ component: RelatoriosPage });

const periods = ["7 dias", "30 dias", "90 dias"];
const channelColors: Record<string, string> = {
  WhatsApp: "#2FAE7C", Web: "#0B3A5D", Instagram: "#F2C94C",
};

function RelatoriosPage() {
  const [period, setPeriod] = useState("30 dias");
  const days = period === "7 dias" ? 7 : period === "90 dias" ? 90 : 30;
  const { data: conversations = [] } = useConversations();
  const { data: agents = [] } = useAgents();

  const cutoff = useMemo(() => Date.now() - days * 86400000, [days]);
  const filtered = useMemo(
    () => conversations.filter(c => new Date(c.opened_at).getTime() >= cutoff),
    [conversations, cutoff],
  );

  const perDay = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      map.set(d.toISOString().slice(0, 10), 0);
    }
    filtered.forEach(c => {
      const k = c.opened_at.slice(0, 10);
      if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map, ([day, conv]) => ({ day: day.slice(5), conv }));
  }, [filtered, days]);

  const byAgent = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(c => {
      if (!c.assigned_to) return;
      counts.set(c.assigned_to, (counts.get(c.assigned_to) ?? 0) + 1);
    });
    return Array.from(counts, ([id, conv]) => ({
      agent: agents.find(a => a.user_id === id)?.display_name ?? "—",
      conv,
    }));
  }, [filtered, agents]);

  const byChannel = useMemo(() => {
    const counts = new Map<string, number>();
    filtered.forEach(c => counts.set(c.channel, (counts.get(c.channel) ?? 0) + 1));
    return Array.from(counts, ([name, value]) => ({ name, value, color: channelColors[name] ?? "#888" }));
  }, [filtered]);

  const total = filtered.length;
  const resolvidas = filtered.filter(c => c.status === "resolvida").length;
  const taxa = total ? Math.round((resolvidas / total) * 100) : 0;
  const abertas = total - resolvidas;

  return (
    <AppLayout title="Relatórios e Analytics" actions={
      <div className="flex gap-1 bg-background rounded-lg p-1">
        {periods.map((p)=>(
          <button key={p} onClick={()=>setPeriod(p)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              period===p ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}>{p}</button>
        ))}
      </div>
    }>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <Kpi icon={TrendingUp} label="Total de conversas" value={String(total)} trend={`${period}`} />
        <Kpi icon={MessageSquare} label="Em aberto" value={String(abertas)} trend="conversas ativas" />
        <Kpi icon={CheckCircle2} label="Resolvidas" value={String(resolvidas)} trend={`${taxa}% de resolução`} />
        <Kpi icon={Clock} label="Agentes ativos" value={String(agents.length)} trend="cadastrados" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <Card title="Conversas por dia" className="lg:col-span-2">
          <div className="h-56 md:h-72">
            <ResponsiveContainer>
              <LineChart data={perDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="conv" stroke="#2FAE7C" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Conversas por canal">
          <div className="h-56 md:h-72">
            {byChannel.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byChannel} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {byChannel.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card title="Conversas por agente" className="lg:col-span-3">
          <div className="h-56 md:h-72">
            {byAgent.length === 0 ? <Empty /> : (
              <ResponsiveContainer>
                <BarChart data={byAgent}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                  <XAxis dataKey="agent" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="conv" fill="#0B3A5D" radius={[8,8,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function Empty() {
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">Sem dados no período</div>;
}

function Kpi({ icon: Icon, label, value, trend }: any) {
  return (
    <div className="bg-card rounded-xl shadow-sm border p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold mt-1 text-brand">{value}</div>
        </div>
        <div className="h-10 w-10 rounded-lg bg-success/10 grid place-items-center">
          <Icon className="h-5 w-5 text-success" />
        </div>
      </div>
      <div className="text-xs mt-2 text-muted-foreground">{trend}</div>
    </div>
  );
}

function Card({ title, children, className="" }: any) {
  return (
    <div className={`bg-card rounded-xl shadow-sm border p-5 ${className}`}>
      <h3 className="font-semibold text-brand mb-4">{title}</h3>
      {children}
    </div>
  );
}
