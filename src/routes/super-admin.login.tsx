import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, ShieldHalf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/super-admin/login")({
  component: Page,
});

const schema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "Mínimo 6 caracteres").max(100),
});

function Page() {
  const navigate = useNavigate();
  const { session, isAdmin, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session && isAdmin) navigate({ to: "/super-admin" });
  }, [loading, session, isAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signErr || !data.user) {
        setError(signErr?.message ?? "Falha no login");
        return;
      }
      const checkRes = await fetch("/api/super-admin/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token}`,
        },
      });
      const access = await checkRes.json();
      if (!access.isAdmin) {
        await supabase.auth.signOut();
        setError("Acesso restrito a super administradores.");
        return;
      }
      toast.success("Bem-vindo ao Super Admin Console");
      navigate({ to: "/super-admin" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-sm p-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-[#0B3A5D] text-white grid place-items-center mb-3">
            <ShieldHalf className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-[#0B3A5D]">Super Admin Console</h1>
          <p className="text-sm text-slate-500 mt-1">
            Acesso restrito. Use suas credenciais de super administrador.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={255}
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={100}
            />
          </div>

          {error && (
            <div className="text-sm text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#2FAE7C] hover:bg-[#26926a] text-white"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => window.location.href = "/conversas"}
            className="text-xs text-slate-500 hover:text-[#0B3A5D] hover:underline cursor-pointer"
          >
            ← Voltar ao painel principal
          </button>
        </div>
      </div>
    </div>
  );
}
