import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminSidebar";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { callEdgeFunction } from "@/lib/edge-functions";
import {
  Building2, Plus, Pencil, Trash2, Loader2, Search, Users, MessageSquare,
} from "lucide-react";

const sb = supabase as any;

export const Route = createFileRoute("/super-admin/accounts")({ component: Page });

interface Account {
  id: string;
  name: string;
  slug: string;
  locale: string;
  is_active: boolean;
  created_at: string;
  members_count: number;
  contacts_count: number;
}

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function useAccounts() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["admin_accounts"],
    queryFn: async (): Promise<Account[]> => {
      const accounts = await callEdgeFunction<any[]>("super-admin-accounts", {
        method: "GET",
        token: session?.access_token,
      });
      return accounts.map((a: any) => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        locale: a.locale ?? "pt",
        is_active: a.is_active ?? true,
        created_at: a.created_at,
        members_count: a.members_count ?? 0,
        contacts_count: a.contacts_count ?? 0,
      }));
    },
    enabled: !!session?.access_token,
  });
}

function Page() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const { data: accounts = [], isLoading } = useAccounts();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [locale, setLocale] = useState("pt");
  const [isActive, setIsActive] = useState(true);

  const openCreate = () => {
    setEditing(null);
    setName(""); setSlug(""); setLocale("pt"); setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (a: Account) => {
    setEditing(a);
    setName(a.name); setSlug(a.slug); setLocale(a.locale); setIsActive(a.is_active);
    setModalOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !slug.trim()) throw new Error("Nome e slug são obrigatórios");
      const payload = { name: name.trim(), slug: slug.trim(), locale, is_active: isActive };
      await callEdgeFunction("super-admin-accounts", {
        method: editing ? "PATCH" : "POST",
        token: session?.access_token,
        body: editing ? { id: editing.id, ...payload } : payload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_accounts"] });
      toast.success(editing ? "Organização atualizada" : "Organização criada");
      setModalOpen(false);
    },
    onError: (e: Error) => {
      const msg = e.message.includes("duplicate") ? "Este slug já está em uso" : e.message;
      toast.error(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await callEdgeFunction("super-admin-accounts", {
        method: "DELETE",
        token: session?.access_token,
        body: { id },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin_accounts"] });
      toast.success("Organização removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = accounts.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SuperAdminLayout
      title="Organizações"
      actions={
        <button
          onClick={openCreate}
          className="h-9 px-4 rounded-lg bg-[#2FAE7C] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#26926a]"
        >
          <Plus className="h-4 w-4" /> Nova Organização
        </button>
      }
    >
      <div className="space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            className="w-full h-10 pl-10 pr-4 rounded-lg border bg-white text-sm"
            placeholder="Buscar organizações..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="grid h-64 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <Building2 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 mb-2">Nenhuma organização encontrada.</p>
            <button onClick={openCreate} className="text-[#2FAE7C] text-sm hover:underline">
              Criar primeira organização
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3">Organização</th>
                  <th className="text-left px-4 py-3">Slug</th>
                  <th className="text-center px-4 py-3">Membros</th>
                  <th className="text-center px-4 py-3">Contatos</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Criada em</th>
                  <th className="text-right px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{a.name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.slug}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Users className="h-3.5 w-3.5" /> {a.members_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <MessageSquare className="h-3.5 w-3.5" /> {a.contacts_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {a.is_active ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-[#2FAE7C]/15 text-[#2FAE7C] font-medium">Ativo</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-slate-200 text-slate-600">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(a.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(a)}
                          className="h-8 w-8 rounded border hover:bg-slate-50 grid place-items-center"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5 text-[#0B3A5D]" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir "${a.name}"? Todos os dados da organização serão removidos.`))
                              deleteMut.mutate(a.id);
                          }}
                          disabled={deleteMut.isPending}
                          className="h-8 w-8 rounded border hover:bg-red-50 grid place-items-center"
                          title="Excluir"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border shadow-2xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-base font-semibold text-[#0B3A5D]">
              {editing ? `Editar — ${editing.name}` : "Nova Organização"}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1">Nome *</label>
                <input
                  className="w-full h-10 px-3 rounded-lg border bg-white text-sm"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!editing) setSlug(generateSlug(e.target.value));
                  }}
                  placeholder="Ex: Clínica Guimarães"
                />
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Slug *</label>
                <input
                  className="w-full h-10 px-3 rounded-lg border bg-white text-sm font-mono"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="clinica-guimaraes"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Identificador único, sem espaços</p>
              </div>

              <div>
                <label className="text-xs font-medium block mb-1">Idioma</label>
                <select
                  className="w-full h-10 px-3 rounded-lg border bg-white text-sm"
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                >
                  <option value="pt">Português</option>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              </div>

              <div className="flex items-center justify-between border rounded-lg px-3 py-2">
                <label className="text-sm">Status ativo</label>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? "bg-[#2FAE7C]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="h-9 px-4 rounded-lg border text-sm hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending}
                className="h-9 px-4 rounded-lg bg-[#2FAE7C] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
              >
                {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Criar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SuperAdminLayout>
  );
}
