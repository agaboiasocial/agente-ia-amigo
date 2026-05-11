import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, User as UserIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signIn, signUp } = useAuth();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!authLoading && session) navigate({ to: "/conversas" });
  }, [authLoading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (tab === "login") {
      const { error } = await signIn(email, password);
      setLoading(false);
      if (error) return toast.error(error);
      toast.success("Login realizado com sucesso!");
      navigate({ to: "/conversas" });
    } else {
      if (!name.trim()) { setLoading(false); return toast.error("Informe seu nome"); }
      const { error } = await signUp(email, password, name);
      setLoading(false);
      if (error) return toast.error(error);
      toast.success("Conta criada! Verifique seu e-mail se a confirmação estiver habilitada.");
      setTab("login");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundImage: "linear-gradient(135deg, #0B3A5D 0%, #0D4A6B 100%)" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-success grid place-items-center text-white font-bold text-lg shadow-lg">
              IAS
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Agente IA Social</h1>
          <p className="text-white/70 text-sm mt-1">Plataforma de atendimento ao cliente</p>
        </div>

        <div className="bg-card rounded-xl shadow-xl p-7">
          <div className="flex gap-1 bg-background rounded-lg p-1 mb-5">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${tab === "login" ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground"}`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setTab("signup")}
              className={`flex-1 text-sm py-1.5 rounded-md transition-colors ${tab === "signup" ? "bg-card shadow-sm text-brand font-semibold" : "text-muted-foreground"}`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === "signup" && (
              <Field icon={UserIcon} label="Nome" type="text" value={name} onChange={setName} placeholder="Seu nome" />
            )}
            <Field icon={Mail} label="E-mail" type="email" value={email} onChange={setEmail} placeholder="seu@email.com" />
            <Field icon={Lock} label="Senha" type="password" value={password} onChange={setPassword} placeholder="••••••••" />

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-success text-success-foreground font-semibold hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {tab === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/50 mt-6">© 2026 IAS — Agente IA Social</p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, type, value, onChange, placeholder }: { icon: any; label: string; type: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground">{label}</label>
      <div className="relative mt-1">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-10 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success"
          placeholder={placeholder}
          required
        />
      </div>
    </div>
  );
}
