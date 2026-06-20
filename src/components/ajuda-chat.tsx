"use client";

import { useState, type CSSProperties } from "react";

// Chatbot de AJUDA com respostas PRÉ-PRONTAS (sem IA). Explica o funcionamento e o
// que o agente faz neste primeiro MVP. Self-contained: monta com <AjudaChat /> e
// gerencia o próprio estado/posição (canto inferior direito). Não usa o Ollama —
// é só um FAQ guiado, então é instantâneo e funciona mesmo sem o modelo no ar.

type QA = { q: string; a: string };

const FAQ: QA[] = [
  {
    q: "O que esse agente faz?",
    a: "Ele gera propostas comerciais em PDF no padrão Indeba. Você descreve o cliente e a necessidade em linguagem natural (o briefing), a IA escolhe os produtos no catálogo e escreve o texto de apresentação, e o PDF sai pronto para enviar.",
  },
  {
    q: "Como eu gero uma proposta?",
    a: "1) Escreva o briefing descrevendo o cliente e o que ele precisa. 2) Escolha o tipo de proposta. 3) Clique em Gerar. 4) Revise os produtos e o texto na tela de revisão (pode ajustar quantidade, incluir/excluir itens). 5) Clique em Baixar PDF.",
  },
  {
    q: "Quais tipos de proposta existem?",
    a: "Três: Orçamento (tabela enxuta de itens e valores, padrão ERP), Implantação (formato Express, mais visual) e Comercial (formato fabricante, com páginas institucionais). Você escolhe o tipo antes de gerar.",
  },
  {
    q: "De onde vêm os preços?",
    a: "SEMPRE do catálogo — nunca da IA. Preço, embalagem e ficha técnica são dados do catálogo. A IA só seleciona quais produtos entram e escreve o texto. Isso é uma regra de ouro: preço inventado não sai daqui.",
  },
  {
    q: "Posso mudar o que a IA escolheu?",
    a: "Sim. Tudo que a IA seleciona e escreve é revisável antes de exportar. Na tela de revisão você inclui ou remove produtos, ajusta as quantidades e confere o texto. O PDF reflete exatamente o que você deixou na revisão.",
  },
  {
    q: "E se eu já souber os produtos?",
    a: "Use o caminho estruturado: em vez de descrever, você informa os itens direto. Ele converge no mesmo formato de PDF, sem depender da IA para selecionar. Bom quando você já chega com a proposta pronta na cabeça.",
  },
  {
    q: "O que esse MVP ainda não faz?",
    a: "É um primeiro MVP: o catálogo tem um conjunto reduzido de produtos reais, a IA local pode levar alguns segundos por proposta, e envio por e-mail ainda não está ativo. Os preços e fotos virão da base oficial quando ela estiver disponível.",
  },
];

const WELCOME =
  "Oi! Sou a ajuda do Agente de Proposta. Posso explicar como usar e o que ele faz neste MVP. Toque numa pergunta abaixo 👇";

type Msg = { de: "bot" | "voce"; texto: string };

export function AjudaChat() {
  const [aberto, setAberto] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ de: "bot", texto: WELCOME }]);
  const [usadas, setUsadas] = useState<Set<string>>(new Set());

  function perguntar(qa: QA) {
    setMsgs((m) => [...m, { de: "voce", texto: qa.q }, { de: "bot", texto: qa.a }]);
    setUsadas((u) => new Set(u).add(qa.q));
  }
  function reiniciar() {
    setMsgs([{ de: "bot", texto: WELCOME }]);
    setUsadas(new Set());
  }

  const restantes = FAQ.filter((qa) => !usadas.has(qa.q));

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto((v) => !v)}
        aria-label={aberto ? "Fechar ajuda" : "Abrir ajuda"}
        style={fab}
      >
        {aberto ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.1 9a3 3 0 1 1 4.5 2.6c-.9.5-1.6 1.2-1.6 2.4" />
            <circle cx="12" cy="17.5" r="0.6" fill="white" stroke="none" />
          </svg>
        )}
      </button>

      {/* Painel */}
      {aberto && (
        <div style={painel} role="dialog" aria-label="Ajuda do Agente de Proposta">
          <header style={cabecalho}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={avatar}>?</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#fff" }}>Ajuda do Agente</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,.7)" }}>Respostas rápidas · MVP</div>
              </div>
            </div>
            <button onClick={reiniciar} title="Recomeçar" style={btnReiniciar}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
          </header>

          <div style={corpo}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.de === "voce" ? "flex-end" : "flex-start" }}>
                <div style={m.de === "voce" ? bolhaVoce : bolhaBot}>{m.texto}</div>
              </div>
            ))}
          </div>

          <div style={chips}>
            {restantes.length === 0 ? (
              <button onClick={reiniciar} style={chipReset}>Recomeçar as perguntas</button>
            ) : (
              restantes.map((qa) => (
                <button key={qa.q} onClick={() => perguntar(qa)} style={chip}>
                  {qa.q}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* estilos (inline, alinhados aos tokens do app) */
const fab: CSSProperties = {
  position: "fixed",
  right: "24px",
  bottom: "24px",
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  border: "none",
  background: "var(--orange-500, #ec7a1c)",
  boxShadow: "0 6px 20px rgba(236,122,28,.45)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};
const painel: CSSProperties = {
  position: "fixed",
  right: "24px",
  bottom: "92px",
  width: "360px",
  maxWidth: "calc(100vw - 32px)",
  height: "520px",
  maxHeight: "calc(100vh - 130px)",
  background: "#fff",
  borderRadius: "16px",
  boxShadow: "0 16px 50px rgba(18,40,58,.28)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  zIndex: 1000,
  fontFamily: "Inter, system-ui, sans-serif",
};
const cabecalho: CSSProperties = {
  background: "var(--blue-800, #0e3a5f)",
  padding: "14px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};
const avatar: CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  background: "var(--orange-500, #ec7a1c)",
  color: "#fff",
  fontWeight: 800,
  fontSize: "18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const btnReiniciar: CSSProperties = {
  background: "rgba(255,255,255,.12)",
  border: "none",
  borderRadius: "8px",
  width: "30px",
  height: "30px",
  color: "rgba(255,255,255,.85)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const corpo: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  background: "var(--gray-50, #f7f9fc)",
};
const bolhaBase: CSSProperties = {
  maxWidth: "85%",
  padding: "10px 13px",
  borderRadius: "14px",
  fontSize: "13px",
  lineHeight: 1.5,
};
const bolhaBot: CSSProperties = {
  ...bolhaBase,
  background: "#fff",
  color: "var(--gray-900, #12283a)",
  border: "1px solid var(--gray-200, #e3ebf3)",
  borderBottomLeftRadius: "4px",
};
const bolhaVoce: CSSProperties = {
  ...bolhaBase,
  background: "var(--blue-500, #1e6bb8)",
  color: "#fff",
  borderBottomRightRadius: "4px",
};
const chips: CSSProperties = {
  padding: "12px",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  borderTop: "1px solid var(--gray-200, #e3ebf3)",
  background: "#fff",
  maxHeight: "168px",
  overflowY: "auto",
};
const chip: CSSProperties = {
  padding: "7px 12px",
  borderRadius: "999px",
  border: "1px solid var(--blue-200, #a8cbea)",
  background: "var(--blue-50, #eaf2fa)",
  color: "var(--blue-700, #134879)",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};
const chipReset: CSSProperties = {
  ...chip,
  border: "1px solid var(--gray-300, #cbd7e3)",
  background: "var(--gray-100, #eef3f8)",
  color: "var(--gray-500, #5b6e7d)",
};
