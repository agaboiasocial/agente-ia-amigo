import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

export interface PaymentSchedule {
  id: string;
  contact_id: string | null;
  amount: number;
  due_date: string;
  status: "pending" | "paid" | "overdue" | string;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  contact?: { name: string } | null;
}

export function usePaymentSchedules() {
  return useQuery({
    queryKey: ["payment_schedules"],
    queryFn: async (): Promise<PaymentSchedule[]> => {
      const { data, error } = await sb
        .from("payment_schedules")
        .select("*, contact:contacts(name)")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        contact_id: (row.contact_id ?? null) as string | null,
        amount: Number(row.amount ?? 0),
        due_date: String(row.due_date),
        status: String(row.status ?? "pending"),
        paid_at: (row.paid_at ?? null) as string | null,
        notes: (row.notes ?? null) as string | null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        contact: (row.contact ?? null) as { name: string } | null,
      }));
    },
  });
}

export function useFinanceSummary(payments: PaymentSchedule[]) {
  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pending = payments.filter((p) => p.status !== "paid");
    return {
      total: payments.reduce((sum, p) => sum + p.amount, 0),
      received: payments.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0),
      pending: pending.reduce((sum, p) => sum + p.amount, 0),
      overdue: pending.filter((p) => p.due_date < today).reduce((sum, p) => sum + p.amount, 0),
    };
  }, [payments]);
}
