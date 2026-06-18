import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const sb = supabase as any;

/**
 * Realtime do chat: mantém a lista de conversas atualizada em tempo real
 * (sem esperar o polling de 5s) e dispara um toast discreto quando chega
 * uma nova mensagem do cliente e o usuário NÃO está na tela de conversas.
 */
export function useRealtimeChat() {
  const { accountId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!accountId) return;
    const invalidate = () => qc.invalidateQueries({ queryKey: ["conversations", accountId] });

    const channel = sb
      .channel(`chat-rt-${accountId}`)
      // Qualquer mudança em conversas da conta → atualiza a lista
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `account_id=eq.${accountId}` },
        invalidate,
      )
      // Nova mensagem → atualiza lista + toast se for do cliente e fora do /conversas
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `account_id=eq.${accountId}` },
        (payload: { new?: { is_from_contact?: boolean; sender_name?: string | null; content?: string | null } }) => {
          invalidate();
          const m = payload?.new;
          if (m?.is_from_contact && !pathRef.current.startsWith("/conversas")) {
            const who = m.sender_name || "Cliente";
            const preview = (m.content || "").slice(0, 60);
            toast.message(`Nova mensagem de ${who}`, {
              description: preview || undefined,
              action: { label: "Abrir", onClick: () => navigate({ to: "/conversas" }) },
            });
          }
        },
      )
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [accountId, qc, navigate]);
}
