import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import type { PipelineStage, LossReason } from "@/types/pipeline";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Save, Loader2, Palette,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

const sb = supabase as any;

export const Route = createFileRoute("/pipeline-settings")({ component: PipelineSettingsPage });

/* ───── Stage CRUD ───── */

function useStagesCrud() {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  const stages = useQuery<PipelineStage[]>({
    queryKey: ["pipeline_stages_all"],
    queryFn: async () => {
      const { data, error } = await sb.from("pipeline_stages").select("*").order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (s: Partial<PipelineStage> & { id?: string }) => {
      if (s.id) {
        const { error } = await sb.from("pipeline_stages").update(s).eq("id", s.id);
        if (error) throw error;
      } else {
        // account_id é obrigatório pela RLS (tenant isolation)
        const { error } = await sb.from("pipeline_stages").insert({ ...s, account_id: accountId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_stages_all"] });
      qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("pipeline_stages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_stages_all"] });
      qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
    },
  });

  return { stages, upsert, remove };
}

/* ───── Loss Reason CRUD ───── */

function useLossReasonsCrud() {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  const reasons = useQuery<LossReason[]>({
    queryKey: ["loss_reasons_all"],
    queryFn: async () => {
      const { data, error } = await sb.from("loss_reasons").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (r: Partial<LossReason> & { id?: string }) => {
      if (r.id) {
        const { error } = await sb.from("loss_reasons").update(r).eq("id", r.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("loss_reasons").insert({ ...r, account_id: accountId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loss_reasons_all"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("loss_reasons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loss_reasons_all"] }),
  });

  return { reasons, upsert, remove };
}

/* ───── Page ───── */

const COLORS = ["#2FAE7C", "#0B3A5D", "#F2C94C", "#EB5757", "#56CCF2", "#BB6BD9", "#F2994A", "#6FCF97", "#828282"];

function PipelineSettingsPage() {
  const { stages, upsert: upsertStage, remove: removeStage } = useStagesCrud();
  const { reasons, upsert: upsertReason, remove: removeReason } = useLossReasonsCrud();

  const [newStage, setNewStage] = useState({ name: "", color: "#2FAE7C", probability: 50, sla_hours: "" });
  const [newReason, setNewReason] = useState("");

  const handleAddStage = async () => {
    if (!newStage.name.trim()) return;
    try {
      const pos = (stages.data?.length ?? 0) + 1;
      await upsertStage.mutateAsync({
        name: newStage.name.trim(),
        slug: newStage.name.trim().toLowerCase().replace(/\s+/g, "-"),
        color: newStage.color,
        probability: newStage.probability,
        position: pos,
        is_active: true,
        is_won: false,
        is_lost: false,
        sla_hours: newStage.sla_hours ? Number(newStage.sla_hours) : null,
      } as any);
      toast.success("Etapa criada");
      setNewStage({ name: "", color: "#2FAE7C", probability: 50, sla_hours: "" });
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleStage = async (s: PipelineStage) => {
    await upsertStage.mutateAsync({ id: s.id, is_active: !s.is_active });
    toast.success(s.is_active ? "Etapa desativada" : "Etapa ativada");
  };

  const handleDeleteStage = async (id: string) => {
    try {
      await removeStage.mutateAsync(id);
      toast.success("Etapa removida");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAddReason = async () => {
    if (!newReason.trim()) return;
    try {
      await upsertReason.mutateAsync({ name: newReason.trim(), is_active: true } as any);
      toast.success("Motivo criado");
      setNewReason("");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteReason = async (id: string) => {
    try {
      await removeReason.mutateAsync(id);
      toast.success("Motivo removido");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const loading = stages.isLoading || reasons.isLoading;

  return (
    <AppLayout
      title="Configurar Pipeline"
      actions={
        <Link to="/pipeline" className="h-9 px-3 rounded-lg border text-sm flex items-center gap-1.5 hover:bg-background">
          <ArrowLeft className="h-4 w-4" /> Voltar ao Pipeline
        </Link>
      }
    >
      {loading ? (
        <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="max-w-3xl space-y-8">
          {/* ─── Stages ─── */}
          <section>
            <h2 className="text-base font-semibold text-brand mb-4">Etapas do Pipeline</h2>

            <div className="space-y-2 mb-4">
              {(stages.data ?? []).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span className="h-4 w-4 rounded-full shrink-0" style={{ background: s.color }} />
                  <div className="flex-1 min-w-0">
                    <span className={`text-sm font-medium ${s.is_active ? "" : "line-through text-muted-foreground"}`}>
                      {s.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {s.probability}% · pos {s.position}
                      {s.sla_hours ? ` · SLA ${s.sla_hours}h` : ""}
                      {s.is_won ? " · ✅ Won" : ""}
                      {s.is_lost ? " · ❌ Lost" : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => handleToggleStage(s)}
                    className={`h-7 px-2 rounded text-[11px] border ${s.is_active ? "text-warning" : "text-success"}`}
                  >
                    {s.is_active ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => handleDeleteStage(s.id)}
                    className="h-7 w-7 rounded hover:bg-destructive/10 grid place-items-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add stage form */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">Nova Etapa</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  value={newStage.name}
                  onChange={(e) => setNewStage((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome da etapa"
                  className={inputCls}
                />
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newStage.color}
                    onChange={(e) => setNewStage((p) => ({ ...p, color: e.target.value }))}
                    className="h-10 w-10 rounded-lg border cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-1">
                    {COLORS.slice(0, 5).map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewStage((p) => ({ ...p, color: c }))}
                        className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                        style={{ background: c, borderColor: newStage.color === c ? "#fff" : "transparent" }}
                      />
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  value={newStage.probability}
                  onChange={(e) => setNewStage((p) => ({ ...p, probability: Number(e.target.value) }))}
                  placeholder="Prob %"
                  min={0}
                  max={100}
                  className={inputCls}
                />
                <input
                  value={newStage.sla_hours}
                  onChange={(e) => setNewStage((p) => ({ ...p, sla_hours: e.target.value }))}
                  placeholder="SLA (horas)"
                  type="number"
                  min={0}
                  className={inputCls}
                />
              </div>
              <button
                onClick={handleAddStage}
                disabled={upsertStage.isPending}
                className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                {upsertStage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar Etapa
              </button>
            </div>
          </section>

          {/* ─── Loss Reasons ─── */}
          <section>
            <h2 className="text-base font-semibold text-brand mb-4">Motivos de Perda</h2>

            <div className="space-y-2 mb-4">
              {(reasons.data ?? []).map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <span className="flex-1 text-sm">{r.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                    {r.is_active ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    onClick={() => handleDeleteReason(r.id)}
                    className="h-7 w-7 rounded hover:bg-destructive/10 grid place-items-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Nome do motivo de perda"
                className={inputCls + " flex-1"}
                onKeyDown={(e) => e.key === "Enter" && handleAddReason()}
              />
              <button
                onClick={handleAddReason}
                disabled={upsertReason.isPending}
                className="h-10 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60"
              >
                {upsertReason.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Adicionar
              </button>
            </div>
          </section>
        </div>
      )}
    </AppLayout>
  );
}

const inputCls = "h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40";
