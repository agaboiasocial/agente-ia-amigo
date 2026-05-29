import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Bot = { id: number; name: string; description: string; account: string; webhook: string; active: boolean };

const seed: Bot[] = [
  { id: 1, name: "Atendimento Inicial", description: "Triagem de novos contatos", account: "Agente IA Social", webhook: "https://api.ias.com/bot1", active: true },
];

export const Route = createFileRoute("/super-admin/agent-bots")({ component: Page });

function Page() {
  const [rows, setRows] = useState<Bot[]>(seed);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Bot | null>(null);

  return (
    <SuperAdminLayout
      title="Agent Bots"
      actions={
        <Button className="bg-[#2FAE7C] hover:bg-[#26926a] text-white" onClick={() => { setEditing(null); setOpen(true); }}>
          New bot
        </Button>
      }
    >
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">Id</th>
              <th className="text-left px-4 py-2.5">Nome</th>
              <th className="text-left px-4 py-2.5">Descrição</th>
              <th className="text-left px-4 py-2.5">Conta</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Edit</th>
              <th className="text-left px-4 py-2.5">Destroy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">{r.id}</td>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.description}</td>
                <td className="px-4 py-3">{r.account}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.active ? "bg-[#2FAE7C]/15 text-[#2FAE7C]" : "bg-slate-200 text-slate-600"}`}>
                    {r.active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3"><button className="text-[#0B3A5D] hover:underline" onClick={() => { setEditing(r); setOpen(true); }}>Edit</button></td>
                <td className="px-4 py-3"><button className="text-[#EF4444] hover:underline" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}>Destroy</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <BotDialog
        open={open} onOpenChange={setOpen} editing={editing}
        nextId={Math.max(0, ...rows.map((r) => r.id)) + 1}
        onSave={(b) => { setRows((p) => p.some((x) => x.id === b.id) ? p.map((x) => x.id === b.id ? b : x) : [...p, b]); setOpen(false); }}
      />
    </SuperAdminLayout>
  );
}

function BotDialog({ open, onOpenChange, editing, nextId, onSave }: {
  open: boolean; onOpenChange: (b: boolean) => void; editing: Bot | null; nextId: number; onSave: (b: Bot) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhook, setWebhook] = useState("");
  const [account, setAccount] = useState("Agente IA Social");

  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v);
      if (v) {
        setName(editing?.name ?? ""); setDescription(editing?.description ?? "");
        setWebhook(editing?.webhook ?? ""); setAccount(editing?.account ?? "Agente IA Social");
      }
    }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit bot" : "New bot"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Webhook URL</Label><Input value={webhook} onChange={(e) => setWebhook(e.target.value)} /></div>
          <div>
            <Label>Conta</Label>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Agente IA Social">Agente IA Social</SelectItem>
                <SelectItem value="Clínica Guimarães | Saúde">Clínica Guimarães | Saúde</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-[#2FAE7C] hover:bg-[#26926a] text-white" onClick={() => onSave({
            id: editing?.id ?? nextId, name: name || "Untitled", description, webhook, account, active: editing?.active ?? true,
          })}>{editing ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
