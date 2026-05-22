import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useConversations } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import type { Notification } from "@/types/team";
import {
  Bell,
  CheckCheck,
  Inbox,
  MessageSquare,
  Search,
  Settings,
  Trash2,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/minha-caixa")({ component: MinhaCaixaPage });

type InboxFilter = "all" | "unread" | "message" | "assignment" | "system";

type InboxItem = {
  id: string;
  notificationId?: string;
  category: InboxFilter;
  title: string;
  description: string;
  link: string;
  source: string;
  priority: string;
  createdAt: string;
  readAt: string | null;
  conversationId?: string | null;
  synthetic?: boolean;
};

const tabs: { value: InboxFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "unread", label: "Não lidas" },
  { value: "message", label: "Mensagens" },
  { value: "assignment", label: "Atribuídas" },
  { value: "system", label: "Sistema" },
];

const iconByCategory: Record<string, typeof Bell> = {
  message: MessageSquare,
  assignment: UserCheck,
  system: Settings,
  all: Inbox,
  unread: Bell,
};

function notificationCategory(notification: Notification): InboxFilter {
  const category = notification.category ?? notification.type;
  if (category === "message" || category === "assignment") return category;
  return "system";
}

function notificationToInboxItem(notification: Notification): InboxItem {
  const category = notificationCategory(notification);
  return {
    id: notification.id,
    notificationId: notification.id,
    category,
    title: notification.title,
    description: notification.description ?? "Notificação do sistema IAS",
    link: notification.link ?? "/conversas",
    source: notification.source ?? (category === "system" ? "sistema" : "chat"),
    priority: notification.priority ?? "normal",
    createdAt: notification.created_at,
    readAt: notification.read_at,
    conversationId: notification.conversation_id,
  };
}

function MinhaCaixaPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: convs = [] } = useConversations();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();
  const [tab, setTab] = useState<InboxFilter>("all");
  const [query, setQuery] = useState("");

  const assignedFallback = useMemo<InboxItem[]>(() => {
    const notifiedConversations = new Set(
      notifications
        .filter((n) => notificationCategory(n) === "assignment" && n.conversation_id)
        .map((n) => n.conversation_id),
    );

    return convs
      .filter((c) => c.assigned_to === user?.id && c.status !== "resolvida")
      .filter((c) => !notifiedConversations.has(c.id))
      .map((c) => ({
        id: `assigned-${c.id}`,
        category: "assignment",
        title: `Conversa atribuída: ${c.contact?.name ?? "Contato"}`,
        description: c.last_message ?? "Você tem uma conversa ativa nesta caixa.",
        link: "/conversas",
        source: c.channel,
        priority: "normal",
        createdAt: c.last_message_at ?? c.opened_at ?? new Date().toISOString(),
        readAt: new Date().toISOString(),
        conversationId: c.id,
        synthetic: true,
      }));
  }, [convs, notifications, user?.id]);

  const items = useMemo(() => {
    return [...notifications.map(notificationToInboxItem), ...assignedFallback].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [assignedFallback, notifications]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      if (tab === "unread" && item.readAt) return false;
      if (tab !== "all" && tab !== "unread" && item.category !== tab) return false;
      if (!normalizedQuery) return true;
      return `${item.title} ${item.description} ${item.source}`.toLowerCase().includes(normalizedQuery);
    });
  }, [items, query, tab]);

  const totalByCategory = (category: InboxFilter) => {
    if (category === "all") return items.length;
    if (category === "unread") return unreadCount;
    return items.filter((item) => item.category === category).length;
  };

  const openItem = (item: InboxItem) => {
    if (item.notificationId && !item.readAt) markAsRead(item.notificationId);
    navigate({ to: safeInboxLink(item.link) });
  };

  return (
    <AppLayout flush>
      <div className="h-full flex flex-col">
        <div className="h-16 shrink-0 bg-card border-b px-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Inbox className="h-5 w-5 text-brand shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-brand">Minha Caixa</h1>
              <p className="text-xs text-muted-foreground truncate">
                Central de mensagens, atribuições e avisos do IAS
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">
                {unreadCount} não lidas
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="h-9 px-3 rounded-lg border text-xs font-medium hover:bg-background flex items-center gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                Ler todas
              </button>
            )}
            <div className="relative w-72 max-w-[38vw]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar na caixa..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success"
              />
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-card border-b flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                tab === t.value
                  ? "bg-success text-success-foreground font-semibold"
                  : "text-muted-foreground hover:bg-background"
              }`}
            >
              {t.label}
              <span className="ml-1 opacity-75">{totalByCategory(t.value)}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5 bg-background">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-20 text-sm">
              Nenhuma notificação nesta categoria
            </div>
          ) : (
            <div className="space-y-2 max-w-5xl">
              {filtered.map((item) => {
                const Icon = iconByCategory[item.category] ?? Bell;
                const unread = !item.readAt;
                return (
                  <div
                    key={item.id}
                    onClick={() => openItem(item)}
                    className={`block w-full cursor-pointer bg-card border rounded-lg p-4 hover:shadow-md transition-shadow ${
                      unread ? "border-l-4 border-l-success bg-success/5" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-lg grid place-items-center shrink-0 ${
                        unread ? "bg-success text-success-foreground" : "bg-brand/10 text-brand"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-foreground truncate">
                            {item.title}
                          </span>
                          {unread && <span className="h-2 w-2 rounded-full bg-success shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded-full bg-muted">
                            {labelForCategory(item.category)}
                          </span>
                          <span className="px-1.5 py-0.5 rounded-full bg-muted">
                            {item.source}
                          </span>
                          {item.priority !== "normal" && (
                            <span className="px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
                              {item.priority}
                            </span>
                          )}
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                      </div>
                      {item.notificationId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(item.notificationId!);
                          }}
                          className="h-8 w-8 rounded-lg hover:bg-background grid place-items-center text-muted-foreground hover:text-destructive shrink-0"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function safeInboxLink(link: string) {
  const path = link.split("?")[0]?.split("#")[0] ?? "";
  const knownRoutes = [
    "/conversas",
    "/dashboard",
    "/contatos",
    "/pipeline",
    "/whatsapp",
    "/ias",
    "/equipes",
    "/configuracoes",
    "/financeiro",
    "/empresa",
  ];

  return knownRoutes.includes(path) ? path : "/conversas";
}

function labelForCategory(category: InboxFilter) {
  if (category === "message") return "Mensagem";
  if (category === "assignment") return "Atribuição";
  if (category === "system") return "Sistema";
  return "Notificação";
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
