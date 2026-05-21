import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { usePipeline } from "@/hooks/use-pipeline";
import type { PipelineLead, PipelineStage } from "@/types/pipeline";
import { Loader2, Search, SlidersHorizontal, UserRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pipeline")({ component: PipelinePage });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function PipelinePage() {
  const pipeline = usePipeline();

  const move = async (lead: PipelineLead, stage: PipelineStage) => {
    try {
      await pipeline.moveLeadToStage.mutateAsync({ leadId: lead.id, toStageId: stage.id });
      toast.success(`${lead.name} movido para ${stage.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao mover lead");
    }
  };

  return (
    <AppLayout
      title="Pipeline"
      actions={
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={pipeline.filters.search}
            onChange={(event) => pipeline.setFilters({ ...pipeline.filters, search: event.target.value })}
            placeholder="Buscar lead..."
            className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-success/40"
          />
        </div>
      }
      flush
    >
      {pipeline.loading ? (
        <div className="grid h-full place-items-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="flex h-full min-w-0 flex-col">
          <div className="flex h-12 items-center gap-3 border-b bg-card px-4 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-4 w-4 text-success" />
            <span>{pipeline.leads.length} leads filtrados</span>
            <span>{pipeline.stages.length} etapas ativas</span>
          </div>
          <div className="flex-1 overflow-x-auto bg-background p-4">
            <div className="flex h-full min-w-max gap-4">
              {pipeline.stages.map((stage) => {
                const leads = pipeline.leads.filter((lead) => lead.stage_id === stage.id);
                const totals = pipeline.getColumnTotals(stage.id);
                return (
                  <section
                    key={stage.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      const leadId = event.dataTransfer.getData("text/plain");
                      const lead = pipeline.allLeads.find((item) => item.id === leadId);
                      if (lead) void move(lead, stage);
                    }}
                    className="flex h-full w-[310px] shrink-0 flex-col rounded-lg border bg-card"
                  >
                    <header className="border-b p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: stage.color }} />
                          <h2 className="text-sm font-semibold text-foreground">{stage.name}</h2>
                        </div>
                        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium">
                          {totals.count}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {money.format(totals.total_value)} · ponderado {money.format(totals.weighted_value)}
                      </div>
                    </header>
                    <div className="flex-1 space-y-2 overflow-auto p-3">
                      {leads.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-5 text-center text-xs text-muted-foreground">
                          Arraste leads para esta etapa
                        </div>
                      ) : (
                        leads.map((lead) => (
                          <LeadCard
                            key={lead.id}
                            lead={lead}
                            breached={pipeline.isSlaBreached(lead)}
                          />
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function LeadCard({ lead, breached }: { lead: PipelineLead; breached: boolean }) {
  return (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", lead.id)}
      className={`cursor-grab rounded-lg border bg-background p-3 shadow-sm active:cursor-grabbing ${
        breached ? "border-destructive" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{lead.name}</h3>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{lead.phone ?? lead.email ?? "Sem contato"}</p>
        </div>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
          {lead.lead_score}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="font-semibold text-brand">{money.format(lead.estimated_value)}</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <UserRound className="h-3 w-3" />
          {lead.assigned_to ? "Atribuído" : "Livre"}
        </span>
      </div>
      {lead.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {lead.labels.slice(0, 3).map((label) => (
            <span key={label} className="rounded bg-warning/30 px-1.5 py-0.5 text-[10px] font-medium">
              {label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
