import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

type App = { id: number; name: string; type: string; active: boolean };

const seed: App[] = [
  { id: 1, name: "Slack Notifier", type: "webhook", active: true },
  { id: 2, name: "Zapier", type: "integration", active: false },
];

export const Route = createFileRoute("/super-admin/platform-apps")({ component: Page });

function Page() {
  const [rows, setRows] = useState<App[]>(seed);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");

  return (
    <SuperAdminLayout
      title="Platform Apps"
      actions={
        <Button className="bg-[#2FAE7C] hover:bg-[#26926a] text-white" onClick={() => { setName(""); setType(""); setOpen(true); }}>
          New app
        </Button>
      }
    >
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm min-w-[500px]">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">Id</th>
              <th className="text-left px-4 py-2.5">Nome</th>
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Destroy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">{r.id}</td>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.type}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.active ? "bg-[#2FAE7C]/15 text-[#2FAE7C]" : "bg-slate-200 text-slate-600"}`}>
                    {r.active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3"><button className="text-[#EF4444] hover:underline" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}>Destroy</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New app</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Tipo</Label><Input value={type} onChange={(e) => setType(e.target.value)} placeholder="webhook, integration..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button className="bg-[#2FAE7C] hover:bg-[#26926a] text-white" onClick={() => {
              setRows((p) => [...p, { id: Math.max(0, ...p.map((x) => x.id)) + 1, name: name || "Untitled", type: type || "app", active: true }]);
              setOpen(false);
            }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
