import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  useConversations,
  useMessages,
  useSendMessage,
  useUpdateConversation,
  useDeleteConversation,
  useAgents,
  type ConvRow,
  type MsgRow,
} from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MoreVertical,
  CheckCircle2,
  ArrowLeftRight,
  Send,
  PanelRightClose,
  PanelRightOpen,
  Instagram,
  Globe,
  MessageCircle,
  StickyNote,
  LayoutList,
  Columns3,
  Download,
  FileText,
  FileSpreadsheet,
  FileType,
  Loader2,
  Inbox,
  Trash2,
  Bot,
  BotOff,
  Paperclip,
  X,
  Users,
  Users2,
  Phone,
  Settings2,
  UserCheck,
} from "lucide-react";
import { MessageComposer } from "@/components/MessageComposer";
import { FormattedMessage } from "@/lib/chat-format";
import { useChatPrefs, ensureFontLoaded } from "@/hooks/use-chat-prefs";
import { supabase } from "@/integrations/supabase/client";
import { edgeFunctionUrl } from "@/lib/edge-functions";
import { useConversationStages, type ConversationStage } from "@/hooks/use-conversation-stages";
import { ConversationKanbanSettings } from "@/components/ConversationKanbanSettings";

export const Route = createFileRoute("/conversas")({ component: ConversasPage });

const tabs = ["Abertas", "Pendentes", "Resolvidas", "Todas"] as const;

type AttachmentDraft = {
  file: File;
  type: "image" | "video" | "audio" | "document";
  previewUrl: string;
};

function mediaTypeFromFile(file: File): AttachmentDraft["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "document";
}

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function mediaSrc(message: MsgRow) {
  if (!message.media_url) return "";
  if (message.media_url.startsWith("data:")) return message.media_url;
  if (
    message.media_url.includes("supabase.co/storage") ||
    message.media_url.includes("/storage/v1/object/public/")
  ) {
    return message.media_url;
  }
  return edgeFunctionUrl("message-media", `?id=${encodeURIComponent(message.id)}`);
}

const channelIcon = (c: string) =>
  c === "WhatsApp" ? MessageCircle : c === "Instagram" ? Instagram : Globe;
const channelColor = (c: string) =>
  c === "WhatsApp"
    ? "bg-success/15 text-success"
    : c === "Instagram"
      ? "bg-[oklch(0.65_0.18_20)]/15 text-[oklch(0.55_0.18_20)]"
      : "bg-brand/10 text-brand";

const initials = (n: string) =>
  n
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase() || "?";

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString())
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ----- Export helpers -----
function buildExport(conv: ConvRow, msgs: MsgRow[]) {
  const start = msgs[0]?.created_at ?? conv.opened_at;
  const end = msgs[msgs.length - 1]?.created_at ?? conv.last_message_at ?? start;
  return {
    contact: conv.contact?.name ?? "—",
    channel: conv.channel,
    start: new Date(start).toLocaleString("pt-BR"),
    end: new Date(end).toLocaleString("pt-BR"),
    agent: conv.assigned_to ?? "Não atribuído",
    messages: msgs.map((m) => ({
      time: new Date(m.created_at).toLocaleString("pt-BR"),
      author: m.is_note ? "[NOTA INTERNA]" : m.author === "agente" ? "Agente" : "Cliente",
      text: m.body,
    })),
  };
}
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function exportTxt(c: ConvRow, m: MsgRow[]) {
  const d = buildExport(c, m);
  const lines = [
    `Contato: ${d.contact}`,
    `Canal: ${d.channel}`,
    `Início: ${d.start}`,
    `Fim: ${d.end}`,
    `Agente: ${d.agent}`,
    "",
    "=== Mensagens ===",
    "",
    ...d.messages.map((x) => `[${x.time}] ${x.author}: ${x.text}`),
  ];
  downloadBlob(
    `conversa-${c.id}.txt`,
    new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }),
  );
}
function exportCsv(c: ConvRow, m: MsgRow[]) {
  const d = buildExport(c, m);
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["contato", "canal", "inicio", "fim", "agente", "timestamp", "autor", "mensagem"];
  const rows = d.messages.map((x) =>
    [d.contact, d.channel, d.start, d.end, d.agent, x.time, x.author, x.text].map(esc).join(","),
  );
  downloadBlob(
    `conversa-${c.id}.csv`,
    new Blob(["\ufeff" + [header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    }),
  );
}
function exportPdf(c: ConvRow, m: MsgRow[]) {
  const d = buildExport(c, m);
  const doc = new jsPDF();
  let y = 15;
  doc.setFontSize(14);
  doc.text(`Conversa - ${d.contact}`, 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.text(`Canal: ${d.channel}`, 14, y);
  y += 6;
  doc.text(`Início: ${d.start}   Fim: ${d.end}`, 14, y);
  y += 6;
  doc.text(`Agente responsável: ${d.agent}`, 14, y);
  y += 8;
  doc.setDrawColor(47, 174, 124);
  doc.line(14, y, 196, y);
  y += 6;
  d.messages.forEach((x) => {
    const wrapped = doc.splitTextToSize(`[${x.time}] ${x.author}: ${x.text}`, 180);
    if (y + wrapped.length * 5 > 285) {
      doc.addPage();
      y = 15;
    }
    doc.text(wrapped, 14, y);
    y += wrapped.length * 5 + 2;
  });
  doc.save(`conversa-${c.id}.pdf`);
}

function useTeams() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["teams", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from("teams")
        .select("id, name")
        .eq("account_id", accountId)
        .order("name");
      if (error) return [];
      return (data ?? []) as { id: string; name: string }[];
    },
    enabled: !!accountId,
  });
}

