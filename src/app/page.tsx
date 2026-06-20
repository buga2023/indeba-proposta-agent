"use client";

import { useEffect, useRef, useState } from "react";
import type { PropostaScope } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Logo, Wordmark } from "@/components/brand";

const SUGESTOES = [
  "Laticínio, limpeza CIP das linhas de produção e sabonete para os colaboradores.",
  "Cozinha industrial: desengordurante para louças no diluidor automático e álcool gel para as mãos.",
  "Hortifruti: desinfecção das câmaras frias e multiuso para limpeza geral.",
];

type Anexo = { nome: string; conteudo: string; lido: boolean };
type Msg =
  | { de: "voce"; texto: string; anexos: string[] }
  | { de: "agente"; texto: string }
  | { de: "agente"; scope: PropostaScope };

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Home() {
  const [cliente, setCliente] = useState("");
  const [segmento, setSegmento] = useState("");
  const [prompt, setPrompt] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, carregando]);

  async function onArquivos(files: FileList | null) {
    if (!files) return;
    const novos: Anexo[] = [];
    for (const f of Array.from(files)) {
      const ehTexto = f.type.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(f.name);
      novos.push({ nome: f.name, conteudo: ehTexto ? await f.text() : "", lido: ehTexto });
    }
    setAnexos((a) => [...a, ...novos]);
  }

  async function enviar() {
    const texto = prompt.trim();
    if ((!texto && anexos.length === 0) || carregando) return;

    const partesDoc = anexos.filter((a) => a.lido && a.conteudo).map((a) => `--- ${a.nome} ---\n${a.conteudo}`);
    const briefing = [texto, ...partesDoc].filter(Boolean).join("\n\n");

    setMensagens((m) => [...m, { de: "voce", texto: texto || "(documento anexado)", anexos: anexos.map((a) => a.nome) }]);
    setPrompt("");
    setAnexos([]);
    setErro(null);
    setCarregando(true);
    try {
      const r = await fetch("/api/montar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing, razaoSocial: cliente || "Cliente", cnpj: null, segmento: segmento || null }),
      });
      if (!r.ok) throw new Error(`falha ao montar (${r.status})`);
      const scope: PropostaScope = await r.json();
      setMensagens((m) => [...m, { de: "agente", scope }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      setErro(msg);
      setMensagens((m) => [...m, { de: "agente", texto: `Não consegui montar a proposta: ${msg}` }]);
    } finally {
      setCarregando(false);
    }
  }

  async function baixarPdf(scope: PropostaScope) {
    setBaixando(true);
    setErro(null);
    try {
      const r = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scope),
      });
      if (!r.ok) throw new Error(`falha no PDF (${r.status})`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${scope.cliente.razaoSocial.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "erro");
    } finally {
      setBaixando(false);
    }
  }

  function usarSugestao(s: string) {
    setPrompt(s);
    inputRef.current?.focus();
  }

  async function sair() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const vazio = mensagens.length === 0;

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <Wordmark />
          <div className="flex items-center gap-2">
            <Input
              className="w-36"
              placeholder="Cliente"
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
            />
            <Input
              className="hidden w-36 sm:block"
              placeholder="Segmento"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            />
            <Button variant="ghost" size="sm" onClick={sair} title="Sair">
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Conversa */}
      <main className="scroll-suave flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {vazio ? (
            <Hero onSugestao={usarSugestao} />
          ) : (
            <div className="space-y-5">
              {mensagens.map((m, i) =>
                m.de === "voce" ? (
                  <BolhaUsuario key={i} texto={m.texto} anexos={m.anexos} />
                ) : "scope" in m ? (
                  <BolhaAgente key={i}>
                    <Proposta scope={m.scope} onBaixar={baixarPdf} baixando={baixando} />
                  </BolhaAgente>
                ) : (
                  <BolhaAgente key={i}>
                    <p className="text-sm text-card-foreground">{m.texto}</p>
                  </BolhaAgente>
                ),
              )}
              {carregando && (
                <BolhaAgente>
                  <Digitando />
                </BolhaAgente>
              )}
              <div ref={fimRef} />
            </div>
          )}
        </div>
      </main>

      {/* Barra de entrada */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-3xl px-4 py-3">
          {anexos.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {anexos.map((a, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  📎 {a.nome}
                  {!a.lido && <em className="not-italic text-accent">não lido</em>}
                  <button onClick={() => setAnexos((arr) => arr.filter((_, idx) => idx !== i))} className="text-foreground/40 hover:text-foreground">
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
            <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground hover:bg-muted" title="Anexar documento">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
              <input type="file" multiple className="hidden" onChange={(e) => onArquivos(e.target.files)} />
            </label>
            <Textarea
              ref={inputRef}
              className="max-h-40 min-h-10 flex-1 border-0 bg-transparent py-2 shadow-none focus-visible:ring-0"
              rows={1}
              placeholder="Descreva o cliente e a necessidade…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
            />
            <Button size="icon" onClick={enviar} disabled={carregando || (!prompt.trim() && anexos.length === 0)} title="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" />
              </svg>
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            O preço, a imagem e a ficha vêm sempre do catálogo — a IA só seleciona e escreve.
          </p>
          {erro && <p className="mt-1 text-center text-xs text-red-600">{erro}</p>}
        </div>
      </footer>
    </div>
  );
}

function Hero({ onSugestao }: { onSugestao: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <Logo size={56} />
      <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">Vamos montar uma proposta?</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Descreva o cliente e a necessidade em linguagem natural. Eu seleciono os produtos no catálogo, escrevo o texto e
        gero o PDF no padrão Indeba Express.
      </p>
      <div className="mt-6 grid w-full gap-2 sm:grid-cols-3">
        {SUGESTOES.map((s) => (
          <button
            key={s}
            onClick={() => onSugestao(s)}
            className="rounded-xl border border-border bg-card p-3 text-left text-xs text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function BolhaUsuario({ texto, anexos }: { texto: string; anexos: string[] }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm">
        <p className="whitespace-pre-wrap">{texto}</p>
        {anexos.length > 0 && <p className="mt-1 text-xs text-primary-foreground/70">📎 {anexos.join(", ")}</p>}
      </div>
    </div>
  );
}

function BolhaAgente({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">
        <Logo size={32} />
      </div>
      <Card className="max-w-[85%] px-4 py-3">{children}</Card>
    </div>
  );
}

function Digitando() {
  return (
    <div className="flex items-center gap-1 py-1 text-primary">
      <span className="dot h-2 w-2 rounded-full bg-current" />
      <span className="dot h-2 w-2 rounded-full bg-current" />
      <span className="dot h-2 w-2 rounded-full bg-current" />
      <span className="ml-2 text-xs text-muted-foreground">montando a proposta…</span>
    </div>
  );
}

function Proposta({
  scope,
  onBaixar,
  baixando,
}: {
  scope: PropostaScope;
  onBaixar: (s: PropostaScope) => void;
  baixando: boolean;
}) {
  const subtotal = scope.itens.reduce((s, it) => s + Number(it.embalagens[0]?.preco ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proposta montada</span>
        <Badge tom="ia">{scope.textoApresentacao.procedencia}</Badge>
      </div>
      <p className="whitespace-pre-wrap text-sm text-card-foreground">{scope.textoApresentacao.conteudo}</p>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {scope.itens.map((it) => (
          <li key={it.codigo} className="flex items-center gap-3 bg-card p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.imagemPath} alt={it.nome} className="h-11 w-11 shrink-0 rounded-md border border-border bg-white object-contain p-1" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{it.nome}</span>
                <Badge tom={it.procedenciaSelecao === "MANUAL" ? "manual" : "ia"}>{it.procedenciaSelecao}</Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{it.motivo}</div>
            </div>
            <div className="shrink-0 text-right">
              {it.embalagens.map((e, i) => (
                <div key={i} className="text-xs">
                  <span className="text-muted-foreground">{e.tamanho} {e.unidade}</span>{" "}
                  <span className="font-semibold text-primary">
                    {Number(e.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-xs">
        <span className="text-muted-foreground">{scope.itens.length} produto(s) · subtotal (1 emb. de cada)</span>
        <span className="font-semibold text-foreground">{brl(subtotal)}</span>
      </div>

      <Button variant="success" className="w-full" onClick={() => onBaixar(scope)} disabled={baixando}>
        {baixando ? "Gerando PDF…" : "📄 Baixar PDF da proposta"}
      </Button>
    </div>
  );
}
