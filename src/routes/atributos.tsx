import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  Plus,
  Trash2,
  Pencil,
  Sparkles,
  Type,
  Hash,
  Link2,
  Calendar,
  List,
  CheckSquare,
  AlignLeft,
  X,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/atributos")({ component: Page });

type AttrType = "text" | "number" | "link" | "date" | "list" | "checkbox" | "longtext";
type AttrTarget = "contact" | "conversation";

interface Attribute {
  id: string;
  name: string;
  key: string;
  description?: string;
  type: AttrType;
  target: AttrTarget;
  required: boolean;
  showInPanel: boolean;
  options?: string[];
  createdAt: string;
}

const TYPE_META: Record<AttrType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  text: { label: "Texto", icon: Type },
  number: { label: "Número", icon: Hash },
  link: { label: "Link", icon: Link2 },
  date: { label: "Data", icon: Calendar },
  list: { label: "Lista", icon: List },
  checkbox: { label: "Checkbox", icon: CheckSquare },
  longtext: { label: "Texto longo", icon: AlignLeft },
};

const SEED: Attribute[] = [
  { id: "1", name: "CPF", key: "cpf", type: "text", target: "contact", required: false, showInPanel: true, createdAt: "2026-01-10" },
  { id: "2", name: "Data de nascimento", key: "data_nascimento", type: "date", target: "contact", required: false, showInPanel: true, createdAt: "2026-01-12" },
  { id: "3", name: "Empresa", key: "empresa", type: "text", target: "contact", required: true, showInPanel: true, createdAt: "2026-01-15" },
  { id: "4", name: "Origem do lead", key: "origem_lead", type: "list", target: "contact", required: true, showInPanel: true, options: ["Google Ads", "Instagram", "Indicação", "Site", "Outro"], createdAt: "2026-01-18" },
  { id: "5", name: "Plano contratado", key: "plano_contratado", type: "list", target: "contact", required: false, showInPanel: true, options: ["Free", "Starter", "Pro", "Enterprise"], createdAt: "2026-02-02" },
  { id: "6", name: "Valor do contrato", key: "valor_contrato", type: "number", target: "contact", required: false, showInPanel: false, createdAt: "2026-02-10" },
  { id: "7", name: "Motivo do contato", key: "motivo_contato", type: "list", target: "conversation", required: true, showInPanel: true, options: ["Dúvida", "Suporte", "Venda", "Reclamação"], createdAt: "2026-02-15" },
  { id: "8", name: "Prioridade interna", key: "prioridade_interna", type: "list", target: "conversation", required: false, showInPanel: true, options: ["Baixa", "Média", "Alta", "Urgente"], createdAt: "2026-02-20" },
  { id: "9", name: "Produto de interesse", key: "produto_interesse", type: "text", target: "conversation", required: false, showInPanel: true, createdAt: "2026-03-01" },
];

const STORAGE_KEY = "ias.custom-attributes.v1";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function load(): Attribute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribute[]) : SEED;
  } catch {
    return SEED;
  }
}

