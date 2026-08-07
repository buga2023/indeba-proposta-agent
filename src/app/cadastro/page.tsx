"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { LogoCompleta, Wordmark } from "@/components/brand";

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [pendente, setPendente] = useState(false);

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !email || !senha) {
      setErro("Preencha nome, e-mail e senha.");
      return;
    }
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, email, senha }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        // Mesma armadilha do login: falha de servidor não deve parecer erro de
        // preenchimento, senão o usuário fica corrigindo o formulário em vão.
        if (r.status >= 500) throw new Error("O servidor não conseguiu criar a conta. Não é o que você preencheu — avise o time técnico.");
        throw new Error(d.erro || "Não foi possível criar a conta.");
      }
      // A conta nasce aguardando liberação do gestor — mandar para "/" só devolveria a
      // pessoa ao login sem explicar por quê. Ela precisa saber que deu certo e que o
      // passo que falta não é dela.
      const d = await r.json().catch(() => ({}));
      if (d.pendente) {
        setPendente(true);
        return;
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
          {/* logo oficial */}
          <div className="mb-8 flex flex-col items-center">
            <LogoCompleta altura={86} className="mb-2" />
            <div className="text-[12.5px] text-[var(--text-muted)]">Criar conta de colaborador</div>
          </div>

          {pendente ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: "var(--success-soft)", color: "var(--success)" }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>
              <div className="text-[15px] font-bold text-[var(--text-strong)]">Conta criada!</div>
              <div className="text-[13px] leading-relaxed text-[var(--text-muted)]">
                Falta o gestor liberar seu acesso. Assim que ele aprovar, você entra normalmente
                com o e-mail <b>{email}</b> e a senha que acabou de escolher.
              </div>
              <a href="/login" className="text-[13px] font-semibold" style={{ color: "var(--primary)" }}>
                Voltar para o login
              </a>
            </div>
          ) : (
          <form onSubmit={criarConta} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-body)]">Nome</label>
              <Input
                placeholder="Seu nome completo"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoComplete="name"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-body)]">E-mail</label>
              <Input
                type="email"
                placeholder="seu.email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold text-[var(--text-body)]">Senha</label>
              <Input
                type="password"
                placeholder="Mínimo 8 caracteres"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete="new-password"
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
                  Criando…
                </>
              ) : (
                "Criar conta"
              )}
            </button>
          </form>
          )}

          <p className="mt-5 text-center text-[11.5px] text-[var(--text-subtle)]">
            Já tem conta?{" "}
            <a href="/login" className="font-semibold text-[var(--primary)] hover:underline">
              Entrar
            </a>
          </p>
        </div>
      </div>

      <div className="absolute bottom-4 flex items-center gap-2 text-[11px] text-white/30">
        <Wordmark variante="white" altura={13} alt="" className="opacity-40" />
        <span>PRO IA</span>
      </div>
    </div>
  );
}
