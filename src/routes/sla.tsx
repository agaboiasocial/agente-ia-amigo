import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useConversations, useAgents } from "@/lib/data";
import { CheckCircle2, AlertTriangle, Timer, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/sla")({ component: SlaPage });

function minutesRemaining(opened_at: string, sla: number | null) {
  const sla_min = sla ?? 60;
  const elapsed = (Date.now() - new Date(opened_at).getTime()) / 60000;
  return Math.round(sla_min - elapsed);
}

function SlaPage() {
  const { data: conversations = [] } = useConversations();
  const { data: agents = [] } = useAgents();
  const agentName = (id: string | null) => agents.find(a => a.user_id === id)?.display_name ?? "—";

  const open = conversations.filter(c => c.status !== "resolvida");
  const withSla = open.map(c => ({ c, rem: minutesRemaining(c.opened_at, c.sla_minutes) }));
  const dentro = withSla.filter(x => x.rem > 10).length;
  const alerta = withSla.filter(x => x.rem > 0 && x.rem <= 10).length;
  const fora = withSla.filter(x => x.rem <= 0).length;
  const total = dentro + alerta + fora;
  const pct = total ? Math.round((dentro / total) * 100) : 0;

  return (
    <AppLayout title="SLA — Service Level Agreement">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-success">
          <Header icon={CheckCircle2} color="text-success bg-success/10" label="Dentro do SLA" />
          <div className="text-3xl font-bold text-success">{dentro}</div>
          <div className="text-xs text-muted-foreground mt-1">conversas no prazo</div>
        </Card>
        <Card className="border-l-4 border-l-warning">
          <Header icon={Timer} color="text-warning-foreground bg-warning/30" label="Em alerta" />
          <div className="text-3xl font-bold text-warning-foreground">{alerta}</div>
          <div className="text-xs text-muted-foreground mt-1">≤ 10 min restantes</div>
        </Card>
        <Card className="border-l-4 border-l-destructive">
          <Header icon={AlertTriangle} color="text-destructive bg-destructive/10" label="Fora do SLA" />
          <div className="text-3xl font-bold text-destructive">{fora}</div>
          <div className="text-xs text-muted-foreground mt-1">conversas estouraram</div>
        </Card>
        <Card>
          <Header icon={TrendingUp} color="text-brand bg-brand/10" label="% de cumprimento" />
          <div className="text-3xl font-bold text-brand">{pct}%</div>
          <div className="text-xs text-muted-foreground mt-1">no período atual</div>
        </Card>
      </div>

      <div className="bg-card rounded-xl shadow-sm border overflow-hidden mb-6">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-brand">Conversas com risco de SLA</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Monitoramento em tempo real</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-5 py-3">Conversa</th>
              <th className="text-left px-5 py-3">Contato</th>
              <th className="text-left px-5 py-3">Agente</th>
              <th className="text-left px-5 py-3">Aberta em</th>
              <th className="text-left px-5 py-3">SLA restante</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {withSla.map(({ c, rem }) => {
              const out = rem <= 0;
              const warn = rem > 0 && rem <= 10;
              return (
                <tr key={c.id} className="border-t hover:bg-background">
                  <td className="px-5 py-3 font-mono text-xs text-brand">#{c.id.slice(0,8)}</td>
                  <td className="px-5 py-3 font-medium">{c.contact?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">{agentName(c.assigned_to)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{new Date(c.opened_at).toLocaleString("pt-BR")}</td>
                  <td className="px-5 py-3">
                    {out
                      ? <span className="text-destructive font-semibold">Estourou há {Math.abs(rem)}min</span>
                      : <span className={warn ? "text-warning-foreground font-semibold" : "text-foreground"}>{rem} min</span>
                    }
                  </td>
                  <td className="px-5 py-3">
                    {out ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-destructive text-destructive-foreground font-medium pulse-danger">
                        Fora do SLA
                      </span>
                    ) : warn ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-warning text-warning-foreground font-medium">
                        Em alerta
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-success text-success-foreground font-medium">
                        No prazo
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {withSla.length === 0 && (
          <div className="p-12 text-center text-sm text-muted-foreground">Nenhuma conversa em aberto</div>
        )}
      </div>
    </AppLayout>
  );
}

function Card({ children, className="" }: any) {
  return <div className={`bg-card rounded-xl shadow-sm border p-5 ${className}`}>{children}</div>;
}
function Header({ icon: Icon, color, label }: any) {
  return (
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
      <span className={`h-8 w-8 rounded-lg grid place-items-center ${color}`}><Icon className="h-4 w-4" /></span>
    </div>
  );
}