function useWhatsAppInstances() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["whatsapp_instances", accountId],
    queryFn: async () => {
      let q = (supabase as any)
        .from("whatsapp_instances")
        .select("id, instance_name, phone_number, profile_name, status")
        .eq("status", "connected");
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []) as { id: string; instance_name: string; phone_number: string | null; profile_name: string | null; status: string }[];
    },
  });
}

function ConversasPage() {
  const { user, accountId } = useAuth();
  const { prefs } = useChatPrefs(user?.id);
  useEffect(() => {
    ensureFontLoaded(prefs.font);
  }, [prefs.font]);
  const { data: convs = [], isLoading } = useConversations();
  const updateConv = useUpdateConversation();
  const deleteConv = useDeleteConversation();
  const { data: agents = [] } = useAgents();
  const { data: teams = [] } = useTeams();
  const { data: instances = [] } = useWhatsAppInstances();
  const { data: kanbanStages = [] } = useConversationStages();

  const [view, setView] = useState<"list" | "kanban">("list");
  const [kanbanSettingsOpen, setKanbanSettingsOpen] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Todas");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [showInfo, setShowInfo] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<AttachmentDraft | null>(null);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTab, setTransferTab] = useState<"agente" | "equipe" | "numero">("agente");

  const filtered = useMemo(() => {
    return convs.filter((c) => {
      if (tab === "Abertas" && c.status !== "aberta") return false;
      if (tab === "Pendentes" && c.status !== "pendente") return false;
      if (tab === "Resolvidas" && c.status !== "resolvida") return false;
      const name = c.contact?.name ?? "";
      if (query && !name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [convs, tab, query]);

  const active = convs.find((c) => c.id === activeId) ?? filtered[0] ?? null;
  const { data: messages = [] } = useMessages(active?.id);
  const sendMsg = useSendMessage();

  useEffect(() => {
    return () => {
      if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    };
  }, [attachment?.previewUrl]);

  const uploadAttachment = async (conversationId: string, item: AttachmentDraft) => {
    const ext = item.file.name.split(".").pop();
    const path = `${conversationId}/${crypto.randomUUID()}-${safeFileName(item.file.name || `arquivo.${ext || "bin"}`)}`;
    const { error } = await supabase.storage
      .from("chat-media")
      .upload(path, item.file, {
        contentType: item.file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      throw new Error(
        `Falha ao enviar o anexo para o Supabase Storage. Verifique se o bucket chat-media foi criado. ${error.message}`,
      );
    }
    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const selectAttachment = (file: File | null) => {
    if (!file) return;
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment({
      file,
      type: mediaTypeFromFile(file),
      previewUrl: URL.createObjectURL(file),
    });
  };

  const send = async () => {
    if ((!draft.trim() && !attachment) || !active) return;
    const body = draft;
    const item = attachment;
    setDraft("");
    setAttachment(null);
    try {
      const mediaUrl = item ? await uploadAttachment(active.id, item) : null;
      await sendMsg.mutateAsync({
        conversation_id: active.id,
        body,
        is_note: mode === "note",
        author: "agente",
        sender_id: user?.id ?? null,
        media_url: mediaUrl,
        media_type: item?.type ?? null,
        file_name: item?.file.name ?? null,
        mime_type: item?.file.type ?? null,
      });
      // Auto-assume: ao responder (não nota) uma conversa sem dono, vira dono e pausa a IA
      if (mode === "reply" && user?.id && !active.assigned_to) {
        updateConv.mutate({ id: active.id, patch: { assigned_to: user.id } });
        if (active.contact_id && !active.contact?.ai_paused) {
          const sb = (await import("@/integrations/supabase/client")).supabase as any;
          sb.from("contacts").update({ ai_paused: true, updated_at: new Date().toISOString() }).eq("id", active.contact_id);
        }
      }
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    } catch (e: unknown) {
      setDraft(body);
      if (item) setAttachment(item);
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    }
  };

  const claimConversation = () => {
    if (!active || !user?.id) return;
    updateConv.mutate({ id: active.id, patch: { assigned_to: user.id } });
    if (active.contact_id && !active.contact?.ai_paused) {
      import("@/integrations/supabase/client").then(({ supabase }) => {
        (supabase as any).from("contacts").update({ ai_paused: true, updated_at: new Date().toISOString() }).eq("id", active.contact_id);
      });
    }
    toast.success("Conversa atribuída a você");
  };

  const moveCard = (id: string, stage: string) => {
    updateConv.mutate({ id, patch: { stage } });
  };

  const resolve = () => {
    if (!active) return;
    updateConv.mutate({
      id: active.id,
      patch: { status: "resolvida", stage: "resolvido", resolved_at: new Date().toISOString() },
    });
    toast.success("Conversa marcada como resolvida");
  };

  const handleDelete = async () => {
    if (!active) return;
    const name = active.contact?.name ?? "esta conversa";
    if (!confirm(`Excluir "${name}" e todas as mensagens? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteConv.mutateAsync(active.id);
      setActiveId(null);
      toast.success("Conversa excluída");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  };

  const toggleAI = async () => {
    if (!active?.contact_id) return;
    const sb = (await import("@/integrations/supabase/client")).supabase as any;
    const currentPaused = active.contact?.ai_paused ?? false;
    const { error } = await sb
      .from("contacts")
      .update({ ai_paused: !currentPaused, updated_at: new Date().toISOString() })
      .eq("id", active.contact_id);
    if (error) {
      toast.error("Erro ao alterar IA: " + error.message);
      return;
    }
    toast.success(currentPaused ? "IA reativada para este contato" : "IA pausada para este contato");
  };

  const transferToAgent = async (agentId: string) => {
    if (!active) return;
    const agent = agents.find((a) => a.user_id === agentId);
    updateConv.mutate({ id: active.id, patch: { assigned_to: agentId } });
    toast.success(`Conversa transferida para ${agent?.display_name || "agente"}`);
    setShowTransfer(false);
  };

  const transferToTeam = async (teamId: string) => {
    if (!active) return;
    const team = teams.find((t) => t.id === teamId);
    const { error } = await (supabase as any)
      .from("conversations")
      .update({ assigned_team_id: teamId, updated_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) {
      toast.error("Erro ao transferir: " + error.message);
      return;
    }
    toast.success(`Conversa transferida para equipe ${team?.name || ""}`);
    setShowTransfer(false);
  };

  const transferToInstance = async (instanceName: string) => {
    if (!active) return;
    const inst = instances.find((i) => i.instance_name === instanceName);
    const { error } = await (supabase as any)
      .from("conversations")
      .update({ instance_name: instanceName, updated_at: new Date().toISOString() })
      .eq("id", active.id);
    if (error) {
      toast.error("Erro ao transferir: " + error.message);
      return;
    }
    toast.success(`Conversa transferida para ${inst?.profile_name || instanceName}`);
    setShowTransfer(false);
  };

  return (
    <AppLayout flush>
      <div className="h-full flex flex-col">
        <div className="h-12 shrink-0 bg-card border-b px-3 md:px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {mobileShowChat && (
              <button onClick={() => { setMobileShowChat(false); }} className="md:hidden h-8 w-8 rounded-lg border grid place-items-center shrink-0">
                <PanelRightClose className="h-4 w-4" />
              </button>
            )}
            <h1 className="text-sm font-semibold text-brand truncate">Conversas</h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">· {convs.length} no total</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {view === "kanban" && (
              <button
                onClick={() => setKanbanSettingsOpen(true)}
                className="h-8 px-2 sm:px-3 rounded-lg border bg-background hover:bg-muted text-xs font-medium flex items-center gap-1.5 text-muted-foreground"
                title="Editar colunas do Kanban"
              >
                <Settings2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Editar Kanban</span>
              </button>
            )}
            <div className="flex items-center gap-1 bg-background rounded-lg p-1 border">
              <button
                onClick={() => setView("list")}
                className={`text-xs px-2 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${view === "list" ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground"}`}
              >
                <LayoutList className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Lista</span>
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`text-xs px-2 sm:px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${view === "kanban" ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground"}`}
              >
                <Columns3 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 grid place-items-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : convs.length === 0 ? (
          <EmptyAll />
        ) : view === "kanban" ? (
          <KanbanBoard convs={filtered} stages={kanbanStages} onMove={moveCard} dragId={dragId} setDragId={setDragId} />
        ) : (
          <div className="flex flex-1 min-h-0">
            {/* Column 1 - list */}
            <section className={`w-full md:w-[320px] shrink-0 border-r bg-card flex flex-col ${mobileShowChat ? "hidden md:flex" : "flex"}`}>
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
                      className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${tab === t ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground hover:text-foreground"}`}
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
                    const sel = c.id === active?.id;
                    const name = c.contact?.name ?? "—";
                    return (
                      <button
                        key={c.id}
                        onClick={() => { setActiveId(c.id); setMobileShowChat(true); }}
                        className={`w-full text-left px-4 py-3 border-b flex gap-3 hover:bg-background transition-colors ${sel ? "bg-background" : ""} ${c.unread ? "border-l-4 border-l-success" : ""}`}
                      >
                        <div className="h-10 w-10 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold shrink-0">
                          {initials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-sm truncate ${c.unread ? "font-bold" : "font-medium"} text-foreground`}
                            >
                              {name}
                            </span>
                            <span className="text-[11px] text-muted-foreground shrink-0 ml-2">
                              {formatTime(c.last_message_at)}
                            </span>
                          </div>
                          <p className="text-xs truncate mt-0.5 text-muted-foreground">
                            {c.last_message ?? "Sem mensagens"}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${channelColor(c.channel)}`}
                            >
                              <Icon className="h-3 w-3" />
                              {c.channel}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {/* Column 2 - chat */}
            <section className={`flex-1 flex flex-col bg-background min-w-0 ${mobileShowChat ? "flex" : "hidden md:flex"}`}>
              {!active ? (
                <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
                  Selecione uma conversa
                </div>
              ) : (
                <>
                  <header className="h-14 md:h-16 shrink-0 bg-card border-b px-3 md:px-5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      {/* Mobile back button */}
                      <button onClick={() => setMobileShowChat(false)} className="md:hidden h-8 w-8 rounded-lg border grid place-items-center shrink-0">
                        <PanelRightClose className="h-4 w-4" />
                      </button>
                      <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold shrink-0">
                        {initials(active.contact?.name ?? "?")}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground truncate text-sm md:text-base">
                          {active.contact?.name ?? "—"}
                        </div>
                        <div className="text-[10px] md:text-xs text-muted-foreground flex items-center gap-1 md:gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${channelColor(active.channel)}`}
                          >
                            {active.channel}
                          </span>
                          · {active.status}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                      {!active.assigned_to && (
                        <button
                          onClick={claimConversation}
                          className="h-8 md:h-9 px-2 md:px-3 rounded-lg text-xs font-semibold bg-brand text-brand-foreground hover:opacity-95 flex items-center gap-1.5"
                          title="Assumir esta conversa"
                        >
                          <UserCheck className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Assumir</span>
                        </button>
                      )}
                      <button
                        onClick={() => setShowTransfer(true)}
                        className="h-8 md:h-9 px-2 md:px-3 rounded-lg text-xs font-medium border hover:bg-background flex items-center gap-1.5"
                        title="Transferir"
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Transferir</span>
                      </button>
                      <button
                        onClick={resolve}
                        className="h-8 md:h-9 px-2 md:px-3 rounded-lg text-xs font-medium bg-success text-success-foreground hover:opacity-95 flex items-center gap-1.5"
                        title="Resolver"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Resolver</span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-8 md:h-9 px-2 md:px-3 rounded-lg text-xs font-medium border hover:bg-background flex items-center gap-1.5" title="Exportar">
                            <Download className="h-3.5 w-3.5" style={{ color: "#2FAE7C" }} />
                            <span className="hidden xl:inline">Exportar Conversa</span>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel>Formato de exportação</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              exportPdf(active, messages);
                              toast.success("Conversa exportada com sucesso!");
                            }}
                          >
                            <FileType className="h-4 w-4" style={{ color: "#2FAE7C" }} /> Exportar
                            como PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              exportTxt(active, messages);
                              toast.success("Conversa exportada com sucesso!");
                            }}
                          >
                            <FileText className="h-4 w-4" style={{ color: "#2FAE7C" }} /> Exportar
                            como TXT
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              exportCsv(active, messages);
                              toast.success("Conversa exportada com sucesso!");
                            }}
                          >
                            <FileSpreadsheet className="h-4 w-4" style={{ color: "#2FAE7C" }} />{" "}
                            Exportar como CSV
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <button
                        onClick={() => setShowInfo((s) => !s)}
                        className="h-9 w-9 rounded-lg border hover:bg-background grid place-items-center"
                        title="Painel"
                      >
                        {showInfo ? (
                          <PanelRightClose className="h-4 w-4" />
                        ) : (
                          <PanelRightOpen className="h-4 w-4" />
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="h-9 w-9 rounded-lg border hover:bg-background grid place-items-center">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={toggleAI}>
                            {active?.contact?.ai_paused ? (
                              <><Bot className="h-4 w-4 mr-2" /> Reativar IA</>
                            ) : (
                              <><BotOff className="h-4 w-4 mr-2" /> Pausar IA</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={handleDelete}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir conversa
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </header>

                  <div className="flex-1 overflow-auto p-3 md:p-6 space-y-3 md:space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-10">
                        Sem mensagens ainda. Envie a primeira abaixo.
                      </div>
                    ) : (
                      messages.map((m) => {
                        const mine = m.author === "agente";
                        return (
                          <div
                            key={m.id}
                            className={`flex ${mine ? "justify-end" : "justify-start"}`}
                          >
                            <div className="max-w-[85%] md:max-w-[70%]">
                              <div
                                className={`px-4 py-2.5 shadow-sm ${
                                  m.is_note
                                    ? "bg-warning/30 text-foreground rounded-2xl border border-warning"
                                    : mine
                                      ? "bg-success text-success-foreground rounded-2xl rounded-br-md"
                                      : "bg-card text-foreground rounded-2xl rounded-bl-md"
                                }`}
                                style={{
                                  fontFamily: `${prefs.font}, system-ui, sans-serif`,
                                  fontSize: prefs.size,
                                  lineHeight: 1.5,
                                }}
                              >
                                {m.is_note && (
                                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-1">
                                    Nota interna
                                  </div>
                                )}
                                {m.message_type === "image" && m.media_url ? (
                                  <div>
                                    <img
                                      src={mediaSrc(m)}
                                      alt="imagem"
                                      className="max-w-full max-h-72 rounded-lg mb-1 cursor-pointer"
                                      onClick={() => window.open(mediaSrc(m), "_blank")}
                                    />
                                    {m.body && m.body !== "[imagem]" && <FormattedMessage text={m.body} />}
                                  </div>
                                ) : m.message_type === "video" && m.media_url ? (
                                  <div>
                                    <video
                                      src={mediaSrc(m)}
                                      controls
                                      className="max-w-full max-h-72 rounded-lg mb-1"
                                    />
                                    {m.body && m.body !== "[vídeo]" && <FormattedMessage text={m.body} />}
                                  </div>
                                ) : m.message_type === "audio" && m.media_url ? (
                                  <audio src={mediaSrc(m)} controls className="max-w-full min-w-[200px]" />
                                ) : m.message_type === "document" && m.media_url ? (
                                  <a
                                    href={mediaSrc(m)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm underline"
                                  >
                                    📎 {m.body || "Documento"}
                                  </a>
                                ) : m.message_type === "sticker" ? (
                                  <span className="text-3xl">🏷️</span>
                                ) : (
                                  <FormattedMessage text={m.body} />
                                )}
                              </div>
                              <div
                                className={`text-[10px] text-muted-foreground mt-1 ${mine ? "text-right" : ""}`}
                              >
                                {new Date(m.created_at).toLocaleString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t bg-card">
                    <div className="flex gap-1 px-4 pt-2">
                      <button
                        onClick={() => setMode("reply")}
                        className={`text-xs px-3 py-1.5 rounded-md transition-colors ${mode === "reply" ? "bg-success/15 text-success font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Resposta
                      </button>
                      <button
                        onClick={() => setMode("note")}
                        className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${mode === "note" ? "bg-warning/30 text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        <StickyNote className="h-3 w-3" /> Nota interna
                      </button>
                    </div>
                    <div className={`p-3 ${mode === "note" ? "bg-warning/10" : ""}`}>
                      {attachment && (
                        <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <Paperclip className="h-4 w-4 text-success" />
                            <span className="truncate">{attachment.file.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {(attachment.file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(attachment.previewUrl);
                              setAttachment(null);
                            }}
                            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Remover anexo"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <div className="flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <MessageComposer
                            value={draft}
                            onChange={setDraft}
                            onSubmit={send}
                            placeholder={
                              mode === "note"
                                ? "Escreva uma nota visível só para a equipe..."
                                : "Digite sua mensagem... (use * para negrito, _ para itálico)"
                            }
                            fontFamily={prefs.font}
                            fontSize={prefs.size}
                            noteMode={mode === "note"}
                          />
                        </div>
                        <label className="grid h-11 w-11 cursor-pointer place-items-center rounded-xl border bg-background text-muted-foreground hover:text-success">
                          <Paperclip className="h-4 w-4" />
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                            onChange={(event) => {
                              selectAttachment(event.target.files?.[0] ?? null);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        <button
                          onClick={send}
                          disabled={sendMsg.isPending || (!draft.trim() && !attachment)}
                          className="h-11 px-3 md:px-5 rounded-xl bg-success text-success-foreground hover:opacity-95 flex items-center gap-2 font-semibold text-sm disabled:opacity-60 shrink-0"
                        >
                          <Send className="h-4 w-4" /> <span className="hidden sm:inline">Enviar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Column 3 - info */}
            {active && showInfo && (
              <aside className="hidden lg:flex w-[300px] shrink-0 border-l bg-card overflow-auto flex-col">
                <div className="p-5 text-center border-b">
                  <div className="h-20 w-20 mx-auto rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-lg">
                    {initials(active.contact?.name ?? "?")}
                  </div>
                  <h3 className="mt-3 font-semibold text-foreground">
                    {active.contact?.name ?? "—"}
                  </h3>
                </div>
                <InfoSection title="Canal de origem">
                  <span
                    className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${channelColor(active.channel)}`}
                  >
                    {active.channel}
                  </span>
                </InfoSection>
                <InfoSection title="Status">
                  <span className="text-xs px-2 py-1 rounded-md bg-background border">
                    {active.status}
                  </span>
                </InfoSection>
                <InfoSection title="Etapa do Kanban">
                  <select
                    value={active.stage}
                    onChange={(e) =>
                      updateConv.mutate({ id: active.id, patch: { stage: e.target.value } })
                    }
                    className="w-full h-9 px-2 rounded-md border bg-background text-sm"
                  >
                    {kanbanStages.map((s) => (
                      <option key={s.id} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </InfoSection>
                <InfoSection title="Aberta em">
                  <div className="text-xs text-muted-foreground">
                    {new Date(active.opened_at).toLocaleString("pt-BR")}
                  </div>
                </InfoSection>
              </aside>
            )}
          </div>
        )}
      </div>

      {/* Modal de Transferência */}
      {showTransfer && active && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTransfer(false)}>
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-foreground">Transferir conversa</h3>
              <button onClick={() => setShowTransfer(false)} className="h-8 w-8 rounded-lg hover:bg-muted grid place-items-center">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b">
              {([
                { id: "agente" as const, label: "Agente", icon: Users },
                { id: "equipe" as const, label: "Equipe", icon: Users2 },
                { id: "numero" as const, label: "Número", icon: Phone },
              ]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTransferTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium border-b-2 transition-colors ${
                    transferTab === t.id
                      ? "border-brand text-brand"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="max-h-64 overflow-auto p-2">
              {transferTab === "agente" && (
                agents.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">Nenhum agente encontrado</div>
                ) : (
                  agents.map((a) => (
                    <button
                      key={a.user_id}
                      onClick={() => transferToAgent(a.user_id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                        {a.avatar_initials || initials(a.display_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{a.display_name}</div>
                        <div className="text-xs text-muted-foreground">{a.online ? "🟢 Online" : "⚪ Offline"}</div>
                      </div>
                    </button>
                  ))
                )
              )}

              {transferTab === "equipe" && (
                teams.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">Nenhuma equipe encontrada</div>
                ) : (
                  teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => transferToTeam(t.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-success/10 text-success grid place-items-center">
                        <Users2 className="h-4 w-4" />
                      </div>
                      <div className="text-sm font-medium">{t.name}</div>
                    </button>
                  ))
                )
              )}

              {transferTab === "numero" && (
                instances.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-6">Nenhum número conectado</div>
                ) : (
                  instances
                    .filter((i) => i.instance_name !== active.instance_name)
                    .map((i) => (
                      <button
                        key={i.id}
                        onClick={() => transferToInstance(i.instance_name)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <div className="h-9 w-9 rounded-full bg-warning/10 text-warning grid place-items-center">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{i.profile_name || i.instance_name}</div>
                          <div className="text-xs text-muted-foreground">{i.phone_number || i.instance_name}</div>
                        </div>
                      </button>
                    ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      <ConversationKanbanSettings open={kanbanSettingsOpen} onClose={() => setKanbanSettingsOpen(false)} />
    </AppLayout>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 border-b">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h4>
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

function EmptyAll() {
  return (
    <div className="flex-1 grid place-items-center bg-background p-10">
      <div className="text-center max-w-md">
        <div className="mx-auto h-20 w-20 rounded-full bg-success/10 grid place-items-center mb-4">
          <Inbox className="h-9 w-9 text-success" />
        </div>
        <h3 className="text-lg font-semibold text-brand">Nenhuma conversa ainda</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Conecte um canal (WhatsApp, Web, Instagram) ou crie um contato em <b>Contatos</b> para
          iniciar atendimentos. As conversas aparecerão aqui em tempo real.
        </p>
      </div>
    </div>
  );
}

function KanbanBoard({
  convs,
  stages,
  onMove,
  dragId,
  setDragId,
}: {
  convs: ConvRow[];
  stages: ConversationStage[];
  onMove: (id: string, stage: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
}) {
  // Conversations whose stage doesn't match any column land in the first column
  const stageKeys = new Set(stages.map((s) => s.key));
  const firstKey = stages[0]?.key;
  return (
    <div className="flex-1 min-h-0 overflow-x-auto p-3 md:p-4 bg-background">
      <div className="flex gap-3 md:gap-4 h-full min-w-max">
        {stages.map((stage, idx) => {
          const items = convs.filter((c) => {
            const st = c.stage || firstKey;
            // Unknown stages fall into the first column
            if (!stageKeys.has(st)) return idx === 0;
            return st === stage.key;
          });
          return (
            <div
              key={stage.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) {
                  onMove(dragId, stage.key);
                  setDragId(null);
                }
              }}
              className="w-[260px] md:w-[300px] shrink-0 bg-card rounded-xl border flex flex-col max-h-full"
            >
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
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
                  const name = c.contact?.name ?? "—";
                  return (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => setDragId(c.id)}
                      onDragEnd={() => setDragId(null)}
                      className={`bg-background border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-all ${dragId === c.id ? "opacity-50 rotate-1" : ""} ${c.unread ? "border-l-4 border-l-success" : ""}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="h-8 w-8 rounded-full bg-brand/10 text-brand grid place-items-center text-[10px] font-bold shrink-0">
                          {initials(name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {name}
                            </span>
                            <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                              {formatTime(c.last_message_at)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {c.last_message ?? "—"}
                          </p>
                          <div className="flex items-center gap-1.5 mt-2">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${channelColor(c.channel)}`}
                            >
                              <Icon className="h-2.5 w-2.5" />
                              {c.channel}
                            </span>
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
