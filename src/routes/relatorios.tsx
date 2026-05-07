import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { TrendingUp, Clock, CheckCircle2, Smile } from "lucide-react";

export const Route = createFileRoute("/relatorios")({ component: RelatoriosPage });

const days = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1}`,
  conv: Math.round(40 + Math.random() * 60 + (i > 20 ? 30 : 0)),
}));

const byAgent = [
  { agent: "Mariana", conv: 142 },
  { agent: "Carlos", conv: 118 },
  { agent: "Beatriz", conv: 96 },
  { agent: "Ricardo", conv: 73 },
];

const byChannel = [
  { name: "WhatsApp", value: 56, color: "#2FAE7C" },
  { name: "Web", value: 28, color: "#0B3A5D" },
  { name: "Instagram", value: 16, color: "#F2C94C" },
];

const periods = ["Hoje", "7 dias", "30 dias", "Personalizado"];

function RelatoriosPage() {
  const [period, setPeriod] = useState("30 dias");
  return (
    <AppLayout title="Relatórios" actions={
      <div className="flex gap-1 bg-background rounded-lg p-1">
        {periods.map((p)=>(
          <button key={p} onClick={()=>setPeriod(p)}
            className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
              period===p ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground hover:text-foreground"
            }`}>{p}</button>
        ))}
      </div>
    }>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Kpi icon={TrendingUp} label="Total de conversas" value="1.428" trend="+12% vs período anterior" color="text-success" />
        <Kpi icon={Clock} label="Tempo médio de resposta" value="2m 14s" trend="-18% mais rápido" color="text-success" />
        <Kpi icon={CheckCircle2} label="Tempo médio de resolução" value="1h 32m" trend="+4% mais lento" color="text-destructive" />
        <Kpi icon={Smile} label="CSAT score" value="4.7 / 5" trend="92% satisfação" color="text-success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Conversas por dia" className="lg:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={days}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="conv" stroke="#2FAE7C" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Conversas por canal">
          <div className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={byChannel} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {byChannel.map((e) => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Conversas por agente" className="lg:col-span-3">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={byAgent}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 250)" />
                <XAxis dataKey="agent" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="conv" fill="#0B3A5D" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}

function Kpi({ icon: Icon, label, value, trend, color }: any) {
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
      <div className={`text-xs mt-2 ${color}`}>{trend}</div>
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
