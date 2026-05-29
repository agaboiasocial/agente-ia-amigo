import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineStage, PipelineLead } from "@/types/pipeline";
import { useAuth } from "@/hooks/use-auth";

const sb = supabase as any;

// ---------- Types ----------

export type DashboardPeriod = "today" | "week" | "month" | "all";

export interface DashboardKPIs {
  newLeads: number;
  activeLeads: number;
  conversionRate: number;
  totalPipelineValue: number;
  weightedPipelineValue: number;
  slaBreachedCount: number;
  wonCount: number;
  lostCount: number;
}

export interface StageSummary {
  id: string;
  name: string;
  color: string;
  leadCount: number;
  totalValue: number;
  isBottleneck: boolean;
}

export interface OperationalAlerts {
  unassignedCount: number;
  stalledCount: number;
  slaBreachedCount: number;
  noFollowupCount: number;
}

export interface TeamMemberPerf {
  userId: string;
  fullName: string;
  initials: string | null;
  leadsCount: number;
  wonCount: number;
  conversionRate: number;
}

export interface RecentActivity {
  id: string;
  contactName: string;
  fromStageName: string | null;
  toStageName: string | null;
  fromStageColor: string | null;
  toStageColor: string | null;
  movedBy: string | null;
  createdAt: string;
}

export interface DashboardInsight {
  type: "warning" | "success" | "info";
  message: string;
}

export interface RevenueMonth {
  month: string;
  value: number;
}

// ---------- Period helpers ----------

function getPeriodStart(period: DashboardPeriod): string | null {
  if (period === "all") return null;
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }
  // month
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

// ---------- Hook ----------

