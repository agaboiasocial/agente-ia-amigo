import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import {
  Building2, Users, MessageSquare, DollarSign, TrendingUp, Loader2, Activity,
} from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/super-admin/")({ component: Page });

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface AdminStats {
  totalAccounts: number;
  totalUsers: number;
  totalContacts: number;
  totalConversations: number;
  totalMRR: number;
  accountDetails: { id: string; name: string; contacts: number; conversations: number; users: number; plan_value: number; created_at: string }[];
  monthlyAccounts: { month: string; count: number }[];
}

function useAdminDashboard() {
  return useQuery({
    queryKey: ["super_admin_dashboard"],
    queryFn: async (): Promise<AdminStats> => {
      const safe = async (p: Promise<any>) => { try { const r = await p; return r; } catch { return { data: [] }; } };
      const [acctRes, profilesRes, contactsRes, convsRes] = await Promise.all([
        safe(sb.from("accounts").select("*").order("name")),
        safe(sb.from("profiles").select("user_id, account_id")),
        safe(sb.from("contacts").select("id, account_id")),
        safe(sb.from("conversations").select("id, account_id")),
      ]);

      const accounts: any[] = acctRes.data ?? [];
      const profiles: any[] = profilesRes.data ?? [];
      const contacts: any[] = contactsRes.data ?? [];
      const conversations: any[] = convsRes.data ?? [];

      // Count per account
      const contactCounts: Record<string, number> = {};
      contacts.forEach((c: any) => { contactCounts[c.account_id] = (contactCounts[c.account_id] || 0) + 1; });
      const convCounts: Record<string, number> = {};
      conversations.forEach((c: any) => { convCounts[c.account_id] = (convCounts[c.account_id] || 0) + 1; });
      const userCounts: Record<string, number> = {};
      profiles.forEach((p: any) => { userCounts[p.account_id] = (userCounts[p.account_id] || 0) + 1; });

      const accountDetails = accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        contacts: contactCounts[a.id] ?? 0,
        conversations: convCounts[a.id] ?? 0,
        users: userCounts[a.id] ?? 0,
        plan_value: Number(a.plan_value ?? 0),
        created_at: a.created_at,
      }));

      // Monthly account creation (last 12 months)
      const now = new Date();
      const monthlyAccounts: { month: string; count: number }[] = [];
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const count = accounts.filter((a: any) => a.created_at?.startsWith(key)).length;
        monthlyAccounts.push({ month: `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, count });
      }

      return {
        totalAccounts: accounts.length,
        totalUsers: profiles.length,
        totalContacts: contacts.length,
        totalConversations: conversations.length,
        totalMRR: accounts.reduce((s: number, a: any) => s + Number(a.plan_value ?? 0), 0),
        accountDetails,
        monthlyAccounts,
      };
    },
  });
}

function Page() {
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <SuperAdminLayout title="Dashboard">
        <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      </SuperAdminLayout>
    );
  }

  const stats = data!;
  const maxConv = Math.max(...stats.accountDetails.map((a) => a.conversations), 1);
  const maxMonth = Math.max(...stats.monthlyAccounts.map((m) => m.count), 1);

  return (
    <SuperAdminLayout title="Dashboard">
      <div className="space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Organizações", value: String(stats.totalAccounts), icon: Building2 },
            { label: "Usuários", value: String(stats.totalUsers), icon: Users },
            { label: "Leads/Contatos", value: String(stats.totalContacts), icon: TrendingUp },
            { label: "Conversas", value: String(stats.totalConversations), icon: MessageSquare },
            { label: "MRR Total", value: money.format(stats.totalMRR), icon: DollarSign },
          ].map((k) => (
            <div key={k.label} className="bg-white rounded-lg border p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-500">{k.label}</span>
                <k.icon className="h-4 w-4 text-slate-400" />
              </div>
              <div className="text-2xl font-bold text-[#0B3A5D]">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Conversations per account */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold text-[#0B3A5D] mb-4">Conversas por conta</h3>
            <div className="space-y-3">
              {stats.accountDetails
                .sort((a, b) => b.conversations - a.conversations)
                .slice(0, 10)
                .map((a) => {
                  const pct = (a.conversations / maxConv) * 100;
                  return (
                    <div key={a.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-700">{a.name}</span>
                        <span className="text-slate-500">{a.conversations}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded">
                        <div className="h-2 rounded bg-[#2FAE7C] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Monthly accounts chart */}
          <div className="bg-white rounded-lg border p-5">
            <h3 className="font-semibold text-[#0B3A5D] mb-4">Novas contas por mês</h3>
            <div className="flex items-end gap-2 h-40">
              {stats.monthlyAccounts.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[#0B3A5D] rounded-t transition-all"
                    style={{ height: `${Math.max((m.count / maxMonth) * 100, 4)}%` }}
                  />
                  <span className="text-[10px] text-slate-400">{m.month.split("/")[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Most active accounts table */}
          <div className="bg-white rounded-lg border p-5 lg:col-span-2">
            <h3 className="font-semibold text-[#0B3A5D] mb-4">Contas mais ativas</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-2">Conta</th>
                    <th className="text-left px-4 py-2">Leads</th>
                    <th className="text-left px-4 py-2">Conversas</th>
                    <th className="text-left px-4 py-2">Membros</th>
                    <th className="text-left px-4 py-2">MRR</th>
                    <th className="text-left px-4 py-2">Criada em</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.accountDetails
                    .sort((a, b) => b.contacts + b.conversations - (a.contacts + a.conversations))
                    .map((a) => (
                      <tr key={a.id} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-900">{a.name}</td>
                        <td className="px-4 py-2">{a.contacts}</td>
                        <td className="px-4 py-2">{a.conversations}</td>
                        <td className="px-4 py-2">{a.users}</td>
                        <td className="px-4 py-2 font-semibold">{money.format(a.plan_value)}</td>
                        <td className="px-4 py-2 text-slate-500">{new Date(a.created_at).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
