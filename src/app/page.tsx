"use client";

/**
 * Indeba Express — UI portada do design "Indeba Express.dc.html" (Claude Design),
 * agora ligada aos endpoints reais:
 *   - Briefing  → POST /api/montar  (IA seleciona do catálogo; tipo "orcamento")
 *   - Revisão   → edita o PropostaScope real (quantidade + incluir/excluir)
 *   - PDF       → POST /api/pdf      (mesmo objeto que a tela mostra vira PDF — §4)
 *   - Catálogo  → GET  /api/catalogo (data/catalogo.json — preço sempre do catálogo)
 *   - Histórico → GET  /api/propostas (log append-only de PDFs gerados — §1.8)
 *
 * Constituição: preço/embalagem vêm SEMPRE do catálogo; a IA só seleciona e escreve.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PropostaScope, PropostaItem, Produto } from "@/lib/contracts";

/* ───────────────────────── helpers ───────────────────────── */

const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");
// Valor sem "R$" (preview do PDF de orçamento espelha o template, que omite o símbolo).
const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Nº do orçamento derivado do id (mesma lógica do template-orcamento.ts).
const numeroDoc = (id: string) => String((parseInt(id.replace(/[^0-9a-f]/gi, "").slice(0, 6) || "0", 16) % 9000) + 1000);
const precoUnit = (it: PropostaItem) => Number(it.embalagens[0]?.preco ?? 0);
const unidadeDe = (it: PropostaItem) => {
  const e = it.embalagens[0];
  return e ? `${e.tamanho} ${e.unidade}` : "—";
};

// Procedência (dado real do item) no lugar da "categoria" do mock.
const procColor = (p: PropostaItem["procedenciaSelecao"]) => (p === "MANUAL" ? "#D97706" : "#1E6BB8");
const procLabel = (p: PropostaItem["procedenciaSelecao"]) => (p === "MANUAL" ? "Manual" : "Seleção IA");

// Cores por linha do catálogo (facetas reais).
const LINHA_COR: Record<string, string> = {
  lavanderia: "#1E6BB8",
  alimentos_bebidas: "#16A34A",
  limpeza_conservacao: "#7C3AED",
  higiene_clinica: "#0EA5E9",
  higiene_pessoal: "#DB2777",
  tratamento_pisos: "#D97706",
  automotiva: "#475569",
};
const linhaCor = (l: string) => LINHA_COR[l] ?? "#5B6E7D";
const humaniza = (l: string) =>
  l.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function parseCliente(briefing: string): string {
  const h = briefing.split(":")[0].trim();
  return h && h.length <= 80 ? h : "Cliente";
}

