import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ArrowRight,
  Smartphone,
  MessageSquare,
  Webhook,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/whatsapp")({ component: Page });

type ConnState = "disconnected" | "connecting" | "connected" | "error";

interface Instance {
  inboxName: string;
  profileName: string;
  phone: string;
  connectedAt: string;
  webhookUrl: string;
  webhookActive: boolean;
  lastEventAt: string;
  autoReceive: boolean;
  readReceipts: boolean;
  team: string;
  defaultAgent: string;
  welcomeMessage: string;
  awayMessage: string;
  schedule: string;
  sentToday: number;
  receivedToday: number;
  lastActivity: string;
}

const STORAGE_KEY = "ias.whatsapp.instance.v1";

function loadInstance(): Instance | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Instance) : null;
  } catch {
    return null;
  }
}
function saveInstance(i: Instance | null) {
  if (i) localStorage.setItem(STORAGE_KEY, JSON.stringify(i));
  else localStorage.removeItem(STORAGE_KEY);
}

function Page() {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setInstance(loadInstance());
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <AppLayout title="WhatsApp">
        <div className="grid place-items-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!instance) {
    return (
      <ConnectFlow
        onConnected={(i) => {
          saveInstance(i);
          setInstance(i);
        }}
      />
    );
  }
  return (
    <ManageInstance
      instance={instance}
      onSave={(i) => {
        saveInstance(i);
        setInstance(i);
        toast.success("Configurações salvas");
      }}
      onDisconnect={() => {
        if (!confirm("Desconectar WhatsApp?")) return;
        saveInstance(null);
        setInstance(null);
        toast.success("WhatsApp desconectado");
      }}
    />
  );
}

/* ---------------- CONNECT FLOW ---------------- */

function ConnectFlow({ onConnected }: { onConnected: (i: Instance) => void }) {
  const [state, setState] = useState<ConnState>("disconnected");
  const [seconds, setSeconds] = useState(40);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (state !== "disconnected") return;
    setSeconds(40);
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [state]);

  const regenerate = () => {
    setState("disconnected");
    setSeconds(40);
  };

  const simulateScan = () => {
    setState("connecting");
    setTimeout(() => {
      // 90% success
      if (Math.random() > 0.1) {
        const inst: Instance = {
          inboxName: "Atendimento Principal",
          profileName: "IAS Atendimento",
          phone: "+55 (11) 98765-4321",
          connectedAt: new Date().toISOString(),
          webhookUrl: "https://api.ias.com.br/webhooks/whatsapp/abc123",
          webhookActive: true,
          lastEventAt: new Date().toISOString(),
          autoReceive: true,
          readReceipts: true,
          team: "Atendimento",
          defaultAgent: "Maria Silva",
          welcomeMessage: "Olá! 👋 Bem-vindo ao nosso atendimento. Em que podemos ajudar?",
          awayMessage: "No momento estamos fora do horário de atendimento. Retornaremos em breve!",
          schedule: "Comercial (Seg–Sex 09h–18h)",
          sentToday: 142,
          receivedToday: 218,
          lastActivity: "agora",
        };
        onConnected(inst);
      } else {
        setError("Não foi possível estabelecer a conexão com o WhatsApp. Verifique sua internet e tente novamente.");
        setState("error");
      }
    }, 1800);
  };

  return (
    <AppLayout title="Conectar WhatsApp">
      <div className="max-w-xl mx-auto">
        <div className="bg-card rounded-2xl border shadow-sm p-8">
          {state === "disconnected" && (
            <DisconnectedView seconds={seconds} expired={seconds === 0} onRegenerate={regenerate} onSimulateScan={simulateScan} />
          )}
          {state === "connecting" && <ConnectingView />}
          {state === "error" && <ErrorView message={error} onRetry={regenerate} />}
        </div>
      </div>
    </AppLayout>
  );
}

