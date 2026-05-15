import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Tag, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/etiquetas")({ component: EtiquetasPage });

const PRESET_COLORS = [
  "#2FAE7C", "#0B3A5D", "#F2C94C", "#EF4444",
  "#8B5CF6", "#EC4899", "#F97316", "#06B6D4",
  "#84CC16", "#6366F1", "#14B8A6", "#A855F7",
];

interface LabelRow {
  id: string;
  name: string;
  color: string;
  description: string | null;
  show_in_sidebar: boolean;
}

function useLabelsFull() {
  return useQuery({
    queryKey: ["labels-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("labels")
        .select("id, name, color, description, show_in_sidebar")
        .order("name");
      if (error) throw error;
      return (data ?? []) as LabelRow[];
    },
  });
}

function useLabelCounts() {
  return useQuery({
    queryKey: ["label-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("conversation_labels").select("label_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[(r as { label_id: string }).label_id] =
        (counts[(r as { label_id: string }).label_id] ?? 0) + 1;
      return counts;
    },
  });
}

function EtiquetasPage() {
  const { data: labels = [], isLoading } = useLabelsFull();
  const { data: counts = {} } = useLabelCounts();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LabelRow | null>(null);
  const [open, setOpen] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (payload: Omit<LabelRow, "id"> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("labels").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("labels").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels-full"] });
      qc.invalidateQueries({ queryKey: ["labels"] });
      toast.success(editing ? "Etiqueta atualizada" : "Etiqueta criada");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("labels").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labels-full"] });
      qc.invalidateQueries({ queryKey: ["labels"] });
      qc.invalidateQueries({ queryKey: ["label-counts"] });
      toast.success("Etiqueta excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setOpen(true); };
  const openEdit = (l: LabelRow) => { setEditing(l); setOpen(true); };

  return (
    <AppLayout title="Etiquetas">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold" style={{ color: "#0B3A5D" }}>Etiquetas</h2>
            <p className="text-xs text-muted-foreground mt-1">Organize suas conversas com etiquetas coloridas.</p>
          </div>
          <button
            onClick={openNew}
            className="h-10 px-4 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:opacity-95"
            style={{ background: "#2FAE7C" }}
          >
            <Plus className="h-4 w-4" /> Nova Etiqueta
          </button>
        </div>

        {isLoading ? (
          <div className="bg-card rounded-xl border p-8 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : labels.length === 0 ? (
          <EmptyState onCreate={openNew} />
        ) : (
          <div className="bg-card rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Etiqueta</th>
                  <th className="text-left px-5 py-3">Descrição</th>
                  <th className="text-left px-5 py-3">Conversas</th>
                  <th className="text-left px-5 py-3">Sidebar</th>
                  <th className="text-right px-5 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {labels.map(l => (
                  <tr key={l.id} className="border-t">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3 w-3 rounded-full shrink-0" style={{ background: l.color }} />
                        <span className="font-medium">{l.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground max-w-md truncate">{l.description || "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-background border font-medium">{counts[l.id] ?? 0}</span>
                    </td>
                    <td className="px-5 py-3">
                      {l.show_in_sidebar ? (
                        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ background: "#2FAE7C20", color: "#2FAE7C" }}>Visível</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-medium">Oculta</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(l)} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-background text-muted-foreground hover:text-foreground" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { if (confirm(`Excluir "${l.name}"?`)) deleteMutation.mutate(l.id); }}
                          className="h-8 w-8 grid place-items-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open && (
        <LabelModal
          initial={editing}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSave={(payload) => saveMutation.mutate(editing ? { ...payload, id: editing.id } : payload)}
          saving={saveMutation.isPending}
        />
      )}
    </AppLayout>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-card rounded-xl border p-12 text-center">
      <div className="h-16 w-16 rounded-full mx-auto grid place-items-center mb-4" style={{ background: "#2FAE7C15" }}>
        <Tag className="h-8 w-8" style={{ color: "#2FAE7C" }} />
      </div>
      <div className="font-semibold" style={{ color: "#0B3A5D" }}>Nenhuma etiqueta criada</div>
      <p className="text-sm text-muted-foreground mt-1">Crie etiquetas para organizar suas conversas</p>
      <button
        onClick={onCreate}
        className="mt-5 h-10 px-4 rounded-lg text-sm font-semibold text-white inline-flex items-center gap-2"
        style={{ background: "#2FAE7C" }}
      >
        <Plus className="h-4 w-4" /> Criar primeira etiqueta
      </button>
    </div>
  );
}

function LabelModal({
  initial, onClose, onSave, saving,
}: {
  initial: LabelRow | null;
  onClose: () => void;
  onSave: (p: { name: string; description: string | null; color: string; show_in_sidebar: boolean }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState(initial?.color ?? PRESET_COLORS[0]);
  const [showInSidebar, setShowInSidebar] = useState(initial?.show_in_sidebar ?? false);

  const submit = () => {
    if (!name.trim()) { toast.error("Informe um nome"); return; }
    onSave({ name: name.trim(), description: description.trim() || null, color, show_in_sidebar: showInSidebar });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-md rounded-xl shadow-xl p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: "#0B3A5D" }}>
            {initial ? "Editar etiqueta" : "Nova etiqueta"}
          </h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg grid place-items-center hover:bg-background text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>

        <label className="block">
          <span className="text-xs font-medium">Nome da etiqueta</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Lead Quente"
            className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40" />
        </label>

        <label className="block">
          <span className="text-xs font-medium">Descrição (opcional)</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="mt-1 w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40" />
        </label>

        <div>
          <span className="text-xs font-medium">Cor</span>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)}
                className={`h-8 w-full rounded-lg border-2 transition-all ${color === c ? "ring-2 ring-offset-2 ring-foreground/30 scale-105" : "border-transparent"}`}
                style={{ background: c }} />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg border" style={{ background: color }} />
            <input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#000000"
              className="flex-1 h-9 px-3 rounded-lg border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-success/40" />
          </div>
        </div>

        <label className="flex items-center justify-between p-3 rounded-lg bg-background border cursor-pointer">
          <div>
            <div className="text-sm font-medium">Mostrar na sidebar</div>
            <div className="text-xs text-muted-foreground">Aparece como filtro rápido nas conversas</div>
          </div>
          <input type="checkbox" checked={showInSidebar} onChange={(e) => setShowInSidebar(e.target.checked)}
            className="h-5 w-5 accent-[#2FAE7C]" />
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg text-sm font-semibold border hover:bg-background">
            Cancelar
          </button>
          <button onClick={submit} disabled={saving}
            className="h-10 px-4 rounded-lg text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
            style={{ background: "#2FAE7C" }}>
            {saving ? "Salvando…" : initial ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
