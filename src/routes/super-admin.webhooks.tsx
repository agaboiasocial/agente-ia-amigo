import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Loader2, Webhook, CheckCircle2, XCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { edgeFunctionUrl } from "@/lib/edge-functions";

const sb = supabase as any;

export const Route = createFileRoute("/super-admin/webhooks")({ component: Page });

function useWebhookAccounts() {
  return useQuery({
    queryKey: ["admin_webhooks"],
    queryFn: async () => {
      const { data } = await sb.from("accounts").select("*").order("name");
      return (data ?? []) as { id: string; name: string; locale: string; created_at: string }[];
    },
  });
}

function Page() {
  const { data: accounts = [], isLoading } = useWebhookAccounts();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL copiada para a área de transferência");
  };

  return (
    <SuperAdminLayout title="Webhooks">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-500">
            URLs de webhook para integração com Evolution API e plataformas externas por conta.
          </p>
        </div>

        {isLoading ? (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Webhook className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Nenhuma conta encontrada.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => {
              const webhookUrl = edgeFunctionUrl("whatsapp-webhook", acc.id);
              const hasWebhook = true; // All accounts have the endpoint available
              return (
                <div key={acc.id} className="bg-white rounded-lg border p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#0B3A5D]">{acc.name}</h3>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 bg-[#2FAE7C]/15 text-[#2FAE7C]">
                      <CheckCircle2 className="h-3 w-3" /> Ativo
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">WhatsApp Webhook URL</label>
                    <div className="flex items-center gap-1">
                      <code className="flex-1 text-[11px] bg-slate-50 border rounded px-2 py-1.5 text-slate-700 truncate">
                        {webhookUrl}
                      </code>
                      <button
                        onClick={() => copy(webhookUrl)}
                        className="h-7 w-7 rounded border hover:bg-slate-50 grid place-items-center shrink-0"
                        title="Copiar URL"
                      >
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                      </button>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400">
                    Criado em {new Date(acc.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold text-[#0B3A5D] mb-3">Configuração na Evolution API</h3>
          <div className="space-y-2 text-xs text-slate-600">
            <p>1. Acesse as configurações da sua instância na Evolution API</p>
            <p>2. No campo <strong>Webhook URL</strong>, cole a URL acima correspondente à conta</p>
            <p>3. Habilite os eventos: <code className="bg-slate-50 px-1 rounded">MESSAGES_UPSERT</code>, <code className="bg-slate-50 px-1 rounded">CONNECTION_UPDATE</code></p>
            <p>4. Salve a configuração e envie uma mensagem de teste</p>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
