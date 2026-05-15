import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useLabels } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Zap, Pencil, Copy, Trash2, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/automacoes")({ component: AutomacoesPage });

const TRIGGER_EVENTS = [
  { value: "conversa_criada", label: "Conversa criada" },
  { value: "conversa_atribuida", label: "Conversa atribuída" },
  { value: "etiqueta_adicionada", label: "Etiqueta adicionada" },
  { value: "mensagem_recebida", label: "Mensagem recebida" },
  { value: "conversa_resolvida", label: "Conversa resolvida" },
];

const ACTION_TYPES = [
  { value: "atribuir_agente", label: "Atribuir agente" },
  { value: "atribuir_equipe", label: "Atribuir equipe" },
  { value: "adicionar_etiqueta", label: "Adicionar etiqueta" },
  { value: "enviar_mensagem", label: "Enviar mensagem automática" },
  { value: "enviar_webhook", label: "Enviar webhook" },
  { value: "mover_caixa", label: "Mover para caixa de entrada" },
];

interface Action {
  id: string;
  type: string;
  value?: string;
}

interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger_label_id: string | null;
  trigger_event: string;
  actions: Action[];
  active: boolean;
  created_at: string;
}

function useAutomations() {
  return useQuery({
    queryKey: ["automations"],
    queryFn: async (): Promise<Automation[]> => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        active: (r as { is_active: boolean | null }).is_active ?? false,
        actions: (Array.isArray(r.actions) ? r.actions : []) as unknown as Action[],
      })) as unknown as Automation[];
    },
  });
}

function AutomacoesPage() {
  const { data: automations = [], isLoading } = useAutomations();
  const { data: labels = [] } = useLabels();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("automations").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["automations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Automação excluída");
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (a: Automation) => {
      const { error } = await supabase.from("automations").insert({
        name: `${a.name} (cópia)`,
        description: a.description,
        trigger_label_id: a.trigger_label_id,
        trigger_event: a.trigger_event,
        actions: a.actions as never,
        active: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Automação duplicada");
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const labelById = (id: string | null) => labels.find((l) => l.id === id);

  return (
    <AppLayout
      title="Automações"
      actions={
        <Button
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className="bg-[#2FAE7C] hover:bg-[#2FAE7C]/90 text-white"
        >
          <Plus className="h-4 w-4" /> Nova Automação
        </Button>
      }
    >
      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : automations.length === 0 ? (
        <div className="bg-card border rounded-xl p-12 grid place-items-center text-center">
          <div className="h-16 w-16 rounded-full bg-[#2FAE7C]/10 grid place-items-center mb-4">
            <Zap className="h-8 w-8 text-[#2FAE7C]" />
          </div>
          <h2 className="text-lg font-semibold text-[#0B3A5D]">
            Nenhuma automação criada ainda
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-5 max-w-sm">
            Crie regras automáticas para agilizar o atendimento e reduzir tarefas manuais.
          </p>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
            className="bg-[#2FAE7C] hover:bg-[#2FAE7C]/90 text-white"
          >
            <Plus className="h-4 w-4" /> Criar primeira automação
          </Button>
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Etiqueta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((a) => {
                const label = labelById(a.trigger_label_id);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium text-[#0B3A5D]">{a.name}</div>
                      {a.description && (
                        <div className="text-xs text-muted-foreground">{a.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {label ? (
                        <Badge
                          style={{ backgroundColor: label.color, color: "#fff" }}
                          className="border-0"
                        >
                          {label.name}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={a.active}
                          onCheckedChange={(v) =>
                            toggleActive.mutate({ id: a.id, active: v })
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {a.active ? "Ativa" : "Inativa"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditing(a);
                            setOpen(true);
                          }}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => duplicate.mutate(a)}
                          title="Duplicar"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Excluir "${a.name}"?`)) remove.mutate(a.id);
                          }}
                          title="Excluir"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AutomationDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        labels={labels}
      />
    </AppLayout>
  );
}

function AutomationDialog({
  open,
  onOpenChange,
  editing,
  labels,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Automation | null;
  labels: { id: string; name: string; color: string }[];
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerLabelId, setTriggerLabelId] = useState<string>("");
  const [triggerEvent, setTriggerEvent] = useState<string>("conversa_criada");
  const [actions, setActions] = useState<Action[]>([]);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setTriggerLabelId(editing.trigger_label_id ?? "");
      setTriggerEvent(editing.trigger_event);
      setActions(editing.actions ?? []);
    } else {
      setName("");
      setDescription("");
      setTriggerLabelId("");
      setTriggerEvent("conversa_criada");
      setActions([]);
    }
  }, [open, editing]);

  const handleClose = (v: boolean) => {
    onOpenChange(v);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        trigger_label_id: triggerLabelId || null,
        trigger_event: triggerEvent,
        actions: actions as never,
      };
      if (editing) {
        const { error } = await supabase
          .from("automations")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("automations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Automação atualizada" : "Automação criada");
      qc.invalidateQueries({ queryKey: ["automations"] });
      handleClose(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAction = () =>
    setActions((a) => [...a, { id: crypto.randomUUID(), type: "atribuir_agente", value: "" }]);

  const updateAction = (id: string, patch: Partial<Action>) =>
    setActions((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const removeAction = (id: string) =>
    setActions((a) => a.filter((x) => x.id !== id));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[#0B3A5D]">
            {editing ? "Editar automação" : "Nova automação"}
          </DialogTitle>
          <DialogDescription>
            Configure um gatilho e as ações que serão executadas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="auto-name">Nome da automação</Label>
            <Input
              id="auto-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Boas-vindas a novos leads"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auto-desc">Descrição (opcional)</Label>
            <Textarea
              id="auto-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Etiqueta gatilho</Label>
              <Select value={triggerLabelId} onValueChange={setTriggerLabelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  {labels.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Nenhuma etiqueta cadastrada
                    </div>
                  ) : (
                    labels.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: l.color }}
                          />
                          {l.name}
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Evento gatilho</Label>
              <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGER_EVENTS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base text-[#0B3A5D]">Ações</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAction}
                className="border-[#2FAE7C] text-[#2FAE7C] hover:bg-[#2FAE7C]/10"
              >
                <Plus className="h-4 w-4" /> Adicionar ação
              </Button>
            </div>

            {actions.length === 0 && (
              <p className="text-xs text-muted-foreground py-3">
                Nenhuma ação adicionada.
              </p>
            )}

            {actions.map((action, idx) => {
              const def = ACTION_TYPES.find((t) => t.value === action.type);
              const needsValue =
                action.type === "enviar_webhook" ||
                action.type === "enviar_mensagem" ||
                action.type === "atribuir_agente" ||
                action.type === "atribuir_equipe" ||
                action.type === "adicionar_etiqueta" ||
                action.type === "mover_caixa";
              return (
                <div
                  key={action.id}
                  className="border rounded-lg p-3 bg-muted/30 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Ação {idx + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAction(action.id)}
                      className="h-7 w-7 text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select
                    value={action.type}
                    onValueChange={(v) => updateAction(action.id, { type: v, value: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {needsValue && (
                    <Input
                      value={action.value ?? ""}
                      onChange={(e) =>
                        updateAction(action.id, { value: e.target.value })
                      }
                      placeholder={
                        action.type === "enviar_webhook"
                          ? "https://exemplo.com/webhook"
                          : action.type === "enviar_mensagem"
                          ? "Texto da mensagem"
                          : `Valor para ${def?.label.toLowerCase()}`
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="bg-[#2FAE7C] hover:bg-[#2FAE7C]/90 text-white"
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