/** Elemento com estados :hover / :active (o design usa style-hover/style-active). */
function Hoverable({
  as = "button",
  base,
  hover,
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  as?: "button" | "div";
  base: CSSProperties;
  hover?: CSSProperties;
  active?: CSSProperties;
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [h, setH] = useState(false);
  const [a, setA] = useState(false);
  const style = { ...base, ...(h && hover ? hover : {}), ...(a && active ? active : {}) };
  const handlers = {
    onMouseEnter: () => setH(true),
    onMouseLeave: () => {
      setH(false);
      setA(false);
    },
    onMouseDown: () => setA(true),
    onMouseUp: () => setA(false),
  };
  if (as === "div") {
    return (
      <div style={style} onClick={onClick} title={title} {...handlers}>
        {children}
      </div>
    );
  }
  return (
    <button style={style} onClick={onClick} title={title} disabled={disabled} {...handlers}>
      {children}
    </button>
  );
}

/* tipo do registro do histórico (espelha EventoProposta da API, sem importar node) */
type PropostaLog = {
  ts: string;
  usuario: string;
  propostaId: string;
  cliente: string;
  segmento: string | null;
  tipo: string | null;
  total: string;
  itens: { codigo: string; nome: string; quantidade: number; precos: string[] }[];
};

const LOADING_MSGS = ["Analisando o briefing...", "Buscando no catálogo...", "Selecionando produtos...", "Finalizando a proposta..."];
const LOADING_LABELS = ["Briefing analisado", "Catálogo consultado", "Produtos selecionados", "Proposta montada"];

type Screen = "briefing" | "loading" | "review" | "pdf" | "history" | "catalog";

/* ───────────────────────── componente principal ───────────────────────── */

export default function Home() {
  const [screen, setScreen] = useState<Screen>("briefing");
  const [reviewVariant, setReviewVariant] = useState<"A" | "B">("A");
  const [briefingText, setBriefingText] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<PropostaScope | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const [catFilter, setCatFilter] = useState("Todos");
  const [catalogo, setCatalogo] = useState<Produto[] | null>(null);
  const [catalogoErro, setCatalogoErro] = useState<string | null>(null);
  const [propostas, setPropostas] = useState<PropostaLog[] | null>(null);
  const [propostasErro, setPropostasErro] = useState<string | null>(null);

  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stopStepTimer = useCallback(() => {
    if (stepTimer.current) {
      clearInterval(stepTimer.current);
      stepTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopStepTimer(), [stopStepTimer]);

  // Carrega catálogo / histórico sob demanda (uma vez por entrada na tela).
  useEffect(() => {
    if (screen === "catalog" && catalogo === null) {
      fetch("/api/catalogo")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: { produtos: Produto[] }) => setCatalogo(d.produtos))
        .catch((e) => setCatalogoErro(e instanceof Error ? e.message : "Erro"));
    }
    if (screen === "history" && propostas === null) {
      fetch("/api/propostas")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: { propostas: PropostaLog[] }) => setPropostas(d.propostas))
        .catch((e) => setPropostasErro(e instanceof Error ? e.message : "Erro"));
    }
  }, [screen, catalogo, propostas]);

  async function startGeneration() {
    const texto = briefingText.trim();
    if (!texto || generating) return;
    setError(null);
    setGenerating(true);
    const primeira = !hasLoadedOnce;
    if (primeira) {
      setScreen("loading");
      setLoadingStep(0);
      let s = 0;
      stopStepTimer();
      stepTimer.current = setInterval(() => {
        s++;
        if (s >= 3) {
          setLoadingStep(3);
          stopStepTimer();
        } else {
          setLoadingStep(s);
        }
      }, 700);
    } else {
      setQuickLoading(true);
    }

    try {
      const r = await fetch("/api/montar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: texto, razaoSocial: parseCliente(texto), cnpj: null, segmento: null, tipo: "orcamento" }),
      });
      if (!r.ok) throw new Error(`Falha ao montar a proposta (${r.status}).`);
      const data = await r.json();
      if (data?.precisaTipo) throw new Error("Não consegui identificar o tipo de proposta a partir do briefing.");
      if (!data || !Array.isArray(data.itens)) throw new Error("Resposta inesperada do servidor.");
      const novo = data as PropostaScope;
      stopStepTimer();
      setLoadingStep(4);
      setScope(novo);
      setExcluded(new Set());
      setHasLoadedOnce(true);
      setScreen("review");
    } catch (e) {
      stopStepTimer();
      setError(e instanceof Error ? e.message : "Erro ao montar a proposta.");
      setScreen("briefing");
    } finally {
      setGenerating(false);
      setQuickLoading(false);
    }
  }

  function changeQty(codigo: string, d: number) {
    setScope((s) =>
      s ? { ...s, itens: s.itens.map((it) => (it.codigo === codigo ? { ...it, quantidade: Math.max(1, it.quantidade + d) } : it)) } : s,
    );
  }
  function toggleProduct(codigo: string) {
    setExcluded((ex) => {
      const next = new Set(ex);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  const includedItems = scope ? scope.itens.filter((it) => !excluded.has(it.codigo)) : [];
  const total = includedItems.reduce((sum, it) => sum + precoUnit(it) * it.quantidade, 0);

  async function baixarPdf() {
    if (!scope || downloading) return;
    if (includedItems.length === 0) {
      setError("Inclua ao menos um produto para gerar o PDF.");
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const efetivo: PropostaScope = { ...scope, itens: includedItems };
      const r = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(efetivo),
      });
      if (!r.ok) throw new Error(`Falha ao gerar o PDF (${r.status}).`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${scope.cliente.razaoSocial.replace(/\s+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      // histórico mudou — força recarga na próxima visita
      setPropostas(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar PDF.");
    } finally {
      setDownloading(false);
    }
  }

  /* navegação da sidebar */
  function navItemStyle(screens: Screen[]): CSSProperties {
    const activeNav = screens.includes(screen);
    return {
      display: "flex",
      alignItems: "center",
      gap: "10px",
      padding: "9px 12px",
      borderRadius: "8px",
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      width: "100%",
      background: activeNav ? "rgba(255,255,255,0.13)" : "transparent",
      color: activeNav ? "#FFFFFF" : "rgba(255,255,255,0.6)",
      fontFamily: "Inter,sans-serif",
      fontSize: "14px",
      fontWeight: activeNav ? 600 : 400,
      transition: "background 0.18s ease, color 0.18s ease",
    };
  }
  const navHover: CSSProperties = { background: "rgba(255,255,255,0.16)", color: "#fff" };

  function novaProposta() {
    setScreen("briefing");
    setBriefingText("");
    setQuickLoading(false);
    setError(null);
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--gray-50)", fontFamily: "'Inter',sans-serif", color: "var(--gray-900)" }}>
      {/* ============ SIDEBAR ============ */}
      <aside style={{ width: "240px", flex: "none", height: "100vh", background: "var(--blue-800)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--blue-500)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 2px 8px rgba(30,107,184,.5)" }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: "13px", letterSpacing: "-.5px" }}>ies</span>
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "white", lineHeight: 1.1 }}>
                indeba <span style={{ color: "#EC7A1C" }}>express</span>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,.45)", marginTop: "2px" }}>Agente de Proposta</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: "10px 8px", flex: 1, display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
          <Hoverable base={navItemStyle(["briefing", "loading", "review", "pdf"])} hover={navHover} onClick={novaProposta}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2H4.5A1 1 0 003.5 3v11a1 1 0 001 1h8a1 1 0 001-1V6.5L9.5 2z" />
              <path d="M9.5 2v4.5h4.5" />
              <path d="M6 9.5h5M6 12h3.5" />
            </svg>
            Nova proposta
          </Hoverable>
          <Hoverable base={navItemStyle(["history"])} hover={navHover} onClick={() => setScreen("history")}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M3 4.5h11M3 8.5h11M3 12.5h7" />
            </svg>
            Propostas
          </Hoverable>
          <Hoverable base={navItemStyle(["catalog"])} hover={navHover} onClick={() => setScreen("catalog")}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="2.5" width="5" height="5" rx="1" />
              <rect x="9.5" y="2.5" width="5" height="5" rx="1" />
              <rect x="2.5" y="9.5" width="5" height="5" rx="1" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
            </svg>
            Catálogo
          </Hoverable>

          <div style={{ height: "1px", background: "rgba(255,255,255,.07)", margin: "8px 4px" }} />

          <Hoverable base={navItemStyle([])} hover={navHover} title="Em breve">
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8.5" cy="8.5" r="2.25" />
              <path d="M8.5 2.5v1M8.5 13v1.5M2.5 8.5h1M13 8.5h1.5M4.5 4.5l.7.7M11.8 11.8l.7.7M4.5 12.5l.7-.7M11.8 5.2l.7-.7" />
            </svg>
            Configurações
          </Hoverable>
        </nav>

        <div style={{ padding: "14px 14px", borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "var(--blue-500)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontWeight: 700, fontSize: "12px", color: "white" }}>N</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontSize: "13px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Nicolás Ferreira</div>
            <div style={{ color: "rgba(255,255,255,.4)", fontSize: "11px" }}>Vendedor</div>
          </div>
          <button
            onClick={() => {
              fetch("/api/logout", { method: "POST" }).finally(() => (window.location.href = "/login"));
            }}
            title="Sair"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,.35)", padding: "2px", display: "flex" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 2l4 5-4 5" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <main className="ies-scroll" style={{ flex: 1, height: "100vh", overflowY: "auto", overflowX: "hidden", position: "relative" }}>
        {screen === "briefing" && (
          <BriefingScreen {...{ quickLoading, briefingText, setBriefingText, startGeneration, textareaRef, error }} />
        )}
        {screen === "loading" && <LoadingScreen loadingStep={loadingStep} />}
        {screen === "review" && scope && (
          <ReviewScreen
            {...{ reviewVariant, setReviewVariant, scope, excluded, includedItems, total, toggleProduct, changeQty }}
            goToBriefing={novaProposta}
            goToPDF={() => setScreen("pdf")}
          />
        )}
        {screen === "pdf" && scope && (
          <PdfScreen
            scope={scope}
            includedItems={includedItems}
            total={total}
            downloading={downloading}
            baixarPdf={baixarPdf}
            goToReview={() => setScreen("review")}
            error={error}
          />
        )}
        {(screen === "review" || screen === "pdf") && !scope && <SemProposta onNova={novaProposta} />}
        {screen === "history" && <HistoryScreen propostas={propostas} erro={propostasErro} goToBriefing={novaProposta} />}
        {screen === "catalog" && <CatalogScreen catalogo={catalogo} erro={catalogoErro} catFilter={catFilter} setCatFilter={setCatFilter} />}
      </main>
    </div>
  );
}

