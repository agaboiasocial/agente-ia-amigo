import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/super-admin/sidekiq")({ component: Page });

function Page() {
  return (
    <SuperAdminLayout title="Sidekiq Dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5"><div className="text-sm text-slate-500">Jobs pendentes</div><div className="mt-2 text-3xl font-semibold text-[#0B3A5D]">12</div></Card>
        <Card className="p-5"><div className="text-sm text-slate-500">Processados</div><div className="mt-2 text-3xl font-semibold text-[#2FAE7C]">5,820</div></Card>
        <Card className="p-5"><div className="text-sm text-slate-500">Falhados</div><div className="mt-2 text-3xl font-semibold text-[#EF4444]">3</div></Card>
      </div>
      <Card className="mt-4 p-5">
        <h3 className="font-semibold text-[#0B3A5D] mb-3">Filas</h3>
        <table className="w-full text-sm">
          <thead className="text-slate-500"><tr><th className="text-left py-2">Nome</th><th className="text-left">Tamanho</th><th className="text-left">Latência</th></tr></thead>
          <tbody>
            <tr className="border-t"><td className="py-2">default</td><td>8</td><td>2s</td></tr>
            <tr className="border-t"><td className="py-2">mailers</td><td>3</td><td>1s</td></tr>
            <tr className="border-t"><td className="py-2">webhooks</td><td>1</td><td>0s</td></tr>
          </tbody>
        </table>
      </Card>
    </SuperAdminLayout>
  );
}
