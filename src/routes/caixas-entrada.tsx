import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  useInboxes,
  useInboxMembers,
  useCreateInbox,
  useUpdateInbox,
  useDeleteInbox,
  channelMeta,
  type InboxChannel,
  type Inbox,
} from "@/lib/inboxes";
import { useAgents, useConversations } from "@/lib/data";
import {
  Plus,
  Trash2,
  Pencil,
  MessageCircle,
  Instagram,
  Facebook,
  Send as SendIcon,
  Globe,
  Mail,
  Search,
  X,
  Check,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/caixas-entrada")({ component: CaixasPage });

const channelIcons: Record<InboxChannel, typeof Globe> = {
  WhatsApp: MessageCircle,
  Instagram: Instagram,
  Facebook: Facebook,
  Telegram: SendIcon,
  Website: Globe,
  Email: Mail,
};

function CaixasPage() {
  const { data: inboxes = [] } = useInboxes();
  const { data: members = [] } = useInboxMembers();
  const { data: agents = [] } = useAgents();
  const { data: convs = [] } = useConversations();
  const updateInbox = useUpdateInbox();
  const deleteInbox = useDeleteInbox();
  const [open, setOpen] = useState(false);

  return (
    <AppLayout title="Caixas de Entrada">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-brand">Caixas de Entrada</h1>
            <p className="text-sm text-muted-foreground">
              Configure os canais de atendimento da sua operação.
            </p>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="h-10 px-4 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-95 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Nova Caixa de Entrada
          </button>
        </div>

        {inboxes.length === 0 ? (
          <div className="bg-card border rounded-xl p-12 text-center">
            <div className="h-16 w-16 mx-auto rounded-2xl bg-success/10 grid place-items-center mb-4">
              <Globe className="h-8 w-8 text-success" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Nenhuma caixa criada ainda</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Conecte um canal para começar a receber conversas.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="h-10 px-4 rounded-lg bg-success text-success-foreground text-sm font-medium"
            >
              Criar primeira caixa
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {inboxes.map((ib) => {
              const Icon = channelIcons[ib.channel];
              const meta = channelMeta[ib.channel];
              const ibMembers = members.filter((m) => m.inbox_id === ib.id);
              const userCount = ibMembers.filter((m) => m.user_id).length;
              const teamCount = ibMembers.filter((m) => m.team_id).length;
              const activeConvs = convs.filter(
                (c) => (c as { inbox_id?: string }).inbox_id === ib.id && c.status !== "resolvida",
              ).length;
              return (
                <div key={ib.id} className="bg-card border rounded-xl p-5 flex items-center gap-4">
                  <div
                    className="h-12 w-12 rounded-xl grid place-items-center shrink-0"
                    style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground truncate">{ib.name}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                      <span>
                        {userCount} agente{userCount !== 1 ? "s" : ""} · {teamCount} equipe
                        {teamCount !== 1 ? "s" : ""}
                      </span>
                      <span>· {activeConvs} conversas ativas</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={ib.active}
                      onChange={(e) => updateInbox.mutate({ id: ib.id, patch: { active: e.target.checked } })}
                      className="h-4 w-4 accent-success"
                    />
                    <span className={ib.active ? "text-success font-medium" : "text-muted-foreground"}>
                      {ib.active ? "Ativa" : "Inativa"}
                    </span>
                  </label>
                  <button
                    title="Editar"
                    className="h-9 w-9 rounded-lg border hover:bg-background grid place-items-center"
                    onClick={() => toast.info("Edição em breve")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    title="Excluir"
                    onClick={() => {
                      if (confirm(`Excluir caixa "${ib.name}"?`)) {
                        deleteInbox.mutate(ib.id, {
                          onSuccess: () => toast.success("Caixa excluída"),
                        });
                      }
                    }}
                    className="h-9 w-9 rounded-lg border hover:bg-destructive/10 hover:border-destructive hover:text-destructive grid place-items-center"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <NewInboxWizard open={open} onClose={() => setOpen(false)} agents={agents} />
    </AppLayout>
  );
}

// ----- Wizard -----

const channels: InboxChannel[] = ["WhatsApp", "Instagram", "Facebook", "Telegram", "Website", "Email"];

function NewInboxWizard({
  open,
  onClose,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  agents: { user_id: string; display_name: string; avatar_initials: string | null }[];
}) {
  const [step, setStep] = useState(1);
  const [channel, setChannel] = useState<InboxChannel | null>(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  const [widgetColor, setWidgetColor] = useState("#2FAE7C");
  const [welcome, setWelcome] = useState("Olá! Como podemos ajudar?");
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const create = useCreateInbox();

  const reset = () => {
    setStep(1);
    setChannel(null);
    setName("");
    setConfig({});
    setWidgetColor("#2FAE7C");
    setWelcome("Olá! Como podemos ajudar?");
    setSelectedAgents(new Set());
    setSearch("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    if (!channel || !name.trim()) return;
    try {
      await create.mutateAsync({
        inbox: {
          name: name.trim(),
          channel,
          config,
          widget_color: channel === "Website" ? widgetColor : null,
          welcome_message: channel === "Website" ? welcome : null,
          active: true,
        },
        members: [...selectedAgents].map((user_id) => ({ user_id })),
      });
      toast.success("Caixa de entrada criada!");
      close();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    }
  };

  const filteredAgents = useMemo(
    () => agents.filter((a) => a.display_name.toLowerCase().includes(search.toLowerCase())),
    [agents, search],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? close() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-brand">Nova Caixa de Entrada</DialogTitle>
        </DialogHeader>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex-1 flex items-center gap-2">
              <div
                className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${
                  step >= s ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {s}
              </div>
              <span
                className={`text-xs ${step >= s ? "text-foreground font-medium" : "text-muted-foreground"}`}
              >
                {s === 1 ? "Canal" : s === 2 ? "Configuração" : "Agentes"}
              </span>
              {s < 3 && <div className={`flex-1 h-px ${step > s ? "bg-success" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-auto">
            {channels.map((c) => {
              const Icon = channelIcons[c];
              const meta = channelMeta[c];
              const sel = channel === c;
              return (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    sel ? "border-success bg-success/5" : "border-border hover:border-success/50"
                  }`}
                >
                  <div
                    className="h-10 w-10 rounded-lg grid place-items-center mb-2"
                    style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="font-semibold text-sm">{meta.label}</div>
                  <div className="text-xs text-muted-foreground">{meta.description}</div>
                </button>
              );
            })}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && channel && (
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            <Field label="Nome da caixa" value={name} onChange={setName} placeholder="Ex: WhatsApp Vendas" />

            {channel === "WhatsApp" && (
              <>
                <Field label="Número do WhatsApp" value={config.phone ?? ""} onChange={(v) => setConfig({ ...config, phone: v })} placeholder="+55 11 99999-9999" />
                <Field label="API URL (Evolution API)" value={config.api_url ?? ""} onChange={(v) => setConfig({ ...config, api_url: v })} placeholder="https://api.example.com" />
                <Field label="API Key" value={config.api_key ?? ""} onChange={(v) => setConfig({ ...config, api_key: v })} placeholder="••••••" />
              </>
            )}
            {channel === "Instagram" && (
              <button className="w-full h-10 rounded-lg border-2 border-dashed border-success/50 text-success font-medium text-sm hover:bg-success/5">
                Conectar conta do Instagram
              </button>
            )}
            {channel === "Facebook" && (
              <button className="w-full h-10 rounded-lg border-2 border-dashed border-[#1877F2]/50 text-[#1877F2] font-medium text-sm hover:bg-[#1877F2]/5">
                Conectar página do Facebook
              </button>
            )}
            {channel === "Telegram" && (
              <Field label="Token do Bot" value={config.token ?? ""} onChange={(v) => setConfig({ ...config, token: v })} placeholder="123456:ABC-DEF..." />
            )}
            {channel === "Website" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-3">
                  <Field label="URL do site" value={config.url ?? ""} onChange={(v) => setConfig({ ...config, url: v })} placeholder="https://meusite.com" />
                  <div>
                    <label className="text-xs text-muted-foreground">Cor do widget</label>
                    <div className="flex gap-2 items-center mt-1">
                      <input type="color" value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="h-9 w-14 rounded border cursor-pointer" />
                      <input value={widgetColor} onChange={(e) => setWidgetColor(e.target.value)} className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mensagem de boas-vindas</label>
                    <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
                  </div>
                </div>
                {/* Preview */}
                <div className="bg-background border rounded-lg p-4 flex flex-col">
                  <div className="text-xs text-muted-foreground mb-2">Preview do widget</div>
                  <div className="flex-1 bg-card rounded-xl border shadow-sm p-3 flex flex-col">
                    <div className="text-white text-sm font-semibold p-3 -m-3 mb-3 rounded-t-xl" style={{ backgroundColor: widgetColor }}>
                      {name || "Sua marca"}
                    </div>
                    <div className="flex-1 text-xs bg-muted/30 rounded-lg p-2 text-foreground">{welcome}</div>
                    <div className="mt-2 h-8 rounded-lg border bg-background" />
                  </div>
                </div>
              </div>
            )}
            {channel === "Email" && (
              <>
                <Field label="Email" value={config.email ?? ""} onChange={(v) => setConfig({ ...config, email: v })} placeholder="suporte@empresa.com" />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Servidor IMAP" value={config.imap ?? ""} onChange={(v) => setConfig({ ...config, imap: v })} placeholder="imap.gmail.com" />
                  <Field label="Servidor SMTP" value={config.smtp ?? ""} onChange={(v) => setConfig({ ...config, smtp: v })} placeholder="smtp.gmail.com" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-3 max-h-[60vh] overflow-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar agente..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success"
              />
            </div>
            <div className="border rounded-lg divide-y max-h-72 overflow-auto">
              {filteredAgents.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">Nenhum agente</div>
              ) : (
                filteredAgents.map((a) => {
                  const sel = selectedAgents.has(a.user_id);
                  return (
                    <button
                      key={a.user_id}
                      onClick={() => {
                        const next = new Set(selectedAgents);
                        if (sel) next.delete(a.user_id);
                        else next.add(a.user_id);
                        setSelectedAgents(next);
                      }}
                      className="w-full px-3 py-2 flex items-center gap-3 hover:bg-background text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-brand text-brand-foreground grid place-items-center text-xs font-bold">
                        {a.avatar_initials ?? "?"}
                      </div>
                      <span className="flex-1 text-sm">{a.display_name}</span>
                      <div
                        className={`h-5 w-5 rounded border-2 grid place-items-center ${
                          sel ? "bg-success border-success" : "border-muted-foreground/30"
                        }`}
                      >
                        {sel && <Check className="h-3 w-3 text-success-foreground" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">{selectedAgents.size}</strong> agente
              {selectedAgents.size !== 1 ? "s" : ""} terão acesso a esta caixa.
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <button
            onClick={close}
            className="h-9 px-3 rounded-lg text-sm text-muted-foreground hover:bg-background flex items-center gap-1"
          >
            <X className="h-4 w-4" /> Cancelar
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="h-9 px-4 rounded-lg border text-sm font-medium hover:bg-background"
              >
                Voltar
              </button>
            )}
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={(step === 1 && !channel) || (step === 2 && !name.trim())}
                className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-medium disabled:opacity-50"
              >
                Próximo
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={create.isPending}
                className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-medium disabled:opacity-50"
              >
                {create.isPending ? "Criando..." : "Criar Caixa"}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 mt-1 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success"
      />
    </div>
  );
}