function SemProposta({ onNova }: { onNova: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "16px", padding: "48px" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--gray-900)" }}>Nenhuma proposta em edição</div>
      <p style={{ fontSize: "14px", color: "var(--gray-500)" }}>Comece um briefing para montar uma proposta.</p>
      <button onClick={onNova} style={{ padding: "10px 20px", background: "var(--orange-500)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "white" }}>
        Nova proposta
      </button>
    </div>
  );
}

/* ═══════════════════════ TELA: BRIEFING ═══════════════════════ */

function BriefingScreen({
  quickLoading,
  briefingText,
  setBriefingText,
  startGeneration,
  textareaRef,
  error,
}: {
  quickLoading: boolean;
  briefingText: string;
  setBriefingText: (v: string) => void;
  startGeneration: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  error: string | null;
}) {
  const chipBase: CSSProperties = { padding: "10px 16px", background: "white", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--gray-200)", borderRadius: "12px", fontSize: "13px", color: "var(--gray-500)", cursor: "pointer", textAlign: "left", flex: 1, lineHeight: 1.45, boxShadow: "var(--shadow-sm)", transition: "border-color .18s ease,transform .15s ease,box-shadow .18s ease,color .18s ease" };
  const chipHover: CSSProperties = { borderColor: "var(--blue-200)", color: "var(--gray-900)", transform: "translateY(-2px)", boxShadow: "0 6px 16px rgba(15,26,36,.09)" };

  const chips = [
    { text: "Laticínio, limpeza CIP das linhas e sabonete para colaboradores.", prompt: "Laticínio São João: limpeza CIP das linhas de produção e sabonete bactericida para os colaboradores." },
    { text: "Cozinha industrial: desengordurante e álcool gel para as mãos.", prompt: "Cozinha industrial: desengordurante para louças no diluidor automático e álcool gel para as mãos." },
    { text: "Hortifruti: câmaras frias e multiuso para limpeza geral.", prompt: "Hortifruti Verde Vida: desinfecção das câmaras frias e multiuso para limpeza geral das bancadas." },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--gray-50)", position: "relative" }}>
      {quickLoading && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "var(--blue-50)", overflow: "hidden", zIndex: 10 }}>
          <div style={{ position: "absolute", top: 0, height: "100%", width: "30%", background: "linear-gradient(to right,transparent,var(--blue-500),var(--orange-500))", animation: "indeterminate 1.1s cubic-bezier(.4,0,.2,1) infinite" }} />
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: "56px", background: "white", borderBottom: "1px solid var(--gray-200)", flex: "none", position: "sticky", top: 0, zIndex: 5 }}>
        <div>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)" }}>Nova proposta</span>
          <span style={{ fontSize: "12px", color: "var(--gray-400)", marginLeft: "10px" }}>IA seleciona os produtos e redige o texto</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", background: "#DCFCE7", borderRadius: "999px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16A34A", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: 500 }}>IA disponível</span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px 210px" }}>
        <div style={{ textAlign: "center", maxWidth: "640px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg,var(--blue-500),var(--blue-800))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 28px rgba(30,107,184,.3)" }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: "16px", letterSpacing: "-.5px" }}>ies</span>
            </div>
          </div>
          <h1 style={{ fontSize: "30px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-.6px", marginBottom: "12px", fontFamily: "'Fraunces',serif" }}>Vamos montar uma proposta?</h1>
          <p style={{ fontSize: "15px", color: "var(--gray-500)", lineHeight: 1.65 }}>Descreva o cliente e a necessidade em linguagem natural. A IA seleciona os produtos do catálogo, redige o texto e gera o PDF no padrão Indeba Express.</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "28px", flexWrap: "wrap", justifyContent: "center" }}>
            {chips.map((c) => (
              <Hoverable key={c.text} base={chipBase} hover={chipHover} onClick={() => setBriefingText(c.prompt)}>
                {c.text}
              </Hoverable>
            ))}
          </div>
        </div>
      </div>

      <div style={{ position: "sticky", bottom: 0, padding: "16px 28px 28px", background: "linear-gradient(to top,var(--gray-50) 65%,transparent)", flex: "none" }}>
        <div style={{ maxWidth: "680px", margin: "0 auto" }}>
          <div style={{ background: "white", border: "1.5px solid var(--gray-200)", borderRadius: "16px", boxShadow: "var(--shadow-md)", display: "flex", alignItems: "flex-end", padding: "10px 10px 10px 16px", gap: "8px" }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gray-400)", padding: "6px", flex: "none", display: "flex" }} title="Anexar (em breve)">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M16.5 10.5l-7.5 7.5-6-6" />
                <path d="M1.5 1.5h6v6" />
                <path d="M7.5 1.5H3a1.5 1.5 0 00-1.5 1.5v12A1.5 1.5 0 003 16.5h12a1.5 1.5 0 001.5-1.5v-4.5" />
              </svg>
            </button>
            <textarea
              ref={textareaRef}
              value={briefingText}
              onChange={(e) => {
                const el = e.target;
                el.style.height = "auto";
                el.style.height = Math.min(el.scrollHeight, 120) + "px";
                setBriefingText(el.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  startGeneration();
                }
              }}
              placeholder="Descreva o cliente e a necessidade — ex.: Padaria em Lauro de Freitas. Precisa de detergente, desengordurante e álcool 70 para limpeza pesada da cozinha."
              style={{ flex: 1, border: "none", background: "transparent", resize: "none", fontSize: "14px", color: "var(--gray-900)", lineHeight: 1.55, padding: "4px 0", minHeight: "26px", maxHeight: "120px", overflow: "hidden", fontFamily: "'Inter',sans-serif" }}
              rows={1}
            />
            <Hoverable
              base={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--orange-500)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 2px 8px rgba(236,122,28,.4)", transition: "transform .12s ease,background .18s ease,box-shadow .18s ease" }}
              hover={{ background: "#D2680F", boxShadow: "0 4px 14px rgba(236,122,28,.55)", transform: "translateY(-1px)" }}
              active={{ transform: "translateY(0)", background: "#A8530C" }}
              onClick={startGeneration}
            >
              {quickLoading ? (
                <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8h10M8 3l5 5-5 5" />
                </svg>
              )}
            </Hoverable>
          </div>
          {error ? (
            <p style={{ textAlign: "center", fontSize: "12px", color: "#DC2626", marginTop: "10px" }}>{error}</p>
          ) : (
            <p style={{ textAlign: "center", fontSize: "11.5px", color: "var(--gray-400)", marginTop: "10px" }}>
              {quickLoading ? "Analisando o briefing e selecionando os produtos do catálogo…" : "O preço, a imagem e a ficha vêm sempre do catálogo — a IA só seleciona e escreve."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ TELA: LOADING ═══════════════════════ */

function LoadingScreen({ loadingStep }: { loadingStep: number }) {
  const progressPct = Math.min(Math.round((loadingStep / 4) * 100), 100);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "36px", padding: "48px", background: "var(--gray-50)" }}>
      <div style={{ display: "flex", gap: "9px", alignItems: "center", height: "32px" }}>
        {[0, 0.2, 0.4].map((d) => (
          <div key={d} style={{ width: "11px", height: "11px", borderRadius: "50%", background: "var(--blue-500)", animation: `wave 1.3s ease-in-out infinite ${d}s`, boxShadow: "0 0 0 3px rgba(30,107,184,.12)" }} />
        ))}
      </div>

      <div style={{ textAlign: "center", width: "100%", maxWidth: "400px" }}>
        <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-.4px", marginBottom: "6px" }}>{LOADING_MSGS[Math.min(loadingStep, 3)]}</div>
        <div style={{ fontSize: "14px", color: "var(--gray-400)", marginBottom: "20px" }}>Isso leva apenas alguns segundos.</div>
        <div style={{ height: "5px", background: "var(--gray-200)", borderRadius: "999px", overflow: "hidden" }}>
          <div style={{ height: "5px", borderRadius: "999px", background: "linear-gradient(to right, #1E6BB8, #EC7A1C)", width: progressPct + "%", transition: "width 0.7s cubic-bezier(.4,0,.2,1)" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "7px" }}>
          <span style={{ fontSize: "11.5px", color: "var(--gray-400)" }}>Processando…</span>
          <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--blue-500)" }}>{progressPct}%</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "7px", width: "100%", maxWidth: "380px" }}>
        {LOADING_LABELS.map((label, i) => {
          const done = loadingStep > i;
          const active = loadingStep === i;
          return (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "12px 16px",
                borderRadius: "10px",
                borderWidth: "1px",
                borderStyle: "solid",
                borderColor: done ? "#A7F3D0" : active ? "#A8CBEA" : "#E3EBF3",
                background: done ? "#F0FDF4" : active ? "#EAF2FA" : "white",
                boxShadow: active ? "0 0 0 3px rgba(30,107,184,.08), 0 1px 3px rgba(15,26,36,.06)" : "0 1px 2px rgba(15,26,36,.04)",
                transition: "all 0.35s cubic-bezier(.4,0,.2,1)",
                animation: done && loadingStep - 1 === i ? "stepIn .3s ease both" : "none",
              }}
            >
              <div style={{ width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? "#DCFCE7" : active ? "#D2E4F4" : "#EEF3F8", transition: "background 0.3s ease" }}>
                {done ? (
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="#16A34A" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1.5 6.5l3.5 3.5 6.5-7" />
                  </svg>
                ) : active ? (
                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#1E6BB8", animation: "pulse 1s ease-in-out infinite" }} />
                ) : (
                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#CBD7E3" }} />
                )}
              </div>
              <span style={{ fontSize: "14px", flex: 1, color: done ? "#16A34A" : active ? "#1E6BB8" : "#94A6B8", fontWeight: done ? 600 : active ? 700 : 400, transition: "color 0.3s ease" }}>{label}</span>
              <div style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "999px", background: done ? "#DCFCE7" : active ? "#D2E4F4" : "#EEF3F8", color: done ? "#16A34A" : active ? "#1E6BB8" : "#CBD7E3", transition: "all 0.3s ease" }}>{done ? "Concluído" : active ? "Em andamento" : "Aguardando"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════ TELA: REVIEW ═══════════════════════ */

function ReviewScreen({
  reviewVariant,
  setReviewVariant,
  scope,
  excluded,
  includedItems,
  total,
  toggleProduct,
  changeQty,
  goToBriefing,
  goToPDF,
}: {
  reviewVariant: "A" | "B";
  setReviewVariant: (v: "A" | "B") => void;
  scope: PropostaScope;
  excluded: Set<string>;
  includedItems: PropostaItem[];
  total: number;
  toggleProduct: (codigo: string) => void;
  changeQty: (codigo: string, d: number) => void;
  goToBriefing: () => void;
  goToPDF: () => void;
}) {
  const vTab = (v: "A" | "B"): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "6px 13px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: reviewVariant === v ? 600 : 400,
    background: reviewVariant === v ? "#0E3A5F" : "transparent",
    color: reviewVariant === v ? "white" : "#5B6E7D",
    fontFamily: "Inter,sans-serif",
  });

  const orangeBtn: CSSProperties = { display: "flex", alignItems: "center", gap: "7px", padding: "8px 18px", background: "var(--orange-500)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "white", boxShadow: "0 2px 8px rgba(236,122,28,.35)", transition: "transform .12s ease,background .18s ease,box-shadow .18s ease" };
  const orangeHover: CSSProperties = { background: "#D2680F", boxShadow: "0 4px 14px rgba(236,122,28,.5)", transform: "translateY(-1px)" };
  const orangeActive: CSSProperties = { transform: "translateY(0)", background: "#A8530C" };

  const qtyBtn: CSSProperties = { width: "26px", height: "26px", borderRadius: "6px", border: "1px solid var(--gray-200)", background: "white", cursor: "pointer", fontSize: "15px", color: "var(--gray-500)", display: "flex", alignItems: "center", justifyContent: "center" };
  const qtyBtnSm: CSSProperties = { ...qtyBtn, width: "24px", height: "24px", borderRadius: "5px", fontSize: "13px" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--gray-50)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: "56px", background: "white", borderBottom: "1px solid var(--gray-200)", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={goToBriefing} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--gray-200)", background: "white", cursor: "pointer", fontSize: "13px", color: "var(--gray-500)" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2L3 6.5 8 11" />
            </svg>
            Nova proposta
          </button>
          <div>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--gray-900)" }}>Revisão da proposta</span>
            <span style={{ fontSize: "12px", color: "var(--gray-400)", marginLeft: "10px" }}>{scope.cliente.razaoSocial} · {includedItems.length} produtos selecionados</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", background: "var(--gray-100)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
            <button onClick={() => setReviewVariant("A")} style={vTab("A")}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
                <rect x="1" y="1" width="4.5" height="4.5" rx="1" />
                <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" />
                <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" />
                <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" />
              </svg>
              Cards
            </button>
            <button onClick={() => setReviewVariant("B")} style={vTab("B")}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round">
                <path d="M1 3h11M1 6.5h11M1 10h11" />
              </svg>
              Tabela
            </button>
          </div>
          <Hoverable base={orangeBtn} hover={orangeHover} active={orangeActive} onClick={goToPDF}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 1.5v8M4.5 7l3 3 3-3" />
              <path d="M1.5 12.5h12" />
            </svg>
            Gerar PDF
          </Hoverable>
        </div>
      </div>

      {/* Texto de apresentação (IA-TEXTO) */}
      {scope.textoApresentacao.conteudo && (
        <div style={{ flex: "none", padding: "14px 28px 0" }}>
          <div style={{ background: "white", border: "1px solid var(--gray-200)", borderLeft: "3px solid var(--blue-500)", borderRadius: "8px", padding: "12px 16px", display: "flex", gap: "10px", boxShadow: "var(--shadow-sm)" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--blue-500)", background: "var(--blue-50)", borderRadius: "999px", padding: "2px 8px", height: "fit-content", whiteSpace: "nowrap" }}>{scope.textoApresentacao.procedencia}</span>
            <p style={{ fontSize: "13px", color: "var(--gray-500)", lineHeight: 1.55, margin: 0 }}>{scope.textoApresentacao.conteudo}</p>
          </div>
        </div>
      )}

      <div className="ies-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {reviewVariant === "A" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
            {scope.itens.map((p) => {
              const included = !excluded.has(p.codigo);
              return (
                <Hoverable
                  key={p.codigo}
                  as="div"
                  base={{ background: "white", borderRadius: "12px", borderWidth: "1px", borderStyle: included ? "solid" : "dashed", borderColor: included ? "#E3EBF3" : "#CBD7E3", padding: "16px", display: "flex", flexDirection: "column", opacity: included ? 1 : 0.5, boxShadow: "0 1px 2px rgba(15,26,36,.06)", transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease, opacity .25s ease" }}
                  hover={{ transform: "translateY(-3px)", boxShadow: "0 10px 24px rgba(15,26,36,.1)" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "12px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: procColor(p.procedenciaSelecao), flexShrink: 0 }} />
                    <span style={{ fontSize: "11px", color: "var(--gray-500)", fontWeight: 500 }}>{procLabel(p.procedenciaSelecao)}</span>
                    <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--gray-400)", background: "var(--gray-100)", padding: "2px 7px", borderRadius: "4px" }}>{p.codigo}</span>
                  </div>
                  <div style={{ width: "100%", height: "90px", background: "var(--gray-100)", borderRadius: "8px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.imagemPath} alt={p.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} onError={(e) => ((e.currentTarget.style.display = "none"))} />
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "4px", lineHeight: 1.3 }}>{p.nome}</div>
                  <div style={{ fontSize: "12.5px", color: "var(--gray-500)", lineHeight: 1.5, marginBottom: "12px", flex: 1 }}>{p.descricaoUso}</div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", background: "var(--gray-100)", borderRadius: "999px", marginBottom: "10px", width: "fit-content" }} title="Preço e ficha vêm do catálogo">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#94A6B8" strokeWidth={1.5}>
                      <path d="M1 2h8M1 5h8M1 8h5" />
                    </svg>
                    <span style={{ fontSize: "11px", color: "var(--gray-500)", fontWeight: 500 }}>Catálogo</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid var(--gray-100)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <button onClick={() => changeQty(p.codigo, -1)} style={qtyBtn}>−</button>
                      <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", minWidth: "18px", textAlign: "center" }}>{p.quantidade}</span>
                      <button onClick={() => changeQty(p.codigo, 1)} style={qtyBtn}>+</button>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--blue-500)" }}>{fmt(precoUnit(p))}</div>
                      <div style={{ fontSize: "11px", color: "var(--gray-400)" }}>/ {unidadeDe(p)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleProduct(p.codigo)}
                    style={{ marginTop: "10px", width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid " + (included ? "#A7F3D0" : "#E3EBF3"), background: included ? "#DCFCE7" : "#F7F9FC", color: included ? "#16A34A" : "#94A6B8", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "Inter,sans-serif" }}
                  >
                    {included ? "✓ Incluído" : "+ Incluir"}
                  </button>
                </Hoverable>
              );
            })}
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--gray-200)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 110px 110px 100px", padding: "11px 20px", background: "var(--gray-100)", borderBottom: "1px solid var(--gray-200)" }}>
              {["Produto", "Origem", "Qtd", "Preço unit.", "Total", "Status"].map((h, i) => (
                <div key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".05em", textAlign: i === 2 || i === 5 ? "center" : i === 3 || i === 4 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {scope.itens.map((p) => {
              const included = !excluded.has(p.codigo);
              return (
                <div key={p.codigo} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 110px 110px 100px", padding: "13px 20px", borderBottom: "1px solid #EEF3F8", alignItems: "center", background: included ? "#FFFFFF" : "#F7F9FC", opacity: included ? 1 : 0.45 }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-900)" }}>{p.nome}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--gray-400)", marginTop: "2px" }}>{p.codigo} · {unidadeDe(p)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: procColor(p.procedenciaSelecao), flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>{procLabel(p.procedenciaSelecao)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                    <button onClick={() => changeQty(p.codigo, -1)} style={qtyBtnSm}>−</button>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", minWidth: "16px", textAlign: "center" }}>{p.quantidade}</span>
                    <button onClick={() => changeQty(p.codigo, 1)} style={qtyBtnSm}>+</button>
                  </div>
                  <div style={{ textAlign: "right", fontSize: "13.5px", color: "var(--gray-500)" }}>{fmt(precoUnit(p))}</div>
                  <div style={{ textAlign: "right", fontSize: "13.5px", fontWeight: 700, color: "var(--blue-500)" }}>{fmt(precoUnit(p) * p.quantidade)}</div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button onClick={() => toggleProduct(p.codigo)} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", background: included ? "#DCFCE7" : "#EEF3F8", color: included ? "#16A34A" : "#94A6B8", fontSize: "12px", fontWeight: 600, fontFamily: "Inter,sans-serif", whiteSpace: "nowrap" }}>{included ? "✓ Incluído" : "+ Incluir"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ flex: "none", padding: "14px 28px", background: "white", borderTop: "1px solid var(--gray-200)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: "14px", color: "var(--gray-500)" }}>
          <strong style={{ color: "var(--gray-900)" }}>{includedItems.length} produtos</strong> incluídos · ajuste a seleção acima
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11.5px", color: "var(--gray-400)" }}>Total estimado</div>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-.5px" }}>{fmt(total)}</div>
          </div>
          <Hoverable
            base={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 24px", background: "var(--orange-500)", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "15px", fontWeight: 600, color: "white", boxShadow: "0 4px 16px rgba(236,122,28,.35)", transition: "transform .12s ease,background .18s ease,box-shadow .18s ease" }}
            hover={{ background: "#D2680F", boxShadow: "0 6px 20px rgba(236,122,28,.5)", transform: "translateY(-1px)" }}
            active={{ transform: "translateY(0)", background: "#A8530C" }}
            onClick={goToPDF}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1.5v9M5 8l3 3 3-3" />
              <path d="M1.5 13h13" />
            </svg>
            Gerar PDF
          </Hoverable>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ TELA: PDF PREVIEW ═══════════════════════ */

function PdfScreen({
  scope,
  includedItems,
  total,
  downloading,
  baixarPdf,
  goToReview,
  error,
}: {
  scope: PropostaScope;
  includedItems: PropostaItem[];
  total: number;
  downloading: boolean;
  baixarPdf: () => void;
  goToReview: () => void;
  error: string | null;
}) {
  const c = scope.condicoesComerciais;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");

  return (
    <div style={{ background: "#DDE1E7", minHeight: "100vh", padding: "28px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <button onClick={goToReview} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #B0BAC5", background: "white", cursor: "pointer", fontSize: "13px", color: "var(--gray-500)" }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2L3 6.5 8 11" />
          </svg>
          Voltar e editar
        </button>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {error && <span style={{ fontSize: "12px", color: "#DC2626" }}>{error}</span>}
          <Hoverable
            base={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 18px", borderRadius: "8px", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--gray-200)", background: "white", cursor: downloading ? "wait" : "pointer", fontSize: "14px", fontWeight: 500, color: "var(--gray-900)", opacity: downloading ? 0.7 : 1 }}
            hover={downloading ? {} : { borderColor: "var(--blue-500)", color: "var(--blue-500)" }}
            onClick={baixarPdf}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7.5 1.5v8M4.5 7l3 3 3-3" />
              <path d="M1.5 12.5h12" />
            </svg>
            {downloading ? "Gerando…" : "Baixar PDF"}
          </Hoverable>
          <button style={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 18px", borderRadius: "8px", border: "1px solid var(--blue-500)", background: "var(--blue-500)", cursor: "not-allowed", fontSize: "14px", fontWeight: 600, color: "white", opacity: 0.55 }} title="Envio por e-mail — em breve">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 7.5A5.5 5.5 0 112 7.5" />
              <path d="M7.5 1.5v5M5 4l2.5 2.5L10 4" />
            </svg>
            Enviar por e-mail
          </button>
          <Hoverable
            base={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 18px", borderRadius: "8px", border: "none", background: "var(--orange-500)", cursor: downloading ? "wait" : "pointer", fontSize: "14px", fontWeight: 600, color: "white", boxShadow: "0 2px 8px rgba(236,122,28,.35)", transition: "transform .12s ease,background .18s ease,box-shadow .18s ease", opacity: downloading ? 0.8 : 1 }}
            hover={downloading ? {} : { background: "#D2680F", boxShadow: "0 4px 14px rgba(236,122,28,.5)", transform: "translateY(-1px)" }}
            active={{ transform: "translateY(0)", background: "#A8530C" }}
            onClick={baixarPdf}
          >
            {downloading ? "Gerando…" : "Gerar PDF"}
          </Hoverable>
        </div>
      </div>

      {/* Documento A4 — espelha o template-orcamento.ts (modelo ERP, ref. GVA) */}
      <div style={{ maxWidth: "820px", margin: "0 auto", background: "white", boxShadow: "0 8px 40px rgba(0,0,0,.18)", borderRadius: "2px", padding: "40px 44px", color: "#25303f", fontSize: "12px" }}>
        {/* topo: data / nº */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: "var(--gray-500)", paddingBottom: "10px" }}>
          <span>{data}</span>
          <span style={{ color: "#25303f", fontSize: "15px" }}>Orçamento <strong style={{ color: "var(--blue-800)", fontWeight: 800 }}>{numeroDoc(scope.id)}</strong></span>
        </div>

        {/* cabeçalho empresa */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", borderBottom: "2px solid var(--gray-200)", paddingBottom: "14px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div style={{ width: "54px", height: "54px", flex: "none", borderRadius: "8px", background: "linear-gradient(135deg,var(--blue-500),var(--blue-800))", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: "18px", letterSpacing: "-.5px" }}>ies</div>
            <div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--blue-800)" }}>INDEBA EXPRESS</div>
              <div style={{ fontSize: "9.5px", color: "var(--gray-500)", lineHeight: 1.5, maxWidth: "340px", marginTop: "2px" }}>Rua Cosme de Farias, 05 - Galpão 01 - Boca do Rio - Salvador - BA - CEP: 41710-010</div>
              <div style={{ fontSize: "9.5px", color: "var(--gray-400)", textTransform: "uppercase", marginTop: "2px" }}>IES Equipamentos, Soluções e Produtos de Limpeza Ltda</div>
              <div style={{ fontSize: "9.5px", color: "var(--gray-400)", marginTop: "2px" }}>CNPJ: 13.313.568/0001-04&nbsp;&nbsp;IE: 150336336</div>
            </div>
          </div>
          <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--blue-800)" }}>(71) 3369-2306</div>
            <div style={{ fontSize: "10px", color: "var(--gray-500)", marginTop: "4px" }}>gerencia@indebaexpress.com.br</div>
          </div>
        </div>

        {/* caixa do cliente */}
        <div style={{ display: "flex", gap: "16px", borderWidth: "1px", borderStyle: "solid", borderColor: "#d8e0ea", borderRadius: "6px", padding: "14px 16px", margin: "16px 0 8px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--blue-800)" }}>{scope.cliente.razaoSocial}</div>
            {scope.cliente.cnpj && <div style={{ fontSize: "10.5px", color: "var(--gray-500)", marginTop: "3px" }}>CNPJ: {scope.cliente.cnpj}</div>}
            {scope.cliente.segmento && <div style={{ fontSize: "10.5px", color: "var(--gray-500)", marginTop: "3px", textTransform: "capitalize" }}>{scope.cliente.segmento.replace(/_/g, " ")}</div>}
          </div>
          <div style={{ width: "210px", flex: "none", borderLeft: "1px solid var(--gray-200)", paddingLeft: "16px" }}>
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--blue-800)" }}>Validade da proposta</div>
              <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "1px" }}>{c.validade}</div>
            </div>
            <div>
              <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--blue-800)" }}>Previsão de entrega</div>
              <div style={{ fontSize: "11px", color: "var(--gray-500)", marginTop: "1px" }}>{c.prazoEntrega}</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: "10.5px", color: "var(--gray-500)", margin: "8px 0 14px" }}>Contrato de comodato 12 meses</div>

        {/* tabela ERP */}
        <div style={{ display: "grid", gridTemplateColumns: "40px 2.1fr 3fr 92px 92px", padding: "9px 4px", background: "#f1f4f8", borderBottom: "1px solid #d8e0ea" }}>
          {[
            { t: "Qt.", a: "center" },
            { t: "Produto/Serviço", a: "left" },
            { t: "Detalhe do item", a: "left" },
            { t: "Valor unitário", a: "right" },
            { t: "Subtotal", a: "right" },
          ].map((h) => (
            <div key={h.t} style={{ fontSize: "9px", fontWeight: 700, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".4px", textAlign: h.a as CSSProperties["textAlign"], padding: "0 5px" }}>{h.t}</div>
          ))}
        </div>
        {includedItems.map((p) => {
          const e = p.embalagens[0];
          return (
            <div key={p.codigo} style={{ display: "grid", gridTemplateColumns: "40px 2.1fr 3fr 92px 92px", padding: "9px 4px", borderBottom: "1px solid #eef2f7", alignItems: "start" }}>
              <div style={{ textAlign: "center", padding: "0 5px" }}>{p.quantidade}</div>
              <div style={{ padding: "0 5px", lineHeight: 1.35 }}>
                <span style={{ color: "var(--gray-400)" }}>{p.codigo}</span> - <strong style={{ color: "#25303f" }}>{p.nome}</strong>
              </div>
              <div style={{ padding: "0 5px", fontSize: "9.5px", color: "var(--gray-500)", lineHeight: 1.45 }}>
                {p.descricaoUso}
                {e && <span style={{ color: "var(--gray-400)" }}> · emb. {e.tamanho} {e.unidade}</span>}
              </div>
              <div style={{ textAlign: "right", padding: "0 5px" }}>{dec(precoUnit(p))}</div>
              <div style={{ textAlign: "right", padding: "0 5px" }}>{dec(precoUnit(p) * p.quantidade)}</div>
            </div>
          );
        })}

        {/* totais */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "230px", padding: "6px 5px", borderTop: "1px solid #eef2f7" }}>
            <span style={{ color: "var(--gray-500)" }}>Total</span>
            <span style={{ fontWeight: 800, color: "var(--blue-800)" }}>{dec(total)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", width: "230px", padding: "6px 5px", borderTop: "2px solid #d8e0ea" }}>
            <span style={{ color: "var(--blue-800)", fontWeight: 700 }}>Valor líquido</span>
            <span style={{ fontWeight: 800, color: "var(--blue-800)", fontSize: "14px" }}>{dec(total)}</span>
          </div>
        </div>

        {/* forma de pagamento */}
        <div style={{ marginTop: "18px", borderTop: "1px solid var(--gray-200)", paddingTop: "10px" }}>
          <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--blue-800)" }}>Forma de pagamento:</div>
          <div style={{ fontSize: "10.5px", color: "var(--gray-500)", marginTop: "2px" }}>{c.pagamento}{c.frete ? ` · Frete: ${c.frete}` : ""}</div>
        </div>
      </div>

      <p style={{ textAlign: "center", fontSize: "11.5px", color: "var(--gray-500)", marginTop: "16px" }}>Pré-visualização fiel — o PDF final é gerado pelo servidor a partir desta mesma proposta.</p>
    </div>
  );
}

/* ═══════════════════════ TELA: HISTORY ═══════════════════════ */

function HistoryScreen({ propostas, erro, goToBriefing }: { propostas: PropostaLog[] | null; erro: string | null; goToBriefing: () => void }) {
  const cols = "2fr 1fr 90px 110px 110px 120px 80px";
  const lista = propostas ?? [];
  const totalFaturado = lista.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const totalItens = lista.reduce((s, p) => s + p.itens.length, 0);
  const clientes = new Set(lista.map((p) => p.cliente)).size;
  const stats = [
    { label: "Propostas", value: String(lista.length), color: "var(--gray-900)" },
    { label: "Clientes", value: String(clientes), color: "var(--blue-500)" },
    { label: "Itens", value: String(totalItens), color: "#16A34A" },
    { label: "Faturamento", value: fmt(totalFaturado), color: "var(--gray-900)" },
  ];

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-.4px" }}>Propostas</h2>
          <div style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "3px" }}>{propostas === null ? "Carregando…" : `${lista.length} proposta(s) gerada(s)`}</div>
        </div>
        <Hoverable
          base={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", background: "var(--orange-500)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "white", boxShadow: "0 2px 8px rgba(236,122,28,.35)", transition: "transform .12s ease,background .18s ease,box-shadow .18s ease" }}
          hover={{ background: "#D2680F", boxShadow: "0 4px 14px rgba(236,122,28,.5)", transform: "translateY(-1px)" }}
          active={{ transform: "translateY(0)", background: "#A8530C" }}
          onClick={goToBriefing}
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
            <path d="M7.5 1.5v12M1.5 7.5h12" />
          </svg>
          Nova proposta
        </Hoverable>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "24px" }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "white", borderRadius: "12px", border: "1px solid var(--gray-200)", padding: "16px 20px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "12px", color: "var(--gray-500)", fontWeight: 500, marginBottom: "4px" }}>{s.label}</div>
            <div style={{ fontSize: "26px", fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {erro ? (
        <div style={{ textAlign: "center", padding: "60px 40px", color: "#DC2626", fontSize: "14px" }}>Não foi possível carregar o histórico: {erro}</div>
      ) : propostas !== null && lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 40px" }}>
          <div style={{ width: "72px", height: "72px", background: "var(--gray-100)", borderRadius: "16px", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD7E3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 6h22M5 12h22M5 18h14" />
            </svg>
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "8px" }}>Nenhuma proposta ainda</h3>
          <p style={{ fontSize: "14px", color: "var(--gray-500)" }}>Gere a primeira proposta para ela aparecer aqui.</p>
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--gray-200)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, padding: "11px 20px", background: "var(--gray-100)", borderBottom: "1px solid var(--gray-200)" }}>
            {[
              { t: "Cliente", a: "left" },
              { t: "Segmento", a: "left" },
              { t: "Data", a: "left" },
              { t: "Status", a: "center" },
              { t: "Produtos", a: "center" },
              { t: "Valor", a: "right" },
              { t: "", a: "left" },
            ].map((h, i) => (
              <div key={i} style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".05em", textAlign: h.a as CSSProperties["textAlign"] }}>{h.t}</div>
            ))}
          </div>
          {lista.map((p, idx) => {
            const data = new Date(p.ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
            return (
              <Hoverable
                key={p.propostaId + idx}
                as="div"
                base={{ display: "grid", gridTemplateColumns: cols, padding: "13px 20px", borderBottom: "1px solid var(--gray-100)", alignItems: "center", transition: "background .15s ease" }}
                hover={{ background: "var(--gray-50)" }}
              >
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-900)" }}>{p.cliente}</div>
                <div style={{ fontSize: "13px", color: "var(--gray-500)", textTransform: "capitalize" }}>{p.segmento ? p.segmento.replace(/_/g, " ") : "—"}</div>
                <div style={{ fontSize: "13px", color: "var(--gray-400)" }}>{data}</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 600, background: "#DCFCE7", color: "#16A34A" }}>Gerada</span>
                </div>
                <div style={{ textAlign: "center", fontSize: "13px", color: "var(--gray-500)" }}>{p.itens.length} itens</div>
                <div style={{ textAlign: "right", fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{fmt(Number(p.total) || 0)}</div>
                <div />
              </Hoverable>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ TELA: CATALOG ═══════════════════════ */

function CatalogScreen({
  catalogo,
  erro,
  catFilter,
  setCatFilter,
}: {
  catalogo: Produto[] | null;
  erro: string | null;
  catFilter: string;
  setCatFilter: (c: string) => void;
}) {
  const todos = catalogo ?? [];
  const ativos = todos.filter((p) => p.ativo);
  const linhas = Array.from(new Set(ativos.map((p) => humaniza(p.linha))));
  const allCats = ["Todos", ...linhas, "Arquivados"];

  const filtered =
    catFilter === "Todos"
      ? ativos
      : catFilter === "Arquivados"
        ? todos.filter((p) => !p.ativo)
        : ativos.filter((p) => humaniza(p.linha) === catFilter);

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "22px" }}>
        <div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "var(--gray-900)", letterSpacing: "-.4px" }}>Catálogo</h2>
          <div style={{ fontSize: "14px", color: "var(--gray-500)", marginTop: "3px" }}>{catalogo === null ? "Carregando…" : `${filtered.length} produtos · Higiene & Limpeza`}</div>
        </div>
        <Hoverable
          base={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", background: "var(--blue-500)", border: "none", borderRadius: "8px", cursor: "not-allowed", fontSize: "14px", fontWeight: 600, color: "white", boxShadow: "0 2px 8px rgba(30,107,184,.3)", opacity: 0.6 }}
          title="Cadastro de produto — em breve"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
            <path d="M7.5 1.5v12M1.5 7.5h12" />
          </svg>
          Novo produto
        </Hoverable>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "9px 14px", flex: 1, minWidth: "200px", maxWidth: "300px" }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#94A6B8" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="M10 10l3 3" />
          </svg>
          <input type="text" placeholder="Buscar produto ou SKU..." style={{ border: "none", background: "transparent", fontSize: "14px", color: "var(--gray-900)", flex: 1, fontFamily: "'Inter',sans-serif" }} />
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {allCats.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              style={{ padding: "5px 14px", borderRadius: "999px", border: "1px solid " + (catFilter === cat ? "#1E6BB8" : "#E3EBF3"), cursor: "pointer", fontSize: "13px", fontWeight: catFilter === cat ? 600 : 400, background: catFilter === cat ? "#EAF2FA" : "white", color: catFilter === cat ? "#1E6BB8" : "#5B6E7D", fontFamily: "Inter,sans-serif" }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {erro ? (
        <div style={{ textAlign: "center", padding: "60px 40px", color: "#DC2626", fontSize: "14px" }}>Não foi possível carregar o catálogo: {erro}</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 40px" }}>
          <div style={{ width: "72px", height: "72px", background: "var(--gray-100)", borderRadius: "16px", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="#CBD7E3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="6" width="24" height="20" rx="3" />
              <path d="M10 13h12M10 18h8" />
            </svg>
          </div>
          <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "8px" }}>{catalogo === null ? "Carregando catálogo…" : "Nenhum produto encontrado"}</h3>
          <p style={{ fontSize: "14px", color: "var(--gray-500)" }}>Tente outro filtro ou adicione um produto ao catálogo.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" }}>
          {filtered.map((item) => {
            const e = item.embalagens[0];
            return (
              <Hoverable
                key={item.codigo}
                as="div"
                base={{ background: "white", borderRadius: "12px", borderWidth: "1px", borderStyle: "solid", borderColor: "var(--gray-200)", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "var(--shadow-sm)", transition: "transform .18s ease,box-shadow .18s ease,border-color .18s ease" }}
                hover={{ transform: "translateY(-3px)", boxShadow: "0 10px 24px rgba(15,26,36,.1)", borderColor: "var(--gray-300)" }}
              >
                <div style={{ height: "3px", background: linhaCor(item.linha) }} />
                <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: linhaCor(item.linha), flexShrink: 0 }} />
                      <span style={{ fontSize: "11px", color: "var(--gray-500)", fontWeight: 500 }}>{humaniza(item.linha)}</span>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: item.ativo ? "#16A34A" : "#94A6B8" }}>{item.ativo ? "Ativo" : "Arquivado"}</span>
                  </div>
                  <div style={{ width: "100%", height: "72px", background: "var(--gray-100)", borderRadius: "8px", marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.imagemPath} alt={item.nome} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} onError={(ev) => ((ev.currentTarget.style.display = "none"))} />
                  </div>
                  <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--gray-900)", marginBottom: "2px", lineHeight: 1.3 }}>{item.nome}</div>
                  <div style={{ fontSize: "11.5px", color: "var(--gray-400)", flex: 1, marginBottom: "10px" }}>SKU: {item.codigo}</div>
                  <div style={{ paddingTop: "10px", borderTop: "1px solid var(--gray-100)", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--blue-500)" }}>{e ? fmt(Number(e.preco)) : "—"}</div>
                    <div style={{ fontSize: "11px", color: "var(--gray-400)" }}>/ {e ? `${e.tamanho} ${e.unidade}` : "un"}</div>
                  </div>
                </div>
              </Hoverable>
            );
          })}
        </div>
      )}
    </div>
  );
}
