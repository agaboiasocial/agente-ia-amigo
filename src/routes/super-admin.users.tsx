import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/super-admin/users")({ component: Page });

type RoleValue = "admin" | "agente";

function Page() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const authHeaders = {
    "Content-Type": "application/json",
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["super-admin-users"],
    queryFn: async () => {
      const r = await fetch("/api/super-admin/users", { method: "GET", headers: authHeaders });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro ao listar usuários");
      return json;
    },
  });

  const createMut = useMutation({
    mutationFn: async (input: { email: string; password: string; displayName: string; role: RoleValue }) => {
      const r = await fetch("/api/super-admin/users", { method: "POST", headers: authHeaders, body: JSON.stringify(input) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro ao criar usuário");
      return json;
    },
    onSuccess: () => {
      toast.success("Usuário criado");
      qc.invalidateQueries({ queryKey: ["super-admin-users"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (userId: string) => {
      const r = await fetch("/api/super-admin/users", { method: "DELETE", headers: authHeaders, body: JSON.stringify({ userId }) });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Erro ao remover usuário");
      return json;
    },
    onSuccess: () => {
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["super-admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (usersQuery.data ?? []).filter((r) =>
    [r.displayName, r.email].some((v) => v.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <SuperAdminLayout
      title="Users"
      actions={
        <Button
          className="bg-[#2FAE7C] hover:bg-[#26926a] text-white"
          onClick={() => setOpen(true)}
        >
          Novo agente
        </Button>
      }
    >
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="p-4 border-b flex justify-end">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar usuários"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {usersQuery.isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
          </div>
        ) : usersQuery.error ? (
          <div className="p-6 text-sm text-[#EF4444]">
            {(usersQuery.error as Error).message}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">Nenhum usuário encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-2.5">Nome</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Papéis</th>
                <th className="text-left px-4 py-2.5">Criado em</th>
                <th className="text-left px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{r.displayName}</td>
                  <td className="px-4 py-3 text-slate-600">{r.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.length === 0 ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        r.roles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              role === "admin"
                                ? "bg-[#0B3A5D]/10 text-[#0B3A5D]"
                                : "bg-[#2FAE7C]/15 text-[#2FAE7C]"
                            }`}
                          >
                            {role}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-[#EF4444] hover:underline disabled:opacity-50"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (confirm(`Remover ${r.displayName}? Esta ação é permanente.`)) {
                          deleteMut.mutate(r.id);
                        }
                      }}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <UserDialog
        open={open}
        onOpenChange={setOpen}
        submitting={createMut.isPending}
        onSave={(u) => createMut.mutate(u)}
      />
    </SuperAdminLayout>
  );
}

function UserDialog({
  open,
  onOpenChange,
  submitting,
  onSave,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  submitting: boolean;
  onSave: (u: { email: string; password: string; displayName: string; role: RoleValue }) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleValue>("agente");

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) {
          setDisplayName("");
          setEmail("");
          setPassword("");
          setRole("agente");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo agente</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Nome</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres. Compartilhe com o agente.</p>
          </div>
          <div>
            <Label>Papel</Label>
            <Select value={role} onValueChange={(v) => setRole(v as RoleValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="agente">Agente</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            className="bg-[#2FAE7C] hover:bg-[#26926a] text-white"
            disabled={submitting || !email || !password || !displayName}
            onClick={() => onSave({ email, password, displayName, role })}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
