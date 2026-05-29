import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type InboxChannel = "WhatsApp" | "Instagram" | "Facebook" | "Telegram" | "Website" | "Email";

export interface Inbox {
  id: string;
  name: string;
  channel: InboxChannel;
  config: Record<string, unknown>;
  channel_config?: Record<string, unknown> | null;
  widget_color: string | null;
  welcome_message: string | null;
  greeting_message?: string | null;
  active: boolean;
  status?: string | null;
  account_id?: string | null;
  instance_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface InboxMember {
  id: string;
  inbox_id: string;
  user_id: string | null;
  team_id: string | null;
}

const sb = supabase as any;

function logReadError(scope: string, _error: unknown) {
  console.warn(`[IAS] Falha ao carregar ${scope}`);
}

export function useInboxes() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["inboxes", accountId],
    queryFn: async (): Promise<Inbox[]> => {
      const { data, error } = await sb
        .from("inboxes")
        .select("*")
        .eq("account_id", accountId)
        .order("created_at");
      if (error) {
        logReadError("caixas de entrada", error);
        return [];
      }
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        name: String(row.name ?? "Caixa de Entrada"),
        channel: String(row.channel ?? "WhatsApp") as InboxChannel,
        config: ((row.config ?? row.channel_config ?? {}) as Record<string, unknown>) ?? {},
        channel_config: ((row.channel_config ?? row.config ?? {}) as Record<string, unknown>) ?? {},
        widget_color: (row.widget_color ?? null) as string | null,
        welcome_message: (row.welcome_message ?? row.greeting_message ?? null) as string | null,
        greeting_message: (row.greeting_message ?? row.welcome_message ?? null) as string | null,
        active: "active" in row ? Boolean(row.active) : String(row.status ?? "active") !== "inactive",
        status: (row.status ?? (row.active === false ? "inactive" : "active")) as string,
        account_id: (row.account_id ?? null) as string | null,
        instance_name: (row.instance_name ?? null) as string | null,
        created_at: String(row.created_at ?? new Date().toISOString()),
        updated_at: (row.updated_at ?? null) as string | null,
      }));
    },
    enabled: !!accountId,
  });
}

export function useInboxMembers() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["inbox_members", accountId],
    queryFn: async (): Promise<InboxMember[]> => {
      const { data, error } = await sb
        .from("inbox_members")
        .select("*, inbox:inboxes!inner(account_id)")
        .eq("inbox.account_id", accountId);
      if (error) {
        logReadError("membros das caixas", error);
        return [];
      }
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        inbox_id: String(row.inbox_id),
        user_id: (row.user_id ?? null) as string | null,
        team_id: (row.team_id ?? null) as string | null,
      }));
    },
    enabled: !!accountId,
  });
}

export function useCreateInbox() {
  const qc = useQueryClient();
  const { accountId, user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      inbox: Omit<Inbox, "id" | "created_at" | "updated_at">;
      members: { user_id?: string; team_id?: string }[];
    }) => {
      if (!accountId) throw new Error("Conta atual não identificada. Recarregue a página e tente novamente.");
      if (!payload.inbox.name?.trim()) throw new Error("Informe o nome da caixa de entrada.");

      const channelConfig = payload.inbox.config ?? payload.inbox.channel_config ?? {};
      const active = payload.inbox.active !== false;
      const inboxPayload = {
        name: payload.inbox.name.trim(),
        channel: payload.inbox.channel,
        config: channelConfig,
        channel_config: channelConfig,
        widget_color: payload.inbox.widget_color ?? null,
        welcome_message: payload.inbox.welcome_message ?? null,
        greeting_message: payload.inbox.welcome_message ?? null,
        active,
        status: active ? "active" : "inactive",
        account_id: accountId,
        instance_name: payload.inbox.instance_name ?? null,
      };

      const { data, error } = await sb.from("inboxes").insert(inboxPayload).select().single();
      if (error) throw error;

      const memberKeys = new Set<string>();
      const members = [
        ...payload.members,
        ...(user?.id ? [{ user_id: user.id }] : []),
      ].filter((member) => {
        const key = member.user_id ? `u:${member.user_id}` : member.team_id ? `t:${member.team_id}` : "";
        if (!key || memberKeys.has(key)) return false;
        memberKeys.add(key);
        return true;
      });

      if (members.length) {
        const rows = members.map((m) => ({ inbox_id: data.id, ...m }));
        const { error: mErr } = await sb.from("inbox_members").insert(rows);
        if (mErr) throw mErr;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inboxes", accountId] });
      qc.invalidateQueries({ queryKey: ["inbox_members", accountId] });
    },
  });
}

export function useUpdateInbox() {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Inbox> }) => {
      const updatePatch: Record<string, unknown> = { ...patch };
      if ("active" in updatePatch) updatePatch.status = updatePatch.active ? "active" : "inactive";
      if ("config" in updatePatch) updatePatch.channel_config = updatePatch.config;
      if ("welcome_message" in updatePatch) updatePatch.greeting_message = updatePatch.welcome_message;
      const { error } = await sb.from("inboxes").update(updatePatch).eq("id", id).eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inboxes", accountId] }),
  });
}

export function useDeleteInbox() {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("inboxes").delete().eq("id", id).eq("account_id", accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inboxes", accountId] });
      qc.invalidateQueries({ queryKey: ["inbox_members", accountId] });
    },
  });
}

export const channelMeta: Record<
  InboxChannel,
  { label: string; description: string; color: string }
> = {
  WhatsApp: { label: "WhatsApp", description: "Atenda via WhatsApp Business", color: "#25D366" },
  Instagram: { label: "Instagram", description: "DMs e comentários", color: "#E1306C" },
  Facebook: { label: "Facebook Messenger", description: "Mensagens da página", color: "#1877F2" },
  Telegram: { label: "Telegram", description: "Bot do Telegram", color: "#26A5E4" },
  Website: { label: "Website", description: "Widget de chat no site", color: "#2FAE7C" },
  Email: { label: "Email", description: "Caixa via IMAP/SMTP", color: "#6B7280" },
};
