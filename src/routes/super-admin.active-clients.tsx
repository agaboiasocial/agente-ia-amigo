import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { toast } from "sonner";
import {
  Building2, DollarSign, Users, TrendingUp, Pencil, Loader2, Plus, Trash2,
} from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/super-admin/active-clients")({ component: Page });

const PLAN_OPTIONS = [
  { value: "crm", label: "CRM", price: 297 },
  { value: "ia", label: "IA de Atendimento", price: 297 },
  { value: "ia_crm", label: "IA + CRM", price: 497 },
];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

interface AccountWithStats {
  id: string;
  name: string;
  locale: string;
  plan_type: string;
  plan_value: number;
  created_at: string;
  leads_count: number;
  users_count: number;
}

function useActiveClients() {
  return useQuery({
    queryKey: ["admin_active_clients"],
    queryFn: async (): Promise<{ accounts: AccountWithStats[]; totalMRR: number; totalLeads: number; totalUsers: number }> => {
      const safe = async (p: Promise<any>) => { try { const r = await p; return r; } catch { return { data: [] }; } };
      const [acctRes, contactsRes, profilesRes] = await Promise.all([
        safe(sb.from("accounts").select("*").order("name")),
        safe(sb.from("contacts").select("id, account_id")),
        safe(sb.from("profiles").select("id, account_id")),
      ]);
      const accounts: any[] = acctRes.data ?? [];
      const contacts: any[] = contactsRes.data ?? [];
      const profiles: any[] = profilesRes.data ?? [];

      const leadCounts: Record<string, number> = {};
      contacts.forEach((c: any) => { leadCounts[c.account_id] = (leadCounts[c.account_id] || 0) + 1; });
      const userCounts: Record<string, number> = {};
      profiles.forEach((p: any) => { userCounts[p.account_id] = (userCounts[p.account_id] || 0) + 1; });

      const enriched: AccountWithStats[] = accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        locale: a.locale ?? "pt",
        plan_type: a.plan_type ?? "crm",
        plan_value: Number(a.plan_value ?? 297),
        created_at: a.created_at,
        leads_count: leadCounts[a.id] ?? 0,
        users_count: userCounts[a.id] ?? 0,
      }));

      return {
        accounts: enriched,
        totalMRR: enriched.reduce((s, a) => s + a.plan_value, 0),
        totalLeads: enriched.reduce((s, a) => s + a.leads_count, 0),
        totalUsers: enriched.reduce((s, a) => s + a.users_count, 0),
      };
    },
  });
}

function Page() {
  const qc = useQueryClient();
  const { data, isLoading } = useActiveClients();
  const [editing, setEditing] = useState<AccountWithStats | null>(null);
  const [planType, setPlanType] = useState("crm");
  const [planValue, setPlanValue] = useState(297);

  const updatePlan = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const { error } = await sb.from("accounts").update({ plan_type: planType, plan_value: planValue }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_active_clients"] });
      toast.success("Plano atualizado");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (a: AccountWithStats) => {
    setEditing(a);
    setPlanType(a.plan_type);
    setPlanValue(a.plan_value);
  };

  const planLabel = (t: string) => PLAN_OPTIONS.find((p) => p.value === t)?.label ?? t;
  const planBadge = (t: string) => t === "ia_crm" ? "bg-success/15 text-success" : t === "ia" ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground";

  const accounts = data?.accounts ?? [];

  return (
    <SuperAdminLayout title="Clientes Ativos">
      {isLoading ? (
        <div className="grid h-64 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Organizações", value: String(accounts.length), icon: Building2 },
              { label: "Usuários Ativos", value: String(data?.totalUsers ?? 0), icon: Users },
              { label: "Total de Leads", value: String(data?.totalLeads ?? 0), icon: TrendingUp },
              { label: "MRR Total", value: money.format(data?.totalMRR ?? 0), icon: DollarSign },
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

          {/* Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Organização</th>
                  <th className="text-left px-4 py-3">Plano</th>
                  <th className="text-left px-4 py-3">Valor Mensal</th>
                  <th className="text-left px-4 py-3">Leads</th>
                  <th className="text-left px-4 py-3">Membros</th>
                  <th className="text-left px-4 py-3">Cliente desde</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${planBadge(a.plan_type)}`}>
                        {planLabel(a.plan_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{money.format(a.plan_value)}</td>
                    <td className="px-4 py-3">{a.leads_count}</td>
                    <td className="px-4 py-3">{a.users_count}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(a.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(a)} className="text-[#0B3A5D] hover:underline text-xs">
                        <Pencil className="h-3.5 w-3.5 inline mr-1" />Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Edit modal */}
          {editing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-md rounded-xl bg-white border shadow-2xl p-6 space-y-4">
                <h2 className="text-base font-semibold text-[#0B3A5D]">Editar Plano — {editing.name}</h2>
                <div>
                  <label className="text-xs font-medium block mb-1">Plano</label>
                  <select
                    value={planType}
                    onChange={(e) => {
                      setPlanType(e.target.value);
                      const plan = PLAN_OPTIONS.find((p) => p.value === e.target.value);
                      if (plan) setPlanValue(plan.price);
                    }}
                    className="w-full h-10 px-3 rounded-lg border bg-white text-sm"
                  >
                    {PLAN_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label} — {money.format(p.price)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Valor Mensal (R$)</label>
                  <input
                    type="number"
                    value={planValue}
                    onChange={(e) => setPlanValue(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border bg-white text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditing(null)} className="h-9 px-4 rounded-lg border text-sm hover:bg-slate-50">Cancelar</button>
                  <button
                    onClick={() => updatePlan.mutate()}
                    disabled={updatePlan.isPending}
                    className="h-9 px-4 rounded-lg bg-[#2FAE7C] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
                  >
                    {updatePlan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </SuperAdminLayout>
  );
}
