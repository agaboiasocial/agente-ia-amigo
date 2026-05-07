import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { contacts as all } from "@/lib/mock-data";
import { Search, Plus, X, Mail, Phone, MessageCircle, Tag } from "lucide-react";

export const Route = createFileRoute("/contatos")({ component: ContatosPage });

function ContatosPage() {
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("Todos");
  const [drawer, setDrawer] = useState<string | null>(null);

  const list = useMemo(
    () =>
      all.filter(
        (c) =>
          (channel === "Todos" || c.channel === channel) &&
          (q === "" || c.name.toLowerCase().includes(q.toLowerCase()) || c.email.includes(q))
      ),
    [q, channel]
  );

  const active = all.find((c) => c.id === drawer);

  return (
    <AppLayout title="Contatos" actions={
      <button className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 hover:opacity-95">
        <Plus className="h-4 w-4" /> Novo contato
      </button>
    }>
      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={q} onChange={(e)=>setQ(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success"
            />
          </div>
          <select value={channel} onChange={(e)=>setChannel(e.target.value)} className="h-10 px-3 rounded-lg border bg-background text-sm">
            {["Todos","WhatsApp","Web","Instagram"].map((o)=> <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-5 py-3">Nome</th>
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Telefone</th>
                <th className="text-left px-5 py-3">Canal</th>
                <th className="text-left px-5 py-3">Última conversa</th>
                <th className="text-left px-5 py-3">Criado em</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} onClick={()=>setDrawer(c.id)} className="border-t hover:bg-background cursor-pointer transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                        {c.name.split(" ").slice(0,2).map(s=>s[0]).join("")}
                      </div>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{c.email}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.phone}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-success/15 text-success">{c.channel}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{c.lastConv}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 border-t text-xs text-muted-foreground">
          Mostrando {list.length} de {all.length} contatos
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={()=>setDrawer(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <aside onClick={(e)=>e.stopPropagation()} className="relative w-full max-w-md bg-card h-full shadow-xl overflow-auto animate-in slide-in-from-right">
            <div className="p-5 border-b flex items-center justify-between bg-brand text-brand-foreground">
              <h3 className="font-semibold">Detalhes do contato</h3>
              <button onClick={()=>setDrawer(null)}><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 text-center border-b">
              <div className="h-20 w-20 mx-auto rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-lg">
                {active.name.split(" ").slice(0,2).map(s=>s[0]).join("")}
              </div>
              <h2 className="mt-3 text-lg font-semibold">{active.name}</h2>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                {active.labels.map((l)=>(
                  <span key={l} className="text-[11px] px-2 py-0.5 rounded-md bg-warning/30 text-foreground font-medium">{l}</span>
                ))}
              </div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <Row icon={Mail} label="Email" value={active.email} />
              <Row icon={Phone} label="Telefone" value={active.phone} />
              <Row icon={MessageCircle} label="Canal" value={active.channel} />
              <Row icon={Tag} label="Cliente desde" value={active.createdAt} />
            </div>
            <div className="p-5 border-t">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Histórico de conversas</h4>
              <ul className="space-y-2">
                <li className="p-3 rounded-lg bg-background text-xs">
                  <div className="font-medium">Última interação</div>
                  <div className="text-muted-foreground">{active.lastConv}</div>
                </li>
              </ul>
            </div>
            <div className="p-5 flex gap-2">
              <button className="flex-1 h-10 rounded-lg bg-success text-success-foreground font-medium text-sm">Iniciar conversa</button>
              <button className="h-10 px-4 rounded-lg border text-sm">Editar</button>
            </div>
          </aside>
        </div>
      )}
    </AppLayout>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-9 w-9 rounded-lg bg-background grid place-items-center"><Icon className="h-4 w-4 text-brand" /></div>
      <div>
        <div className="text-[11px] uppercase text-muted-foreground tracking-wider">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
