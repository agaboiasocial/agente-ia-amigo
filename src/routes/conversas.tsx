import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { conversations as initialConvs, kanbanStages, type Conversation, type KanbanStage } from "@/lib/mock-data";
import {
  Search,
  Phone,
  MoreVertical,
  CheckCircle2,
  ArrowLeftRight,
  Smile,
  Paperclip,
  Zap,
  Send,
  Tag,
  Mail,
  X,
  PanelRightClose,
  PanelRightOpen,
  Instagram,
  Globe,
  MessageCircle,
  StickyNote,
  LayoutList,
  Columns3,
} from "lucide-react";

export const Route = createFileRoute("/conversas")({
  component: ConversasPage,
});

const tabs = ["Abertas", "Pendentes", "Resolvidas", "Todas"] as const;

const channelIcon = (c: Conversation["channel"]) =>
  c === "WhatsApp" ? MessageCircle : c === "Instagram" ? Instagram : Globe;

const channelColor = (c: Conversation["channel"]) =>
  c === "WhatsApp"
    ? "bg-success/15 text-success"
    : c === "Instagram"
    ? "bg-[oklch(0.65_0.18_20)]/15 text-[oklch(0.55_0.18_20)]"
    : "bg-brand/10 text-brand";

function ConversasPage() {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [tab, setTab] = useState<(typeof tabs)[number]>("Abertas");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState("c1");
  const [convs, setConvs] = useState(initialConvs);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [showInfo, setShowInfo] = useState(true);
  const [dragId, setDragId] = useState<string | null>(null);

  const moveCard = (id: string, stage: KanbanStage) => {
    setConvs((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
  };

  const filtered = useMemo(() => {
    return convs.filter((c) => {
      if (tab === "Abertas" && c.status !== "aberta") return false;
      if (tab === "Pendentes" && c.status !== "pendente") return false;
      if (tab === "Resolvidas" && c.status !== "resolvida") return false;
      if (query && !c.contactName.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [convs, tab, query]);

  const active = convs.find((c) => c.id === activeId) ?? convs[0];

  const send = () => {
    if (!draft.trim()) return;
    setConvs((prev) =>
      prev.map((c) =>
        c.id === active.id
          ? {
              ...c,
              messages: [
                ...c.messages,
                {
                  id: String(Date.now()),
                  from: "agente",
                  text: draft,
                  time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
                  isNote: mode === "note",
                },
              ],
              lastMessage: draft,
            }
          : c
      )
    );
    setDraft("");
  };

  return (
    <AppLayout flush>
      <div className="h-full flex flex-col">
        {/* Top toolbar with view switcher */}
        <div className="h-12 shrink-0 bg-card border-b px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold text-brand">Conversas</h1>
            <span className="text-xs text-muted-foreground">· {convs.length} no total</span>
          </div>
          <div className="flex items-center gap-1 bg-background rounded-lg p-1 border">
            <button
              onClick={() => setView("list")}
              className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                view === "list" ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground"
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${
                view === "kanban" ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground"
              }`}
            >
              <Columns3 className="h-3.5 w-3.5" /> Kanban
            </button>
          </div>
        </div>

        {view === "kanban" ? (
          <KanbanBoard
            convs={convs}
            onMove={moveCard}
            dragId={dragId}
            setDragId={setDragId}
          />
        ) : (
        <div className="flex flex-1 min-h-0">
        {/* Column 1 */}
        <section className="w-[320px] shrink-0 border-r bg-card flex flex-col">
          <div className="p-4 border-b space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand">Conversas</h2>
              <span className="text-xs text-muted-foreground">{filtered.length} itens</span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar conversa..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success"
              />
            </div>
            <div className="flex gap-1 bg-background rounded-lg p-1">
              {tabs.map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${
                    tab === t
                      ? "bg-card shadow-sm text-brand font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {filtered.length === 0 ? (
              <EmptyState text="Nenhuma conversa encontrada" />
            ) : (
              filtered.map((c) => {
                const Icon = channelIcon(c.channel);
                const sel = c.id === active.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left px-4 py-3 border-b flex gap-3 hover:bg-background transition-colors ${
                      sel ? "bg-background" : ""
                    } ${c.unread ? "border-l-4 border-l-success" : ""}`}
                  >
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                        {c.avatar}
                      </div>
                      {c.online && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${c.unread ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
                          {c.contactName}
                        </span>
                        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{c.time}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${c.unread ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {c.lastMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${channelColor(c.channel)}`}>
                          <Icon className="h-3 w-3" />
                          {c.channel}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate">· {c.agent}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Column 2 */}
        <section className="flex-1 flex flex-col bg-background min-w-0">
          {/* Chat header */}
          <header className="h-16 shrink-0 bg-card border-b px-5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="h-10 w-10 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                  {active.avatar}
                </div>
                {active.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-foreground truncate">{active.contactName}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${channelColor(active.channel)}`}>
                    {active.channel}
                  </span>
                  · {active.online ? "Online agora" : "Offline"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-9 px-3 rounded-lg text-xs font-medium border hover:bg-background flex items-center gap-1.5">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Transferir
              </button>
              <button className="h-9 px-3 rounded-lg text-xs font-medium bg-success text-success-foreground hover:opacity-95 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
              </button>
              <button
                onClick={() => setShowInfo((s) => !s)}
                className="h-9 w-9 rounded-lg border hover:bg-background grid place-items-center"
                title="Painel de informações"
              >
                {showInfo ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </button>
              <button className="h-9 w-9 rounded-lg border hover:bg-background grid place-items-center">
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-auto p-6 space-y-4">
            {active.messages.map((m) => {
              const mine = m.from === "agente";
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[70%]">
                    <div
                      className={`px-4 py-2.5 text-sm shadow-sm ${
                        m.isNote
                          ? "bg-warning/30 text-foreground rounded-2xl border border-warning"
                          : mine
                          ? "bg-success text-success-foreground rounded-2xl rounded-br-md"
                          : "bg-card text-foreground rounded-2xl rounded-bl-md"
                      }`}
                    >
                      {m.isNote && (
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                          Nota interna
                        </div>
                      )}
                      {m.text}
                    </div>
                    <div className={`text-[10px] text-muted-foreground mt-1 ${mine ? "text-right" : ""}`}>
                      {m.time}
                    </div>
                  </div>
                </div>
              );
            })}
            {active.online && (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                <span className="flex gap-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:240ms]" />
                </span>
                {active.contactName.split(" ")[0]} está digitando…
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t bg-card">
            <div className="flex gap-1 px-4 pt-2">
              <button
                onClick={() => setMode("reply")}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  mode === "reply" ? "bg-success/15 text-success font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Resposta
              </button>
              <button
                onClick={() => setMode("note")}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                  mode === "note" ? "bg-warning/30 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <StickyNote className="h-3 w-3" /> Nota interna
              </button>
            </div>
            <div className={`p-3 ${mode === "note" ? "bg-warning/10" : ""}`}>
              <div className="flex items-end gap-2">
                <div className="flex-1 rounded-xl border bg-background px-3 py-2 flex items-center gap-2">
                  <button className="text-muted-foreground hover:text-foreground"><Smile className="h-4 w-4" /></button>
                  <button className="text-muted-foreground hover:text-foreground"><Paperclip className="h-4 w-4" /></button>
                  <button className="text-muted-foreground hover:text-warning" title="Respostas rápidas"><Zap className="h-4 w-4" /></button>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={mode === "note" ? "Escreva uma nota visível só para a equipe..." : "Digite sua mensagem..."}
                    className="flex-1 bg-transparent text-sm focus:outline-none"
                  />
                </div>
                <button
                  onClick={send}
                  className="h-11 px-5 rounded-xl bg-success text-success-foreground hover:opacity-95 flex items-center gap-2 font-semibold text-sm"
                >
                  <Send className="h-4 w-4" /> Enviar
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Column 3 */}
        {showInfo && (
          <aside className="w-[300px] shrink-0 border-l bg-card overflow-auto">
            <div className="p-5 text-center border-b">
              <div className="h-20 w-20 mx-auto rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-lg">
                {active.avatar}
              </div>
              <h3 className="mt-3 font-semibold text-foreground">{active.contactName}</h3>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center justify-center gap-1"><Mail className="h-3 w-3" /> {active.contactName.toLowerCase().split(" ").join(".")}@email.com</div>
                <div className="flex items-center justify-center gap-1"><Phone className="h-3 w-3" /> (11) 98765-4321</div>
              </div>
            </div>

            <Section title="Canal de origem">
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${channelColor(active.channel)}`}>
                {active.channel}
              </span>
            </Section>

            <Section title="Labels">
              <div className="flex flex-wrap gap-1.5">
                {["VIP", "Recorrente"].map((l) => (
                  <span key={l} className="text-xs px-2 py-1 rounded-md bg-success/15 text-success font-medium flex items-center gap-1">
                    <Tag className="h-3 w-3" /> {l}
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" />
                  </span>
                ))}
                <button className="text-xs px-2 py-1 rounded-md border border-dashed text-muted-foreground hover:text-foreground">+ Adicionar</button>
              </div>
            </Section>

            <Section title="Conversas anteriores">
              <ul className="space-y-2 text-xs">
                <li className="p-2 rounded-md bg-background">
                  <div className="font-medium text-foreground">Pedido #4310</div>
                  <div className="text-muted-foreground">Resolvida · 12/04/2026</div>
                </li>
                <li className="p-2 rounded-md bg-background">
                  <div className="font-medium text-foreground">Dúvida pagamento</div>
                  <div className="text-muted-foreground">Resolvida · 28/03/2026</div>
                </li>
              </ul>
            </Section>

            <Section title="Atributos customizados">
              <dl className="text-xs space-y-1.5">
                <div className="flex justify-between"><dt className="text-muted-foreground">Plano</dt><dd className="font-medium">Pro</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Cliente desde</dt><dd className="font-medium">2024</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">LTV</dt><dd className="font-medium">R$ 4.820</dd></div>
              </dl>
            </Section>

            <Section title="Participantes">
              <div className="flex -space-x-2">
                {["MS", "CP", "BL"].map((a) => (
                  <div key={a} className="h-8 w-8 rounded-full bg-brand text-brand-foreground grid place-items-center text-[10px] font-bold ring-2 ring-card">
                    {a}
                  </div>
                ))}
              </div>
            </Section>
          </aside>
        )}
        </div>
        )}
      </div>
    </AppLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 border-b">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">{title}</h4>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-10 text-center">
      <div className="mx-auto h-16 w-16 rounded-full bg-background grid place-items-center mb-3">
        <MessageCircle className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function KanbanBoard({
  convs,
  onMove,
  dragId,
  setDragId,
}: {
  convs: Conversation[];
  onMove: (id: string, stage: KanbanStage) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
}) {
  return (
    <div className="flex-1 min-h-0 overflow-x-auto p-4 bg-background">
      <div className="flex gap-4 h-full min-w-max">
        {kanbanStages.map((stage) => {
          const items = convs.filter((c) => c.stage === stage.id);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) {
                  onMove(dragId, stage.id);
                  setDragId(null);
                }
              }}
              className="w-[300px] shrink-0 bg-card rounded-xl border flex flex-col max-h-full"
            >
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: stage.color }}
                  />
                  <h3 className="text-sm font-semibold text-foreground">{stage.label}</h3>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-background text-muted-foreground font-medium">
                  {items.length}
                </span>
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                {items.length === 0 && (
                  <div className="text-center text-xs text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                    Arraste cards para cá
                  </div>
                )}
                {items.map((c) => {
                  const Icon = channelIcon(c.channel);
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`bg-background border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${
                        dragId === c.id ? "opacity-50 rotate-1" : ""
                      } ${c.unread ? "border-l-4 border-l-success" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="relative shrink-0">
                          <div className="h-8 w-8 rounded-full bg-brand/10 text-brand grid place-items-center text-[10px] font-bold">
                            {c.avatar}
                          </div>
                          {c.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success ring-2 ring-background" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground truncate">{c.contactName}</span>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">{c.time}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${channelColor(c.channel)}`}>
                              <Icon className="h-2.5 w-2.5" />
                              {c.channel}
                            </span>
                            {c.slaRemaining < 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground font-semibold">
                                SLA estourado
                              </span>
                            )}
                            {c.slaRemaining > 0 && c.slaRemaining <= 10 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning text-warning-foreground font-semibold">
                                {c.slaRemaining}min
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
