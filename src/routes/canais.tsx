import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { getWhatsAppStatus, disconnectWhatsApp } from "@/lib/whatsapp.functions";
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
};

function CanaisPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const navigate = useNavigate();
  const fetchStatus = useServerFn(getWhatsAppStatus);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setInstances((data as Instance[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const refreshOne = async (inst: Instance) => {
    setRefreshingId(inst.id);
    try {
      const res = await fetchStatus({ data: { instanceName: inst.instance_name } });
      await supabase
        .from("whatsapp_instances")
        .update({
          status: res.state === "open" ? "connected" : res.state ?? "pending",
          phone_number: res.phoneNumber ?? inst.phone_number,
          profile_name: res.profileName ?? inst.profile_name,
        })
        .eq("id", inst.id);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar status");
    } finally {
      setRefreshingId(null);
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
                    onClick={() => navigate({ to: "/conversas" })}
                    className="px-3 py-1.5 text-sm rounded-lg bg-[#0B3A5D] text-white hover:opacity-90"
                  >
                    Ver conversas
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
