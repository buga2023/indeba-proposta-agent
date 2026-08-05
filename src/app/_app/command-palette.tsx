"use client";

/**
 * Command palette (Ctrl/Cmd+K) — navegação rápida entre as telas reais.
 * Só navega para telas que existem (sem ações fabricadas).
 */

import * as React from "react";

// `busca`: texto extra que casa na filtragem sem aparecer na linha (ex.: o SKU do
// produto, pra "DGCLOR" achar o item mesmo o rótulo sendo o nome comercial).
export type PaletteItem = { key: string; label: string; hint?: string; busca?: string };

export function CommandPalette({
  open,
  onClose,
  items,
  onGo,
}: {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
  onGo: (key: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const [abertoAntes, setAbertoAntes] = React.useState(open);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Zera a busca na ABERTURA ajustando o estado durante a renderização, não por effect:
  // setState síncrono dentro de effect encadeia render extra (React 19 acusa). Este é o
  // padrão oficial pra reagir a mudança de prop — ver "You Might Not Need an Effect".
  if (open !== abertoAntes) {
    setAbertoAntes(open);
    if (open) setQ("");
  }

  // O effect fica só com o foco, que não mexe em estado.
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  // Sem acento e por SKU também: "sanquat" acha "Primmax Sanquat", "dgclor" acha pelo
  // código. Sem termo, só as telas — a lista inteira com 150 produtos não ajuda ninguém.
  const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const termo = semAcento(q.trim());
  const filtered = termo
    ? items.filter((i) => semAcento(`${i.label} ${i.busca ?? ""}`).includes(termo))
    : items.filter((i) => !i.key.startsWith("produto:"));

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(14,40,58,.35)", backdropFilter: "blur(2px)", display: "flex", justifyContent: "center", alignItems: "flex-start", paddingTop: "12vh", animation: "overlay-in .15s ease both" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 560, maxWidth: "calc(100vw - 32px)", background: "white", borderRadius: 16, boxShadow: "0 32px 80px rgba(14,40,58,.4)", overflow: "hidden", animation: "palette-in .2s var(--ease-out) both" }}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "Enter" && filtered[0]) onGo(filtered[0].key);
          }}
          placeholder="Ir para… (tela, produto ou código)"
          style={{ width: "100%", boxSizing: "border-box", border: "none", borderBottom: "1px solid var(--gray-100)", padding: "16px 20px", fontSize: 15, outline: "none", fontFamily: "var(--font-sans), sans-serif", color: "var(--gray-900)" }}
        />
        <div className="ies-scroll" style={{ maxHeight: 340, overflowY: "auto", padding: 8 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--gray-400)", fontSize: 13 }}>Nada encontrado.</div>
          ) : (
            filtered.map((i) => (
              <button
                key={i.key}
                onClick={() => onGo(i.key)}
                style={{ display: "flex", width: "100%", alignItems: "center", gap: 10, padding: "10px 12px", border: "none", background: "transparent", borderRadius: 9, cursor: "pointer", textAlign: "left", fontSize: 14, color: "var(--gray-800)", fontFamily: "inherit" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--gray-50)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {i.label}
                {i.hint && <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--gray-400)" }}>{i.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
