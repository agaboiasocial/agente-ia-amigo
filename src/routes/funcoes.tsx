import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { Sparkles, Plus, Code2, Webhook, Database, Calendar, CreditCard, Trash2 } from "lucide-react";

export const Route = createFileRoute("/funcoes")({ component: FuncoesPage });

const funcs = [
  { id: "1", name: "Consultar pedido", icon: Database, desc: "Busca status do pedido pelo número no ERP", trigger: "/pedido", active: true },
  { id: "2", name: "Agendar reunião", icon: Calendar, desc: "Cria evento no Google Calendar do agente", trigger: "/agendar", active: true },
  { id: "3", name: "Enviar boleto", icon: CreditCard, desc: "Gera 2ª via via API do gateway de pagamento", trigger: "/boleto", active: false },
  { id: "4", name: "Webhook CRM", icon: Webhook, desc: "Notifica HubSpot quando lead qualificar", trigger: "auto", active: true },
];

function FuncoesPage() {
  return (
    <AppLayout
      title="Funções personalizadas"
      actions={
        <button className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> Nova função
        </button>
      }
    >
      <div className="bg-warning/15 border border-warning rounded-xl p-4 flex items-start gap-3 mb-6">
        <Sparkles className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-foreground">Recurso liberado</div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Conecte o IAS a APIs externas, bancos de dados e webhooks para executar ações automaticamente durante a conversa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {funcs.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.id} className="bg-card border rounded-xl p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-success/15 text-success grid place-items-center">
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  f.active ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {f.active ? "ATIVA" : "PAUSADA"}
                </span>
              </div>
              <h3 className="font-semibold text-brand">{f.name}</h3>
              <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <code className="text-[11px] bg-background px-2 py-1 rounded font-mono text-success">{f.trigger}</code>
                <div className="flex items-center gap-1">
                  <button className="h-8 w-8 rounded-lg hover:bg-background grid place-items-center text-muted-foreground">
                    <Code2 className="h-4 w-4" />
                  </button>
                  <button className="h-8 w-8 rounded-lg hover:bg-background grid place-items-center text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <button className="border-2 border-dashed rounded-xl p-5 text-muted-foreground hover:border-success hover:text-success transition-colors flex flex-col items-center justify-center min-h-[180px]">
          <Plus className="h-8 w-8 mb-2" />
          <span className="text-sm font-medium">Criar nova função</span>
          <span className="text-xs mt-1">A partir de zero ou de um template</span>
        </button>
      </div>
    </AppLayout>
  );
}
