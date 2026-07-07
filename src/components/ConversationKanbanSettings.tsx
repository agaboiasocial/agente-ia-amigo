import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, X, GripVertical } from "lucide-react";
import {
  useConversationStages,
  useStageMutations,
  type ConversationStage,
} from "@/hooks/use-conversation-stages";

const PRESET_COLORS = [
  "#F2C94C", "#2FAE7C", "#0B3A5D", "#94A3B8",
  "#8B5CF6", "#EF4444", "#F97316", "#06B6D4", "#EC4899",
];

export function ConversationKanbanSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: stages = [] } = useConversationStages();
  const { addStage, updateStage, deleteStage, reorder } = useStageMutations();
  const [local, setLocal] = useState<ConversationStage[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => { if (open) setLocal(stages); }, [open, stages]);

  if (!open) return null;

  const handleRename = (id: string, label: string) => {
    setLocal((p) => p.map((s) => (s.id === id ? { ...s, label } : s)));
  };
  const saveRename = (s: ConversationStage) => {
    updateStage.mutate({ id: s.id, patch: { label: s.label } }, {
      onError: (e: any) => toast.error(e.message || "Erro ao renomear"),
    });
  };
  const saveColor = (s: ConversationStage, color: string) => {
    setLocal((p) => p.map((x) => (x.id === s.id ? { ...x, color } : x)));
    updateStage.mutate({ id: s.id, patch: { color } }, {
      onError: (e: any) => toast.error(e.message || "Erro ao mudar cor"),
    });
  };
  const handleAdd = () => {
    if (!newLabel.trim()) { toast.error("Informe o nome da coluna"); return; }
    addStage.mutate({ label: newLabel.trim(), color: newColor }, {
      onSuccess: () => { setNewLabel(""); setNewColor(PRESET_COLORS[0]); toast.success("Coluna adicionada"); },
      onError: (e: any) => toast.error(e.message || "Erro ao adicionar"),
    });
  };
  const handleDelete = (s: ConversationStage) => {
    if (local.length <= 1) { toast.error("Mantenha pelo menos uma coluna"); return; }
    if (!confirm(`Excluir a coluna "${s.label}"? As conversas nela ficarão sem etapa.`)) return;
    deleteStage.mutate(s.id, {
      onSuccess: () => toast.success("Coluna removida"),
      onError: (e: any) => toast.error(e.message || "Erro ao remover"),
    });
  };

  // Reordenar colunas por drag&drop — salva a nova ordem automaticamente
  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
    const next = [...local];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    setLocal(next);
    setDragIdx(null);
    reorder.mutate(next, { onError: (e: any) => toast.error(e.message || "Erro ao reordenar") });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <div>
            <h2 className="text-lg font-semibold text-brand">Editar Kanban</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Personalize as colunas das conversas</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg grid place-items-center hover:bg-background text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {local.map((s, i) => (
            <div
              key={s.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-2 p-2 rounded-lg border bg-background transition-opacity ${dragIdx === i ? "opacity-40" : ""}`}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 cursor-grab active:cursor-grabbing" />
              <input
                type="color"
                value={s.color}
                onChange={(e) => saveColor(s, e.target.value)}
                className="h-7 w-7 rounded cursor-pointer border shrink-0"
                title="Cor"
              />
              <input
                value={s.label}
                onChange={(e) => handleRename(s.id, e.target.value)}
                onBlur={() => saveRename(s)}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="flex-1 h-9 px-3 rounded-lg border bg-card text-sm"
              />
              <button
                onClick={() => handleDelete(s)}
                className="h-9 w-9 rounded-lg grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                title="Excluir coluna"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-5 border-t bg-background/50 space-y-3">
          <div className="text-xs font-medium text-muted-foreground">Nova coluna</div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="h-9 w-9 rounded cursor-pointer border shrink-0"
            />
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Ex: Negociação"
              className="flex-1 h-9 px-3 rounded-lg border bg-card text-sm"
            />
            <button
              onClick={handleAdd}
              disabled={addStage.isPending}
              className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 disabled:opacity-60 shrink-0"
            >
              {addStage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button key={c} onClick={() => setNewColor(c)}
                className={`h-6 w-6 rounded-full border-2 ${newColor === c ? "border-foreground" : "border-transparent"}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
