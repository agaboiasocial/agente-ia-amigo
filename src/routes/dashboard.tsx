import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useConversations, useContacts, useAgents } from "@/lib/data";
import { usePipeline } from "@/hooks/use-pipeline";
import { usePaymentSchedules, useFinanceSummary } from "@/lib/finance";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bot, CheckCircle2, KanbanSquare, MessageSquare, Users, Wallet } from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function DashboardPage() {
  const { data: conversations = [] } = useConversations();
  const { data: contacts = [] } = useContacts();
  const { data: agents = [] } = useAgents();
  const pipeline = usePipeline();
  const { data: payments = [] } = usePaymentSchedules();
  const finance = useFinanceSummary(payments);

  const openConversations = conversations.filter((c) => c.status !== "resolvida").length;
  const resolved = conversations.filter((c) => c.status === "resolvida").length;

  const stageData = useMemo(
    () =>
      pipeline.stages.map((stage) => ({
        name: stage.name,
        leads: pipeline.allLeads.filter((lead) => lead.stage_id === stage.id).length,
        color: stage.color,
      })),
    [pipeline.allLeads, pipeline.stages],
  );

  const channelData = useMemo(() => {
    const map = new Map<string, number>();
    conversations.forEach((c) => map.set(c.channel, (map.get(c.channel) ?? 0) + 1));
    return Array.from(map, ([name, value]) => ({ name, value }));
  }, [conversations]);

  return (
    <AppLayout title="Dashboard IAS">
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi icon={MessageSquare} label="Conversas abertas" value={openConversations} />
          <Kpi icon={CheckCircle2} label="Resolvidas" value={resolved} />
          <Kpi icon={Users} label="Contatos/Leads" value={contacts.length} />
          <Kpi icon={KanbanSquare} label="Pipeline" value={pipeline.allLeads.length} />
          <Kpi icon={Bot} label="Agentes" value={agents.length} />
          <Kpi icon={Wallet} label="Financeiro" value={money.format(finance.pending)} />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <Panel title="Pipeline por etapa" className="lg:col-span-2">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={stageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="leads" radius={[6, 6, 0, 0]}>
                    {stageData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Canais de atendimento">
            <div className="h-72">
              {channelData.length === 0 ? (
                <Empty />
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={channelData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={88}>
                      {channelData.map((item, index) => (
                        <Cell key={item.name} fill={["#2FAE7C", "#0B3A5D", "#F2C94C", "#6366F1"][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <QuickLink to="/conversas" title="Chat" text="Atenda conversas, notas internas e exportação." />
          <QuickLink to="/pipeline" title="Pipeline" text="Gerencie leads em Kanban no padrão IAS." />
          <QuickLink to="/ias" title="IAS Agente" text="Configure IA, tom, prompt e handoff humano." />
        </section>
      </div>
    </AppLayout>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof MessageSquare; label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-success" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-brand">{value}</div>
    </div>
  );
}

function Panel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border bg-card p-5 ${className}`}>
      <h2 className="mb-4 text-sm font-semibold text-brand">{title}</h2>
      {children}
    </div>
  );
}

function QuickLink({ to, title, text }: { to: string; title: string; text: string }) {
  return (
    <Link to={to} className="rounded-lg border bg-card p-5 transition-colors hover:bg-background">
      <div className="font-semibold text-brand">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}

function Empty() {
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">Sem dados ainda</div>;
}
