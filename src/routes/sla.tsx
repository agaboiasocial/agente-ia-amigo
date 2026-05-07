import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { conversations } from "@/lib/mock-data";
import { CheckCircle2, AlertTriangle, Timer, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/sla")({ component: SlaPage });

function SlaPage() {
  const dentro = conversations.filter(c=>c.slaRemaining > 10).length;
  const alerta = conversations.filter(c=>c.slaRemaining > 0 && c.slaRemaining <= 10).length;
  const fora = conversations.filter(c=>c.slaRemaining <= 0 && c.status !== "resolvida").length;
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <h3 className="font-semibold text-brand mb-4">Tempo de primeira resposta</h3>
          <Bar meta="2m" real="1m 48s" pct={88} ok />
        </Card>
        <Card>
          <h3 className="font-semibold text-brand mb-4">Tempo de resolução</h3>
          <Bar meta="2h" real="2h 14m" pct={107} />
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
              <th className="text-left px-5 py-3">Tempo aberta</th>
              <th className="text-left px-5 py-3">SLA restante</th>
              <th className="text-left px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {conversations.filter(c=>c.status!=="resolvida").map(c => {
              const out = c.slaRemaining <= 0;
              const warn = c.slaRemaining > 0 && c.slaRemaining <= 10;
              return (
                <tr key={c.id} className="border-t hover:bg-background">
                  <td className="px-5 py-3 font-mono text-xs text-brand">#{c.id}</td>
                  <td className="px-5 py-3 font-medium">{c.contactName}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.agent}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.openedAt}</td>
                  <td className="px-5 py-3">
                    {out
                      ? <span className="text-destructive font-semibold">Estourou há {Math.abs(c.slaRemaining)}min</span>
                      : <span className={warn ? "text-warning-foreground font-semibold" : "text-foreground"}>{c.slaRemaining} min</span>
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
      </div>

      <Card>
        <h3 className="font-semibold text-brand mb-4">Configuração de regras SLA</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Tempo de primeira resposta (min)" value="2" />
          <Field label="Tempo de resolução (min)" value="120" />
          <Field label="Horário de funcionamento" value="08:00 - 18:00" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="h-10 px-4 rounded-lg border text-sm">Cancelar</button>
          <button className="h-10 px-5 rounded-lg bg-success text-success-foreground font-semibold text-sm">Salvar regras</button>
        </div>
      </Card>
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
function Bar({ meta, real, pct, ok=false }: any) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-2">
        <span className="text-muted-foreground">Meta: <b className="text-foreground">{meta}</b></span>
        <span className={ok ? "text-success font-semibold" : "text-destructive font-semibold"}>Realizado: {real}</span>
      </div>
      <div className="h-2.5 rounded-full bg-background overflow-hidden">
        <div style={{ width: `${Math.min(pct, 100)}%` }}
          className={`h-full ${ok ? "bg-success" : "bg-destructive"} transition-all`} />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">{pct}% da meta</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input defaultValue={value} className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success" />
    </label>
  );
}
