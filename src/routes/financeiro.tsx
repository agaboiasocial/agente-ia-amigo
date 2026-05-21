import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { useFinanceSummary, usePaymentSchedules } from "@/lib/finance";
import { CheckCircle2, Clock3, Loader2, Wallet, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/financeiro")({ component: FinanceiroPage });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function FinanceiroPage() {
  const { data: payments = [], isLoading } = usePaymentSchedules();
  const summary = useFinanceSummary(payments);

  return (
    <AppLayout title="Financeiro">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={Wallet} label="Total previsto" value={money.format(summary.total)} />
          <Kpi icon={CheckCircle2} label="Recebido" value={money.format(summary.received)} />
          <Kpi icon={Clock3} label="Em aberto" value={money.format(summary.pending)} />
          <Kpi icon={AlertTriangle} label="Vencido" value={money.format(summary.overdue)} />
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="border-b px-5 py-3">
            <h2 className="text-sm font-semibold text-brand">Agenda de pagamentos</h2>
          </div>
          {isLoading ? (
            <div className="grid place-items-center p-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : payments.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum lançamento financeiro encontrado.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 text-left">Cliente</th>
                  <th className="px-5 py-3 text-left">Vencimento</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="px-5 py-3">{payment.contact?.name ?? "Sem contato"}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {new Date(`${payment.due_date}T00:00:00`).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-brand">
                      {money.format(payment.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
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

function StatusBadge({ status }: { status: string }) {
  const label = status === "paid" ? "Pago" : status === "overdue" ? "Vencido" : "Pendente";
  const cls =
    status === "paid"
      ? "bg-success/15 text-success"
      : status === "overdue"
        ? "bg-destructive/15 text-destructive"
        : "bg-warning/30 text-warning-foreground";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}
