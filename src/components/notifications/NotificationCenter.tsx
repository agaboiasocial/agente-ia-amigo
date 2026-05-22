import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useNotifications } from "@/hooks/use-notifications";
import { Bell, CheckCheck, Inbox, Trash2, X } from "lucide-react";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } =
    useNotifications();
  const navigate = useNavigate();

  const handleClick = (n: (typeof notifications)[0]) => {
    if (!n.read_at) markAsRead(n.id);
    navigate({ to: safeNotificationLink(n.link) });
    setOpen(false);
  };

  const typeIcon: Record<string, string> = {
    sla_breach: "🔴",
    lead_won: "🏆",
    lead_unassigned: "⚠️",
    lead_stalled: "⏳",
    message: "💬",
    info: "ℹ️",
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="relative h-9 w-9 rounded-lg border hover:bg-background grid place-items-center"
        title="Notificações"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold grid place-items-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 max-h-[480px] rounded-xl border bg-card shadow-xl flex flex-col">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <button
                onClick={() => {
                  navigate({ to: "/minha-caixa" });
                  setOpen(false);
                }}
                className="text-sm font-semibold text-brand hover:text-success flex items-center gap-2"
              >
                <Inbox className="h-4 w-4" />
                Minha Caixa
              </button>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="h-7 px-2 rounded text-[11px] hover:bg-background flex items-center gap-1 text-muted-foreground"
                    title="Marcar todas como lidas"
                  >
                    <CheckCheck className="h-3.5 w-3.5" /> Ler todas
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => clearAll()}
                    className="h-7 px-2 rounded text-[11px] hover:bg-background text-muted-foreground"
                    title="Limpar todas"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="h-7 w-7 rounded hover:bg-background grid place-items-center text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-auto">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex items-start gap-3 px-4 py-3 border-b cursor-pointer hover:bg-background transition-colors ${
                      !n.read_at ? "bg-success/5" : ""
                    }`}
                  >
                    <span className="text-base mt-0.5">{typeIcon[n.type] ?? "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium truncate ${!n.read_at ? "text-foreground" : "text-muted-foreground"}`}>
                          {n.title}
                        </span>
                        {!n.read_at && <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />}
                      </div>
                      {n.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>
                      )}
                      <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                        {formatAgo(n.created_at)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(n.id);
                      }}
                      className="mt-1 h-6 w-6 rounded hover:bg-background grid place-items-center text-muted-foreground/50 hover:text-destructive shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function safeNotificationLink(link: string | null | undefined) {
  const path = (link ?? "").split("?")[0]?.split("#")[0] ?? "";
  const knownRoutes = [
    "/minha-caixa",
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

  return knownRoutes.includes(path) ? path : "/minha-caixa";
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}
