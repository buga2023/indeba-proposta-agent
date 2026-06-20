"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import type { Produto } from "@/lib/contracts";
import { responder, WELCOME, SUGESTOES, NAO_SEI } from "./ajuda-chat-logic";

// Assistente de AJUDA do Agente de Proposta. DETERMINÍSTICO e aterrado no catálogo
// real (/api/catalogo) — preço/ficha vêm sempre do catálogo, nunca inventados
// (constituição §1.2). Não usa IA/Ollama. A lógica (o "cérebro") está em
// ./ajuda-chat-logic e é testada em tests/unit/ajuda-chat.test.ts.

type Msg = { de: "bot" | "voce"; texto: string };

export function AjudaChat() {
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "bot", texto: WELCOME }]);
  const [produtos, setProdutos] = useState<Produto[] | null>(null);
  const [input, setInput] = useState("");
  const corpoRef = useRef<HTMLDivElement>(null);

  // Carrega o catálogo na primeira abertura (uma vez).
  useEffect(() => {
    if (aberto && produtos === null) {
      fetch("/api/catalogo")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: { produtos: Produto[] }) => setProdutos(d.produtos ?? []))
        .catch(() => setProdutos([]));
    }
  }, [aberto, produtos]);

  // Rola para a última mensagem.
  useEffect(() => {
    corpoRef.current?.scrollTo({ top: corpoRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  function enviar(texto: string) {
    const q = texto.trim();
    if (!q) return;
    const r = responder(q, produtos);
    setMsgs((m) => [...m, { de: "voce", texto: q }, { de: "bot", texto: r ?? NAO_SEI }]);
    setInput("");
  }

  const ativos = produtos?.filter((p) => p.ativo).length;

  return (
    <>
      <button onClick={() => setAberto((v) => !v)} aria-label={aberto ? "Fechar ajuda" : "Abrir ajuda"} style={fab}>
        {aberto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          // Balão de chat preenchido + 3 pontos (vazados na cor do FAB) — lê na hora como "ajuda".
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 11.4c0 4.3-4 7.6-9 7.6-1.1 0-2.2-.16-3.2-.46L3.2 20.4l1.2-3.7C3.5 15.3 3 13.4 3 11.4 3 7.1 7 3.8 12 3.8s9 3.3 9 7.6z" fill="white" />
            <circle cx="8.5" cy="11.4" r="1.25" fill="var(--orange-500,#ec7a1c)" />
            <circle cx="12" cy="11.4" r="1.25" fill="var(--orange-500,#ec7a1c)" />
            <circle cx="15.5" cy="11.4" r="1.25" fill="var(--orange-500,#ec7a1c)" />
          </svg>
        )}
      </button>

      {aberto && (
        <div style={painel} role="dialog" aria-label="Assistente do Agente de Proposta">
          <header style={cabecalho}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={avatar}>ie</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#fff" }}>Assistente</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,.7)" }}>{ativos != null ? `${ativos} produtos no catálogo` : "carregando catálogo…"}</div>
              </div>
            </div>
            <button onClick={() => setMsgs([{ de: "bot", texto: WELCOME }])} title="Recomeçar" style={btnReiniciar}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
            </button>
          </header>

          <div ref={corpoRef} style={corpo}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.de === "voce" ? "flex-end" : "flex-start" }}>
                <div style={m.de === "voce" ? bolhaVoce : bolhaBot}>{m.texto}</div>
              </div>
            ))}
          </div>

          <div style={chips}>
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => enviar(s)} style={chip}>{s}</button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); enviar(input); }} style={formStyle}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte sobre um produto ou o agente…" style={inputBox} />
            <button type="submit" aria-label="Enviar" style={btnEnviar} disabled={!input.trim()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/* estilos (inline, alinhados aos tokens do app) */
const fab: CSSProperties = { position: "fixed", right: "24px", bottom: "24px", width: "56px", height: "56px", borderRadius: "50%", border: "none", background: "var(--orange-500,#ec7a1c)", boxShadow: "0 6px 20px rgba(236,122,28,.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const painel: CSSProperties = { position: "fixed", right: "24px", bottom: "92px", width: "372px", maxWidth: "calc(100vw - 32px)", height: "560px", maxHeight: "calc(100vh - 130px)", background: "#fff", borderRadius: "16px", boxShadow: "0 16px 50px rgba(18,40,58,.28)", display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 1000, fontFamily: "Inter, system-ui, sans-serif" };
const cabecalho: CSSProperties = { background: "var(--blue-800,#0e3a5f)", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" };
const avatar: CSSProperties = { width: "34px", height: "34px", borderRadius: "50%", background: "var(--orange-500,#ec7a1c)", color: "#fff", fontWeight: 800, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" };
const btnReiniciar: CSSProperties = { background: "rgba(255,255,255,.12)", border: "none", borderRadius: "8px", width: "30px", height: "30px", color: "rgba(255,255,255,.85)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const corpo: CSSProperties = { flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", background: "var(--gray-50,#f7f9fc)" };
const bolhaBase: CSSProperties = { maxWidth: "88%", padding: "10px 13px", borderRadius: "14px", fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap" };
const bolhaBot: CSSProperties = { ...bolhaBase, background: "#fff", color: "var(--gray-900,#12283a)", border: "1px solid var(--gray-200,#e3ebf3)", borderBottomLeftRadius: "4px" };
const bolhaVoce: CSSProperties = { ...bolhaBase, background: "var(--blue-500,#1e6bb8)", color: "#fff", borderBottomRightRadius: "4px" };
const chips: CSSProperties = { padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: "7px", borderTop: "1px solid var(--gray-200,#e3ebf3)", background: "#fff", maxHeight: "120px", overflowY: "auto" };
const chip: CSSProperties = { padding: "6px 11px", borderRadius: "999px", border: "1px solid var(--blue-200,#a8cbea)", background: "var(--blue-50,#eaf2fa)", color: "var(--blue-700,#134879)", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const formStyle: CSSProperties = { display: "flex", gap: "8px", padding: "10px 12px", borderTop: "1px solid var(--gray-200,#e3ebf3)", background: "#fff" };
const inputBox: CSSProperties = { flex: 1, padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--gray-300,#cbd7e3)", fontSize: "13px", fontFamily: "inherit", outline: "none", color: "var(--gray-900,#12283a)" };
const btnEnviar: CSSProperties = { width: "38px", borderRadius: "10px", border: "none", background: "var(--orange-500,#ec7a1c)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
