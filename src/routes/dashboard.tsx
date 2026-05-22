import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useConversations, useContacts, useAgents } from "@/lib/data";
import { usePipeline } from "@/hooks/use-pipeline";
import { usePaymentSchedules, useFinanceSummary } from "@/lib/finance";
import { useDashboardData, type DashboardPeriod, type DashboardInsight } from "@/hooks/use-dashboard-data";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  KanbanSquare,
  MessageSquare,
  Percent,
  ShieldAlert,
  Target,
  TrendingUp,
  UserX,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERIOD_LABELS: Record<DashboardPeriod, string> = { today: "Hoje", week: "Semana", month: "Mes", all: "Tudo" };

function DashboardPage() {
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  // Existing hooks
  const { data: conversations = [] } = useConversations();
  const { data: contacts = [] } = useContacts();
  const { data: agents = [] } = useAgents();
  const pipeline = usePipeline();
  const { data: payments = [] } = usePaymentSchedules();
  const finance = useFinanceSummary(payments);

  // New dashboard hook
  const dashboard = useDashboardData(period);

  const openConversations = conversations.filter((c) => c.status !== "resolvida").length;

  // Upcoming payments (next 7 days)
  const upcomingPayments = useMemo(() => {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 86400000);
    return payments
      .filter((p) => p.status !== "paid" && new Date(p.due_date) <= weekLater)
      .slice(0, 5);
  }, [payments]);

  return (
    <AppLayout title="Dashboard IAS">
      <div className="space-y-6">
        {/* Header with period filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-bold text-brand">Painel de Controle</h1>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(PERIOD_LABELS) as DashboardPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-brand text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Insights banner */}
        {dashboard.insights.length > 0 && (
          <div className="space-y-2">
            {dashboard.insights.map((insight, i) => (
              <InsightBanner key={i} insight={insight} />
            ))}
          </div>
        )}

        {/* KPI cards */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Users} label="Novos Leads" value={dashboard.kpis.newLeads} color="text-success" />
          <Kpi icon={Target} label="Leads Ativos" value={dashboard.kpis.activeLeads} color="text-brand" />
          <Kpi icon={Percent} label="Taxa de Conversao" value={`${dashboard.kpis.conversionRate}%`} color="text-success" />
          <Kpi icon={DollarSign} label="Valor Pipeline" value={money.format(dashboard.kpis.totalPipelineValue)} color="text-brand" />
          <Kpi icon={TrendingUp} label="Pipeline Ponderado" value={money.format(dashboard.kpis.weightedPipelineValue)} color="text-success" />
          <Kpi icon={ShieldAlert} label="SLA Violado" value={dashboard.kpis.slaBreachedCount} color={dashboard.kpis.slaBreachedCount > 0 ? "text-destructive" : "text-success"} />
        </section>

        {/* Secondary KPIs */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={CheckCircle2} label="Ganhos" value={dashboard.kpis.wonCount} color="text-success" />
          <Kpi icon={AlertTriangle} label="Perdidos" value={dashboard.kpis.lostCount} color="text-destructive" />
          <Kpi icon={MessageSquare} label="Conversas Abertas" value={openConversations} color="text-brand" />
          <Kpi icon={Wallet} label="Financeiro Pendente" value={money.format(finance.pending)} color="text-warning" />
        </section>

        {/* Main content grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Revenue chart */}
          <Panel title="Receita Mensal (Ganhos)" className="lg:col-span-2">
            <div className="h-72">
              {dashboard.revenueByMonth.length === 0 ? (
                <Empty text="Nenhum negocio ganho ainda" />
              ) : (
                <ResponsiveContainer>
                  <BarChart data={dashboard.revenueByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v: number) => money.format(v).replace("R$ ", "")} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => money.format(v)} />
                    <Bar dataKey="value" name="Receita" fill="#2FAE7C" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Panel>

          {/* Operational alerts */}
          <Panel title="Alertas Operacionais">
            <div className="space-y-3">
              <AlertRow icon={UserX} label="Sem responsavel" count={dashboard.alerts.unassignedCount} severity={dashboard.alerts.unassignedCount > 0 ? "warning" : "ok"} />
              <AlertRow icon={Clock} label="Parados (+7 dias)" count={dashboard.alerts.stalledCount} severity={dashboard.alerts.stalledCount > 0 ? "warning" : "ok"} />
              <AlertRow icon={ShieldAlert} label="SLA violado" count={dashboard.alerts.slaBreachedCount} severity={dashboard.alerts.slaBreachedCount > 0 ? "danger" : "ok"} />
              <AlertRow icon={MessageSquare} label="Sem followup (+3 dias)" count={dashboard.alerts.noFollowupCount} severity={dashboard.alerts.noFollowupCount > 0 ? "warning" : "ok"} />
            </div>
          </Panel>
        </div>

        {/* Pipeline + Team */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Pipeline summary */}
          <Panel title="Pipeline por Etapa">
            {dashboard.pipelineSummary.length === 0 ? (
              <Empty text="Nenhuma etapa ativa" />
            ) : (
              <div className="space-y-3">
                {dashboard.pipelineSummary.map((stage) => {
                  const maxLeads = Math.max(...dashboard.pipelineSummary.map((s) => s.leadCount), 1);
                  const pct = (stage.leadCount / maxLeads) * 100;
                  return (
                    <div key={stage.id}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="font-medium">{stage.name}</span>
                          {stage.isBottleneck && (
                            <span className="rounded bg-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-warning">
                              GARGALO
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {stage.leadCount} leads &middot; {money.format(stage.totalValue)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: stage.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Team performance */}
          <Panel title="Performance do Time">
            {dashboard.teamPerformance.length === 0 ? (
              <Empty text="Nenhum membro com leads atribuidos" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Membro</th>
                      <th className="pb-2 text-center font-medium">Leads</th>
                      <th className="pb-2 text-center font-medium">Ganhos</th>
                      <th className="pb-2 text-right font-medium">Conversao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.teamPerformance.map((m) => (
                      <tr key={m.userId} className="border-b border-border/50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
                              {m.initials ?? m.fullName.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="font-medium">{m.fullName}</span>
                          </div>
                        </td>
                        <td className="py-2 text-center">{m.leadsCount}</td>
                        <td className="py-2 text-center text-success font-medium">{m.wonCount}</td>
                        <td className="py-2 text-right font-medium">{m.conversionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* Activity feed + Payments */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Activity feed */}
          <Panel title="Atividades Recentes">
            {dashboard.recentActivities.length === 0 ? (
              <Empty text="Nenhuma movimentacao recente" />
            ) : (
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {dashboard.recentActivities.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-md border border-border/50 p-2.5 text-xs">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10">
                      <ArrowRight className="h-3 w-3 text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{a.contactName}</span>
                      <span className="text-muted-foreground">
                        {" "}moveu de{" "}
                        <span style={{ color: a.fromStageColor ?? undefined }}>{a.fromStageName ?? "—"}</span>
                        {" "}para{" "}
                        <span style={{ color: a.toStageColor ?? undefined }}>{a.toStageName ?? "—"}</span>
                      </span>
                      <div className="mt-0.5 text-muted-foreground">
                        {a.movedBy && <span>por {a.movedBy} &middot; </span>}
                        {timeAgo(a.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Payments schedule */}
          <Panel title="Pagamentos Proximos">
            {upcomingPayments.length === 0 ? (
              <Empty text="Nenhum pagamento nos proximos 7 dias" />
            ) : (
              <div className="space-y-2">
                {upcomingPayments.map((p) => {
                  const isOverdue = new Date(p.due_date) < new Date();
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-md border border-border/50 p-2.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className={`h-3.5 w-3.5 ${isOverdue ? "text-destructive" : "text-warning"}`} />
                        <div>
                          <div className="font-medium">{p.contact?.name ?? "Sem contato"}</div>
                          <div className="text-muted-foreground">
                            {new Date(p.due_date).toLocaleDateString("pt-BR")}
                            {isOverdue && <span className="ml-1 text-destructive font-medium">ATRASADO</span>}
                          </div>
                        </div>
                      </div>
                      <span className="font-semibold text-brand">{money.format(p.amount)}</span>
                    </div>
                  );
                })}
                <Link to="/financeiro" className="block text-center text-xs text-brand hover:underline">
                  Ver todos os pagamentos
                </Link>
              </div>
            )}
          </Panel>
        </div>

        {/* Quick actions */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink to="/conversas" icon={MessageSquare} title="Nova Conversa" text="Atenda conversas e notas internas." />
          <QuickLink to="/pipeline" icon={KanbanSquare} title="Pipeline" text="Gerencie leads em Kanban." />
          <QuickLink to="/ias" icon={Bot} title="IAS Agente" text="Configure IA, tom e prompt." />
          <QuickLink to="/financeiro" icon={Wallet} title="Financeiro" text="Controle pagamentos e recebimentos." />
        </section>
      </div>
    </AppLayout>
  );
}

// ---------- Sub-components ----------

function Kpi({ icon: Icon, label, value, color = "text-success" }: { icon: typeof Users; label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`h-4 w-4 ${color}`} />
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

function QuickLink({ to, icon: Icon, title, text }: { to: string; icon: typeof Users; title: string; text: string }) {
  return (
    <Link to={to} className="flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-background">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10">
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <div>
        <div className="font-semibold text-brand">{title}</div>
        <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
      </div>
    </Link>
  );
}

function InsightBanner({ insight }: { insight: DashboardInsight }) {
  const styles = {
    warning: "border-warning/40 bg-warning/10 text-warning",
    success: "border-success/40 bg-success/10 text-success",
    info: "border-brand/40 bg-brand/10 text-brand",
  };
  const icons = {
    warning: AlertTriangle,
    success: CheckCircle2,
    info: Zap,
  };
  const Icon = icons[insight.type];
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-xs font-medium ${styles[insight.type]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {insight.message}
    </div>
  );
}

function AlertRow({ icon: Icon, label, count, severity }: { icon: typeof Users; label: string; count: number; severity: "ok" | "warning" | "danger" }) {
  const colors = {
    ok: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  };
  return (
    <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs">
        <Icon className={`h-3.5 w-3.5 ${colors[severity]}`} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className={`text-lg font-bold ${colors[severity]}`}>{count}</span>
    </div>
  );
}

function Empty({ text = "Sem dados ainda" }: { text?: string }) {
  return <div className="grid h-full min-h-[100px] place-items-center text-sm text-muted-foreground">{text}</div>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atras`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  return `${days}d atras`;
}
