import { createFileRoute } from "@tanstack/react-router";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/super-admin/instance-health")({ component: Page });

const dot = (color: string) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${color}`} />;

function Page() {
  return (
    <SuperAdminLayout title="Instance Health">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="text-sm text-slate-500">Versão</div>
          <div className="mt-2 text-2xl font-semibold text-[#0B3A5D]">4.13.0</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Redis</div>
          <div className="mt-2 flex items-center gap-2"><span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#2FAE7C]/15 text-[#2FAE7C] font-medium">Online</span></div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Banco de dados</div>
          <div className="mt-2 flex items-center gap-2"><span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#2FAE7C]/15 text-[#2FAE7C] font-medium">Online</span></div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Sidekiq</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div><div className="text-slate-500 text-xs">Pendentes</div><div className="font-semibold">12</div></div>
            <div><div className="text-slate-500 text-xs">Processados</div><div className="font-semibold">5,820</div></div>
            <div><div className="text-slate-500 text-xs">Falhados</div><div className="font-semibold text-[#EF4444]">3</div></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Uptime</div>
          <div className="mt-2 text-2xl font-semibold text-[#0B3A5D]">12d 4h</div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Memória</div>
          <div className="mt-2 flex items-center gap-2">{dot("bg-[#F2C94C]")}<span className="text-sm">68% (5.4 / 8 GB)</span></div>
          <div className="mt-2 h-2 bg-slate-100 rounded"><div className="h-2 rounded bg-[#F2C94C]" style={{ width: "68%" }} /></div>
        </Card>
        <Card className="p-5">
          <div className="text-sm text-slate-500">Disco</div>
          <div className="mt-2 flex items-center gap-2">{dot("bg-[#2FAE7C]")}<span className="text-sm">42% (84 / 200 GB)</span></div>
          <div className="mt-2 h-2 bg-slate-100 rounded"><div className="h-2 rounded bg-[#2FAE7C]" style={{ width: "42%" }} /></div>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
