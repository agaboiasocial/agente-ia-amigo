import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/super-admin/")({
  component: Page,
});

const stats = [
  { label: "Total de contas", value: 2 },
  { label: "Total de usuários", value: 12 },
  { label: "Total de conversas", value: 264 },
  { label: "Total de mensagens", value: 5821 },
];

const topAccounts = [
  { name: "Agente IA Social", conv: 264 },
  { name: "Clínica Guimarães | Saúde", conv: 0 },
];

function Page() {
  return (
    <SuperAdminLayout title="Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <div className="text-sm text-slate-500">{s.label}</div>
            <div className="mt-2 text-3xl font-semibold text-[#0B3A5D]">{s.value}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
        <Card className="p-5">
          <h3 className="font-semibold text-[#0B3A5D] mb-4">Conversas por conta</h3>
          <div className="space-y-3">
            {topAccounts.map((a) => {
              const max = Math.max(...topAccounts.map((x) => x.conv), 1);
              const pct = (a.conv / max) * 100;
              return (
                <div key={a.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{a.name}</span>
                    <span className="text-slate-500">{a.conv}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded">
                    <div className="h-2 rounded bg-[#2FAE7C]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-[#0B3A5D] mb-4">Novas contas por mês</h3>
          <div className="flex items-end gap-2 h-40">
            {[1, 0, 2, 1, 0, 1, 2, 0, 1, 1, 0, 2].map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-[#0B3A5D] rounded-t"
                  style={{ height: `${(v / 2) * 100}%`, minHeight: 4 }}
                />
                <span className="text-[10px] text-slate-400">{i + 1}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="font-semibold text-[#0B3A5D] mb-4">Contas mais ativas</h3>
          <ul className="divide-y">
            {topAccounts.map((a) => (
              <li key={a.name} className="py-2 flex justify-between text-sm">
                <span>{a.name}</span>
                <span className="text-slate-500">{a.conv} conversas</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
