import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Bot, Sparkles, Wand2, BookOpen, Zap, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/ias")({ component: IASPage });

function IASPage() {
  const [enabled, setEnabled] = useState(true);
  const [tone, setTone] = useState("amigavel");
  const [autoReply, setAutoReply] = useState(true);

  return (
    <AppLayout title="IAS — Agente Inteligente">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status card */}
        <div className="lg:col-span-2 bg-card rounded-xl border shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-success/15 text-success grid place-items-center">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold text-brand text-lg">Assistente IAS</h2>
                <p className="text-xs text-muted-foreground">Responde clientes automaticamente com IA contextual.</p>
              </div>
            </div>
            <button
              onClick={() => setEnabled((e) => !e)}
              className={`h-9 px-4 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                enabled ? "bg-success text-success-foreground" : "bg-background border"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {enabled ? "Ativo" : "Desativado"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Tom de voz">
              <select value={tone} onChange={(e) => setTone(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                <option value="amigavel">Amigável</option>
                <option value="formal">Formal</option>
                <option value="vendedor">Consultivo / vendas</option>
                <option value="tecnico">Técnico</option>
              </select>
            </Field>
            <Field label="Idioma principal">
              <select className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                <option>Português (BR)</option>
                <option>Inglês</option>
                <option>Espanhol</option>
              </select>
            </Field>
            <Field label="Modelo de IA">
              <select className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                <option>IAS-Pro (recomendado)</option>
                <option>IAS-Lite (econômico)</option>
                <option>IAS-Max (raciocínio avançado)</option>
              </select>
            </Field>
            <Field label="Encaminhar para humano após">
              <select className="w-full h-10 px-3 rounded-lg border bg-background text-sm">
                <option>3 mensagens sem solução</option>
                <option>Solicitação explícita</option>
                <option>Nunca</option>
              </select>
            </Field>
          </div>

          <div className="mt-5">
            <label className="text-xs font-medium">Instruções do agente (system prompt)</label>
            <textarea
              defaultValue="Você é o IAS, atendente virtual da nossa empresa. Seja cordial, objetivo e use português brasileiro. Sempre que não souber, ofereça transferir para um agente humano."
              className="mt-1 w-full min-h-[120px] p-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success"
            />
          </div>

          <div className="mt-5 flex items-center justify-between p-4 rounded-lg bg-background border">
            <div>
              <div className="text-sm font-medium">Resposta automática</div>
              <div className="text-xs text-muted-foreground">IAS responde a primeira mensagem antes do agente humano</div>
            </div>
            <button onClick={() => setAutoReply((a) => !a)}
              className={`relative h-6 w-11 rounded-full transition-colors ${autoReply ? "bg-success" : "bg-muted"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${autoReply ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          <Stat icon={Zap} label="Mensagens hoje" value="1.284" tone="success" />
          <Stat icon={Sparkles} label="Taxa de resolução" value="78%" tone="brand" />
          <Stat icon={Wand2} label="Tempo médio" value="1m 12s" tone="warning" />

          <div className="bg-brand text-brand-foreground rounded-xl p-5">
            <BookOpen className="h-5 w-5 mb-2" />
            <h3 className="font-semibold text-sm">Base de conhecimento</h3>
            <p className="text-xs opacity-80 mt-1">42 documentos · 218 perguntas treinadas</p>
            <button className="mt-4 h-9 px-3 rounded-lg bg-warning text-warning-foreground text-xs font-semibold w-full">
              Gerenciar conhecimento
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function Stat({ icon: Icon, label, value, tone }: any) {
  const map: any = {
    success: "bg-success/15 text-success",
    brand: "bg-brand/10 text-brand",
    warning: "bg-warning/30 text-warning-foreground",
  };
  return (
    <div className="bg-card rounded-xl border p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg grid place-items-center ${map[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold text-brand">{value}</div>
      </div>
    </div>
  );
}
