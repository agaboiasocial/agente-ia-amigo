import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { callEdgeFunction } from "@/lib/edge-functions";
import { MessageCircle, Plus, RefreshCw, CheckCircle2, AlertCircle, Loader2, PowerOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/canais")({ component: CanaisPage });

type Instance = {
  id: string;
  instance_name: string;
  phone_number: string | null;
  profile_name: string | null;
  profile_pic: string | null;
  status: string | null;
  created_at: string | null;
  inbox_id: string | null;
  inbox_name: string | null;
  webhook_configured: boolean;
};

function CanaisPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { accountId, session, loading: authLoading } = useAuth();

  const load = useCallback(async () => {
    if (!accountId) {
      setInstances([]);
      setLoadError("Conta atual não identificada. Recarregue a página e tente novamente.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: inboxes, error: inboxError } = await (supabase as any)
        .from("inboxes")
        .select("id, name, instance_name")
        .eq("account_id", accountId);
      if (inboxError) throw inboxError;

      const inboxByInstance = new Map<string, any>(
        ((inboxes ?? []) as any[]).map((inbox) => [inbox.instance_name, inbox])
      );
      setInstances(((data as any[]) ?? []).map((inst) => {
        const inbox = inboxByInstance.get(inst.instance_name);
        return {
          ...inst,
          inbox_id: inbox?.id ?? null,
          inbox_name: inbox?.name ?? null,
          webhook_configured: true,
        };
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao carregar canais conectados";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  const refreshOne = async (inst: Instance) => {
    setRefreshingId(inst.id);
    try {
      await callEdgeFunction("whatsapp-refresh", {
        method: "POST",
        token: session?.access_token,
        body: { instanceName: inst.instance_name, instanceId: inst.id },
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar status");
    } finally {
      setRefreshingId(null);
    }
  };

  const disconnect = async (inst: Instance, remove: boolean) => {
    const msg = remove
      ? `Remover a instância "${inst.instance_name}"? Isso desconecta o número e apaga a configuração.`
      : `Desconectar o número "${inst.instance_name}"? A instância continuará cadastrada.`;
    if (!confirm(msg)) return;
    setDisconnectingId(inst.id);
    try {
      await callEdgeFunction("whatsapp-disconnect", {
        method: "POST",
        token: session?.access_token,
        body: { instanceName: inst.instance_name, deleteInstance: remove },
      });
      toast.success(remove ? "Instância removida" : "Número desconectado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao desconectar");
    } finally {
      setDisconnectingId(null);
    }
  };

  const statusBadge = (s: string | null) => {
    if (s === "connected" || s === "open")
      return <span className="inline-flex items-center gap-1 text-[#2FAE7C] text-sm"><CheckCircle2 className="h-4 w-4" /> Conectado</span>;
    if (s === "connecting")
      return <span className="inline-flex items-center gap-1 text-[#F2C94C] text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Conectando</span>;
    return <span className="inline-flex items-center gap-1 text-muted-foreground text-sm"><AlertCircle className="h-4 w-4" /> Desconectado</span>;
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0B3A5D]">Canais Conectados</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Todos os números de WhatsApp e canais integrados ao sistema.
            </p>
          </div>
          <Link
            to="/whatsapp"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0B3A5D] text-white text-sm font-medium hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Conectar WhatsApp
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : loadError ? (
          <div className="border border-destructive/30 rounded-xl p-8 text-center bg-destructive/5">
            <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
            <p className="text-sm text-destructive font-medium mb-4">{loadError}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-background"
            >
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
          </div>
        ) : instances.length === 0 ? (
          <div className="border border-dashed rounded-xl p-12 text-center">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">Nenhum canal conectado ainda.</p>
            <Link
              to="/whatsapp"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2FAE7C] text-white text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Conectar primeiro número
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {instances.map((inst) => (
              <div
                key={inst.id}
                className="flex items-center gap-4 p-4 border rounded-xl bg-card hover:shadow-sm transition"
              >
                <div className="h-12 w-12 rounded-full bg-[#2FAE7C]/10 flex items-center justify-center overflow-hidden">
                  {inst.profile_pic ? (
                    <img src={inst.profile_pic} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <MessageCircle className="h-6 w-6 text-[#2FAE7C]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#0B3A5D] truncate">
                    {inst.profile_name || inst.instance_name}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {inst.phone_number ? `+${inst.phone_number}` : "Número não disponível"} · {inst.instance_name}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    <StatusPill ok={inst.status === "connected" || inst.status === "open"} label="WhatsApp" />
                    <StatusPill ok={inst.webhook_configured} label="Webhook" />
                    <StatusPill ok={!!inst.inbox_id} label={inst.inbox_name ? `Caixa: ${inst.inbox_name}` : "Caixa"} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(inst.status)}
                  <button
                    onClick={() => refreshOne(inst)}
                    disabled={refreshingId === inst.id}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
                    title="Atualizar status"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshingId === inst.id ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    onClick={() => disconnect(inst, false)}
                    disabled={disconnectingId === inst.id}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground disabled:opacity-50"
                    title="Desconectar número"
                  >
                    {disconnectingId === inst.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PowerOff className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => navigate({ to: "/conversas" })}
                    className="px-3 py-1.5 text-sm rounded-lg bg-[#0B3A5D] text-white hover:opacity-90"
                  >
                    Ver conversas
                  </button>
                  <button
                    onClick={() => disconnect(inst, true)}
                    disabled={disconnectingId === inst.id}
                    className="px-3 py-1.5 text-sm rounded-lg border border-destructive text-destructive hover:bg-destructive/5 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
      ok ? "bg-success/15 text-success" : "bg-warning/20 text-foreground"
    }`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}
