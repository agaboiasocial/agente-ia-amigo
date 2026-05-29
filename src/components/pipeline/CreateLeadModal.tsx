import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineStage } from "@/types/pipeline";
import { normalizeContactPhone } from "@/lib/data";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";

const sb = supabase as any;

interface Props {
  open: boolean;
  onClose: () => void;
  stages: PipelineStage[];
}

export function CreateLeadModal({ open, onClose, stages }: Props) {
  const qc = useQueryClient();
  const { accountId } = useAuth();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    estimated_value: "",
    source: "manual",
    notes: "",
    stage_id: stages[0]?.id ?? "",
  });

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Informe o nome");
      if (!accountId) throw new Error("Conta atual não identificada. Recarregue a página e tente novamente.");

      const phone = normalizeContactPhone(form.phone);
      if (phone) {
        const { data: existing, error: duplicateError } = await sb
          .from("contacts")
          .select("id")
          .eq("account_id", accountId)
          .eq("phone_number", phone)
          .limit(1)
          .maybeSingle();
        if (duplicateError) throw duplicateError;
        if (existing) throw new Error("Já existe um contato com este telefone nesta conta.");
      }

      const { error } = await sb.from("contacts").insert({
        name: form.name.trim(),
        phone_number: phone,
        email: form.email.trim() || null,
        estimated_value: Number(form.estimated_value) || 0,
        source: form.source,
        notes: form.notes.trim() || null,
        stage_id: form.stage_id || null,
        stage_entered_at: new Date().toISOString(),
        channel: "manual",
        tags: [],
        account_id: accountId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_leads", accountId] });
      qc.invalidateQueries({ queryKey: ["contacts", accountId] });
      toast.success("Lead criado com sucesso");
      setForm({ name: "", phone: "", email: "", estimated_value: "", source: "manual", notes: "", stage_id: stages[0]?.id ?? "" });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl bg-card border shadow-2xl">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-base font-semibold text-brand">Novo Lead</h2>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-background grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          <Field label="Nome *">
            <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} placeholder="Nome do lead" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} placeholder="+55 11 99999-9999" />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} placeholder="email@exemplo.com" type="email" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor estimado (R$)">
              <input value={form.estimated_value} onChange={(e) => set("estimated_value", e.target.value)} className={inputCls} placeholder="0,00" type="number" min="0" step="0.01" />
            </Field>
            <Field label="Origem">
              <select value={form.source} onChange={(e) => set("source", e.target.value)} className={inputCls}>
                <option value="manual">Manual</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="website">Website</option>
                <option value="instagram">Instagram</option>
                <option value="indicacao">Indicação</option>
                <option value="outro">Outro</option>
              </select>
            </Field>
          </div>

          <Field label="Etapa inicial">
            <select value={form.stage_id} onChange={(e) => set("stage_id", e.target.value)} className={inputCls}>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Observações">
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className={inputCls + " min-h-[72px]"} placeholder="Notas sobre o lead..." />
          </Field>
        </div>

        <footer className="flex justify-end gap-2 border-t px-5 py-4">
          <button onClick={onClose} className="h-9 px-4 rounded-lg border text-sm hover:bg-background">
            Cancelar
          </button>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="h-9 px-4 rounded-lg bg-success text-success-foreground text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Criar Lead
          </button>
        </footer>
      </div>
    </div>
  );
}

const inputCls = "w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1">{label}</span>
      {children}
    </label>
  );
}
