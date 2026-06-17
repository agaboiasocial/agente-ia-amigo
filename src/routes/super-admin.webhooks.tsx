import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Loader2, Webhook, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { toast } from "sonner";
import { edgeFunctionUrl } from "@/lib/edge-functions";

const sb = supabase as any;

export const Route = createFileRoute("/super-admin/webhooks")({ component: Page });

interface InstanceRow {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string | null;
  account_id: string | null;
  account_name: string;
}

// O webhook é por INSTÂNCIA (instance_name no path), não por conta.
function useWebhookInstances() {
  return useQuery({
    queryKey: ["admin_webhook_instances"],
    queryFn: async (): Promise<InstanceRow[]> => {
      const [{ data: instances }, { data: accounts }] = await Promise.all([
        sb.from("whatsapp_instances").select("id, instance_name, phone_number, status, account_id").order("created_at", { ascending: false }),
        sb.from("accounts").select("id, name"),
      ]);
      const acctMap = new Map<string, string>(((accounts ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]));
      return ((instances ?? []) as Omit<InstanceRow, "account_name">[]).map((i) => ({
        ...i,
        account_name: i.account_id ? (acctMap.get(i.account_id) ?? "—") : "Sem organização",
      }));
    },
  });
}

const EVENTS = ["MESSAGES_UPSERT", "CONNECTION_UPDATE", "QRCODE_UPDATED", "SEND_MESSAGE", "MESSAGES_UPDATE"];

function statusInfo(s: string | null) {
  if (s === "connected") return { label: "Conectado", cls: "bg-[#2FAE7C]/15 text-[#2FAE7C]", ok: true };
  if (s === "connecting" || s === "pending") return { label: "Pendente", cls: "bg-amber-100 text-amber-700", ok: false };
  return { label: "Desconectado", cls: "bg-slate-100 text-slate-500", ok: false };
}

function Page() {
  const { data: instances = [], isLoading } = useWebhookInstances();

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("URL copiada");
  };

  return (
    <SuperAdminLayout title="Webhooks">
      <div className="space-y-6">
        <p className="text-sm text-slate-500">
          Cada instância WhatsApp tem uma URL de webhook própria (baseada no <strong>nome da instância</strong>).
          Os webhooks são configurados automaticamente na Evolution API ao conectar.
        </p>

        {isLoading ? (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : instances.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Webhook className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Nenhuma instância conectada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {instances.map((inst) => {
              const webhookUrl = edgeFunctionUrl("whatsapp-webhook", inst.instance_name);
              const st = statusInfo(inst.status);
              return (
                <div key={inst.id} className="bg-white rounded-lg border p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#0B3A5D] truncate">{inst.instance_name}</h3>
                      <p className="text-[11px] text-slate-400 truncate">{inst.account_name}{inst.phone_number ? ` · ${inst.phone_number}` : ""}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0 ${st.cls}`}>
                      {st.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />} {st.label}
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-slate-500 block mb-1">Webhook URL</label>
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
                </div>
              );
            })}
          </div>
        )}

        <div className="bg-white rounded-lg border p-5">
          <h3 className="text-sm font-semibold text-[#0B3A5D] mb-3">Como funciona</h3>
          <div className="space-y-2 text-xs text-slate-600">
            <p>• O webhook é configurado <strong>automaticamente</strong> na Evolution API quando você conecta uma instância (não precisa colar URL manualmente).</p>
            <p>• A URL segue o padrão <code className="bg-slate-50 px-1 rounded">.../functions/v1/whatsapp-webhook/&lt;nome-da-instância&gt;</code>.</p>
            <p>• Eventos habilitados: {EVENTS.map((e) => <code key={e} className="bg-slate-50 px-1 rounded mr-1">{e}</code>)}</p>
            <p>• <strong>Não há limite</strong> de instâncias no sistema. O limite depende do plano/infra da sua Evolution API. Um mesmo <strong>número de WhatsApp</strong> não pode estar em duas instâncias ao mesmo tempo.</p>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