function DisconnectedView({
  seconds,
  expired,
  onRegenerate,
  onSimulateScan,
}: {
  seconds: number;
  expired: boolean;
  onRegenerate: () => void;
  onSimulateScan: () => void;
}) {
  return (
    <div className="text-center">
      <div className="h-14 w-14 rounded-2xl bg-success/15 text-success grid place-items-center mx-auto mb-3">
        <WhatsAppIcon className="h-7 w-7" />
      </div>
      <h2 className="text-xl font-semibold text-brand">Conectar WhatsApp</h2>
      <p className="text-sm text-muted-foreground mt-1">Escaneie o QR Code com seu WhatsApp para conectar</p>

      <div className="mt-6 flex justify-center">
        <div className="relative h-[280px] w-[280px] rounded-xl bg-white border p-4 grid place-items-center">
          <FakeQR />
          {expired && (
            <div className="absolute inset-0 rounded-xl bg-brand/85 text-brand-foreground grid place-items-center">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 mx-auto mb-2" />
                <div className="text-sm font-semibold">QR Code expirado</div>
                <button
                  onClick={onRegenerate}
                  className="mt-3 h-9 px-4 rounded-lg bg-success text-success-foreground text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Gerar novo QR
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {!expired && (
        <div className="text-xs text-muted-foreground mt-2">
          Expira em {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
        </div>
      )}

      <ol className="mt-6 space-y-2 text-left max-w-sm mx-auto">
        {[
          "Abra o WhatsApp no seu celular",
          "Toque em Menu (⋮) ou Configurações",
          'Toque em "Dispositivos conectados"',
          'Toque em "Conectar dispositivo"',
          "Aponte a câmera para o QR Code",
        ].map((t, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="h-6 w-6 rounded-full bg-success/15 text-success grid place-items-center text-xs font-bold shrink-0">
              {i + 1}
            </span>
            <span className="text-foreground">{t}</span>
          </li>
        ))}
      </ol>

      <button onClick={onSimulateScan} className="mt-6 text-xs text-muted-foreground underline hover:text-success">
        Simular leitura do QR (demo)
      </button>
    </div>
  );
}

function ConnectingView() {
  return (
    <div className="text-center py-8">
      <Loader2 className="h-14 w-14 text-success animate-spin mx-auto" />
      <h2 className="text-xl font-semibold text-brand mt-5 animate-pulse">Conectando...</h2>
      <p className="text-sm text-muted-foreground mt-1">Aguarde enquanto estabelecemos a conexão</p>
    </div>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="text-center py-6">
      <div className="h-14 w-14 rounded-full bg-destructive/15 text-destructive grid place-items-center mx-auto">
        <XCircle className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-brand mt-4">Falha na conexão</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{message}</p>
      <button
        onClick={onRetry}
        className="mt-5 h-10 px-5 rounded-lg bg-success text-success-foreground text-sm font-semibold inline-flex items-center gap-1.5"
      >
        <RefreshCw className="h-4 w-4" /> Tentar novamente
      </button>
    </div>
  );
}

/* ---------------- MANAGE INSTANCE ---------------- */

function ManageInstance({
  instance,
  onSave,
  onDisconnect,
}: {
  instance: Instance;
  onSave: (i: Instance) => void;
  onDisconnect: () => void;
}) {
  const [form, setForm] = useState<Instance>(instance);
  const connected = true;

  const set = <K extends keyof Instance>(k: K, v: Instance[K]) => setForm((p) => ({ ...p, [k]: v }));

  const copyWebhook = () => {
    navigator.clipboard.writeText(form.webhookUrl);
    toast.success("URL copiada");
  };

  return (
    <AppLayout
      title={form.inboxName}
      actions={
        <div className="flex items-center gap-2">
          <span
            className={`text-[11px] px-2 py-1 rounded-full font-semibold inline-flex items-center gap-1 ${
              connected ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Conectado" : "Desconectado"}
          </span>
          <button
            onClick={onDisconnect}
            className="h-9 px-3 rounded-lg border border-destructive text-destructive text-xs font-semibold hover:bg-destructive/5"
          >
            Desconectar
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Connected success banner (first render only via fade) */}
        <div className="bg-card border rounded-xl p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-success/15 text-success grid place-items-center">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-brand">WhatsApp Conectado!</div>
            <div className="text-xs text-muted-foreground">
              {form.profileName} · {form.phone}
            </div>
          </div>
          <Link
            to="/conversas"
            className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold inline-flex items-center gap-1.5"
          >
            Ir para conversas <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <InfoCard label="Número conectado" value={form.phone} icon={Smartphone} />
          <InfoCard label="Nome do perfil" value={form.profileName} icon={Smartphone} />
          <InfoCard label="Última atividade" value={form.lastActivity} icon={Wifi} />
          <InfoCard label="Enviadas hoje" value={String(form.sentToday)} icon={MessageSquare} tone="success" />
          <InfoCard label="Recebidas hoje" value={String(form.receivedToday)} icon={MessageSquare} tone="brand" />
        </div>

        {/* Settings */}
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-brand">Configurações da caixa</h3>

          <Field label="Nome da caixa de entrada">
            <input
              value={form.inboxName}
              onChange={(e) => set("inboxName", e.target.value)}
              className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </Field>

          <div className="grid md:grid-cols-2 gap-3">
            <Toggle label="Receber mensagens automaticamente" checked={form.autoReceive} onChange={() => set("autoReceive", !form.autoReceive)} />
            <Toggle label="Enviar confirmação de leitura" checked={form.readReceipts} onChange={() => set("readReceipts", !form.readReceipts)} />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <Field label="Equipe responsável">
              <select
                value={form.team}
                onChange={(e) => set("team", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              >
                {["Atendimento", "Vendas", "Suporte", "Financeiro"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Agente padrão">
              <select
                value={form.defaultAgent}
                onChange={(e) => set("defaultAgent", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              >
                {["Maria Silva", "João Santos", "Ana Costa", "Sem padrão"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Horário de funcionamento">
              <select
                value={form.schedule}
                onChange={(e) => set("schedule", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              >
                {[
                  "Comercial (Seg–Sex 09h–18h)",
                  "Estendido (Seg–Sáb 08h–20h)",
                  "24/7",
                  "Personalizado",
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Mensagem de boas-vindas automática">
            <textarea
              rows={2}
              value={form.welcomeMessage}
              onChange={(e) => set("welcomeMessage", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </Field>

          <Field label="Mensagem de ausência">
            <textarea
              rows={2}
              value={form.awayMessage}
              onChange={(e) => set("awayMessage", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </Field>
        </div>

        {/* Webhook */}
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Webhook className="h-4 w-4 text-success" />
            <h3 className="font-semibold text-brand">Webhook</h3>
            <span
              className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                form.webhookActive ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {form.webhookActive ? "ATIVO" : "INATIVO"}
            </span>
          </div>
          <Field label="URL do webhook">
            <div className="flex gap-2">
              <input
                readOnly
                value={form.webhookUrl}
                className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm font-mono"
              />
              <button
                onClick={copyWebhook}
                className="h-10 px-3 rounded-lg border text-sm hover:bg-background inline-flex items-center gap-1.5"
              >
                <Copy className="h-4 w-4" /> Copiar
              </button>
            </div>
          </Field>
          <div className="text-xs text-muted-foreground mt-3">
            Último evento recebido:{" "}
            <span className="text-foreground font-medium">
              {new Date(form.lastEventAt).toLocaleString("pt-BR")}
            </span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={() => onSave(form)}
            className="h-10 px-5 rounded-lg bg-success text-success-foreground text-sm font-semibold hover:opacity-95"
          >
            Salvar configurações
          </button>
        </div>
      </div>
    </AppLayout>
  );
}

/* ---------------- bits ---------------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-success" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "brand";
}) {
  const toneCls = tone === "success" ? "text-success" : tone === "brand" ? "text-brand" : "text-foreground";
  return (
    <div className="bg-card border rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`text-sm font-semibold mt-1 truncate ${toneCls}`}>{value}</div>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.52 3.48A11.94 11.94 0 0 0 12.06 0C5.5 0 .18 5.32.18 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.34-1.66a11.86 11.86 0 0 0 5.71 1.45h.01c6.56 0 11.88-5.32 11.88-11.88 0-3.17-1.24-6.16-3.42-8.43ZM12.06 21.5h-.01a9.6 9.6 0 0 1-4.9-1.34l-.35-.21-3.76.99 1.01-3.66-.23-.38a9.62 9.62 0 0 1-1.48-5.12c0-5.31 4.32-9.63 9.64-9.63 2.57 0 4.99 1 6.81 2.83a9.55 9.55 0 0 1 2.82 6.82c0 5.31-4.32 9.7-9.55 9.7Zm5.55-7.21c-.3-.15-1.79-.88-2.07-.98-.28-.1-.48-.15-.69.15-.2.3-.79.98-.97 1.18-.18.2-.36.22-.66.07-.3-.15-1.27-.47-2.41-1.49-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.36.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.66-1.6-.91-2.19-.24-.57-.49-.5-.66-.5l-.56-.01c-.2 0-.53.07-.81.38-.28.3-1.06 1.04-1.06 2.54 0 1.5 1.09 2.96 1.24 3.16.15.2 2.14 3.27 5.19 4.59.73.31 1.29.5 1.73.64.73.23 1.39.2 1.91.12.58-.09 1.79-.73 2.04-1.43.25-.7.25-1.31.18-1.43-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function FakeQR() {
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < 21; i++) {
    for (let j = 0; j < 21; j++) {
      const corner = (i < 7 && j < 7) || (i < 7 && j > 13) || (i > 13 && j < 7);
      const filled = corner
        ? i === 0 || i === 6 || j === 0 || j === 6 || (i > 1 && i < 5 && j > 1 && j < 5)
        : ((i * 31 + j * 17) % 7) < 3;
      cells.push(<div key={`${i}-${j}`} className={filled ? "bg-brand" : ""} />);
    }
  }
  return (
    <div
      className="w-full h-full"
      style={{ display: "grid", gridTemplateColumns: "repeat(21, 1fr)", gridTemplateRows: "repeat(21, 1fr)" }}
    >
      {cells}
    </div>
  );
}
