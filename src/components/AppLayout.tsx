import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

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
            <div className="flex items-center gap-2">{actions}</div>
          </header>
        )}
        <main className={flush ? "flex-1 min-h-0 overflow-hidden" : "flex-1 overflow-auto p-6"}>
          {children}
        </main>
      </div>
    </div>
  );
}
