import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useContacts, useCreateContact, type ContactRow } from "@/lib/data";
import { toast } from "sonner";
import { Search, Plus, X, Mail, Phone, MessageCircle, Tag, Users, Loader2 } from "lucide-react";

export const Route = createFileRoute("/contatos")({ component: ContatosPage });

function ContatosPage() {
  const { data: all = [], isLoading } = useContacts();
  const create = useCreateContact();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("Todos");
  const [drawer, setDrawer] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", channel: "WhatsApp" });

  const list = useMemo(
    () => all.filter((c) =>
      (channel === "Todos" || c.channel === channel) &&
      (q === "" || c.name.toLowerCase().includes(q.toLowerCase()) || (c.email ?? "").includes(q))
    ),
    [q, channel, all]
  );

  const active = all.find((c) => c.id === drawer);

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Informe o nome");
    try {
      await create.mutateAsync({ name: form.name, email: form.email || null, phone: form.phone || null, channel: form.channel, labels: [] });
      toast.success("Contato criado!");
      setShowNew(false);
      setForm({ name: "", email: "", phone: "", channel: "WhatsApp" });
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <AppLayout title="Contatos" actions={
      <button onClick={() => setShowNew(true)} className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 hover:opacity-95">
        <Plus className="h-4 w-4" /> Novo contato
      </button>
    }>
      <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou email..."
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-background border text-sm focus:outline-none focus:ring-2 focus:ring-success" />
          </div>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-10 px-3 rounded-lg border bg-background text-sm">
            {["Todos", "WhatsApp", "Web", "Instagram"].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        {isLoading ? (
          <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : list.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{all.length === 0 ? "Nenhum contato cadastrado ainda. Clique em \"Novo contato\" para começar." : "Nenhum contato encontrado com esses filtros."}</p>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-background text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-5 py-3">Nome</th>
                  <th className="text-left px-5 py-3">Email</th>
                  <th className="text-left px-5 py-3">Telefone</th>
                  <th className="text-left px-5 py-3">Canal</th>
                  <th className="text-left px-5 py-3">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} onClick={() => setDrawer(c.id)} className="border-t hover:bg-background cursor-pointer transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-brand/10 text-brand grid place-items-center text-xs font-bold">
                          {c.name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
                        </div>
                        <span className="font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-success/15 text-success">{c.channel}</span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 border-t text-xs text-muted-foreground">
          Mostrando {list.length} de {all.length} contatos
        </div>
      </div>

      {active && <ContactDrawer c={active} onClose={() => setDrawer(null)} />}
      {showNew && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowNew(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-card rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="font-semibold text-brand mb-4">Novo contato</h3>
            <div className="space-y-3">
              <Input label="Nome" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Input label="Telefone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <label className="block">
                <span className="text-xs font-medium text-foreground">Canal</span>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm">
                  {["WhatsApp", "Web", "Instagram"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setShowNew(false)} className="h-10 px-4 rounded-lg border text-sm">Cancelar</button>
              <button onClick={submit} disabled={create.isPending} className="h-10 px-4 rounded-lg bg-success text-success-foreground font-semibold text-sm disabled:opacity-60">
                {create.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function ContactDrawer({ c, onClose }: { c: ContactRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <aside onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md bg-card h-full shadow-xl overflow-auto animate-in slide-in-from-right">
        <div className="p-5 border-b flex items-center justify-between bg-brand text-brand-foreground">
          <h3 className="font-semibold">Detalhes do contato</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 text-center border-b">
          <div className="h-20 w-20 mx-auto rounded-full bg-brand/10 text-brand grid place-items-center font-bold text-lg">
            {c.name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase()}
          </div>
          <h2 className="mt-3 text-lg font-semibold">{c.name}</h2>
          {c.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap justify-center gap-1">
              {c.labels.map((l) => (
                <span key={l} className="text-[11px] px-2 py-0.5 rounded-md bg-warning/30 text-foreground font-medium">{l}</span>
              ))}
            </div>
          )}
        </div>
        <div className="p-5 space-y-3 text-sm">
          <Row icon={Mail} label="Email" value={c.email ?? "—"} />
          <Row icon={Phone} label="Telefone" value={c.phone ?? "—"} />
          <Row icon={MessageCircle} label="Canal" value={c.channel} />
          <Row icon={Tag} label="Cliente desde" value={new Date(c.created_at).toLocaleDateString("pt-BR")} />
        </div>
      </aside>
    </div>
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

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-foreground">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success" />
    </label>
  );
}
