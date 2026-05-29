import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { toast } from "sonner";
import {
  Building2, Globe, Copy, CheckCircle, Webhook, Save, Loader2, Link as LinkIcon, Key,
} from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/empresa")({ component: EmpresaPage });

function useAccount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my_account"],
    queryFn: async () => {
      // Get the first account (single-tenant)
      const { data, error } = await sb.from("accounts").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        name: string;
        locale: string;
        domain: string | null;
        created_at: string;
        updated_at: string;
        plan_type: string | null;
        plan_value: number | null;
      } | null;
    },
  });
}

function EmpresaPage() {
  const qc = useQueryClient();
  const { data: account, isLoading } = useAccount();
  const [copied, setCopied] = useState<string | null>(null);
  const [webhookSecret, setWebhookSecret] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL ?? "";
  const webhookEndpoint = account ? `${supabaseUrl}/functions/v1/whatsapp-webhook/${account.id}` : "";

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copiado!");
  };

  const generateSecret = () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    setWebhookSecret(Array.from(array, (b) => b.toString(16).padStart(2, "0")).join(""));
  };

  if (isLoading) {
    return (
      <AppLayout title="Empresa">
        <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!account) {
    return (
      <AppLayout title="Empresa">
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <div className="font-semibold text-brand">Nenhuma conta encontrada</div>
          <p className="text-sm text-muted-foreground mt-1">Entre em contato com o administrador.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Empresa">
      <div className="max-w-3xl space-y-4 md:space-y-6">
        {/* Info da Empresa */}
        <div className="bg-card rounded-xl border p-4 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-success/15 text-success grid place-items-center">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-brand">Informações da Empresa</h2>
              <p className="text-xs text-muted-foreground">Dados cadastrais da sua conta</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ReadField label="Nome da conta" value={account.name} />
            <ReadField label="Idioma" value={account.locale ?? "pt"} />
            <ReadField label="Plano" value={account.plan_type ?? "Não definido"} />
            <ReadField label="Valor mensal" value={account.plan_value ? `R$ ${account.plan_value}` : "—"} />
          </div>
          <div className="flex items-center gap-2 text-sm mt-4">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-muted-foreground">Status: Ativo</span>
          </div>
        </div>

        {/* Integração Webhook */}
        <div className="bg-card rounded-xl border p-4 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-brand/10 text-brand grid place-items-center shrink-0">
              <Webhook className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-brand">Integração Webhook</h2>
              <p className="text-xs text-muted-foreground">URLs para conectar com Evolution API e n8n</p>
            </div>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">ATIVO</span>
          </div>

          <div className="space-y-4">
            {/* Webhook Endpoint */}
            <div>
              <label className="text-xs font-medium block mb-1">Webhook Endpoint (WhatsApp)</label>
              <div className="flex gap-2">
                <input readOnly value={webhookEndpoint} className="flex-1 min-w-0 h-10 px-3 rounded-lg border bg-background text-sm font-mono truncate" />
                <CopyBtn copied={copied === "endpoint"} onClick={() => handleCopy(webhookEndpoint, "endpoint")} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Configure esta URL na Evolution API para receber mensagens</p>
            </div>

            {/* Account ID */}
            <div>
              <label className="text-xs font-medium block mb-1">Account ID</label>
              <div className="flex gap-2">
                <input readOnly value={account.id} className="flex-1 min-w-0 h-10 px-3 rounded-lg border bg-background text-sm font-mono truncate" />
                <CopyBtn copied={copied === "id"} onClick={() => handleCopy(account.id, "id")} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Use no campo <code className="bg-muted px-1 rounded">AccountId</code> do n8n</p>
            </div>

            {/* Webhook Secret */}
            <div>
              <label className="text-xs font-medium block mb-1">Webhook Secret</label>
              <div className="flex gap-2">
                <input
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Gere ou insira um secret"
                  className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm font-mono"
                />
                <CopyBtn copied={copied === "secret"} onClick={() => handleCopy(webhookSecret, "secret")} disabled={!webhookSecret} />
                <button
                  onClick={generateSecret}
                  className="h-10 px-3 rounded-lg border text-xs font-medium hover:bg-background flex items-center gap-1.5"
                >
                  <Key className="h-3.5 w-3.5" /> Gerar
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Use para validar requisições de webhook recebidas</p>
            </div>
          </div>
        </div>

        {/* Configuração n8n */}
        <div className="bg-card rounded-xl border p-4 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-lg bg-success/15 text-success grid place-items-center shrink-0">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-brand">Configuração n8n</h2>
              <p className="text-xs text-muted-foreground">Copie esses valores para configurar o fluxo n8n</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium block mb-1">Webhook URL (n8n → WhatsApp)</label>
              <div className="flex gap-2">
                <input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://n8n.seudominio.com/webhook/crm-send-whatsapp"
                  className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm font-mono"
                />
                <CopyBtn copied={copied === "n8nurl"} onClick={() => handleCopy(webhookUrl, "n8nurl")} disabled={!webhookUrl} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">URL do webhook no n8n que recebe mensagens do CRM e envia pro WhatsApp</p>
            </div>
          </div>
        </div>

        {/* Payload de exemplo */}
        <div className="bg-card rounded-xl border p-4 md:p-6">
          <h3 className="text-sm font-semibold text-brand mb-3">Payload de exemplo</h3>
          <pre className="bg-background border rounded-lg p-3 md:p-4 text-xs overflow-x-auto text-muted-foreground">
{`{
  "name": "João Silva",
  "phone": "+5511999999999",
  "email": "joao@email.com",
  "source": "WhatsApp",
  "notes": "Lead vindo do site",
  "estimated_value": 1500.00,
  "probability": 50
}`}
          </pre>
          <div className="flex gap-2 text-xs text-muted-foreground mt-2">
            <span className="font-medium">Campos obrigatórios:</span>
            <code className="bg-muted px-1 rounded">name</code>
          </div>
        </div>

        {/* Info adicional */}
        <div className="bg-card rounded-xl border p-4 md:p-6">
          <h3 className="text-sm font-semibold text-brand mb-3">Informações adicionais</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Criado em:</span>
              <p className="font-medium">{new Date(account.created_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Última atualização:</span>
              <p className="font-medium">{account.updated_at ? new Date(account.updated_at).toLocaleDateString("pt-BR") : "—"}</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1">{label}</label>
      <input readOnly value={value} className="w-full h-10 px-3 rounded-lg border bg-muted text-sm" />
    </div>
  );
}

function CopyBtn({ copied, onClick, disabled }: { copied: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-10 w-10 rounded-lg border hover:bg-background grid place-items-center shrink-0 disabled:opacity-40"
      title="Copiar"
    >
      {copied ? <CheckCircle className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}
