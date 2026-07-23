import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppSidebar, MobileMenuButton, MobileSidebarProvider } from "./AppSidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { useRealtimeChat } from "@/hooks/use-realtime-chat";

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
  const navigate = useNavigate();
  useRealtimeChat(); // realtime das conversas + toast de nova mensagem

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="h-[100dvh] w-full grid place-items-center bg-background text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <MobileSidebarProvider>
      <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {title && (
            <header className="min-h-14 shrink-0 bg-card border-b flex items-center justify-between px-4 md:px-6 gap-2 [padding-top:env(safe-area-inset-top)]">
              <div className="flex items-center gap-2 min-w-0">
                <MobileMenuButton />
                <h1 className="text-base md:text-lg font-semibold text-brand truncate">{title}</h1>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {actions}
                <NotificationCenter />
              </div>
            </header>
          )}
          {/* If no title bar, show a mobile-only header for the hamburger */}
          {!title && (
            <header className="min-h-12 shrink-0 bg-card border-b flex items-center px-4 md:hidden [padding-top:env(safe-area-inset-top)]">
              <MobileMenuButton />
              <span className="ml-2 text-sm font-semibold text-brand">Agente IA Social</span>
            </header>
          )}
          <main className={flush ? "flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-auto p-4 md:p-6"}>
            {children}
          </main>
        </div>
      </div>
    </MobileSidebarProvider>
  );
}
