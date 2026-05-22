import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
  inbox_id?: string | null;
  instance_name?: string | null;
}

interface RawConversationRow {
  id: string;
  contact_id: string | null;
  channel: string | null;
  status: string | null;
  assigned_agent_id: string | null;
  assigned_team_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
  inbox_id: string | null;
  instance_name: string | null;
  sla_status: string | null;
  custom_attributes: Record<string, unknown> | null;
  contact?: { id: string; name: string } | null;
}

function readStringAttribute(
  attributes: Record<string, unknown> | null,
  key: string,
  fallback: string,
) {
  const value = attributes?.[key];
  return typeof value === "string" && value ? value : fallback;
}

function mapConversation(row: RawConversationRow): ConvRow {
  const status = row.status ?? "aberta";
  const stage = readStringAttribute(
    row.custom_attributes,
    "stage",
    status === "resolvida" ? "resolvido" : "novo",
  );

  return {
    id: row.id,
    contact_id: row.contact_id ?? "",
    channel: row.channel ?? "WhatsApp",
    status,
    stage,
    assigned_to: row.assigned_agent_id,
    last_message: row.last_message,
    last_message_at: row.last_message_at ?? row.updated_at ?? row.created_at,
    unread: readStringAttribute(row.custom_attributes, "unread", "false") === "true",
    sla_minutes: null,
    opened_at: row.created_at ?? new Date().toISOString(),
    resolved_at: row.resolved_at,
    contact: row.contact ?? undefined,
    inbox_id: row.inbox_id,
    instance_name: row.instance_name,
  };
}

export function useConversations() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["conversations", accountId],
    queryFn: async (): Promise<ConvRow[]> => {
      let q = supabase
        .from("conversations")
        .select("*, contact:contacts(id, name)")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as RawConversationRow[]).map(mapConversation);
    },
    enabled: !!accountId,
    refetchInterval: 5000,
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const dbPatch: Record<string, unknown> = { ...patch };
      if ("assigned_to" in dbPatch) {
        dbPatch.assigned_agent_id = dbPatch.assigned_to;
        delete dbPatch.assigned_to;
      }
      if ("stage" in dbPatch) {
        const { data: current } = await supabase
          .from("conversations")
          .select("custom_attributes")
          .eq("id", id)
          .maybeSingle();
        dbPatch.custom_attributes = {
          ...(((current as { custom_attributes?: Record<string, unknown> | null } | null)
            ?.custom_attributes ?? {}) as Record<string, unknown>),
          stage: dbPatch.stage,
        };
        delete dbPatch.stage;
      }
      const { error } = await supabase.from("conversations").update(dbPatch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  return useMutation({
    mutationFn: async (payload: { contact_id: string; channel: string; assigned_to?: string | null }) => {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          contact_id: payload.contact_id,
          channel: payload.channel,
          assigned_agent_id: payload.assigned_to ?? null,
          custom_attributes: { stage: "novo" },
          status: "aberta",
          ...(accountId ? { account_id: accountId } : {}),
        } as never)
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
  sender_name: string | null;
}

interface RawMsgRow {
  id: string;
  conversation_id: string | null;
  agent_id: string | null;
  content: string | null;
  is_from_contact: boolean | null;
  is_private: boolean | null;
  sender_name: string | null;
  created_at: string | null;
}

function mapMsg(row: RawMsgRow): MsgRow {
  return {
    id: row.id,
    conversation_id: row.conversation_id ?? "",
    author: row.is_from_contact ? "cliente" : "agente",
    sender_id: row.agent_id,
    body: row.content ?? "",
    is_note: !!row.is_private,
    created_at: row.created_at ?? new Date().toISOString(),
    sender_name: row.sender_name,
  };
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<MsgRow[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, agent_id, content, is_from_contact, is_private, sender_name, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as RawMsgRow[]).map(mapMsg);
    },
    enabled: !!conversationId,
    refetchInterval: 5000,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (payload: { conversation_id: string; body: string; is_note: boolean; author: "cliente" | "agente"; sender_id?: string | null; sender_name?: string | null }) => {
      if (payload.author !== "agente") throw new Error("Envio pelo cliente não é permitido no sistema");
      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          conversationId: payload.conversation_id,
          body: payload.body,
          isNote: payload.is_note,
          senderName: payload.sender_name ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao enviar mensagem");
      return json;
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

interface RawContactRow {
  id: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  channel: string | null;
  tags: string[] | null;
  created_at: string | null;
}

function mapContact(row: RawContactRow): ContactRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone_number,
    channel: row.channel ?? "WhatsApp",
    labels: row.tags ?? [],
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

export function useContacts() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["contacts", accountId],
    queryFn: async (): Promise<ContactRow[]> => {
      let q = supabase.from("contacts").select("*").order("created_at", { ascending: false });
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as RawContactRow[]).map(mapContact);
    },
    enabled: !!accountId,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  return useMutation({
    mutationFn: async (c: Omit<ContactRow, "id" | "created_at">) => {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          name: c.name,
          email: c.email,
          phone_number: c.phone,
          channel: c.channel,
          tags: c.labels,
          ...(accountId ? { account_id: accountId } : {}),
        } as never)
        .select()
        .single();
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
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["audit_logs", accountId],
    queryFn: async (): Promise<AuditRow[]> => {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
    enabled: !!accountId,
  });
}

// ---------- Quick replies ----------
export interface QuickReply { id: string; shortcut: string; message: string }

export function useQuickReplies() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["quick_replies", accountId],
    queryFn: async (): Promise<QuickReply[]> => {
      let q = supabase.from("quick_replies").select("*").order("shortcut");
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as QuickReply[];
    },
    enabled: !!accountId,
  });
}

// ---------- Labels ----------
export interface LabelRow { id: string; name: string; color: string }

export function useLabels() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["labels", accountId],
    queryFn: async (): Promise<LabelRow[]> => {
      let q = supabase.from("labels").select("*").order("name");
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        color: row.color ?? "#2FAE7C",
      })) as LabelRow[];
    },
    enabled: !!accountId,
  });
}

// ---------- Agents (profiles) ----------
export interface AgentRow { user_id: string; display_name: string; avatar_initials: string | null; online: boolean }

export function useAgents() {
  const { accountId } = useAuth();
  return useQuery({
    queryKey: ["agents", accountId],
    queryFn: async (): Promise<AgentRow[]> => {
      let q = supabase
        .from("profiles")
        .select("user_id, display_name, avatar_initials, online")
        .order("display_name");
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as AgentRow[];
    },
    enabled: !!accountId,
  });
}