export function useDashboardData(period: DashboardPeriod = "month") {
  const qc = useQueryClient();
  const { accountId } = useAuth();

  // Fetch pipeline stages
  const { data: stages = [] } = useQuery({
    queryKey: ["dashboard_stages", accountId],
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

  // Fetch all contacts (leads)
  const { data: allLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["dashboard_leads", accountId],
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
      }));
    },
    enabled: !!accountId,
    refetchInterval: 15000,
  });

  // Fetch profiles for team performance
  const { data: profiles = [] } = useQuery({
    queryKey: ["dashboard_profiles", accountId],
    queryFn: async () => {
      const { data, error } = await sb
        .from("profiles")
        .select("user_id, display_name, avatar_initials, online")
        .eq("account_id", accountId)
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as { user_id: string; display_name: string; avatar_initials: string | null; online: boolean }[];
    },
    enabled: !!accountId,
  });

  // Fetch recent lead_movements
  const { data: movements = [] } = useQuery({
    queryKey: ["dashboard_movements", accountId],
    queryFn: async (): Promise<RecentActivity[]> => {
      const { data, error } = await sb
        .from("lead_movements")
        .select("id, contact_id, from_stage_id, to_stage_id, moved_by, created_at, contact:contacts(name), from_stage:pipeline_stages!lead_movements_from_stage_id_fkey(name, color), to_stage:pipeline_stages!lead_movements_to_stage_id_fkey(name, color), mover:profiles!lead_movements_moved_by_fkey(display_name)")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) {
        // Fallback without joins if FK names differ
        const { data: fallback, error: e2 } = await sb
          .from("lead_movements")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);
        if (e2) throw e2;
        return (fallback ?? []).map((row: Record<string, unknown>) => ({
          id: String(row.id),
          contactName: "Lead",
          fromStageName: null,
          toStageName: null,
          fromStageColor: null,
          toStageColor: null,
          movedBy: null,
          createdAt: String(row.created_at),
        }));
      }
      return (data ?? []).map((row: Record<string, unknown>) => {
        const contact = row.contact as { name: string } | null;
        const from = row.from_stage as { name: string; color: string } | null;
        const to = row.to_stage as { name: string; color: string } | null;
        const mover = row.mover as { display_name: string } | null;
        return {
          id: String(row.id),
          contactName: contact?.name ?? "Lead",
          fromStageName: from?.name ?? null,
          toStageName: to?.name ?? null,
          fromStageColor: from?.color ?? null,
          toStageColor: to?.color ?? null,
          movedBy: mover?.display_name ?? null,
          createdAt: String(row.created_at),
        };
      });
    },
    enabled: !!accountId,
    refetchInterval: 15000,
  });

  // Period-filtered leads
  const periodStart = getPeriodStart(period);
  const leads = useMemo(() => {
    if (!periodStart) return allLeads;
    return allLeads.filter((l) => l.created_at >= periodStart);
  }, [allLeads, periodStart]);

  // Enrich leads with stage info
  const enrichedLeads = useMemo(
    () => allLeads.map((l) => ({ ...l, current_stage: stages.find((s) => s.id === l.stage_id) ?? null })),
    [allLeads, stages],
  );

  // ---------- KPIs ----------
  const kpis = useMemo((): DashboardKPIs => {
    const activeStages = stages.filter((s) => !s.is_won && !s.is_lost);
    const activeStageIds = new Set(activeStages.map((s) => s.id));

    const active = leads.filter((l) => l.stage_id && activeStageIds.has(l.stage_id));
    const won = leads.filter((l) => l.won_at);
    const lost = leads.filter((l) => l.lost_at);
    const closed = won.length + lost.length;
    const conversionRate = closed > 0 ? (won.length / closed) * 100 : 0;

    const totalPipelineValue = active.reduce((s, l) => s + l.estimated_value, 0);
    const weightedPipelineValue = active.reduce((s, l) => {
      const stage = stages.find((st) => st.id === l.stage_id);
      return s + l.estimated_value * ((stage?.probability ?? l.probability) / 100);
    }, 0);

    // SLA breached
    const slaBreached = enrichedLeads.filter((l) => {
      if (!l.current_stage?.sla_hours || !l.stage_entered_at) return false;
      const limit = new Date(l.stage_entered_at).getTime() + l.current_stage.sla_hours * 3600000;
      return Date.now() > limit;
    });

    return {
      newLeads: leads.length,
      activeLeads: active.length,
      conversionRate: Math.round(conversionRate * 10) / 10,
      totalPipelineValue,
      weightedPipelineValue,
      slaBreachedCount: slaBreached.length,
      wonCount: won.length,
      lostCount: lost.length,
    };
  }, [leads, enrichedLeads, stages]);

  // ---------- Pipeline summary ----------
  const pipelineSummary = useMemo((): StageSummary[] => {
    const activeStages = stages.filter((s) => !s.is_won && !s.is_lost);
    const summaries = activeStages.map((stage) => {
      const stageLeads = allLeads.filter((l) => l.stage_id === stage.id);
      return {
        id: stage.id,
        name: stage.name,
        color: stage.color,
        leadCount: stageLeads.length,
        totalValue: stageLeads.reduce((s, l) => s + l.estimated_value, 0),
        isBottleneck: false,
      };
    });
    // Mark bottleneck: stage with most leads (if > avg * 1.5)
    if (summaries.length > 0) {
      const avg = summaries.reduce((s, st) => s + st.leadCount, 0) / summaries.length;
      const max = Math.max(...summaries.map((s) => s.leadCount));
      if (max > avg * 1.5 && max > 2) {
        summaries.forEach((s) => { s.isBottleneck = s.leadCount === max; });
      }
    }
    return summaries;
  }, [allLeads, stages]);

  // ---------- Operational alerts ----------
  const alerts = useMemo((): OperationalAlerts => {
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 86400000;
    const threeDaysAgo = now - 3 * 86400000;

    const activeStageIds = new Set(stages.filter((s) => !s.is_won && !s.is_lost).map((s) => s.id));
    const activeLeads = allLeads.filter((l) => l.stage_id && activeStageIds.has(l.stage_id));

    const unassigned = activeLeads.filter((l) => !l.assigned_to).length;
    const stalled = activeLeads.filter((l) => {
      const entered = l.stage_entered_at ? new Date(l.stage_entered_at).getTime() : 0;
      return entered > 0 && entered < sevenDaysAgo;
    }).length;
    const slaBreached = enrichedLeads.filter((l) => {
      if (!l.current_stage?.sla_hours || !l.stage_entered_at) return false;
      const limit = new Date(l.stage_entered_at).getTime() + l.current_stage.sla_hours * 3600000;
      return Date.now() > limit;
    }).length;
    const noFollowup = activeLeads.filter((l) => {
      const lastContact = l.last_contact_at ? new Date(l.last_contact_at).getTime() : 0;
      return lastContact > 0 && lastContact < threeDaysAgo;
    }).length;

    return { unassignedCount: unassigned, stalledCount: stalled, slaBreachedCount: slaBreached, noFollowupCount: noFollowup };
  }, [allLeads, enrichedLeads, stages]);

  // ---------- Team performance ----------
  const teamPerformance = useMemo((): TeamMemberPerf[] => {
    return profiles.map((p) => {
      const memberLeads = allLeads.filter((l) => l.assigned_to === p.user_id);
      const won = memberLeads.filter((l) => l.won_at).length;
      const lost = memberLeads.filter((l) => l.lost_at).length;
      const closed = won + lost;
      return {
        userId: p.user_id,
        fullName: p.display_name,
        initials: p.avatar_initials,
        leadsCount: memberLeads.length,
        wonCount: won,
        conversionRate: closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0,
      };
    }).filter((m) => m.leadsCount > 0);
  }, [allLeads, profiles]);

  // ---------- Revenue chart (monthly won deals) ----------
  const revenueByMonth = useMemo((): RevenueMonth[] => {
    const wonLeads = allLeads.filter((l) => l.won_at);
    const map = new Map<string, number>();
    wonLeads.forEach((l) => {
      const d = new Date(l.won_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) ?? 0) + l.estimated_value);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, value]) => ({
        month: month.replace(/^(\d{4})-(\d{2})$/, (_m, y, mo) => {
          const names = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
          return `${names[parseInt(mo, 10) - 1]}/${y.slice(2)}`;
        }),
        value,
      }));
  }, [allLeads]);

  // ---------- Insights ----------
  const insights = useMemo((): DashboardInsight[] => {
    const result: DashboardInsight[] = [];

    if (alerts.slaBreachedCount > 0) {
      result.push({ type: "warning", message: `${alerts.slaBreachedCount} lead(s) com SLA violado - acao urgente necessaria` });
    }
    if (alerts.unassignedCount > 0) {
      result.push({ type: "warning", message: `${alerts.unassignedCount} lead(s) sem responsavel atribuido` });
    }
    if (alerts.stalledCount > 0) {
      result.push({ type: "warning", message: `${alerts.stalledCount} lead(s) parado(s) ha mais de 7 dias` });
    }
    if (alerts.noFollowupCount > 0) {
      result.push({ type: "info", message: `${alerts.noFollowupCount} lead(s) sem followup ha 3+ dias` });
    }
    if (kpis.conversionRate >= 40) {
      result.push({ type: "success", message: `Taxa de conversao excelente: ${kpis.conversionRate}%` });
    }
    if (kpis.wonCount > 0) {
      result.push({ type: "success", message: `${kpis.wonCount} negocio(s) ganho(s) no periodo` });
    }
    const bottleneck = pipelineSummary.find((s) => s.isBottleneck);
    if (bottleneck) {
      result.push({ type: "warning", message: `Gargalo detectado em "${bottleneck.name}" com ${bottleneck.leadCount} leads` });
    }

    return result;
  }, [alerts, kpis, pipelineSummary]);

  // ---------- Realtime ----------
  useEffect(() => {
    const channel = sb
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contacts" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard_leads", accountId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_stages" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard_stages", accountId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_movements" }, () => {
        qc.invalidateQueries({ queryKey: ["dashboard_movements", accountId] });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [accountId, qc]);

  return {
    kpis,
    pipelineSummary,
    alerts,
    teamPerformance,
    recentActivities: movements,
    revenueByMonth,
    insights,
    loading: leadsLoading,
  };
}
