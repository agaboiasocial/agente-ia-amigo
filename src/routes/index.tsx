import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate({ to: "/conversas" }), 700);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundImage:
          "linear-gradient(135deg, #0B3A5D 0%, #0D4A6B 100%)",
      }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-xl bg-success grid place-items-center text-white font-bold text-lg shadow-lg">
              IAS
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Agente IA Social</h1>
          <p className="text-white/70 text-sm mt-1">
            Plataforma de atendimento ao cliente
          </p>
        </div>

        <div className="bg-card rounded-xl shadow-xl p-7">
          <h2 className="text-lg font-semibold text-foreground">Entrar na sua conta</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Acesse o painel da sua equipe
          </p>

          <form onSubmit={submit} className="space-y-4 mt-6">
            <div>
              <label className="text-xs font-medium text-foreground">E-mail</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="email"
                  defaultValue="mariana@ias.com.br"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Senha</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  defaultValue="••••••••"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-success"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-muted-foreground">
                <input type="checkbox" className="accent-[var(--success)]" /> Lembrar-me
              </label>
              <a className="text-success font-medium hover:underline cursor-pointer">
                Esqueceu a senha?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-success text-success-foreground font-semibold hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Entrar
            </button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Não tem uma conta?{" "}
            <Link to="/" className="text-brand font-medium hover:underline">
              Fale com o administrador
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/50 mt-6">
          © 2026 IAS — Agente IA Social
        </p>
      </div>
    </div>
  );
}
