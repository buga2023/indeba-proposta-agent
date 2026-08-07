"use client";

import { useState, useEffect, useRef, type CSSProperties } from "react";
import type { Produto } from "@/lib/contracts";
import { responder, WELCOME, SUGESTOES, NAO_SEI } from "./ajuda-chat-logic";

// Assistente de AJUDA do Agente de Proposta. DETERMINÍSTICO e aterrado no catálogo
// real (/api/catalogo) — preço/ficha vêm sempre do catálogo, nunca inventados
// (constituição §1.2). Não usa IA/Ollama. A lógica (o "cérebro") está em
// ./ajuda-chat-logic e é testada em tests/unit/ajuda-chat.test.ts.

type Msg = { de: "bot" | "voce"; texto: string };

// ── Renderização da resposta ──────────────────────────────────────────────────
// A bolha imprimia `{m.texto}` cru: com `pre-wrap` as quebras apareciam, mas título de
// ficha, rótulo de campo e item de lista chegavam todos como o MESMO texto de 13px. Num
// balão de 372px isso vira massa cinzenta — a informação está lá e ninguém acha.
//
// Isto NÃO é um parser de Markdown, e não deve virar um: reconhece exatamente a convenção
// que o cérebro emite (documentada em ajuda-chat-logic.ts). Sem dependência nova e sem
// dangerouslySetInnerHTML — o texto fala de preço e produto, não passa por HTML de terceiro.

// "a **b** c" → o split com grupo de captura devolve ["a ", "b", " c"]: os ÍMPARES são o
// conteúdo capturado, ou seja, o que estava entre os asteriscos.
function comNegrito(texto: string) {
  return texto.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 ? <strong key={i} style={forte}>{parte}</strong> : <span key={i}>{parte}</span>));
}

