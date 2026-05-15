import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useConversations, type ConvRow } from "@/lib/data";
import { useInboxes } from "@/lib/inboxes";
import { Inbox, MessageCircle, Instagram, Globe } from "lucide-react";

export const Route = createFileRoute("/caixas/$id")({ component: CaixaPage });

const channelIcon = (c: string) =>
  c === "WhatsApp" ? MessageCircle : c === "Instagram" ? Instagram : Globe;

const initials = (n: string) =>
  n.split(" ").slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase() || "?";

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function CaixaPage() {
  const { id } = Route.useParams();
  const { data: convs = [] } = useConversations();
  const { data: inboxes = [] } = useInboxes();

  const inbox = inboxes.find((i) => i.id === id);

  const filtered = useMemo(() => {
    if (id === "nao-atribuidas") return convs.filter((c) => !c.assigned_to);
    return convs.filter((c) => (c as ConvRow & { inbox_id?: string }).inbox_id === id);
  }, [convs, id]);

  const title = id === "nao-atribuidas" ? "Não atribuídas" : inbox?.name ?? "Caixa";

  return (
    <AppLayout flush>
      <div className="h-full flex flex-col">
        <div className="h-14 shrink-0 bg-card border-b px-5 flex items-center gap-3">
          <Inbox className="h-5 w-5 text-brand" />
          <h1 className="text-base font-semibold text-brand">{title}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">
            {filtered.length}
          </span>
        </div>
        <div className="flex-1 overflow-auto p-5 bg-background">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-20 text-sm">
              Nenhuma conversa nesta caixa
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl">
              {filtered.map((c) => {
                const Icon = channelIcon(c.channel);
                return (
                  <Link
                    key={c.id}
                    to="/conversas"
                    className="block bg-card border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                        {initials(c.contact?.name ?? "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">
                            {c.contact?.name ?? "—"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-success/15 text-success">
                            <Icon className="h-3 w-3" />
                            {c.channel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {c.last_message ?? "Sem mensagens"}
                        </p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatTime(c.last_message_at)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
