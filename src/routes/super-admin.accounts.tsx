import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Filter, Search, ArrowUpDown } from "lucide-react";

type Account = {
  id: number;
  name: string;
  locale: string;
  users: number;
  conversations: number;
  active: boolean;
  domain?: string;
  features?: Record<string, boolean>;
};

const initial: Account[] = [
  { id: 1, name: "Agente IA Social", locale: "pt", users: 1, conversations: 264, active: true },
  { id: 2, name: "Clínica Guimarães | Saúde", locale: "pt", users: 1, conversations: 0, active: true },
];

const FEATURES = [
  "Automações",
  "Campanhas",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Telegram",
  "Web",
  "Relatórios",
  "Auditoria",
  "SLA",
];

export const Route = createFileRoute("/super-admin/accounts")({
  component: Page,
});

function Page() {
  const [rows, setRows] = useState<Account[]>(initial);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()));

  const upsert = (a: Account) => {
    setRows((prev) => {
      const exists = prev.some((p) => p.id === a.id);
      return exists ? prev.map((p) => (p.id === a.id ? a : p)) : [...prev, a];
    });
  };

  const destroy = (id: number) => {
    if (confirm("Excluir esta conta?")) setRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <SuperAdminLayout
      title="Accounts"
      actions={
        <Button
          className="bg-[#2FAE7C] hover:bg-[#26926a] text-white"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          New account
        </Button>
      }
    >
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="flex items-center justify-between gap-3 p-4 border-b">
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" /> All records
          </Button>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search Accounts"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left px-4 py-2.5">
                <span className="inline-flex items-center gap-1">
                  Id <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
              <th className="text-left px-4 py-2.5">Name</th>
              <th className="text-left px-4 py-2.5">Locale</th>
              <th className="text-left px-4 py-2.5">Users</th>
              <th className="text-left px-4 py-2.5">Conversations</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Edit</th>
              <th className="text-left px-4 py-2.5">Destroy</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-700">{r.id}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{r.name}</td>
                <td className="px-4 py-3 text-slate-600">{r.locale}</td>
                <td className="px-4 py-3">{r.users}</td>
                <td className="px-4 py-3">{r.conversations}</td>
                <td className="px-4 py-3">
                  {r.active ? (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#2FAE7C]/15 text-[#2FAE7C] font-medium">
                      active
                    </span>
                  ) : (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600">
                      inactive
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <button
                    className="text-[#0B3A5D] hover:underline"
                    onClick={() => {
                      setEditing(r);
                      setOpen(true);
                    }}
                  >
                    Edit
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    className="text-[#EF4444] hover:underline"
                    onClick={() => destroy(r.id)}
                  >
                    Destroy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AccountDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        nextId={Math.max(0, ...rows.map((r) => r.id)) + 1}
        onSave={(a) => {
          upsert(a);
          setOpen(false);
        }}
      />
    </SuperAdminLayout>
  );
}

function AccountDialog({
  open,
  onOpenChange,
  editing,
  nextId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: Account | null;
  nextId: number;
  onSave: (a: Account) => void;
}) {
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("pt");
  const [domain, setDomain] = useState("");
  const [active, setActive] = useState(true);
  const [features, setFeatures] = useState<Record<string, boolean>>({});




  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setName(editing?.name ?? "");
          setLocale(editing?.locale ?? "pt");
          setDomain(editing?.domain ?? "");
          setActive(editing?.active ?? true);
          setFeatures(editing?.features ?? {});
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit account" : "New account"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label>Nome da conta</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Locale</Label>
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt">pt</SelectItem>
                  <SelectItem value="en">en</SelectItem>
                  <SelectItem value="es">es</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Domínio</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between border rounded-md px-3 py-2">
            <Label>Status ativo</Label>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Features habilitadas</div>
            <div className="grid grid-cols-2 gap-2">
              {FEATURES.map((f) => (
                <label key={f} className="flex items-center justify-between border rounded-md px-3 py-1.5 text-sm">
                  <span>{f}</span>
                  <Switch
                    checked={!!features[f]}
                    onCheckedChange={(v) => setFeatures((s) => ({ ...s, [f]: v }))}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="bg-[#2FAE7C] hover:bg-[#26926a] text-white"
            onClick={() =>
              onSave({
                id: editing?.id ?? nextId,
                name: name || "Untitled",
                locale,
                users: editing?.users ?? 0,
                conversations: editing?.conversations ?? 0,
                active,
                domain,
                features,
              })
            }
          >
            {editing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
