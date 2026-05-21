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

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline_stages"],
    queryFn: async (): Promise<PipelineStage[]> => {
      const { data, error } = await sb
        .from("pipeline_stages")
        .select("*")
        .eq("is_active", true)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLossReasons() {
  return useQuery({
    queryKey: ["loss_reasons"],
    queryFn: async (): Promise<LossReason[]> => {
      const { data, error } = await sb
        .from("loss_reasons")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePipelineLeads() {
  return useQuery({
    queryKey: ["pipeline_leads"],
    queryFn: async (): Promise<PipelineLead[]> => {
      const { data, error } = await sb
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name ?? "Sem nome"),
        phone: (row.phone ?? row.phone_number ?? null) as string | null,
        email: (row.email ?? null) as string | null,
        channel: String(row.channel ?? "WhatsApp"),
        labels: ((row.labels ?? row.tags ?? []) as string[]) ?? [],
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
    refetchInterval: 10000,
  });
}

export function usePipeline() {
  const qc = useQueryClient();
  const { user } = useAuth();
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
      const { error } = await sb.from("contacts").update(patch).eq("id", leadId);
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
      qc.invalidateQueries({ queryKey: ["pipeline_leads"] });
    },
  });

  // Update assignee
  const updateLeadAssignee = useMutation({
    mutationFn: async ({ leadId, assignedTo }: { leadId: string; assignedTo: string | null }) => {
      const { error } = await sb
        .from("contacts")
        .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_leads"] }),
  });

  // Update lead
  const updateLead = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await sb
        .from("contacts")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline_leads"] }),
  });

  // Delete lead
  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_leads"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
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
        qc.invalidateQueries({ queryKey: ["pipeline_leads"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stages" }, () => {
        qc.invalidateQueries({ queryKey: ["pipeline_stages"] });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [qc]);

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
    getColumnTotals,
    isSlaBreached,
  };
}
