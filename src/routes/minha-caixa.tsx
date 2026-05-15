import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useConversations, type ConvRow } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { Search, MessageCircle, Instagram, Globe, Inbox } from "lucide-react";

export const Route = createFileRoute("/minha-caixa")({ component: MinhaCaixaPage });

const tabs = ["Abertas", "Pendentes", "Resolvidas", "Adiadas"] as const;

const channelIcon = (c: string) =>
  c === "WhatsApp" ? MessageCircle : c === "Instagram" ? Instagram : Globe;

function slaState(c: ConvRow): "ok" | "warn" | "over" {
  if (!c.sla_minutes || !c.opened_at || c.status === "resolvida") return "ok";
  const opened = new Date(c.opened_at).getTime();
  const limit = opened + c.sla_minutes * 60 * 1000;
  const now = Date.now();
  if (now > limit) return "over";
  if (limit - now < 15 * 60 * 1000) return "warn";
  return "ok";
}

function slaBorder(s: "ok" | "warn" | "over") {
  if (s === "warn") return "border-l-4 border-l-warning";
  if (s === "over") return "border-l-4 border-l-destructive";
  return "";
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

const initials = (n: string) =>
  n.split(" ").slice(0, 2).map((s) => s[0] ?? "").join("").toUpperCase() || "?";

function MinhaCaixaPage() {
  const { user } = useAuth();
  const { data: convs = [] } = useConversations();
  const [tab, setTab] = useState<(typeof tabs)[number]>("Abertas");
  const [query, setQuery] = useState("");

  const mine = useMemo(
    () => convs.filter((c) => c.assigned_to === user?.id),
    [convs, user?.id],
  );

  const filtered = useMemo(() => {
    return mine.filter((c) => {
      if (tab === "Abertas" && c.status !== "aberta") return false;
      if (tab === "Pendentes" && c.status !== "pendente") return false;
      if (tab === "Resolvidas" && c.status !== "resolvida") return false;
      if (tab === "Adiadas" && c.status !== "adiada") return false;
      if (query && !(c.contact?.name ?? "").toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [mine, tab, query]);

  return (
    <AppLayout flush>
      <div className="h-full flex flex-col">
        <div className="h-14 shrink-0 bg-card border-b px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Inbox className="h-5 w-5 text-brand" />
            <h1 className="text-base font-semibold text-brand">Minha Caixa</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success font-semibold">
              {mine.length} conversas
            </span>
          </div>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-card border-b flex gap-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                tab === t
                  ? "bg-success text-success-foreground font-semibold"
                  : "text-muted-foreground hover:bg-background"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-5 bg-background">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-20 text-sm">
              Nenhuma conversa nesta categoria
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl">
              {filtered.map((c) => {
                const Icon = channelIcon(c.channel);
                const sla = slaState(c);
                return (
                  <Link
                    key={c.id}
                    to="/conversas"
                    className={`block bg-card border rounded-lg p-4 hover:shadow-md transition-shadow ${slaBorder(sla)}`}
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
                          {sla === "warn" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/20 text-warning font-semibold">
                              SLA próximo
                            </span>
                          )}
                          {sla === "over" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive font-semibold">
                              SLA estourado
                            </span>
                          )}
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
