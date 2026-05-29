import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type {
  PipelineStage,
  PipelineLead,
  LossReason,
  ColumnTotals,
  PipelineFilters,
} from "@/types/pipeline";
import { DEFAULT_FILTERS } from "@/types/pipeline";
import { useMemo, useState, useEffect } from "react";

const sb = supabase as any;

function stageSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function usePipelineStages() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["pipeline_stages", accountId],
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await sb
        .from("pipeline_stages")
        .select("*")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });
}

export function useLossReasons() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["loss_reasons", accountId],
    queryFn: async (): Promise<LossReason[]> => {
      const { data, error } = await sb
        .from("loss_reasons")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!accountId,
  });
}

export function usePipelineLeads() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["pipeline_leads", accountId],
    queryFn: async (): Promise<PipelineLead[]> => {
      const { data, error } = await sb
        .from("contacts")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name ?? "Sem nome"),
        phone: (row.phone ?? row.phone_number ?? null) as string | null,
        email: (row.email ?? null) as string | null,
        channel: String(row.channel ?? "manual"),
        labels: ((row.tags ?? []) as string[]) ?? [],
        stage_id: (row.stage_id ?? null) as string | null,
        estimated_value: Number(row.estimated_value ?? 0),
        probability: Number(row.probability ?? 0),
        source: String(row.source ?? "manual"),
        assigned_to: (row.assigned_to ?? null) as string | null,
        lead_score: Number(row.lead_score ?? 0),
        won_at: (row.won_at ?? null) as string | null,
        lost_at: (row.lost_at ?? null) as string | null,
        loss_reason_id: (row.loss_reason_id ?? null) as string | null,
        stage_entered_at: (row.stage_entered_at ?? row.created_at ?? null) as string | null,
        last_contact_at: (row.last_contact_at ?? null) as string | null,
        ai_paused: Boolean(row.ai_paused ?? false),
        notes: (row.notes ?? null) as string | null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: (row.updated_at ?? null) as string | null,
      })) as PipelineLead[];
    },
    enabled: !!accountId,
    refetchInterval: 10000,
  });
}

