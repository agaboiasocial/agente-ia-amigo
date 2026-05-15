import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAgents, useQuickReplies, useLabels } from "@/lib/data";
import { Plus, Trash2, Code, Copy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useChatPrefs, ensureFontLoaded, CHAT_FONTS, type ChatFont } from "@/hooks/use-chat-prefs";
import { FormattedMessage } from "@/lib/chat-format";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({ component: ConfigPage });

const tabs = ["Perfil", "Agentes", "Aparência", "Respostas rápidas", "Labels", "Horário", "Widget"];

function ConfigPage() {
  const [tab, setTab] = useState("Perfil");
  const { user } = useAuth();
  const { data: agents = [] } = useAgents();
  const { data: quickReplies = [] } = useQuickReplies();
  const { data: labels = [] } = useLabels();

  return (
    <AppLayout title="Configurações">
      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-56 shrink-0">
          <div className="bg-card border rounded-xl p-2 shadow-sm">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  tab === t
                    ? "bg-success/15 text-success font-semibold"
                    : "text-foreground hover:bg-background"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex-1 space-y-4">
          {tab === "Perfil" && (
            <Section title="Perfil da conta" desc="Informações exibidas no widget e e-mails.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="E-mail logado" value={user?.email ?? ""} />
                <Field label="ID do usuário" value={user?.id ?? ""} />
              </div>
            </Section>
          )}

          {tab === "Agentes" && (
            <Section title="Agentes" desc="Usuários cadastrados no painel.">
              {agents.length === 0 ? (
                <Empty msg="Nenhum agente cadastrado" />
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Agente</th>
                      <th className="text-left px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.user_id} className="border-t">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-brand text-brand-foreground grid place-items-center text-xs font-bold">
                              {a.avatar_initials ?? "?"}
                            </div>
                            <span className="font-medium">{a.display_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${a.online ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                          >
                            {a.online ? "Online" : "Offline"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          )}

          {tab === "Aparência" && <AparenciaTab />}

          {tab === "Respostas rápidas" && (
            <Section
              title="Respostas rápidas"
              desc="Mensagens pré-definidas com atalhos."
              action={
                <button
                  disabled
                  className="h-9 px-3 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 opacity-60"
                >
                  <Plus className="h-4 w-4" /> Nova resposta
                </button>
              }
            >
              {quickReplies.length === 0 ? (
                <Empty msg="Nenhuma resposta cadastrada" />
              ) : (
                <ul className="space-y-3">
                  {quickReplies.map((q) => (
                    <li
                      key={q.id}
                      className="p-4 rounded-lg border bg-background flex justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <code className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded">
                          {q.shortcut}
                        </code>
                        <p className="text-sm mt-2">{q.message}</p>
                      </div>
                      <button className="text-muted-foreground hover:text-destructive shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {tab === "Labels" && (
            <Section
              title="Labels"
              desc="Tags para organizar contatos e conversas."
              action={
                <button
                  disabled
                  className="h-9 px-3 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5 opacity-60"
                >
                  <Plus className="h-4 w-4" /> Nova label
                </button>
              }
            >
              {labels.length === 0 ? (
                <Empty msg="Nenhuma label cadastrada" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {labels.map((l) => (
                    <div
                      key={l.id}
                      className="px-3 py-2 rounded-lg border bg-background flex items-center gap-2"
                    >
                      <span className="h-3 w-3 rounded-full" style={{ background: l.color }} />
                      <span className="text-sm font-medium">{l.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {tab === "Horário" && (
            <Section
              title="Horário de funcionamento"
              desc="Defina quando sua equipe está disponível."
            >
              <div className="space-y-2">
                {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map(
                  (d, i) => (
                    <div
                      key={d}
                      className="flex items-center gap-3 p-3 rounded-lg bg-background border"
                    >
                      <input
                        type="checkbox"
                        defaultChecked={i < 5}
                        className="accent-[var(--success)]"
                      />
                      <span className="font-medium text-sm w-24">{d}</span>
                      <input
                        defaultValue={i < 5 ? "08:00" : "—"}
                        className="h-9 w-24 px-2 rounded-md border bg-card text-sm"
                      />
                      <span className="text-muted-foreground text-xs">até</span>
                      <input
                        defaultValue={i < 5 ? "18:00" : "—"}
                        className="h-9 w-24 px-2 rounded-md border bg-card text-sm"
                      />
                    </div>
                  ),
                )}
              </div>
            </Section>
          )}

          {tab === "Widget" && (
            <Section title="Widget de chat" desc="Integre o IAS no seu site.">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-background border min-h-[300px] relative">
                  <div className="text-xs text-muted-foreground mb-3">Pré-visualização</div>
                  <div className="absolute bottom-5 right-5 w-72 rounded-2xl bg-card shadow-xl overflow-hidden border">
                    <div className="bg-brand text-brand-foreground p-4">
                      <div className="font-semibold text-sm">Olá! 👋</div>
                      <div className="text-xs opacity-80 mt-1">Como podemos te ajudar hoje?</div>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="bg-background p-2 rounded-lg text-xs">
                        Suporte respondendo em 2 min
                      </div>
                      <button className="w-full h-9 rounded-lg bg-success text-success-foreground text-xs font-semibold">
                        Iniciar conversa
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-2 flex items-center gap-2">
                    <Code className="h-4 w-4" /> Código de incorporação
                  </div>
                  <div className="rounded-lg bg-brand text-brand-foreground p-4 font-mono text-xs relative">
                    <button className="absolute top-2 right-2 text-brand-foreground/70 hover:text-warning">
                      <Copy className="h-4 w-4" />
                    </button>
                    <pre className="whitespace-pre-wrap">{`<script src="https://widget.ias.com.br/v1.js"
  data-account="ias-prod-001"
  async></script>`}</pre>
                  </div>
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Section({
  title,
  desc,
  children,
  action,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-xl shadow-sm border p-6">
      <div className="flex justify-between items-start mb-5 gap-4">
        <div>
          <h3 className="font-semibold text-brand">{title}</h3>
          {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input
        readOnly
        value={value}
        className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none"
      />
    </label>
  );
}
function Empty({ msg }: { msg: string }) {
  return <div className="p-8 text-center text-sm text-muted-foreground">{msg}</div>;
}

function AparenciaTab() {
  const { user } = useAuth();
  const { prefs, save } = useChatPrefs(user?.id);
  const [font, setFont] = useState<ChatFont>(prefs.font);
  const [size, setSize] = useState<number>(prefs.size);

  useEffect(() => {
    setFont(prefs.font);
    setSize(prefs.size);
  }, [prefs]);
  useEffect(() => {
    ensureFontLoaded(font);
  }, [font]);

  const sample =
    "Olá! Esta é uma *mensagem* com _formatação_ e ~tachado~.\n" +
    "Você pode usar `código inline` ou listas:\n" +
    "- Item um\n- Item dois\n\n> E também citações elegantes.";

  return (
    <div className="bg-card rounded-xl shadow-sm border p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-brand">Aparência do chat</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configuração individual: cada agente escolhe como vê as mensagens.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <label className="block">
          <span className="text-xs font-medium">Fonte do chat</span>
          <select
            value={font}
            onChange={(e) => setFont(e.target.value as ChatFont)}
            className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40"
          >
            {CHAT_FONTS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-medium flex items-center justify-between">
            <span>Tamanho da fonte</span>
            <span className="text-muted-foreground">{size}px</span>
          </span>
          <input
            type="range"
            min={12}
            max={18}
            step={1}
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value, 10))}
            className="mt-3 w-full accent-[var(--success)]"
          />
        </label>
      </div>

      <div>
        <div className="text-xs font-medium mb-2">Pré-visualização</div>
        <div
          className="max-w-md rounded-2xl bg-success p-4 text-success-foreground shadow-sm"
          style={{
            fontFamily: `${font}, system-ui, sans-serif`,
            fontSize: size,
            lineHeight: 1.5,
          }}
        >
          <FormattedMessage text={sample} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            save({ font, size });
            toast.success("Preferências salvas");
          }}
          className="h-10 rounded-lg bg-success px-5 text-sm font-semibold text-success-foreground hover:opacity-95"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
