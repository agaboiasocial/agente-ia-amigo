import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminGate,
});

function SuperAdminGate() {
  const { session, loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/super-admin/login";

  useEffect(() => {
    if (loading || isLogin) return;
    if (!session || !isAdmin) navigate({ to: "/super-admin/login" });
  }, [loading, session, isAdmin, navigate, isLogin]);

  if (isLogin) return <Outlet />;

  if (loading || !session || !isAdmin) {
    return (
      <div className="h-screen w-full grid place-items-center bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }
  return <Outlet />;
}
