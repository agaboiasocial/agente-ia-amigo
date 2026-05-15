import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------- Conversations ----------
export interface ConvRow {
  id: string;
  contact_id: string;
  channel: string;
  status: string;
  stage: string;
  assigned_to: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread: boolean;
  sla_minutes: number | null;
  opened_at: string;
  resolved_at: string | null;
  contact?: { id: string; name: string };
  agent?: { display_name: string; avatar_initials: string | null } | null;
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async (): Promise<ConvRow[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, contact:contacts(id, name)")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as ConvRow[];
    },
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("conversations").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { contact_id: string; channel: string; assigned_to?: string | null }) => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ ...payload, stage: "novo", status: "aberta" } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

// ---------- Messages ----------
export interface MsgRow {
  id: string;
  conversation_id: string;
  author: "cliente" | "agente";
  sender_id: string | null;
  body: string;
  is_note: boolean;
  created_at: string;
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<MsgRow[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MsgRow[];
    },
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { conversation_id: string; body: string; is_note: boolean; author: "cliente" | "agente"; sender_id?: string | null }) => {
      const { error } = await supabase.from("messages").insert(payload);
      if (error) throw error;
      await supabase
        .from("conversations")
        .update({ last_message: payload.body, last_message_at: new Date().toISOString() })
        .eq("id", payload.conversation_id);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["messages", vars.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

// ---------- Contacts ----------
export interface ContactRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  channel: string;
  labels: string[];
  created_at: string;
}

export function useContacts() {
  return useQuery({
    queryKey: ["contacts"],
    queryFn: async (): Promise<ContactRow[]> => {
      const { data, error } = await supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContactRow[];
    },
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Omit<ContactRow, "id" | "created_at">) => {
      const { data, error } = await supabase.from("contacts").insert(c).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

// ---------- Audit logs ----------
export interface AuditRow {
  id: string;
  agent_id: string | null;
  action: string;
  conversation_id: string | null;
  contact_id: string | null;
  details: string | null;
  created_at: string;
}

export function useAuditLogs() {
  return useQuery({
    queryKey: ["audit_logs"],
    queryFn: async (): Promise<AuditRow[]> => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });
}

// ---------- Quick replies ----------
export interface QuickReply { id: string; shortcut: string; message: string }

export function useQuickReplies() {
  return useQuery({
    queryKey: ["quick_replies"],
    queryFn: async (): Promise<QuickReply[]> => {
      const { data, error } = await supabase.from("quick_replies").select("*").order("shortcut");
      if (error) throw error;
      return (data ?? []) as QuickReply[];
    },
  });
}

// ---------- Labels ----------
export interface LabelRow { id: string; name: string; color: string }

export function useLabels() {
  return useQuery({
    queryKey: ["labels"],
    queryFn: async (): Promise<LabelRow[]> => {
      const { data, error } = await supabase.from("labels").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as LabelRow[];
    },
  });
}

// ---------- Agents (profiles) ----------
export interface AgentRow { user_id: string; display_name: string; avatar_initials: string | null; online: boolean }

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async (): Promise<AgentRow[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_initials, online")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as AgentRow[];
    },
  });
}