function Resposta({ texto }: { texto: string }) {
  return (
    <>
      {texto.split("\n").map((linha, i) => {
        // Linha vazia é respiro entre blocos — um <br> daria altura de linha inteira (~20px),
        // que separa demais dentro de um balão pequeno.
        if (!linha.trim()) return <div key={i} style={{ height: "7px" }} />;

        // Linha inteiramente em negrito é título de bloco ("**📦 Nome**", "**Embalagens:**").
        const titulo = /^\*\*(.+)\*\*$/.exec(linha);
        if (titulo) return <div key={i} style={tituloBloco}>{titulo[1]}</div>;

        // Item de lista: o marcador vai numa coluna própria, então a 2ª linha de um item
        // longo alinha com a 1ª em vez de voltar à margem e se confundir com o próximo item.
        const numerado = /^(\d+)\.\s+(.*)$/.exec(linha);
        if (linha.startsWith("• ") || numerado) {
          const marcador = numerado ? `${numerado[1]}.` : "•";
          const conteudo = numerado ? numerado[2] : linha.slice(2);
          return (
            <div key={i} style={itemLista}>
              <span style={numerado ? marcadorNumero : marcadorBullet}>{marcador}</span>
              <span style={{ flex: 1, minWidth: 0 }}>{comNegrito(conteudo)}</span>
            </div>
          );
        }
        return <div key={i} style={paragrafo}>{comNegrito(linha)}</div>;
      })}
    </>
  );
}

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
  //
  // Atribuição direta, e não `scrollTo({ behavior: "smooth" })`: medido neste container no
  // Chrome, "auto" chega ao alvo (654 de 654) e "smooth" deixa o scrollTop parado em 0 — a
  // animação simplesmente não roda aqui. E falhava em SILÊNCIO: a resposta era montada,
  // formatada, e nascia fora da área visível. Quem perguntava via a própria pergunta com um
  // vazio embaixo e precisava rolar à mão para descobrir que havia resposta — o que é pior
  // do que uma resposta mal formatada, porque parece que o assistente não respondeu.
  useEffect(() => {
    const el = corpoRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  // Abre o assistente quando o header global pede (botão "Assistente").
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener("ies:assistente", abrir);
    return () => window.removeEventListener("ies:assistente", abrir);
  }, []);

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
        <div style={painel} role="dialog" aria-label="Assistente do Indeba Express PRO IA">
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
                {/* Só a resposta do bot é formatada. O que a pessoa digitou vai como texto
                    puro: interpretar marcação no input dela faria "**" sumir do que ela
                    escreveu — e o balão dela nunca tem estrutura para exibir mesmo. */}
                <div style={m.de === "voce" ? bolhaVoce : bolhaBot}>
                  {m.de === "voce" ? m.texto : <Resposta texto={m.texto} />}
                </div>
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
const bolhaBase: CSSProperties = { padding: "10px 13px", borderRadius: "14px", fontSize: "13px", lineHeight: 1.5 };
// A bolha do bot é a que carrega ficha técnica e lista: 94% para a lista de embalagens não
// quebrar em duas linhas por item. A da pessoa continua estreita — pergunta é curta, e a
// assimetria é o que faz ler de relance quem falou.
const bolhaBot: CSSProperties = { ...bolhaBase, maxWidth: "94%", background: "#fff", color: "var(--gray-900,#12283a)", border: "1px solid var(--gray-200,#e3ebf3)", borderBottomLeftRadius: "4px" };
// `pre-wrap` fica só aqui: a resposta do bot é montada em <div> por linha pelo `Resposta`,
// e manter pre-wrap lá somaria a quebra do \n à quebra do bloco (linha em branco dobrada).
const bolhaVoce: CSSProperties = { ...bolhaBase, maxWidth: "88%", background: "var(--blue-500,#1e6bb8)", color: "#fff", borderBottomRightRadius: "4px", whiteSpace: "pre-wrap" };
const forte: CSSProperties = { fontWeight: 650, color: "var(--blue-800,#0e3a5f)" };
const tituloBloco: CSSProperties = { fontWeight: 700, fontSize: "13.5px", color: "var(--blue-800,#0e3a5f)", letterSpacing: "-.01em", marginBottom: "1px" };
const paragrafo: CSSProperties = { marginBottom: "1px" };
const itemLista: CSSProperties = { display: "flex", gap: "7px", alignItems: "baseline", marginBottom: "1px" };
const marcadorBullet: CSSProperties = { color: "var(--orange-500,#ec7a1c)", fontWeight: 700, flex: "none", lineHeight: 1.5 };
const marcadorNumero: CSSProperties = { color: "var(--orange-500,#ec7a1c)", fontWeight: 700, flex: "none", minWidth: "13px", fontSize: "12.5px", lineHeight: 1.55 };
// 120px de sugestões (4 fileiras) num painel de 560px deixavam só 314px de leitura — menos
// espaço para a RESPOSTA do que para os atalhos que levam a ela. Duas fileiras; o resto
// continua acessível rolando, e a área de leitura ganha os 46px de volta.
const chips: CSSProperties = { padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: "7px", borderTop: "1px solid var(--gray-200,#e3ebf3)", background: "#fff", maxHeight: "74px", overflowY: "auto" };
const chip: CSSProperties = { padding: "6px 11px", borderRadius: "999px", border: "1px solid var(--blue-200,#a8cbea)", background: "var(--blue-50,#eaf2fa)", color: "var(--blue-700,#134879)", fontSize: "12px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };
const formStyle: CSSProperties = { display: "flex", gap: "8px", padding: "10px 12px", borderTop: "1px solid var(--gray-200,#e3ebf3)", background: "#fff" };
const inputBox: CSSProperties = { flex: 1, padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--gray-300,#cbd7e3)", fontSize: "13px", fontFamily: "inherit", outline: "none", color: "var(--gray-900,#12283a)" };
const btnEnviar: CSSProperties = { width: "38px", borderRadius: "10px", border: "none", background: "var(--orange-500,#ec7a1c)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
