import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { QrCode, Smartphone, RefreshCw, CheckCircle2, AlertCircle, Plus, Trash2, Wifi } from "lucide-react";

export const Route = createFileRoute("/whatsapp")({ component: WhatsAppPage });

type Status = "pending" | "scanning" | "connected";

const sessions = [
  { id: "s1", name: "Atendimento Principal", phone: "+55 11 99999-1234", status: "connected" as Status, since: "há 3 dias" },
  { id: "s2", name: "Vendas", phone: "+55 11 98888-5678", status: "connected" as Status, since: "há 12h" },
];

function WhatsAppPage() {
  const [showQR, setShowQR] = useState(false);
  const [status, setStatus] = useState<Status>("pending");
  const [seconds, setSeconds] = useState(40);

  useEffect(() => {
    if (!showQR || status === "connected") return;
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [showQR, status]);

  const startConnection = () => {
    setShowQR(true);
    setStatus("scanning");
    setSeconds(40);
  };

  return (
    <AppLayout title="Conectar WhatsApp">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Sessions list */}
          <div className="bg-card rounded-xl border shadow-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-brand">Números conectados</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Sessões ativas via Evolution API</p>
              </div>
              <button
                onClick={startConnection}
                className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" /> Novo número
              </button>
            </div>
            <ul>
              {sessions.map((s) => (
                <li key={s.id} className="px-5 py-4 border-b last:border-0 flex items-center gap-4">
                  <div className="h-11 w-11 rounded-xl bg-success/15 text-success grid place-items-center">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.phone} · conectado {s.since}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-success text-success-foreground font-semibold">
                    <Wifi className="h-3 w-3" /> Online
                  </span>
                  <button className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* QR Code panel */}
          {showQR && (
            <div className="bg-card rounded-xl border shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-semibold text-brand">Escaneie o QR Code</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Abra WhatsApp → Aparelhos conectados → Conectar aparelho</p>
                </div>
                {status === "scanning" && (
                  <span className="text-xs text-warning-foreground bg-warning/30 px-2 py-1 rounded-full font-medium">
                    Expira em {seconds}s
                  </span>
                )}
              </div>

              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative">
                  {status === "connected" ? (
                    <div className="h-64 w-64 rounded-2xl bg-success/10 border-2 border-success grid place-items-center">
                      <CheckCircle2 className="h-20 w-20 text-success" />
                    </div>
                  ) : (
                    <div className="h-64 w-64 rounded-2xl bg-white border-2 border-dashed border-success p-3 grid place-items-center">
                      <FakeQR />
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-3">
                  <Step n={1} text="Abra o WhatsApp no seu celular" />
                  <Step n={2} text="Toque em Menu (⋮) → Aparelhos conectados" />
                  <Step n={3} text="Toque em 'Conectar um aparelho'" />
                  <Step n={4} text="Aponte a câmera para este QR Code" />

                  <div className="flex gap-2 pt-3">
                    <button
                      onClick={() => { setSeconds(40); setStatus("scanning"); }}
                      className="h-10 px-4 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-background"
                    >
                      <RefreshCw className="h-4 w-4" /> Gerar novo QR
                    </button>
                    <button
                      onClick={() => setStatus("connected")}
                      className="h-10 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold"
                    >
                      Simular conexão
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-5">
            <div className="h-10 w-10 rounded-lg bg-success/15 text-success grid place-items-center mb-3">
              <QrCode className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-brand text-sm">Evolution API</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Conecte qualquer número WhatsApp via QR Code, sem precisar do WhatsApp Business API oficial.
            </p>
            <div className="mt-4 space-y-2 text-xs">
              <Row k="Servidor" v="evolution.ias.com.br" />
              <Row k="Versão" v="v2.1.4" />
              <Row k="Webhook" v="ativo" tone="success" />
            </div>
          </div>

          <div className="bg-warning/15 border border-warning rounded-xl p-4 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-warning-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              O QR Code expira em 40 segundos. Mantenha o celular conectado à internet durante o pareamento.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-7 w-7 rounded-full bg-success text-success-foreground grid place-items-center text-xs font-bold shrink-0">{n}</div>
      <span className="text-sm">{text}</span>
    </div>
  );
}
function Row({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground">{k}</span>
      <span className={`font-medium ${tone === "success" ? "text-success" : "text-foreground"}`}>{v}</span>
    </div>
  );
}
function FakeQR() {
  // Deterministic pseudo-random pattern
  const cells = [];
  for (let i = 0; i < 21; i++) {
    for (let j = 0; j < 21; j++) {
      const corner =
        (i < 7 && j < 7) || (i < 7 && j > 13) || (i > 13 && j < 7);
      const filled = corner ? ((i === 0 || i === 6 || j === 0 || j === 6) || (i > 1 && i < 5 && j > 1 && j < 5)) : (((i * 31 + j * 17) % 7) < 3);
      cells.push(<div key={`${i}-${j}`} className={filled ? "bg-brand" : ""} />);
    }
  }
  return <div className="grid grid-cols-21 gap-0 w-full h-full" style={{ gridTemplateColumns: "repeat(21, 1fr)", gridTemplateRows: "repeat(21, 1fr)" }}>{cells}</div>;
}
