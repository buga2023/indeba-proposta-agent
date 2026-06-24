"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export default function Login() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (!login || !senha) {
      setErro("Preencha login e senha.");
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, senha }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.erro || "Credenciais inválidas — use sua conta Indeba.");
      }
      router.push("/");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* círculos decorativos */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-[380px] w-[380px] rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-[280px] w-[280px] rounded-full bg-[rgba(247,130,27,0.06)]" />

      {/* swoosh laranja na base */}
      <div
        className="absolute inset-x-0 bottom-0 h-1.5 opacity-90"
        style={{ background: "linear-gradient(to right,var(--orange-600),var(--orange-500),var(--orange-300))" }}
      />

      <div className="w-full max-w-[400px]" style={{ animation: "float-card 5s ease-in-out infinite" }}>
        <div
          className="w-full rounded-[var(--radius-xl)] px-9 py-10"
          style={{
            background: "rgba(255,255,255,.97)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 32px 80px rgba(14,58,95,.5), 0 0 0 1px rgba(255,255,255,.15)",
          }}
        >
          {/* logo */}
          <div className="mb-8 flex flex-col items-center">
            <div
              className="mb-3.5 flex h-[60px] w-[60px] items-center justify-center rounded-2xl"
              style={{
                background: "linear-gradient(135deg,var(--blue-600),var(--blue-800))",
                boxShadow: "0 10px 28px rgba(18,87,196,.4)",
                animation: "glow-pulse 3s ease-in-out infinite",
              }}
            >
              <span className="text-lg font-extrabold tracking-[-0.5px] text-white">ies</span>
            </div>
            <div className="text-xl font-extrabold tracking-tight text-[var(--text-strong)]">
              indeba <span className="text-accent">express</span>
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--text-muted)]">Plataforma de IA · acesso restrito</div>
          </div>

          <form onSubmit={entrar} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-body)]">Login</label>
              <Input
                placeholder="seu.login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-body)]">Senha</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {erro && (
              <div
                className="rounded-[var(--radius-sm)] border-l-[3px] border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2.5 text-[12.5px] text-[var(--danger)]"
                style={{ animation: "fadeUp var(--duration-base) var(--ease-out) both" }}
              >
                {erro}
              </div>
            )}
            <button
              type="submit"
              disabled={carregando}
              className="mt-1 flex h-[46px] w-full items-center justify-center gap-2 rounded-[var(--radius-md)] text-[15px] font-bold text-white transition-all disabled:cursor-not-allowed"
              style={{
                background: carregando ? "var(--border)" : "var(--primary)",
                boxShadow: carregando ? "none" : "var(--shadow-brand)",
              }}
            >
              {carregando ? (
                <>
                  <span
                    className="inline-block h-4 w-4 rounded-full border-2 border-white/40"
                    style={{ borderTopColor: "#fff", animation: "spin .7s linear infinite" }}
                  />
                  Entrando…
                </>
              ) : (
                "Entrar"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-[11.5px] text-[var(--text-subtle)]">
            Conta criada pela administração Indeba.
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 text-[11px] text-white/30">
        Indeba Express · Plataforma de Proposta + Prospecção
      </div>
    </div>
  );
}
