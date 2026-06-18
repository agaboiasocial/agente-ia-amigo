import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { callEdgeFunction } from "@/lib/edge-functions";

function logReadError(scope: string, _error: unknown) {
  console.warn(`[IAS] Falha ao carregar ${scope}`);
}

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
  unread_count: number;
  waiting: boolean; // última mensagem é do cliente (aguardando resposta)
  sla_minutes: number | null;
  opened_at: string;
  resolved_at: string | null;
  contact?: { id: string; name: string; ai_paused?: boolean };
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
  unread_count: number | null;
  last_message_from_contact: boolean | null;
  custom_attributes: Record<string, unknown> | null;
  contact?: { id: string; name: string; ai_paused?: boolean } | null;
}

function readStringAttribute(
  attributes: Record<string, unknown> | null,
  key: string,
  fallback: string,
) {
  const value = attributes?.[key];
  return typeof value === "string" && value ? value : fallback;
}

// DB usa inglês (open/pending/resolved/snoozed); o frontend usa português.
const DB_TO_UI_STATUS: Record<string, string> = {
  open: "aberta", pending: "pendente", resolved: "resolvida", snoozed: "pendente",
};
const UI_TO_DB_STATUS: Record<string, string> = {
  aberta: "open", pendente: "pending", resolvida: "resolved",
};

function mapConversation(row: RawConversationRow): ConvRow {
  const status = DB_TO_UI_STATUS[row.status ?? ""] ?? row.status ?? "aberta";
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
    unread: (row.unread_count ?? 0) > 0,
    unread_count: row.unread_count ?? 0,
    waiting: !!row.last_message_from_contact,
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
        .select("*, contact:contacts(id, name, ai_paused)")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (accountId) q = q.eq("account_id", accountId);
      const { data, error } = await q;
      if (error) {
        logReadError("conversas", error);
        return [];
      }
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
      if ("status" in dbPatch && typeof dbPatch.status === "string") {
        dbPatch.status = UI_TO_DB_STATUS[dbPatch.status] ?? dbPatch.status;
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

// Marca a conversa como lida para o atendente (zera o contador de não-lidas).
// NÃO altera "aguardando resposta" — isso só muda quando o agente responde.
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("conversations")
        .update({ unread_count: 0 } as never)
        .eq("id", conversationId)
        .gt("unread_count", 0); // só escreve se havia não-lidas (evita update desnecessário)
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
          status: "open",
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

export function useDeleteConversation() {
  const qc = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      return callEdgeFunction("conversation-delete", {
        method: "POST",
        token: session?.access_token,
        body: { conversationId },
      });
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
  message_type: string;
  media_url: string | null;
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
  message_type: string | null;
  media_url: string | null;
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
    message_type: row.message_type ?? "text",
    media_url: row.media_url,
  };
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<MsgRow[]> => {
      if (!conversationId) return [];
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, agent_id, content, is_from_contact, is_private, sender_name, created_at, message_type, media_url")
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
    mutationFn: async (payload: {
      conversation_id: string;
      body: string;
      is_note: boolean;
      author: "cliente" | "agente";
      sender_id?: string | null;
      sender_name?: string | null;
      media_url?: string | null;
      media_type?: string | null;
      file_name?: string | null;
      mime_type?: string | null;
    }) => {
      if (payload.author !== "agente") throw new Error("Envio pelo cliente não é permitido no sistema");
      return callEdgeFunction("whatsapp-send", {
        method: "POST",
        token: session?.access_token,
        body: {
          conversationId: payload.conversation_id,
          body: payload.body,
          isNote: payload.is_note,
          senderName: payload.sender_name ?? null,
          mediaUrl: payload.media_url ?? null,
          mediaType: payload.media_type ?? null,
          fileName: payload.file_name ?? null,
          mimeType: payload.mime_type ?? null,
        },
      });
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
    channel: row.channel ?? "manual",
    labels: row.tags ?? [],
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

export function normalizeContactPhone(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55") || digits.length > 11) return digits;
  return `55${digits}`;
}

function normalizeContactChannel(channel: string | null | undefined) {
  const value = (channel ?? "manual").trim().toLowerCase();
  const aliases: Record<string, string> = {
    "whats app": "whatsapp",
    website: "web",
  };
  return aliases[value] ?? value;
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
      if (!accountId) throw new Error("Conta atual não identificada. Recarregue a página e tente novamente.");

      const phone = normalizeContactPhone(c.phone);
      const channel = normalizeContactChannel(c.channel);

      if (phone) {
        const { data: existing, error: duplicateError } = await supabase
          .from("contacts")
          .select("id")
          .eq("account_id", accountId)
          .eq("phone_number", phone)
          .limit(1)
          .maybeSingle();
        if (duplicateError) throw duplicateError;
        if (existing) throw new Error("Já existe um contato com este telefone nesta conta.");
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          name: c.name.trim(),
          email: c.email,
          phone_number: phone,
          channel,
          tags: c.labels,
          account_id: accountId,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
      qc.invalidateQueries({ queryKey: ["pipeline_leads"] });
    },
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