export function usePipeline() {
  const qc = useQueryClient();
  const { user, accountId } = useAuth();
  const { data: stages = [], isLoading: stagesLoading } = usePipelineStages();
  const { data: lossReasons = [] } = useLossReasons();
  const { data: rawLeads = [], isLoading: leadsLoading } = usePipelineLeads();
  const [filters, setFilters] = useState<PipelineFilters>(DEFAULT_FILTERS);

  // Enrich leads with stage info
  const leads = useMemo(() => {
    return rawLeads.map((lead) => ({
      ...lead,
      current_stage: stages.find((s) => s.id === lead.stage_id) ?? null,
    }));
  }, [rawLeads, stages]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (filters.assigned_to && lead.assigned_to !== filters.assigned_to) return false;
      if (filters.stage_id && lead.stage_id !== filters.stage_id) return false;
      if (filters.source && lead.source !== filters.source) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const match =
          lead.name.toLowerCase().includes(q) ||
          (lead.email ?? "").toLowerCase().includes(q) ||
          (lead.phone ?? "").includes(q);
        if (!match) return false;
      }
      if (filters.value_min && lead.estimated_value < Number(filters.value_min)) return false;
      if (filters.value_max && lead.estimated_value > Number(filters.value_max)) return false;
      return true;
    });
  }, [leads, filters]);

  // Column totals
  const getColumnTotals = (stageId: string): ColumnTotals => {
    const stageLeads = filteredLeads.filter((l) => l.stage_id === stageId);
    const stage = stages.find((s) => s.id === stageId);
    const total_value = stageLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);
    return {
      count: stageLeads.length,
      total_value,
      weighted_value: total_value * ((stage?.probability ?? 0) / 100),
    };
  };

  // Move lead to stage
  const moveLeadToStage = useMutation({
    mutationFn: async ({
      leadId,
      toStageId,
      lossReasonId,
    }: {
      leadId: string;
      toStageId: string;
      lossReasonId?: string;
    }) => {
      const lead = rawLeads.find((l) => l.id === leadId);
      const toStage = stages.find((s) => s.id === toStageId);
      const patch: Record<string, unknown> = {
        stage_id: toStageId,
        stage_entered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (toStage?.is_won) patch.won_at = new Date().toISOString();
      if (toStage?.is_lost) {
        patch.lost_at = new Date().toISOString();
        if (lossReasonId) patch.loss_reason_id = lossReasonId;
      }
      const { error } = await sb.from("contacts").update(patch).eq("id", leadId).eq("account_id", accountId);
      if (error) throw error;
      // Record movement
      await sb.from("lead_movements").insert({
        contact_id: leadId,
        from_stage_id: lead?.stage_id ?? null,
        to_stage_id: toStageId,
        moved_by: user?.id ?? null,
        loss_reason_id: lossReasonId ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] });
    },
  });

  // Update assignee
  const updateLeadAssignee = useMutation({
    mutationFn: async ({ leadId, assignedTo }: { leadId: string; assignedTo: string | null }) => {
      const { error } = await sb
        .from("contacts")
        .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
        .eq("id", leadId)
        .eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] }),
  });

  // Update lead
  const updateLead = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await sb
        .from("contacts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] }),
  });

  // Delete lead
  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contacts").delete().eq("id", id).eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
    },
  });

  const renameStage = useMutation({
    mutationFn: async ({ stageId, name }: { stageId: string; name: string }) => {
      const nextName = name.trim();
      if (!accountId) throw new Error("Conta atual não identificada. Recarregue a página e tente novamente.");
      if (!nextName) throw new Error("Informe o nome da etapa.");

      const duplicate = stages.some(
        (stage) => stage.id !== stageId && stage.name.trim().toLowerCase() === nextName.toLowerCase(),
      );
      if (duplicate) throw new Error("Já existe uma etapa com este nome nesta conta.");

      const nextSlug = stageSlug(nextName);
      const { data, error } = await sb
        .from("pipeline_stages")
        .update({ name: nextName, slug: nextSlug, updated_at: new Date().toISOString() })
        .eq("id", stageId)
        .eq("account_id", accountId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Etapa não encontrada para esta conta.");
    },
    onMutate: async ({ stageId, name }) => {
      await qc.cancelQueries({ queryKey: ["pipeline_stages", accountId] });
      const previous = qc.getQueryData<PipelineStage[]>(["pipeline_stages", accountId]);
      qc.setQueryData<PipelineStage[]>(["pipeline_stages", accountId], (current) =>
        (current ?? []).map((stage) => (stage.id === stageId ? { ...stage, name: name.trim() } : stage)),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) qc.setQueryData(["pipeline_stages", accountId], context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_stages", accountId] });
      qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] });
    },
  });

  // SLA check
  const isSlaBreached = (lead: PipelineLead): boolean => {
    if (!lead.current_stage?.sla_hours || !lead.stage_entered_at) return false;
    const entered = new Date(lead.stage_entered_at).getTime();
    const limit = entered + lead.current_stage.sla_hours * 3600000;
    return Date.now() > limit;
  };

  // Realtime subscription
  useEffect(() => {
    const channel = sb
      .channel("pipeline-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => {
        qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stages" }, () => {
        qc.invalidateQueries({ queryKey: ["pipeline_stages", accountId] });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [accountId, qc]);

  return {
    stages,
    lossReasons,
    leads: filteredLeads,
    allLeads: leads,
    loading: stagesLoading || leadsLoading,
    filters,
    setFilters,
    moveLeadToStage,
    updateLeadAssignee,
    updateLead,
    deleteLead,
    renameStage,
    getColumnTotals,
    isSlaBreached,
  };
}
