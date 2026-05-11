import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";

type U = {
  id: number;
  name: string;
  email: string;
  account: string;
  role: "Super Admin" | "Admin" | "Agente";
  active: boolean;
  createdAt: string;
};

const seed: U[] = [
  { id: 1, name: "Carlos Lima", email: "carlos@ias.com", account: "Agente IA Social", role: "Super Admin", active: true, createdAt: "2025-01-12" },
  { id: 2, name: "Ana Souza", email: "ana@clinica.com", account: "Clínica Guimarães | Saúde", role: "Admin", active: true, createdAt: "2025-03-04" },
];

export const Route = createFileRoute("/super-admin/users")({ component: Page });

function Page() {
  const [rows, setRows] = useState<U[]>(seed);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<U | null>(null);

  const filtered = rows.filter((r) =>
    [r.name, r.email, r.account].some((v) => v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <SuperAdminLayout
      title="Users"
      actions={
        <Button
          className="bg-[#2FAE7C] hover:bg-[#26926a] text-white"
          onClick={() => { setEditing(null); setOpen(true); }}
        >
          New user
        </Button>
      }
    >
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b flex justify-end">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input className="pl-9" placeholder="Search users" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">Id</th>
              <th className="text-left px-4 py-2.5">Nome</th>
              <th className="text-left px-4 py-2.5">Email</th>
              <th className="text-left px-4 py-2.5">Conta</th>
              <th className="text-left px-4 py-2.5">Role</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Created</th>
              <th className="text-left px-4 py-2.5">Edit</th>
              <th className="text-left px-4 py-2.5">Destroy</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3">{r.id}</td>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.email}</td>
                <td className="px-4 py-3">{r.account}</td>
                <td className="px-4 py-3">{r.role}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.active ? "bg-[#2FAE7C]/15 text-[#2FAE7C]" : "bg-slate-200 text-slate-600"}`}>
                    {r.active ? "active" : "inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.createdAt}</td>
                <td className="px-4 py-3">
                  <button className="text-[#0B3A5D] hover:underline" onClick={() => { setEditing(r); setOpen(true); }}>Edit</button>
                </td>
                <td className="px-4 py-3">
                  <button className="text-[#EF4444] hover:underline" onClick={() => setRows((p) => p.filter((x) => x.id !== r.id))}>Destroy</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <UserDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        nextId={Math.max(0, ...rows.map((r) => r.id)) + 1}
        onSave={(u) => {
          setRows((prev) => prev.some((p) => p.id === u.id) ? prev.map((p) => p.id === u.id ? u : p) : [...prev, u]);
          setOpen(false);
        }}
      />
    </SuperAdminLayout>
  );
}

function UserDialog({ open, onOpenChange, editing, nextId, onSave }: {
  open: boolean; onOpenChange: (b: boolean) => void; editing: U | null; nextId: number; onSave: (u: U) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [account, setAccount] = useState("Agente IA Social");
  const [role, setRole] = useState<U["role"]>("Agente");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setName(editing?.name ?? "");
          setEmail(editing?.email ?? "");
          setPassword("");
          setAccount(editing?.account ?? "Agente IA Social");
          setRole(editing?.role ?? "Agente");
        }
      }}
    >
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit user" : "New user"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {!editing && (
            <div><Label>Senha temporária</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          )}
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
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as U["role"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Super Admin">Super Admin</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Agente">Agente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-[#2FAE7C] hover:bg-[#26926a] text-white"
            onClick={() => onSave({
              id: editing?.id ?? nextId,
              name: name || "Untitled",
              email,
              account,
              role,
              active: editing?.active ?? true,
              createdAt: editing?.createdAt ?? new Date().toISOString().slice(0, 10),
            })}
          >
            {editing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
