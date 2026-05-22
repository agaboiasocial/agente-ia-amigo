import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminGate,
});

function SuperAdminGate() {
  const { session, loading, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLogin = pathname === "/super-admin/login";

  // Always show login page without gate
  if (isLogin) return <Outlet />;

  // Loading state
  if (loading) {
    return (
      <div className="h-screen w-full grid place-items-center bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Not logged in — redirect to login
  if (!session) {
    window.location.href = "/super-admin/login";
    return null;
  }

  // Logged in but not admin — show access denied (no loop)
  if (!isAdmin) {
    return (
      <div className="h-screen w-full grid place-items-center bg-slate-50">
        <div className="text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h2 className="text-xl font-bold text-slate-800">Acesso restrito</h2>
          <p className="text-slate-500 text-sm max-w-sm">
            Sua conta não tem permissão de administrador.
          </p>
          <button
            onClick={() => window.location.href = "/conversas"}
            className="mt-4 px-4 py-2 bg-[#0B3A5D] text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            Voltar ao painel
          </button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
