import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  MessageSquare,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Bot,
  QrCode,
  Users2,
  LifeBuoy,
  ShieldHalf,
  Inbox,
  ChevronDown,
  ChevronRight,
  User as UserIcon,
  UserX,
  Globe,
  Instagram,
  Mail,
  Send as SendIcon,
  Facebook,
  KanbanSquare,
  Wallet,
  Building2,
} from "lucide-react";
import logoIas from "@/assets/logo-ias.png";
import { useAuth } from "@/hooks/use-auth";
import { useSupport } from "@/components/support/SupportCenter";
import { useInboxes, type InboxChannel } from "@/lib/inboxes";
import { useConversations } from "@/lib/data";
import { useNotifications } from "@/hooks/use-notifications";

const items = [
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { to: "/conversas", label: "Conversas", icon: MessageSquare },
  { to: "/ias", label: "IAS — Agente", icon: Bot },
  { to: "/whatsapp", label: "Conectar WhatsApp", icon: QrCode },
  { to: "/canais", label: "Canais Conectados", icon: Inbox },
  { to: "/contatos", label: "Contatos/Leads", icon: Users },
  { to: "/equipes", label: "Equipes", icon: Users2 },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/empresa", label: "Empresa", icon: Building2 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

const channelIconMap: Record<InboxChannel, typeof Globe> = {
  WhatsApp: MessageSquare,
  Instagram: Instagram,
  Facebook: Facebook,
  Telegram: SendIcon,
  Website: Globe,
  Email: Mail,
};

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { profile, isAdmin, signOut, user } = useAuth();
  const navigate = useNavigate();
  const support = useSupport();
  const [inboxOpen, setInboxOpen] = useState(true);
  const { data: inboxes = [] } = useInboxes();
  const { data: convs = [] } = useConversations();
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const initials = profile?.avatar_initials ?? (user?.email?.slice(0, 2).toUpperCase() ?? "??");
  const name = profile?.display_name ?? user?.email ?? "Usuário";

  const myCount = convs.filter((c) => c.assigned_to === user?.id && c.status !== "resolvida").length;
  const unassignedCount = convs.filter((c) => !c.assigned_to && c.status !== "resolvida").length;
  const allCount = convs.filter((c) => c.status !== "resolvida").length;
  const inboxCount = (id: string) =>
    convs.filter((c) => (c as { inbox_id?: string }).inbox_id === id && c.status !== "resolvida").length;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
        <img src={logoIas} alt="IAS" className="h-10 w-10 rounded-lg bg-white object-contain p-0.5" />
        <div className="leading-tight">
          <div className="text-sm font-semibold">Agente IA Social</div>
          <div className="text-[11px] text-sidebar-foreground/60">Atendimento</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
        {/* Caixas de Entrada section */}
        <div className="mb-1">
          <button
            onClick={() => setInboxOpen((s) => !s)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent transition-colors"
          >
            <Inbox className="h-4 w-4" />
            <span className="flex-1 text-left">Caixas de Entrada</span>
            {inboxOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          {inboxOpen && (
            <div className="ml-2 mt-1 space-y-0.5 border-l border-sidebar-border pl-2">
              <SubLink
                to="/minha-caixa"
                active={pathname.startsWith("/minha-caixa")}
                icon={UserIcon}
                label="Minha Caixa"
                count={unreadCount || myCount}
              />
              <SubLink
                to="/caixas/nao-atribuidas"
                active={pathname === "/caixas/nao-atribuidas"}
                icon={UserX}
                label="Não atribuídas"
                count={unassignedCount}
              />
              <SubLink
                to="/conversas"
                active={pathname === "/conversas"}
                icon={MessageSquare}
                label="Todas"
                count={allCount}
              />
              {inboxes.length > 0 && (
                <div className="pt-2 mt-1 border-t border-sidebar-border/50">
                  <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
                    Caixas
                  </div>
                  {inboxes.map((ib) => {
                    const Icon = channelIconMap[ib.channel] ?? Inbox;
                    return (
                      <SubLink
                        key={ib.id}
                        to={`/caixas/${ib.id}`}
                        active={pathname === `/caixas/${ib.id}`}
                        icon={Icon}
                        label={ib.name}
                        count={inboxCount(ib.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

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

      {(
        <div className="px-3 pt-2">
          <Link
            to="/super-admin"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent transition-colors"
          >
            <ShieldHalf className="h-4 w-4" />
            <span className="flex-1 text-left">Super Admin</span>
          </Link>
        </div>
      )}

      <div className="px-3 pt-2 pb-1">
        <button
          onClick={support.open}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground/85 hover:bg-sidebar-accent transition-colors"
        >
          <LifeBuoy className="h-4 w-4" />
          <span className="flex-1 text-left">Suporte</span>
        </button>
      </div>

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

function SubLink({
  to,
  active,
  icon: Icon,
  label,
  count,
}: {
  to: string;
  active: boolean;
  icon: typeof Inbox;
  label: string;
  count: number;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
        active
          ? "bg-success/20 text-success font-semibold"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {count > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning font-semibold">
          {count}
        </span>
      )}
    </Link>
  );
}
