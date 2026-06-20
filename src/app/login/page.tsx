"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/brand";

export default function Login() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
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
        throw new Error(d.erro || "Falha no login.");
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
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center">
          <Logo size={48} />
          <h1 className="mt-3 text-lg font-bold text-foreground">Agente de Proposta</h1>
          <p className="text-xs text-muted-foreground">Indeba Express · acesso restrito</p>
        </div>
        <form onSubmit={entrar} className="mt-6 space-y-3">
          <label className="block text-sm">
            <span className="text-muted-foreground">Login</span>
            <Input className="mt-1" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Senha</span>
            <Input
              className="mt-1"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
          <Button type="submit" className="w-full" disabled={carregando || !login || !senha}>
            {carregando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
