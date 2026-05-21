import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/use-auth";
import { Bell, Loader2 } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";

export function AppLayout({
  children,
  title,
  actions,
  flush = false,
}: {
  children: ReactNode;
  title?: string;
  actions?: ReactNode;
  flush?: boolean;
}) {
  const { session, loading } = useAuth();
  const { unreadCount, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="h-screen w-full grid place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {title && (
          <header className="h-14 shrink-0 bg-card border-b flex items-center justify-between px-6">
            <h1 className="text-lg font-semibold text-brand">{title}</h1>
            <div className="flex items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={() => markAllAsRead()}
                className="relative h-9 w-9 rounded-lg border bg-background grid place-items-center text-muted-foreground hover:text-foreground"
                title="Notificações"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-warning px-1 text-[10px] font-semibold text-warning-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </header>
        )}
        <main className={flush ? "flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-auto p-6"}>
          {children}
        </main>
      </div>
    </div>
  );
}
