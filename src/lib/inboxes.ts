import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InboxChannel = "WhatsApp" | "Instagram" | "Facebook" | "Telegram" | "Website" | "Email";

export interface Inbox {
  id: string;
  name: string;
  channel: InboxChannel;
  config: Record<string, unknown>;
  widget_color: string | null;
  welcome_message: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InboxMember {
  id: string;
  inbox_id: string;
  user_id: string | null;
  team_id: string | null;
}

const sb = supabase as any;

export function useInboxes() {
  return useQuery({
    queryKey: ["inboxes"],
    queryFn: async (): Promise<Inbox[]> => {
      const { data, error } = await sb.from("inboxes").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInboxMembers() {
  return useQuery({
    queryKey: ["inbox_members"],
    queryFn: async (): Promise<InboxMember[]> => {
      const { data, error } = await sb.from("inbox_members").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      inbox: Omit<Inbox, "id" | "created_at" | "updated_at">;
      members: { user_id?: string; team_id?: string }[];
    }) => {
      const { data, error } = await sb.from("inboxes").insert(payload.inbox).select().single();
      if (error) throw error;
      if (payload.members.length) {
        const rows = payload.members.map((m) => ({ inbox_id: data.id, ...m }));
        const { error: mErr } = await sb.from("inbox_members").insert(rows);
        if (mErr) throw mErr;
      }
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inboxes"] });
      qc.invalidateQueries({ queryKey: ["inbox_members"] });
    },
  });
}

export function useUpdateInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Inbox> }) => {
      const { error } = await sb.from("inboxes").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inboxes"] }),
  });
}

export function useDeleteInbox() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("inboxes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inboxes"] });
      qc.invalidateQueries({ queryKey: ["inbox_members"] });
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