function Page() {
  const [tab, setTab] = useState<AttrTarget>("contact");
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [modal, setModal] = useState<{ mode: "create" | "edit"; attr?: Attribute } | null>(null);

  useEffect(() => setAttrs(load()), []);
  const persist = (next: Attribute[]) => {
    setAttrs(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const filtered = useMemo(() => attrs.filter((a) => a.target === tab), [attrs, tab]);

  const onCreate = () => setModal({ mode: "create" });
  const onEdit = (a: Attribute) => setModal({ mode: "edit", attr: a });
  const onDelete = (a: Attribute) => {
    if (!confirm(`Excluir atributo "${a.name}"?`)) return;
    persist(attrs.filter((x) => x.id !== a.id));
    toast.success("Atributo excluído");
  };

  const onSave = (data: Omit<Attribute, "id" | "createdAt" | "key"> & { key?: string }) => {
    if (modal?.mode === "edit" && modal.attr) {
      persist(attrs.map((a) => (a.id === modal.attr!.id ? { ...a, ...data, key: modal.attr!.key } : a)));
      toast.success("Atributo atualizado");
    } else {
      const key = slugify(data.name);
      if (attrs.some((a) => a.key === key)) {
        toast.error("Já existe um atributo com essa chave");
        return;
      }
      const attr: Attribute = { ...data, id: crypto.randomUUID(), key, createdAt: new Date().toISOString() };
      persist([...attrs, attr]);
      toast.success("Atributo criado");
    }
    setModal(null);
  };

  return (
    <AppLayout
      title="Atributos Personalizados"
      actions={
        <button
          onClick={onCreate}
          className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 hover:opacity-95"
        >
          <Plus className="h-4 w-4" /> Novo Atributo
        </button>
      }
    >
      <div className="bg-card border rounded-xl shadow-sm">
        <div className="border-b px-4 flex items-center gap-1">
          {(["contact", "conversation"] as AttrTarget[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative h-12 px-4 text-sm font-medium transition-colors ${
                tab === t ? "text-success" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "contact" ? "Contato" : "Conversa"}
              <span className="ml-1.5 text-[11px] text-muted-foreground">
                ({attrs.filter((a) => a.target === t).length})
              </span>
              {tab === t && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-success" />}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <EmptyState onCreate={onCreate} />
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Nome</th>
                <th className="text-left px-4 py-3">Chave</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Aplicado em</th>
                <th className="text-left px-4 py-3">Obrigatório</th>
                <th className="text-left px-4 py-3">Criado em</th>
                <th className="text-right px-4 py-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const TypeIcon = TYPE_META[a.type].icon;
                return (
                  <tr key={a.id} className="border-t hover:bg-background/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{a.name}</div>
                      {a.description && <div className="text-xs text-muted-foreground">{a.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-background border px-2 py-0.5 rounded font-mono text-muted-foreground">
                        {a.key}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <TypeIcon className="h-3.5 w-3.5 text-success" />
                        {TYPE_META[a.type].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{a.target === "contact" ? "Contato" : "Conversa"}</td>
                    <td className="px-4 py-3">
                      {a.required ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-warning text-foreground">
                          SIM
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">
                          NÃO
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit(a)}
                          className="h-8 w-8 rounded-lg hover:bg-background grid place-items-center text-muted-foreground hover:text-success"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => onDelete(a)}
                          className="h-8 w-8 rounded-lg hover:bg-background grid place-items-center text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <AttributeModal
          mode={modal.mode}
          initial={modal.attr}
          defaultTarget={tab}
          onClose={() => setModal(null)}
          onSave={onSave}
        />
      )}
    </AppLayout>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-success/15 text-success grid place-items-center mb-3">
        <Sparkles className="h-7 w-7" />
      </div>
      <h4 className="font-semibold text-brand">Nenhum atributo personalizado</h4>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        Crie campos customizados para coletar informações importantes dos seus contatos e conversas.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 h-10 px-5 rounded-lg bg-success text-success-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-95"
      >
        <Plus className="h-4 w-4" /> Criar primeiro atributo
      </button>
    </div>
  );
}

function AttributeModal({
  mode,
  initial,
  defaultTarget,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  initial?: Attribute;
  defaultTarget: AttrTarget;
  onClose: () => void;
  onSave: (data: Omit<Attribute, "id" | "createdAt" | "key"> & { key?: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [type, setType] = useState<AttrType>(initial?.type ?? "text");
  const [target, setTarget] = useState<AttrTarget>(initial?.target ?? defaultTarget);
  const [required, setRequired] = useState(initial?.required ?? false);
  const [showInPanel, setShowInPanel] = useState(initial?.showInPanel ?? true);
  const [options, setOptions] = useState<string[]>(initial?.options ?? []);
  const [optInput, setOptInput] = useState("");
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const key = initial?.key ?? slugify(name);

  const addOption = () => {
    const v = optInput.trim();
    if (!v) return;
    if (options.includes(v)) {
      toast.error("Opção já adicionada");
      return;
    }
    setOptions([...options, v]);
    setOptInput("");
  };
  const removeOption = (i: number) => setOptions(options.filter((_, idx) => idx !== i));

  const onDragStart = (i: number) => setDragIdx(i);
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const next = [...options];
    const [m] = next.splice(dragIdx, 1);
    next.splice(i, 0, m);
    setOptions(next);
    setDragIdx(i);
  };
  const onDragEnd = () => setDragIdx(null);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Informe o nome do atributo");
      return;
    }
    if (type === "list" && options.length === 0) {
      toast.error("Adicione ao menos uma opção da lista");
      return;
    }
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      type,
      target,
      required,
      showInPanel,
      options: type === "list" ? options : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b">
          <h3 className="text-lg font-semibold text-brand">{mode === "edit" ? "Editar Atributo" : "Novo Atributo"}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina um campo customizado para contatos ou conversas.
          </p>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <label className="block">
            <span className="text-xs font-medium">Nome do atributo</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Ex: "Empresa", "CPF", "Plano"'
              className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium">Descrição (opcional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Aparece como tooltip de ajuda"
              className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
            />
          </label>

          <div>
            <span className="text-xs font-medium">Chave</span>
            <div className="mt-1 h-10 px-3 rounded-lg border bg-background text-sm flex items-center text-muted-foreground font-mono">
              {key || "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Gerada automaticamente. Não pode ser editada após a criação.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium">Tipo do atributo</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AttrType)}
                className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              >
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium">Aplicar em</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value as AttrTarget)}
                className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
              >
                <option value="contact">Contato</option>
                <option value="conversation">Conversa</option>
              </select>
            </label>
          </div>

          {type === "list" && (
            <div className="rounded-xl border bg-background p-3">
              <div className="text-xs font-semibold mb-2">Opções da lista</div>
              <div className="flex gap-2">
                <input
                  value={optInput}
                  onChange={(e) => setOptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  placeholder="Ex: Google Ads"
                  className="flex-1 h-9 px-3 rounded-lg border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="h-9 px-3 rounded-lg bg-success text-success-foreground text-sm font-semibold"
                >
                  Adicionar
                </button>
              </div>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {options.map((o, i) => (
                    <div
                      key={o}
                      draggable
                      onDragStart={() => onDragStart(i)}
                      onDragOver={(e) => onDragOver(e, i)}
                      onDragEnd={onDragEnd}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/15 text-success text-xs font-medium cursor-move"
                    >
                      <GripVertical className="h-3 w-3 opacity-60" />
                      {o}
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="hover:bg-success/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <ToggleRow
              label="Obrigatório"
              hint="Se ativo, o campo deve ser preenchido."
              checked={required}
              onChange={() => setRequired((v) => !v)}
            />
            <ToggleRow
              label="Exibir no painel lateral"
              hint="Aparece visível no painel de info do contato/conversa."
              checked={showInPanel}
              onChange={() => setShowInPanel((v) => !v)}
            />
          </div>
        </div>

        <div className="p-5 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-10 px-4 rounded-lg border text-sm font-medium hover:bg-background">
            Cancelar
          </button>
          <button onClick={handleSave} className="h-10 px-5 rounded-lg bg-success text-success-foreground text-sm font-semibold hover:opacity-95">
            {mode === "edit" ? "Salvar Alterações" : "Criar Atributo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-success" : "bg-muted-foreground/30"}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
