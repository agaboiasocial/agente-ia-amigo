import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { agents, quickReplies, labels } from "@/lib/mock-data";
import { Plus, Trash2, Code, Copy } from "lucide-react";

export const Route = createFileRoute("/configuracoes")({ component: ConfigPage });

const tabs = ["Perfil", "Agentes", "Respostas rápidas", "Labels", "Horário", "Widget"];

function ConfigPage() {
  const [tab, setTab] = useState("Perfil");
  return (
    <AppLayout title="Configurações">
      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-56 shrink-0">
          <div className="bg-card border rounded-xl p-2 shadow-sm">
            {tabs.map(t => (
              <button key={t} onClick={()=>setTab(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  tab===t ? "bg-success/15 text-success font-semibold" : "text-foreground hover:bg-background"
                }`}>{t}</button>
            ))}
          </div>
        </nav>

        <div className="flex-1 space-y-4">
          {tab==="Perfil" && (
            <Section title="Perfil da conta" desc="Informações da sua empresa exibidas no widget e e-mails.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome da empresa" value="Agente IA Social" />
                <Field label="Fuso horário" value="(GMT-03:00) Brasília" />
                <Field label="E-mail de suporte" value="suporte@ias.com.br" />
                <Field label="Site" value="https://ias.com.br" />
              </div>
              <div className="mt-5 p-4 rounded-lg bg-background border-dashed border flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl bg-success grid place-items-center text-white font-bold">IAS</div>
                <div>
                  <div className="font-medium text-sm">Logo da empresa</div>
                  <button className="text-xs text-success font-medium mt-1">Alterar logo</button>
                </div>
              </div>
            </Section>
          )}

          {tab==="Agentes" && (
            <Section title="Agentes" desc="Gerencie quem tem acesso ao painel."
              action={<button className="h-9 px-3 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5"><Plus className="h-4 w-4"/> Adicionar</button>}>
              <table className="w-full text-sm">
                <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-3">Agente</th>
                    <th className="text-left px-4 py-3">Função</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(a=>(
                    <tr key={a.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-brand text-brand-foreground grid place-items-center text-xs font-bold">{a.avatar}</div>
                          <span className="font-medium">{a.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select defaultValue={a.role} className="h-8 px-2 rounded-md border bg-background text-xs">
                          <option value="admin">Admin</option>
                          <option value="agente">Agente</option>
                        </select>
                      </td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded-full bg-success/15 text-success font-medium">Ativo</span></td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {tab==="Respostas rápidas" && (
            <Section title="Respostas rápidas" desc="Mensagens pré-definidas com atalhos."
              action={<button className="h-9 px-3 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5"><Plus className="h-4 w-4"/> Nova resposta</button>}>
              <ul className="space-y-3">
                {quickReplies.map(q=>(
                  <li key={q.id} className="p-4 rounded-lg border bg-background flex justify-between gap-4">
                    <div className="min-w-0">
                      <code className="text-xs font-bold text-success bg-success/10 px-2 py-0.5 rounded">{q.shortcut}</code>
                      <p className="text-sm mt-2">{q.message}</p>
                    </div>
                    <button className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {tab==="Labels" && (
            <Section title="Labels" desc="Tags para organizar contatos e conversas."
              action={<button className="h-9 px-3 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-1.5"><Plus className="h-4 w-4"/> Nova label</button>}>
              <div className="flex flex-wrap gap-2">
                {labels.map(l=>(
                  <div key={l.id} className="px-3 py-2 rounded-lg border bg-background flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: l.color }} />
                    <span className="text-sm font-medium">{l.name}</span>
                    <button className="text-muted-foreground hover:text-destructive ml-1"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {tab==="Horário" && (
            <>
              <Section title="Horário de funcionamento" desc="Defina quando sua equipe está disponível.">
                <div className="space-y-2">
                  {["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"].map((d,i)=>(
                    <div key={d} className="flex items-center gap-3 p-3 rounded-lg bg-background border">
                      <input type="checkbox" defaultChecked={i<5} className="accent-[var(--success)]" />
                      <span className="font-medium text-sm w-24">{d}</span>
                      <input defaultValue={i<5 ? "08:00" : "—"} className="h-9 w-24 px-2 rounded-md border bg-card text-sm" />
                      <span className="text-muted-foreground text-xs">até</span>
                      <input defaultValue={i<5 ? "18:00" : "—"} className="h-9 w-24 px-2 rounded-md border bg-card text-sm" />
                    </div>
                  ))}
                </div>
              </Section>
              <Section title="Mensagem de ausência" desc="Enviada automaticamente fora do horário.">
                <textarea defaultValue="Olá! Nosso atendimento está fora do horário. Retornamos seu contato no próximo dia útil. Obrigado!"
                  className="w-full min-h-[100px] p-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success" />
              </Section>
            </>
          )}

          {tab==="Widget" && (
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
                      <div className="bg-background p-2 rounded-lg text-xs">Suporte respondendo em 2 min</div>
                      <button className="w-full h-9 rounded-lg bg-success text-success-foreground text-xs font-semibold">Iniciar conversa</button>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-2 flex items-center gap-2"><Code className="h-4 w-4" /> Código de incorporação</div>
                  <div className="rounded-lg bg-brand text-brand-foreground p-4 font-mono text-xs relative">
                    <button className="absolute top-2 right-2 text-brand-foreground/70 hover:text-warning"><Copy className="h-4 w-4" /></button>
                    <pre className="whitespace-pre-wrap">{`<script src="https://widget.ias.com.br/v1.js"
  data-account="ias-prod-001"
  async></script>`}</pre>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Cole antes do fechamento da tag &lt;/body&gt;.</p>
                </div>
              </div>
            </Section>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ title, desc, children, action }: any) {
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
      <input defaultValue={value} className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success" />
    </label>
  );
}
