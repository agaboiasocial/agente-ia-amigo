import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const sb = supabase as any;

export interface ConversationStage {
  id: string;
  key: string;
  label: string;
  color: string;
  position: number;
  is_resolved: boolean;
}

// Defaults used when the account has no custom stages yet.
// Keys MUST match existing conversations.custom_attributes.stage values.
export const DEFAULT_STAGES: Omit<ConversationStage, "id">[] = [
  { key: "novo", label: "Novo", color: "#F2C94C", position: 0, is_resolved: false },
  { key: "atendimento", label: "Em atendimento", color: "#2FAE7C", position: 1, is_resolved: false },
  { key: "aguardando", label: "Aguardando cliente", color: "#0B3A5D", position: 2, is_resolved: false },
  { key: "resolvido", label: "Resolvido", color: "#94A3B8", position: 3, is_resolved: true },
];

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/(^_|_$)/g, "") || `col_${Date.now()}`;
}

export function useConversationStages() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["conversation_stages", accountId],
    queryFn: async (): Promise<ConversationStage[]> => {
      if (!accountId) return DEFAULT_STAGES.map((s, i) => ({ ...s, id: `default-${i}` }));
      const { data, error } = await sb
        .from("conversation_stages")
        .select("*")
        .eq("account_id", accountId)
        .order("position");
      if (error || !data || data.length === 0) {
        return DEFAULT_STAGES.map((s, i) => ({ ...s, id: `default-${i}` }));
      }
      return data as ConversationStage[];
    },
    staleTime: 30_000,
  });
}

// Ensures defaults are persisted (so we can edit real rows). Returns the rows.
export function useStageMutations() {
  const qc = useQueryClient();
  const { accountId } = useAuth();

  const invalidate = () => qc.invalidateQueries({ queryKey: ["conversation_stages", accountId] });

  const ensureSeeded = async (): Promise<ConversationStage[]> => {
    if (!accountId) throw new Error("Conta não identificada");
    const { data } = await sb.from("conversation_stages").select("*").eq("account_id", accountId).order("position");
    if (data && data.length > 0) return data as ConversationStage[];
    const rows = DEFAULT_STAGES.map((s) => ({ ...s, account_id: accountId }));
    const { data: inserted, error } = await sb.from("conversation_stages").insert(rows).select("*");
    if (error) throw error;
    return (inserted ?? []) as ConversationStage[];
  };

  const addStage = useMutation({
    mutationFn: async ({ label, color }: { label: string; color: string }) => {
      const seeded = await ensureSeeded();
      const position = seeded.length;
      const { error } = await sb.from("conversation_stages").insert({
        account_id: accountId, key: slugify(label), label, color, position, is_resolved: false,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ConversationStage> }) => {
      await ensureSeeded();
      const { error } = await sb.from("conversation_stages").update(patch).eq("id", id).eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      await ensureSeeded();
      const { error } = await sb.from("conversation_stages").delete().eq("id", id).eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (ordered: ConversationStage[]) => {
      await ensureSeeded();
      for (let i = 0; i < ordered.length; i++) {
        await sb.from("conversation_stages").update({ position: i }).eq("id", ordered[i].id).eq("account_id", accountId);
      }
    },
    onSuccess: invalidate,
  });

  return { addStage, updateStage, deleteStage, reorder, ensureSeeded };
}
