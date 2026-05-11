import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/super-admin/settings")({ component: Page });

function Page() {
  const [name, setName] = useState("Agente IA Social");
  const [logo, setLogo] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://app.ias.com");
  const [smtpHost, setSmtpHost] = useState("smtp.sendgrid.net");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("apikey");
  const [storage, setStorage] = useState("local");
  const [rate, setRate] = useState("1000");

  return (
    <SuperAdminLayout
      title="Settings"
      actions={<Button className="bg-[#2FAE7C] hover:bg-[#26926a] text-white" onClick={() => toast.success("Configurações salvas")}>Salvar</Button>}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <h3 className="font-semibold text-[#0B3A5D]">Plataforma</h3>
          <div><Label>Nome da plataforma</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Logo (URL)</Label><Input value={logo} onChange={(e) => setLogo(e.target.value)} /></div>
          <div><Label>URL base</Label><Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} /></div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-semibold text-[#0B3A5D]">Mailer (SMTP)</h3>
          <div><Label>Host</Label><Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Porta</Label><Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} /></div>
            <div><Label>Usuário</Label><Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} /></div>
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-semibold text-[#0B3A5D]">Storage</h3>
          <div><Label>Provedor</Label><Input value={storage} onChange={(e) => setStorage(e.target.value)} placeholder="local, s3, r2..." /></div>
        </Card>

        <Card className="p-5 space-y-3">
          <h3 className="font-semibold text-[#0B3A5D]">Rate limiting</h3>
          <div><Label>Limite por hora</Label><Input value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        </Card>
      </div>
    </SuperAdminLayout>
  );
}
