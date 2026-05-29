// Pipeline types adapted from whatsapp-lead-hub for IAS architecture.
// "Lead" in IAS = enhanced Contact with pipeline fields.

export interface PipelineStage {
  id: string;
  account_id?: string | null;
  name: string;
  slug: string;
  color: string;
  probability: number;
  position: number;
  is_active: boolean;
  is_won: boolean;
  is_lost: boolean;
  sla_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface LossReason {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

/** Contact enhanced with pipeline fields — acts as a "lead" in the pipeline */
export interface PipelineLead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  channel: string;
  labels: string[];
  stage_id: string | null;
  estimated_value: number;
  probability: number;
  source: string;
  assigned_to: string | null;
  lead_score: number;
  won_at: string | null;
  lost_at: string | null;
  loss_reason_id: string | null;
  stage_entered_at: string | null;
  last_contact_at: string | null;
  ai_paused: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  // Joined fields
  assignee?: { display_name: string; avatar_initials: string | null } | null;
  current_stage?: PipelineStage | null;
}

export interface LeadNote {
  id: string;
  contact_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  author?: { display_name: string; avatar_initials: string | null } | null;
}

export interface LeadTask {
  id: string;
  contact_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  assignee?: { display_name: string } | null;
}

export interface LeadMovement {
  id: string;
  contact_id: string;
  from_stage_id: string | null;
  to_stage_id: string | null;
  moved_by: string | null;
  loss_reason_id: string | null;
  notes: string | null;
  created_at: string;
  from_stage?: { name: string; color: string } | null;
  to_stage?: { name: string; color: string } | null;
  mover?: { display_name: string } | null;
  loss_reason?: { name: string } | null;
}

export interface ColumnTotals {
  count: number;
  total_value: number;
  weighted_value: number;
}

export interface PipelineFilters {
  assigned_to: string;
  stage_id: string;
  source: string;
  search: string;
  date_from: string;
  date_to: string;
  value_min: string;
  value_max: string;
}

export const DEFAULT_FILTERS: PipelineFilters = {
  assigned_to: "",
  stage_id: "",
  source: "",
  search: "",
  date_from: "",
  date_to: "",
  value_min: "",
  value_max: "",
};

export const DEFAULT_PIPELINE_STAGES: Omit<PipelineStage, "id" | "created_at" | "updated_at">[] = [
  { name: "Novo", slug: "novo", color: "#F2C94C", probability: 10, position: 0, is_active: true, is_won: false, is_lost: false, sla_hours: 24 },
  { name: "Qualificado", slug: "qualificado", color: "#2FAE7C", probability: 30, position: 1, is_active: true, is_won: false, is_lost: false, sla_hours: 48 },
  { name: "Proposta", slug: "proposta", color: "#0B3A5D", probability: 50, position: 2, is_active: true, is_won: false, is_lost: false, sla_hours: 72 },
  { name: "Negociação", slug: "negociacao", color: "#6366F1", probability: 70, position: 3, is_active: true, is_won: false, is_lost: false, sla_hours: null },
  { name: "Ganho", slug: "ganho", color: "#22C55E", probability: 100, position: 4, is_active: true, is_won: true, is_lost: false, sla_hours: null },
  { name: "Perdido", slug: "perdido", color: "#EF4444", probability: 0, position: 5, is_active: true, is_won: false, is_lost: true, sla_hours: null },
];

export const DEFAULT_LOSS_REASONS = [
  "Preço alto",
  "Concorrente",
  "Sem orçamento",
  "Sem resposta",
  "Timing inadequado",
  "Produto não atende",
  "Outro",
];
