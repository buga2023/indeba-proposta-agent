"use client";

import { useState, useRef, useEffect, type CSSProperties } from "react";
import type { PropostaScope, PropostaItem, ComandoEdicao } from "@/lib/contracts";

// Chat de correção pontual da proposta (Revisão) — ADICIONAL ao "Refinar com IA"
// (esse continua cobrindo pedidos amplos de reseleção de produto). Aqui é para
// correções precisas: cliente, quantidade, preço, adicionar/remover item, condições.
// A IA (rota /api/comando-edicao) só classifica a ação e resolve o item/campo alvo —
// quem aplica a mudança no scope é o `onComando` do Home, com os mesmos setters que
// os controles manuais da Revisão já usam. Preço/quantidade nunca vêm da IA.

type Msg = { de: "bot" | "voce"; texto: string };
type RespostaComando = { comando: ComandoEdicao; numero: string | null; itemResolvido: PropostaItem | null };

const WELCOME =
  "Pode me pedir correções pontuais aqui — ex.: \"troca o CNPJ pra 00.000.000/0001-00\", \"muda a quantidade do [produto] pra 5\", \"preço do [produto] pra 32,50\", \"remove o [produto]\", \"adiciona o [produto]\".";

export function EdicaoChat({
  scope,
  onComando,
}: {
  scope: PropostaScope;
  onComando: (r: RespostaComando, mensagemOriginal: string) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "bot", texto: WELCOME }]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const corpoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    corpoRef.current?.scrollTo({ top: corpoRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function enviar(textoBruto: string) {
    const texto = textoBruto.trim();
    if (!texto || enviando) return;
    setMsgs((m) => [...m, { de: "voce", texto }]);
    setInput("");
    setEnviando(true);
    try {
      const r = await fetch("/api/comando-edicao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensagem: texto, scope }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = (await r.json()) as { comando: ComandoEdicao; numero: string | null; itemResolvido: PropostaItem | null; resposta: string };
      setMsgs((m) => [...m, { de: "bot", texto: data.resposta }]);
      onComando({ comando: data.comando, numero: data.numero, itemResolvido: data.itemResolvido }, texto);
    } catch {
      setMsgs((m) => [...m, { de: "bot", texto: "Não consegui processar agora — tenta de novo." }]);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={caixa}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 14px", borderBottom: "1px solid var(--gray-200)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
          <path d="M21 11.4c0 4.3-4 7.6-9 7.6-1.1 0-2.2-.16-3.2-.46L3.2 20.4l1.2-3.7C3.5 15.3 3 13.4 3 11.4 3 7.1 7 3.8 12 3.8s9 3.3 9 7.6z" />
        </svg>
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--gray-700, #334455)" }}>Chat de correção</span>
        <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>— cliente, quantidade, preço, itens, condições</span>
      </div>

      <div ref={corpoRef} style={corpo}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.de === "voce" ? "flex-end" : "flex-start" }}>
            <div style={m.de === "voce" ? bolhaVoce : bolhaBot}>{m.texto}</div>
          </div>
        ))}
        {enviando && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={bolhaBot}>…</div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); enviar(input); }}
        style={{ display: "flex", gap: "8px", alignItems: "center", padding: "8px 10px", borderTop: "1px solid var(--gray-200)" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={enviando}
          placeholder="Ex.: muda a quantidade do PRIMMAX-PLUS pra 3"
          style={{ flex: 1, border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "8px 11px", fontSize: "13px", color: "var(--gray-900)", fontFamily: "var(--font-sans), sans-serif", outline: "none" }}
        />
        <button
          type="submit"
          disabled={enviando || !input.trim()}
          style={{ width: "36px", height: "36px", borderRadius: "8px", border: "none", background: enviando || !input.trim() ? "var(--gray-200)" : "var(--blue-800)", cursor: enviando || !input.trim() ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </form>
    </div>
  );
}

const caixa: CSSProperties = { background: "white", border: "1px solid var(--gray-200)", borderRadius: "8px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", overflow: "hidden" };
const corpo: CSSProperties = { display: "flex", flexDirection: "column", gap: "8px", padding: "12px 14px", maxHeight: "180px", overflowY: "auto", background: "var(--gray-50)" };
const bolhaBase: CSSProperties = { maxWidth: "88%", padding: "8px 12px", borderRadius: "12px", fontSize: "12.5px", lineHeight: 1.5, whiteSpace: "pre-wrap" };
const bolhaBot: CSSProperties = { ...bolhaBase, background: "#fff", color: "var(--gray-900)", border: "1px solid var(--gray-200)", borderBottomLeftRadius: "4px" };
const bolhaVoce: CSSProperties = { ...bolhaBase, background: "var(--blue-500)", color: "#fff", borderBottomRightRadius: "4px" };
