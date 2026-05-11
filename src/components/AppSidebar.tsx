import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  Users,
  BarChart3,
  ShieldCheck,
  Timer,
  Settings,
  LogOut,
  Bot,
  Sparkles,
  QrCode,
  Zap,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useSupport } from "@/components/support/SupportCenter";

const items = [
  { to: "/conversas", label: "Conversas", icon: MessageSquare },
  { to: "/automacoes", label: "Automação", icon: Zap },
  { to: "/ias", label: "IAS — Agente", icon: Bot },
  { to: "/funcoes", label: "Funções personalizadas", icon: Sparkles },
  { to: "/whatsapp", label: "Conectar WhatsApp", icon: QrCode },
  { to: "/contatos", label: "Contatos", icon: Users },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/auditoria", label: "Auditoria", icon: ShieldCheck },
  { to: "/sla", label: "SLA", icon: Timer },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile, isAdmin, signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const initials = profile?.avatar_initials ?? (user?.email?.slice(0, 2).toUpperCase() ?? "??");
  const name = profile?.display_name ?? user?.email ?? "Usuário";

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
        <div className="h-9 w-9 rounded-lg bg-success text-success-foreground grid place-items-center font-bold">
          IAS
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Agente IA Social</div>
          <div className="text-[11px] text-sidebar-foreground/60">Atendimento</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
        {items.map((it) => {
          const active = pathname.startsWith(it.to);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                active
                  ? "bg-success text-success-foreground font-medium"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{it.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 flex items-center gap-3">
        <div className="relative">
          <div className="h-9 w-9 rounded-full bg-success text-success-foreground grid place-items-center text-xs font-bold">
            {initials}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-sidebar" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{name}</div>
          <div className="text-[11px] text-sidebar-foreground/60">{isAdmin ? "Administrador" : "Agente"}</div>
        </div>
        <button onClick={handleLogout} title="Sair" className="text-sidebar-foreground/70 hover:text-warning">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
