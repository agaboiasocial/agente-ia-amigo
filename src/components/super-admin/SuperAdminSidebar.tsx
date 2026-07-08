import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Grid3x3,
  User,
  Settings,
  Activity,
  HeartPulse,
  ArrowLeftCircle,
  LogOut,
  ChevronDown,
  ChevronRight,
  Building2,
  Webhook,
  LifeBuoy,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const top = [
  { to: "/super-admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/super-admin/accounts", label: "Accounts", icon: Grid3x3 },
  { to: "/super-admin/users", label: "Users", icon: User },
  { to: "/super-admin/active-clients", label: "Clientes Ativos", icon: Building2 },
  { to: "/super-admin/tickets", label: "Chamados", icon: LifeBuoy },
  { to: "/super-admin/webhooks", label: "Webhooks", icon: Webhook },
];

const settingsChildren = [
  { to: "/super-admin/settings", label: "General" },
];

const bottom = [
  { to: "/super-admin/sidekiq", label: "Sidekiq Dashboard", icon: Activity },
  { to: "/super-admin/instance-health", label: "Instance Health", icon: HeartPulse },
  { to: "/conversas", label: "Agent Dashboard", icon: ArrowLeftCircle },
];

export function SuperAdminSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/super-admin/settings"));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close on nav
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname.startsWith(to);

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
      active
        ? "bg-[#0B3A5D] text-white font-medium"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  const sidebarInner = (
    <aside className="flex w-64 shrink-0 flex-col bg-white border-r border-slate-200 h-full">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="text-base font-semibold text-[#0B3A5D]">Agente IA Social</div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-0.5">
          Super Admin Console
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-auto">
        {top.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className={linkCls(isActive(it.to, it.exact))}>
              <Icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}

        <div>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={linkCls(pathname.startsWith("/super-admin/settings")) + " w-full"}
          >
            <Settings className="h-4 w-4" />
            <span className="flex-1 text-left">Settings</span>
            {settingsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {settingsOpen && (
            <div className="ml-7 mt-1 space-y-1">
              {settingsChildren.map((c) => (
                <Link
                  key={c.to}
                  to={c.to}
                  className={`block px-3 py-1.5 text-sm rounded-md ${
                    pathname === c.to
                      ? "text-[#0B3A5D] font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-slate-200 px-3 py-3 space-y-1">
        {bottom.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to} className={linkCls(isActive(it.to))}>
              <Icon className="h-4 w-4" />
              <span>{it.label}</span>
            </Link>
          );
        })}
        <button onClick={handleLogout} className={linkCls(false) + " w-full"}>
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex shrink-0">{sidebarInner}</div>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 h-9 w-9 rounded-lg bg-white border shadow grid place-items-center"
      >
        <Menu className="h-5 w-5" />
      </button>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full w-64">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 -right-10 h-8 w-8 rounded-full bg-white/90 grid place-items-center shadow"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebarInner}
          </div>
        </div>
      )}
    </>
  );
}

export function SuperAdminLayout({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      <SuperAdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 gap-2">
          {/* Spacer for mobile hamburger */}
          <div className="w-9 md:hidden" />
          <h1 className="text-base md:text-lg font-semibold text-[#0B3A5D] truncate">{title}</h1>
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
