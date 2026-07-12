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

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { PropostaScope, PropostaItem, Produto, Prospect, Abordagem, ProspeccaoResponse, InstagramResponse, PostInstagram, TomPost, FinanceiroResponse, ContratoScope, ContratoAnalise, RagResposta, CobrancaResponse, ComprasResponse, FiscalResponse, ContabilResponse, PerfilEstilo, ItemRejeitado, OrcamentoImportResponse, ComandoEdicao } from "@/lib/contracts";
import { setPrecoEmbalagem, setClienteCampo, setQuantidadeAbsoluta, setCondicaoComercial, cortarParaOrcamento } from "@/lib/proposta-edit";
import { AjudaChat } from "@/components/ajuda-chat";
import { EdicaoChat } from "@/components/edicao-chat";
import { ChamadosScreen } from "@/components/chamados-screen";
import { AdminScreen } from "@/components/admin-screen";
import { useToast } from "./_app/toast";
import { CommandPalette, type PaletteItem } from "./_app/command-palette";

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
    // Div clicável vira botão acessível: foco por teclado + Enter/Espaço aciona.
    const clicavel = typeof onClick === "function";
    return (
      <div
        style={style}
        onClick={onClick}
        title={title}
        role={clicavel ? "button" : undefined}
        tabIndex={clicavel ? 0 : undefined}
        onKeyDown={
          clicavel
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick?.();
                }
              }
            : undefined
        }
        {...handlers}
      >
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

/* ── Chrome global: ações do header (busca/assistente) compartilhadas com as telas ── */
const ChromeContext = createContext<{ openPalette: () => void; openAssistant: () => void }>({
  openPalette: () => {},
  openAssistant: () => {},
});

/* tipo do registro do histórico (espelha EventoProposta da API, sem importar node) */
type StatusProposta = "rascunho" | "em_edicao" | "enviada" | "aprovada" | "recusada";
// Espelha PropostaResumo (src/lib/contracts/proposta.ts): proposta persistida + status.
type PropostaLog = {
  id: string;
  status: StatusProposta;
  autor: string;
  cliente: string;
  segmento: string | null;
  tipo: string;
  total: string;
  qtdItens: number;
  criadoEm: string;
  atualizadoEm: string;
};

// Status comercial → rótulo + cores do badge. Eixo separado do scope.status (documento).
const STATUS_UI: Record<StatusProposta, { label: string; bg: string; fg: string }> = {
  rascunho: { label: "Rascunho", bg: "#F1F5F9", fg: "#64748B" },
  em_edicao: { label: "Em edição", bg: "#FEF3C7", fg: "#B45309" },
  enviada: { label: "Enviada", bg: "#DBEAFE", fg: "#2563EB" },
  aprovada: { label: "Aprovada", bg: "#DCFCE7", fg: "#16A34A" },
  recusada: { label: "Recusada", bg: "#FEE2E2", fg: "#DC2626" },
};

const LOADING_MSGS = ["Analisando o briefing...", "Buscando no catálogo...", "Selecionando produtos...", "Finalizando a proposta..."];
const LOADING_LABELS = ["Briefing analisado", "Catálogo consultado", "Produtos selecionados", "Proposta montada"];

type Screen = "dashboard" | "briefing" | "manual" | "importar" | "loading" | "review" | "pdf" | "history" | "catalog" | "prospeccao" | "instagram" | "financeiro" | "contrato" | "atendimento" | "cobranca" | "compras" | "fiscal" | "contabil" | "chamados" | "config";
type TipoProposta = "orcamento" | "implantacao" | "comercial" | "consolidada";

// Tipos de proposta → estrutura do PDF (render.ts roteia por tipo). O vendedor escolhe.
const TIPOS: { value: TipoProposta; label: string; hint: string }[] = [
  { value: "orcamento", label: "Orçamento", hint: "Tabela ERP enxuta" },
  { value: "implantacao", label: "Implantação", hint: "Express, 1 produto/página" },
  { value: "comercial", label: "Comercial", hint: "Fabricante, institucional" },
  { value: "consolidada", label: "Proposta de Solução", hint: "IES, 1 página rica/produto" },
];
const tipoLabel = (t: string) => TIPOS.find((x) => x.value === t)?.label ?? "Orçamento";
// Só "consolidada" é oferecida na criação (pedido do Gustavo, jul/2026) — os outros tipos
// continuam no código intactos (propostas antigas com esses tipos abrem/exportam normal).
const TIPOS_SELECIONAVEIS = TIPOS.filter((t) => t.value === "consolidada");

// Itens da command palette (Ctrl/Cmd+K) — só telas reais.
const CMD_ITEMS: PaletteItem[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "briefing", label: "Nova proposta" },
  { key: "manual", label: "Proposta manual" },
  { key: "importar", label: "Importar orçamento" },
  { key: "history", label: "Propostas" },
  { key: "catalog", label: "Catálogo" },
  { key: "config", label: "Configurações" },
];

/* ───────────────────────── componente principal ───────────────────────── */

export default function Home() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const toast = useToast();
  const [palette, setPalette] = useState(false);
  const [reviewVariant, setReviewVariant] = useState<"A" | "B">("A");
  const [briefingText, setBriefingText] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scope, setScope] = useState<PropostaScope | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  const [tipoProposta, setTipoProposta] = useState<TipoProposta>("consolidada");
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

  // Command palette: Ctrl/Cmd+K alterna o overlay de navegação.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

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

  async function startGeneration(textoOverride?: string, prospect?: ProspectParaProposta) {
    // textoOverride: gerar a partir de um texto explícito (ex.: vindo da prospecção),
    // sem depender do setState assíncrono de briefingText. Guard porque a UI também
    // chama startGeneration direto no onClick (passando o evento como argumento).
    // prospect: quando vem da prospecção, os dados do cliente já estão estruturados
    // (não re-extrai por heurística) e a "dor" personaliza o texto da proposta.
    const texto = (typeof textoOverride === "string" ? textoOverride : briefingText).trim();
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
      const body = prospect
        ? {
            briefing: texto,
            razaoSocial: prospect.razaoSocial,
            cnpj: null,
            segmento: prospect.segmento,
            tipo: "comercial" as const, // prospecção = abordagem fria → apresentação institucional
            contextoProspeccao: prospect.contexto,
          }
        : { briefing: texto, razaoSocial: parseCliente(texto), cnpj: null, segmento: null, tipo: tipoProposta };
      const r = await fetch("/api/montar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      toast("Proposta montada — revise os produtos", "success");
      persistirProposta(novo); // auto-save: proposta gerada já vira registro (rascunho)
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
  // Preço editável pelo vendedor na revisão (override da 1ª embalagem). Catálogo
  // permanece intacto; o override vive no PropostaScope (vira PDF/contrato).
  function editarPreco(codigo: string, idx: number, valor: string) {
    setScope((s) => (s ? setPrecoEmbalagem(s, codigo, idx, valor) : s));
  }
  function toggleProduct(codigo: string) {
    setExcluded((ex) => {
      const next = new Set(ex);
      if (next.has(codigo)) next.delete(codigo);
      else next.add(codigo);
      return next;
    });
  }

  // Edição manual do texto pelo funcionário (constituição §6: a IA é sempre revisável).
  function editarTexto(novo: string) {
    setScope((s) => (s ? { ...s, textoApresentacao: { conteudo: novo, procedencia: "MANUAL" } } : s));
  }

  // Aplicação determinística do chat de correção (EdicaoChat): a IA já classificou a
  // ação e resolveu o item/campo alvo (rota /api/comando-edicao); aqui só chamamos os
  // MESMOS setters que os controles manuais da Revisão usam. Preço/quantidade sempre
  // do `numero` extraído por regex da mensagem original — nunca de um campo da IA.
  function aplicarComandoChat(r: { comando: ComandoEdicao; numero: string | null; itemResolvido: PropostaItem | null; itensSelecionados: PropostaItem[] | null }): string | void {
    const { comando, numero, itemResolvido, itensSelecionados } = r;
    switch (comando.acao) {
      case "alterar_razao_social":
        if (comando.valorTexto) setScope((s) => (s ? setClienteCampo(s, "razaoSocial", comando.valorTexto!) : s));
        break;
      case "alterar_cnpj":
        if (comando.valorTexto) setScope((s) => (s ? setClienteCampo(s, "cnpj", comando.valorTexto!) : s));
        break;
      case "alterar_segmento":
        if (comando.valorTexto) setScope((s) => (s ? setClienteCampo(s, "segmento", comando.valorTexto!) : s));
        break;
      case "alterar_responsavel_cliente":
        if (comando.valorTexto) setScope((s) => (s ? setClienteCampo(s, "responsavel", comando.valorTexto!) : s));
        break;
      case "alterar_quantidade_item":
        if (comando.codigoItem && numero) setScope((s) => (s ? setQuantidadeAbsoluta(s, comando.codigoItem!, Number(numero.replace(",", "."))) : s));
        break;
      case "remover_item":
        if (comando.codigoItem) toggleProduct(comando.codigoItem);
        break;
      case "adicionar_item_catalogo":
        if (itemResolvido) setScope((s) => (s ? { ...s, itens: [...s.itens, itemResolvido] } : s));
        break;
      case "alterar_preco_item":
        if (comando.codigoItem && numero) editarPreco(comando.codigoItem, 0, numero);
        break;
      case "alterar_condicao_comercial":
        if (comando.campoCondicao && comando.valorTexto) setScope((s) => (s ? setCondicaoComercial(s, comando.campoCondicao!, comando.valorTexto!) : s));
        break;
      case "limitar_orcamento": {
        if (!numero) break;
        const teto = Number(numero.replace(",", "."));
        const { codigosRemover, totalFinal } = cortarParaOrcamento(
          includedItems.map((it) => ({ codigo: it.codigo, precoUnit: precoUnit(it), quantidade: it.quantidade })),
          total,
          teto,
        );
        if (codigosRemover.length === 0) {
          return total <= teto ? `Já está dentro do teto de R$ ${numero} (total ${fmt(total)}).` : `Não dá pra cortar mais sem esvaziar a proposta — total atual ${fmt(total)}.`;
        }
        const nomes = codigosRemover.map((c) => includedItems.find((it) => it.codigo === c)?.nome ?? c);
        codigosRemover.forEach(toggleProduct);
        return `Removi ${nomes.map((n) => `"${n}"`).join(", ")} pra caber no teto — total agora ${fmt(totalFinal)}.`;
      }
      case "selecionar_por_necessidade":
        if (itensSelecionados && itensSelecionados.length > 0) {
          setScope((s) => (s ? { ...s, itens: itensSelecionados } : s));
          setExcluded(new Set());
        }
        break;
      case "nao_entendi":
      default:
        break;
    }
  }

  // Refino por prompt: anexa o ajuste ao briefing e reprocessa pelo MESMO /api/montar
  // (mesmo cliente/tipo). Backbone determinístico intacto — preço continua do catálogo.
  async function refinarProposta(ajuste: string) {
    const a = ajuste.trim();
    if (!a || !scope || refining) return;
    const novoBriefing = `${briefingText.trim()}\n\nAjuste solicitado: ${a}`.trim();
    setRefining(true);
    setError(null);
    try {
      const r = await fetch("/api/montar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefing: novoBriefing, razaoSocial: scope.cliente.razaoSocial, cnpj: scope.cliente.cnpj, segmento: scope.cliente.segmento, responsavel: scope.cliente.responsavel, tipo: scope.tipo }),
      });
      if (!r.ok) throw new Error(`Falha ao refinar (${r.status}).`);
      const data = await r.json();
      if (data?.precisaTipo || !Array.isArray(data?.itens)) throw new Error("Resposta inesperada do servidor.");
      // Reusa o id do registro atual: refino ATUALIZA a mesma proposta, não cria outra.
      const atualizado = { ...(data as PropostaScope), id: scope.id };
      setBriefingText(novoBriefing); // acumula o contexto para o próximo refino
      setScope(atualizado);
      setExcluded(new Set());
      if (atualizado.itens.length === 0) setError(data.aviso ?? "Nenhum produto casou após o ajuste.");
      else persistirProposta(atualizado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao refinar.");
    } finally {
      setRefining(false);
    }
  }

  // Auto-save (best-effort): grava/atualiza o registro pelo id do scope. Falha não trava a UI.
  function persistirProposta(s: PropostaScope) {
    if (!s.itens.length) return;
    fetch("/api/propostas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    })
      .then(() => setPropostas(null)) // histórico mudou → recarrega na próxima visita
      .catch(() => {});
  }

  // Reabrir uma proposta já salva: carrega o scope canônico de volta na tela de revisão.
  async function reabrirProposta(id: string) {
    try {
      const r = await fetch(`/api/propostas/${id}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const reg = await r.json();
      setScope(reg.scope as PropostaScope);
      setExcluded(new Set());
      setHasLoadedOnce(true);
      setScreen("review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir a proposta.");
    }
  }

  // Proposta manual (sem IA): a tela monta o scope via /api/montar-estruturado e entrega
  // aqui; cai no MESMO fluxo de revisão/PDF e vira registro (rascunho), igual à via IA.
  function aplicarScopeManual(novo: PropostaScope) {
    setScope(novo);
    setExcluded(new Set());
    setHasLoadedOnce(true);
    setScreen("review");
    toast("Proposta montada — revise os produtos", "success");
    persistirProposta(novo);
  }

  // Muda o status comercial. Otimista: atualiza a lista local; se falhar, recarrega do servidor.
  async function mudarStatus(id: string, status: StatusProposta) {
    setPropostas((ps) => (ps ? ps.map((p) => (p.id === id ? { ...p, status } : p)) : ps));
    try {
      const r = await fetch(`/api/propostas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setPropostas(null);
    }
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
      // persiste as edições (quantidade/texto) e força recarga do histórico
      persistirProposta(scope);
      toast("PDF gerado", "success");
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
      gap: "11px",
      padding: "9px 12px",
      borderRadius: "10px",
      border: "none",
      cursor: "pointer",
      textAlign: "left",
      width: "100%",
      background: activeNav ? "rgba(255,255,255,0.13)" : "transparent",
      color: activeNav ? "#FFFFFF" : "rgba(255,255,255,0.62)",
      fontFamily: "var(--font-sans), sans-serif",
      fontSize: "13.5px",
      fontWeight: activeNav ? 600 : 500,
      transition: "background 0.16s ease, color 0.16s ease",
    };
  }
  const navHover: CSSProperties = { background: "rgba(255,255,255,0.08)", color: "#fff" };
  // Rótulo de seção da sidebar agrupada (design "Plataforma IA Indeba").
  const navSection: CSSProperties = { fontSize: "10px", fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "rgba(255,255,255,.34)", padding: "14px 12px 5px" };

  function novaProposta() {
    setScreen("briefing");
    setBriefingText("");
    setQuickLoading(false);
    setError(null);
  }

  const chrome = {
    openPalette: () => setPalette(true),
    // O Assistente (AjudaChat) é um overlay independente; o header pede a abertura via evento.
    openAssistant: () => window.dispatchEvent(new CustomEvent("ies:assistente")),
  };

  return (
    <ChromeContext.Provider value={chrome}>
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--gray-50)", fontFamily: "var(--font-sans), sans-serif", color: "var(--gray-900)" }}>
      {/* ============ SIDEBAR ============ */}
      <aside className="ies-sidebar" style={{ width: "248px", flex: "none", height: "100vh", background: "var(--gradient-hero)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--blue-500)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 2px 8px rgba(30,107,184,.5)" }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: "13px", letterSpacing: "-.5px" }}>ies</span>
            </div>
            <div className="ies-side-text">
              <div style={{ fontSize: "14px", fontWeight: 700, color: "white", lineHeight: 1.1 }}>
                indeba <span style={{ color: "var(--accent)" }}>express</span>
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,.45)", marginTop: "2px" }}>Plataforma de IA</div>
            </div>
          </div>
        </div>

        <nav style={{ padding: "6px 8px 8px", flex: 1, display: "flex", flexDirection: "column", gap: "1px", overflowY: "auto" }}>
          <div className="ies-side-text" style={navSection}>Visão geral</div>
          <Hoverable base={navItemStyle(["dashboard"])} hover={navHover} onClick={() => setScreen("dashboard")}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1" />
              <rect x="9" y="2.5" width="5.5" height="3.5" rx="1" />
              <rect x="9" y="7.5" width="5.5" height="7" rx="1" />
              <rect x="2.5" y="9.5" width="5.5" height="5" rx="1" />
            </svg>
            Dashboard
          </Hoverable>
          <div className="ies-side-text" style={navSection}>IA &amp; Vendas</div>
          <Hoverable base={navItemStyle(["briefing", "loading", "review", "pdf"])} hover={navHover} onClick={novaProposta}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2H4.5A1 1 0 003.5 3v11a1 1 0 001 1h8a1 1 0 001-1V6.5L9.5 2z" />
              <path d="M9.5 2v4.5h4.5" />
              <path d="M6 9.5h5M6 12h3.5" />
            </svg>
            Nova proposta
          </Hoverable>
          <Hoverable base={navItemStyle(["manual"])} hover={navHover} onClick={() => setScreen("manual")}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="2.5" width="12" height="12" rx="2" />
              <path d="M5.5 6.5h6M5.5 9h6M5.5 11.5h3.5" />
            </svg>
            Proposta manual
          </Hoverable>
          <Hoverable base={navItemStyle(["importar"])} hover={navHover} onClick={() => setScreen("importar")}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 10.5V3M5.5 6l3-3 3 3" />
              <path d="M3 11v2a1 1 0 001 1h9a1 1 0 001-1v-2" />
            </svg>
            Importar orçamento
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

          <div className="ies-side-text" style={navSection}>Sistema</div>
          <Hoverable base={navItemStyle(["config"])} hover={navHover} onClick={() => setScreen("config")}>
            <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8.5" cy="8.5" r="2.25" />
              <path d="M8.5 2.5v1M8.5 13v1.5M2.5 8.5h1M13 8.5h1.5M4.5 4.5l.7.7M11.8 11.8l.7.7M4.5 12.5l.7-.7M11.8 5.2l.7-.7" />
            </svg>
            Configurações
          </Hoverable>
        </nav>

        <div className="ies-side-foot" style={{ padding: "14px 14px", borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "var(--blue-500)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", fontWeight: 700, fontSize: "13px", color: "white" }}>M</div>
          <div className="ies-side-text" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "white", fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Mateus Oliveira</div>
            <div style={{ color: "rgba(255,255,255,.42)", fontSize: "11px" }}>Vendedor · Salvador/BA</div>
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
        {screen === "dashboard" && <DashboardScreen setScreen={setScreen} />}
        {screen === "briefing" && (
          <BriefingScreen {...{ quickLoading, briefingText, setBriefingText, startGeneration, textareaRef, error, tipoProposta, setTipoProposta }} />
        )}
        {screen === "manual" && <ManualScreen onMontar={aplicarScopeManual} />}
        {screen === "importar" && <ImportarOrcamentoScreen onMontar={aplicarScopeManual} />}
        {screen === "loading" && <LoadingScreen loadingStep={loadingStep} />}
        {screen === "review" && scope && (
          <ReviewScreen
            {...{ reviewVariant, setReviewVariant, scope, excluded, includedItems, total, toggleProduct, changeQty, editarPreco }}
            onRefinar={refinarProposta}
            onEditarTexto={editarTexto}
            onComandoChat={aplicarComandoChat}
            refining={refining}
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
            onTipoChange={(t) =>
              setScope((s) => (s ? { ...s, tipo: t, template: t === "comercial" ? "indeba" : "indeba_express" } : s))
            }
          />
        )}
        {(screen === "review" || screen === "pdf") && !scope && <SemProposta onNova={novaProposta} />}
        {screen === "history" && (
          <HistoryScreen
            propostas={propostas}
            erro={propostasErro}
            goToBriefing={novaProposta}
            onReabrir={reabrirProposta}
            onStatus={mudarStatus}
          />
        )}
        {screen === "catalog" && <CatalogScreen catalogo={catalogo} erro={catalogoErro} catFilter={catFilter} setCatFilter={setCatFilter} />}
        {screen === "prospeccao" && <ProspeccaoScreen onGerarProposta={(d) => { setBriefingText(d.briefing); setScreen("briefing"); startGeneration(d.briefing, d); }} />}
        {screen === "instagram" && <InstagramScreen />}
        {screen === "financeiro" && <FinanceiroScreen />}
        {screen === "cobranca" && <CobrancaScreen />}
        {screen === "compras" && <ComprasScreen />}
        {screen === "fiscal" && <FiscalScreen />}
        {screen === "contabil" && <ContabilScreen />}
        {screen === "contrato" && <ContratoScreen scope={scope} onVerProposta={() => setScreen(scope ? "review" : "briefing")} />}
        {screen === "atendimento" && <AtendimentoScreen />}
        {screen === "chamados" && <ChamadosScreen />}
        {screen === "config" && <AdminScreen />}
      </main>

      {/* Command palette (Ctrl/Cmd+K) */}
      <CommandPalette open={palette} onClose={() => setPalette(false)} items={CMD_ITEMS} onGo={(k) => { setScreen(k as Screen); setPalette(false); }} />

      {/* Assistente de ajuda — overlay global (canto inferior direito) */}
      <AjudaChat />
    </div>
    </ChromeContext.Provider>
  );
}

/* ═══════════════════════ TELA: DASHBOARD ═══════════════════════ */

function DashboardScreen({ setScreen }: { setScreen: (s: Screen) => void }) {
  const [propostas, setPropostas] = useState<PropostaLog[] | null>(null);
  const [catalogoCount, setCatalogoCount] = useState<number | null>(null);
  // Data/saudação calculadas só no cliente (evita divergência de hidratação SSR≠cliente).
  const [hdr, setHdr] = useState({ hoje: "", saudacao: "Olá" });
  const { hoje, saudacao } = hdr;

  useEffect(() => {
    const d = new Date();
    const h = d.getHours();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor client-only (data/hora atual), por design
    setHdr({
      hoje: d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase(),
      saudacao: h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite",
    });
    fetch("/api/propostas")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { propostas: PropostaLog[] }) => setPropostas(d.propostas))
      .catch(() => setPropostas([]));
    fetch("/api/catalogo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((d: { produtos: unknown[] }) => setCatalogoCount(d.produtos.length))
      .catch(() => setCatalogoCount(null));
  }, []);

  const lista = propostas ?? [];
  const totalProp = lista.length;
  const valorTotal = lista.reduce((s, p) => s + Number(p.total || 0), 0);
  const aprovadas = lista.filter((p) => p.status === "aprovada").length;

  const statusCount = (Object.keys(STATUS_UI) as StatusProposta[])
    .map((k) => ({ k, n: lista.filter((p) => p.status === k).length, label: STATUS_UI[k].label, fg: STATUS_UI[k].fg }))
    .filter((s) => s.n > 0);
  const donut = (() => {
    if (!totalProp) return "var(--gray-100)";
    let acc = 0;
    const stops = statusCount.map((s) => {
      const from = (acc / totalProp) * 100;
      acc += s.n;
      const to = (acc / totalProp) * 100;
      return `${s.fg} ${from}% ${to}%`;
    });
    return `conic-gradient(${stops.join(",")})`;
  })();

  const porTipo = TIPOS.map((t) => ({ label: t.label, n: lista.filter((p) => p.tipo === t.value).length }));
  const maxTipo = Math.max(1, ...porTipo.map((t) => t.n));

  const KPIS = [
    { label: "Propostas", valor: String(totalProp), cor: "var(--blue-600)" },
    { label: "Valor total", valor: fmt(valorTotal), cor: "var(--success)" },
    { label: "Aprovadas", valor: String(aprovadas), cor: "var(--blue-800)" },
    { label: "Produtos no catálogo", valor: catalogoCount == null ? "—" : String(catalogoCount), cor: "var(--orange-600)" },
  ];

  // Widget financeiro — derivado das propostas reais (sem números inventados, constituição §1.2):
  // "aprovado" = soma das aprovadas; "em negociação" = soma das enviadas.
  const somaPorStatus = (st: StatusProposta) => lista.filter((p) => p.status === st).reduce((s, p) => s + Number(p.total || 0), 0);
  const valorAprovado = somaPorStatus("aprovada");
  const valorEmNegociacao = somaPorStatus("enviada");
  const recentes = lista.slice(0, 4);

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      <ScreenHead title="Dashboard" sub={`${saudacao}, Mateus — visão geral`} />
      <div style={{ padding: "24px 28px 44px", display: "flex", flexDirection: "column", gap: "20px", animation: "fadeUp var(--duration-slow) var(--ease-out) both" }}>
        {/* ── Hero ── */}
        <div style={{ borderRadius: "18px", background: "var(--gradient-hero)", color: "#fff", padding: "26px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", position: "relative", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
          <div style={{ position: "absolute", right: "-60px", top: "-70px", width: "300px", height: "300px", borderRadius: "50%", background: "radial-gradient(circle,rgba(247,130,27,.28),transparent 68%)" }} />
          <div style={{ position: "absolute", right: "80px", bottom: "-120px", width: "260px", height: "260px", borderRadius: "50%", background: "radial-gradient(circle,rgba(30,107,184,.45),transparent 70%)" }} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: "560px" }}>
            <div style={{ fontSize: "12.5px", color: "rgba(255,255,255,.66)", fontWeight: 600, letterSpacing: ".02em", minHeight: "16px" }}>{hoje}</div>
            <div style={{ fontSize: "27px", fontWeight: 800, letterSpacing: "-.02em", marginTop: "5px" }}>{saudacao}, Mateus</div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,.74)", marginTop: "7px", lineHeight: 1.55 }}>Descreva um cliente em linguagem natural — a IA seleciona produtos do catálogo, redige o texto e gera o PDF. Você revisa antes de exportar.</div>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
              <Hoverable onClick={() => setScreen("briefing")} base={{ display: "flex", alignItems: "center", gap: "7px", height: "42px", padding: "0 18px", borderRadius: "12px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600, boxShadow: "var(--shadow-accent)" }} hover={{ background: "var(--accent-hover)" }}>
                <svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round"><path d="M8.5 3v11M3 8.5h11" /></svg>Nova proposta
              </Hoverable>
              <Hoverable onClick={() => setScreen("manual")} base={{ display: "flex", alignItems: "center", gap: "7px", height: "42px", padding: "0 17px", borderRadius: "12px", border: "1px solid rgba(255,255,255,.28)", background: "rgba(255,255,255,.08)", color: "#fff", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "14px", fontWeight: 600 }} hover={{ background: "rgba(255,255,255,.16)" }}>
                <svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="2.5" width="12" height="12" rx="2" /><path d="M5.5 6.5h6M5.5 9h6M5.5 11.5h3.5" /></svg>Proposta manual
              </Hoverable>
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1, textAlign: "right", flex: "none" }}>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,.6)", fontWeight: 600 }}>PROPOSTAS REGISTRADAS</div>
            <div style={{ fontSize: "52px", fontWeight: 900, letterSpacing: "-.03em", lineHeight: 1, fontFamily: "var(--font-mono)" }}>{propostas == null ? "—" : totalProp}</div>
            <div style={{ fontSize: "12.5px", color: "#7ee2a8", fontWeight: 700, marginTop: "4px" }}>{aprovadas} aprovada{aprovadas === 1 ? "" : "s"}</div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" }}>
          {KPIS.map((k, i) => (
            <Hoverable as="div" key={k.label} base={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderTop: `3px solid ${k.cor}`, borderRadius: "14px", padding: "17px 19px", minWidth: 0, boxShadow: "var(--shadow-sm)", transition: "transform var(--duration-base) var(--ease-out),box-shadow var(--duration-base) var(--ease-standard)", animation: `popIn .4s var(--ease-spring) ${i * 0.05}s both` }} hover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-lg)" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500, marginBottom: "9px" }}>{k.label}</div>
              <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-strong)", fontFamily: "var(--font-mono)", letterSpacing: "-.02em" }}>{k.valor}</div>
            </Hoverable>
          ))}
        </div>

        {/* ── Gráficos reais (status / tipo) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: "16px" }}>
          {/* Barras: por tipo */}
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-strong)" }}>Propostas por tipo</div>
            <div style={{ fontSize: "12px", color: "var(--text-subtle)", marginBottom: "14px" }}>Distribuição por estrutura de PDF</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "20px", height: "150px", padding: "0 10px" }}>
              {porTipo.map((t) => (
                <div key={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--blue-600)", fontFamily: "var(--font-mono)" }}>{t.n}</span>
                  <div style={{ width: "100%", maxWidth: "56px", height: `${(t.n / maxTipo) * 100}%`, minHeight: "4px", background: "linear-gradient(180deg,var(--blue-500),var(--blue-700))", borderRadius: "8px 8px 0 0", transition: "height .4s var(--ease-out)" }} />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Donut: status */}
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 22px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "100%", fontSize: "15px", fontWeight: 700, color: "var(--text-strong)" }}>Propostas por status</div>
            <div style={{ width: "100%", fontSize: "12px", color: "var(--text-subtle)", marginBottom: "14px" }}>Funil comercial</div>
            {totalProp === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-subtle)", padding: "30px 0" }}>{propostas == null ? "Carregando…" : "Nenhuma proposta ainda."}</div>
            ) : (
              <>
                <div style={{ position: "relative", width: 150, height: 150 }}>
                  <div style={{ width: 150, height: 150, borderRadius: "50%", background: donut }} />
                  <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: "var(--surface-card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: "30px", fontWeight: 800, color: "var(--text-strong)", lineHeight: 1, fontFamily: "var(--font-mono)" }}>{totalProp}</div>
                    <div style={{ fontSize: "10.5px", color: "var(--text-subtle)", marginTop: "3px" }}>propostas</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "10px 18px", marginTop: "18px" }}>
                  {statusCount.map((s) => (
                    <div key={s.k} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-muted)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.fg, flex: "none" }} />
                      {s.label} <b style={{ color: "var(--text-strong)", fontFamily: "var(--font-mono)" }}>{s.n}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Atividade recente + Financeiro ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.45fr 1fr", gap: "16px", alignItems: "start" }}>
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px 22px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-strong)" }}>Atividade recente</div>
              <Hoverable onClick={() => setScreen("history")} base={{ background: "none", border: "none", color: "var(--primary)", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", padding: 0 }}>Ver tudo →</Hoverable>
            </div>
            {lista.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-subtle)", padding: "16px 0" }}>{propostas == null ? "Carregando…" : "Nenhuma proposta ainda."}</div>
            ) : (
              recentes.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", flex: "none", background: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}>
                    <svg width="16" height="16" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2H4.5A1 1 0 003.5 3v11a1 1 0 001 1h8a1 1 0 001-1V6.5L9.5 2z" /><path d="M9.5 2v4.5h4.5" /></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.cliente}</div>
                    <div style={{ fontSize: "11.5px", color: "var(--text-subtle)" }}>{tipoLabel(p.tipo)} · {p.qtdItens} {p.qtdItens === 1 ? "item" : "itens"} · {STATUS_UI[p.status].label}</div>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary)", fontSize: "14px", whiteSpace: "nowrap" }}>R$ {Number(p.total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>
              ))
            )}
          </div>

          {/* Widget financeiro — derivado das propostas reais */}
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: 500 }}>Valor aprovado</span>
              <span style={{ width: "30px", height: "30px", borderRadius: "9px", background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--success)" }}>
                <svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l4-4 3 2 4-5" /></svg>
              </span>
            </div>
            <div style={{ fontSize: "21px", fontWeight: 800, color: "var(--text-strong)", fontFamily: "var(--font-mono)" }}>{fmt(valorAprovado)}</div>
            <div style={{ height: "1px", background: "var(--border)", margin: "13px 0" }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: 500 }}>Em negociação (enviadas)</span>
              <span style={{ width: "30px", height: "30px", borderRadius: "9px", background: "var(--info-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--info)" }}>
                <svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 4.5v5M6 7h5" /></svg>
              </span>
            </div>
            <div style={{ fontSize: "21px", fontWeight: 800, color: "var(--info)", fontFamily: "var(--font-mono)" }}>{fmt(valorEmNegociacao)}</div>
          </div>
        </div>
      </div>
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
  tipoProposta,
  setTipoProposta,
}: {
  quickLoading: boolean;
  briefingText: string;
  setBriefingText: (v: string) => void;
  startGeneration: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  error: string | null;
  tipoProposta: TipoProposta;
  setTipoProposta: (t: TipoProposta) => void;
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

      <ScreenHead
        title="Nova proposta"
        sub="IA seleciona os produtos e redige o texto"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", background: "var(--success-soft)", borderRadius: "999px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "12px", color: "var(--success)", fontWeight: 500 }}>IA disponível</span>
          </div>
        }
      />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 32px 210px" }}>
        <div style={{ textAlign: "center", maxWidth: "640px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "24px" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "linear-gradient(135deg,var(--blue-500),var(--blue-800))", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 28px rgba(30,107,184,.3)" }}>
              <span style={{ color: "white", fontWeight: 700, fontSize: "16px", letterSpacing: "-.5px" }}>ies</span>
            </div>
          </div>
          <h1 style={{ fontSize: "30px", fontWeight: 800, color: "var(--gray-900)", letterSpacing: "-.6px", marginBottom: "12px", fontFamily: "var(--font-sans)" }}>Vamos montar uma proposta?</h1>
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
          {/* Tipo de proposta → define a estrutura do PDF */}
          {TIPOS_SELECIONAVEIS.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "12px", color: "var(--gray-400)", fontWeight: 500 }}>Tipo de proposta:</span>
              <div style={{ display: "flex", background: "white", border: "1px solid var(--gray-200)", borderRadius: "999px", padding: "3px", gap: "2px", boxShadow: "var(--shadow-sm)" }}>
                {TIPOS_SELECIONAVEIS.map((t) => {
                  const ativo = tipoProposta === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setTipoProposta(t.value)}
                      title={t.hint}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "5px 14px", borderRadius: "999px", border: "none", cursor: "pointer", background: ativo ? "var(--blue-50)" : "transparent", color: ativo ? "var(--blue-600)" : "var(--gray-500)", fontFamily: "var(--font-sans), sans-serif", lineHeight: 1.1 }}
                    >
                      <span style={{ fontSize: "13px", fontWeight: ativo ? 700 : 500 }}>{t.label}</span>
                      <span style={{ fontSize: "10px", color: ativo ? "var(--blue-500)" : "var(--gray-400)", marginTop: "1px" }}>{t.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
              style={{ flex: 1, border: "none", background: "transparent", resize: "none", fontSize: "14px", color: "var(--gray-900)", lineHeight: 1.55, padding: "4px 0", minHeight: "26px", maxHeight: "120px", overflow: "hidden", fontFamily: "var(--font-sans), sans-serif" }}
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

/* ═══════════════════════ TELA: PROPOSTA MANUAL ═══════════════════════ */

// Monta proposta SEM IA: o vendedor escolhe direto do catálogo e define quantidades.
// Preço vem SEMPRE do catálogo (constituição §1.1). POST /api/montar-estruturado devolve
// o MESMO PropostaScope da via IA → cai no fluxo de revisão/PDF existente.
function ManualScreen({ onMontar }: { onMontar: (s: PropostaScope) => void }) {
  const [catalogo, setCatalogo] = useState<Produto[] | null>(null);
  const [erroCat, setErroCat] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segmento, setSegmento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [tipo, setTipo] = useState<TipoProposta>("consolidada");
  const [itens, setItens] = useState<Record<string, number>>({}); // codigo → quantidade
  // Itens próprios (fora do catálogo): preço digitado por humano → procedência MANUAL.
  const [custom, setCustom] = useState<{ id: number; nome: string; tamanho: string; unidade: "L" | "kg" | "un" | "ml"; preco: string; qtd: number }[]>([]);
  const [draft, setDraft] = useState<{ nome: string; tamanho: string; unidade: "L" | "kg" | "un" | "ml"; preco: string }>({ nome: "", tamanho: "", unidade: "L", preco: "" });
  const [showCustom, setShowCustom] = useState(false);
  const nextId = useRef(1);
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalogo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { produtos: Produto[] }) => setCatalogo(d.produtos))
      .catch((e) => setErroCat(e instanceof Error ? e.message : "Erro ao carregar o catálogo."));
  }, []);

  const campoLabel: CSSProperties = { fontSize: "11.5px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" };
  const campoInput: CSSProperties = { width: "100%", height: "38px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "var(--surface)", fontSize: "13.5px", color: "var(--text-strong)", fontFamily: "var(--font-sans)", outline: "none" };
  const qtdBtn: CSSProperties = { width: "26px", height: "26px", borderRadius: "7px", border: "1px solid var(--border-strong)", background: "var(--surface)", cursor: "pointer", color: "var(--text-muted)", fontSize: "15px", lineHeight: 1, flex: "none" };

  const ativos = (catalogo ?? []).filter((p) => p.ativo);
  const q = busca.trim().toLowerCase();
  const filtrados = q ? ativos.filter((p) => `${p.nome} ${p.codigo} ${p.descricaoCurta}`.toLowerCase().includes(q)) : ativos;
  const precoDe = (p: Produto) => Number(p.embalagens[0]?.preco ?? 0);
  const selCat = Object.entries(itens)
    .map(([codigo, qtd]) => ({ produto: ativos.find((p) => p.codigo === codigo), qtd }))
    .filter((x): x is { produto: Produto; qtd: number } => Boolean(x.produto));
  // Linhas unificadas (catálogo + próprias) para render e total.
  const rows: { key: string; nome: string; sub: string; preco: number; qtd: number; onQtd: (q: number) => void }[] = [
    ...selCat.map((x) => ({ key: x.produto.codigo, nome: x.produto.nome, sub: `${fmt(precoDe(x.produto))} un. · catálogo`, preco: precoDe(x.produto), qtd: x.qtd, onQtd: (q: number) => setQtd(x.produto.codigo, q) })),
    ...custom.map((c) => ({ key: `c${c.id}`, nome: c.nome, sub: `${fmt(Number(c.preco) || 0)} un. · ${c.tamanho}${c.unidade} · manual`, preco: Number(c.preco) || 0, qtd: c.qtd, onQtd: (q: number) => setCustomQtd(c.id, q) })),
  ];
  const total = rows.reduce((s, r) => s + r.preco * r.qtd, 0);

  function add(codigo: string) {
    setItens((m) => (m[codigo] ? m : { ...m, [codigo]: 1 }));
  }
  function setQtd(codigo: string, q: number) {
    setItens((m) => {
      if (q <= 0) {
        const n = { ...m };
        delete n[codigo];
        return n;
      }
      return { ...m, [codigo]: q };
    });
  }
  function setCustomQtd(id: number, q: number) {
    setCustom((cs) => (q <= 0 ? cs.filter((c) => c.id !== id) : cs.map((c) => (c.id === id ? { ...c, qtd: q } : c))));
  }
  function addCustom() {
    const nome = draft.nome.trim();
    const tam = Number(draft.tamanho);
    const preco = Number(draft.preco.replace(",", "."));
    if (!nome || !(tam > 0) || !(preco > 0)) {
      setErro("Item próprio: preencha nome, tamanho e preço válidos.");
      return;
    }
    setErro(null);
    setCustom((cs) => [...cs, { id: nextId.current++, nome, tamanho: draft.tamanho, unidade: draft.unidade, preco: preco.toFixed(2), qtd: 1 }]);
    setDraft({ nome: "", tamanho: "", unidade: "L", preco: "" });
    setShowCustom(false);
  }

  async function montar() {
    if (montando) return;
    if (!razaoSocial.trim()) {
      setErro("Informe a razão social do cliente.");
      return;
    }
    if (rows.length === 0) {
      setErro("Adicione ao menos um produto (catálogo ou item próprio).");
      return;
    }
    setMontando(true);
    setErro(null);
    try {
      const body = {
        tipo,
        cliente: { razaoSocial: razaoSocial.trim(), cnpj: cnpj.trim() || null, segmento: segmento.trim() || null, responsavel: responsavel.trim() || null },
        itens: [
          ...selCat.map((x) => ({ codigo: x.produto.codigo, quantidade: x.qtd })),
          ...custom.map((c) => ({ nome: c.nome, embalagens: [{ tamanho: Number(c.tamanho), unidade: c.unidade, preco: Number(c.preco).toFixed(2), diluicaoMax: null, custoDiluido: null }], quantidade: c.qtd })),
        ],
      };
      const r = await fetch("/api/montar-estruturado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`Falha ao montar a proposta (${r.status}).`);
      const scope = await r.json();
      if (!scope || !Array.isArray(scope.itens)) throw new Error("Resposta inesperada do servidor.");
      onMontar(scope as PropostaScope);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao montar a proposta.");
    } finally {
      setMontando(false);
    }
  }

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      <ScreenHead
        title="Proposta manual"
        sub="Monte direto do catálogo — sem IA, preço do catálogo"
        right={
          <Hoverable onClick={montar} base={{ display: "flex", alignItems: "center", gap: "7px", height: "38px", padding: "0 18px", borderRadius: "10px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600, boxShadow: "var(--shadow-accent)", opacity: montando ? 0.7 : 1 }} hover={{ background: "var(--accent-hover)" }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M8 3l5 5-5 5" /></svg>
            {montando ? "Montando…" : "Montar proposta"}
          </Hoverable>
        }
      />
      <div style={{ padding: "24px 28px 44px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Cliente + tipo */}
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px", boxShadow: "var(--shadow-sm)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
          <label style={{ flex: "1 1 240px", minWidth: 0 }}>
            <div style={campoLabel}>Razão social *</div>
            <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex.: Laticínio São João Ltda" style={campoInput} />
          </label>
          <label style={{ flex: "1 1 180px", minWidth: 0 }}>
            <div style={campoLabel}>CNPJ</div>
            <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" style={campoInput} />
          </label>
          <label style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div style={campoLabel}>Segmento</div>
            <input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Laticínio" style={campoInput} />
          </label>
          <label style={{ flex: "1 1 200px", minWidth: 0 }}>
            <div style={campoLabel}>Responsável</div>
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem recebe a proposta" style={campoInput} />
          </label>
          {TIPOS_SELECIONAVEIS.length > 1 && (
            <div>
              <div style={campoLabel}>Tipo</div>
              <div style={{ display: "flex", background: "var(--surface-muted)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
                {TIPOS_SELECIONAVEIS.map((t) => {
                  const at = tipo === t.value;
                  return (
                    <button key={t.value} onClick={() => setTipo(t.value)} title={t.hint} style={{ padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: at ? 600 : 500, background: at ? "var(--primary)" : "transparent", color: at ? "#fff" : "var(--text-muted)", fontFamily: "inherit" }}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {erro && <div style={{ padding: "11px 14px", background: "var(--danger-soft)", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>{erro}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "16px", alignItems: "start" }}>
          {/* Catálogo */}
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px", boxShadow: "var(--shadow-sm)" }}>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto por nome ou código…" style={{ ...campoInput, marginBottom: "12px" }} />
            {erroCat && <div style={{ fontSize: "13px", color: "#B91C1C" }}>{erroCat}</div>}
            {catalogo === null && !erroCat && <div style={{ fontSize: "13px", color: "var(--text-subtle)", padding: "12px 0" }}>Carregando catálogo…</div>}
            <div className="ies-scroll" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "440px", overflowY: "auto" }}>
              {filtrados.map((p) => {
                const incluido = Boolean(itens[p.codigo]);
                return (
                  <div key={p.codigo} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border)", background: incluido ? "var(--info-soft)" : "var(--surface)" }}>
                    <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: linhaCor(p.linha), flex: "none" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13.5px", fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-subtle)" }}>{p.codigo} · {humaniza(p.linha)}</div>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--primary)", fontSize: "13px", whiteSpace: "nowrap" }}>{fmt(precoDe(p))}</span>
                    <button onClick={() => add(p.codigo)} disabled={incluido} title={incluido ? "Já incluído" : "Adicionar"} style={{ width: "30px", height: "30px", borderRadius: "8px", border: "1px solid var(--border-strong)", background: incluido ? "var(--surface-muted)" : "var(--surface)", cursor: incluido ? "default" : "pointer", color: incluido ? "var(--text-subtle)" : "var(--primary)", fontSize: "18px", lineHeight: 1, flex: "none" }}>+</button>
                  </div>
                );
              })}
              {catalogo !== null && filtrados.length === 0 && <div style={{ fontSize: "13px", color: "var(--text-subtle)", padding: "12px 0" }}>Nenhum produto encontrado.</div>}
            </div>
            {/* Item próprio (fora do catálogo) — preço digitado por humano (MANUAL) */}
            <div style={{ borderTop: "1px solid var(--border)", marginTop: "14px", paddingTop: "14px" }}>
              {!showCustom ? (
                <button onClick={() => setShowCustom(true)} style={{ display: "flex", alignItems: "center", gap: "7px", background: "none", border: "none", color: "var(--primary)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans)", padding: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M7 1.5v11M1.5 7h11" /></svg>
                  Item próprio (fora do catálogo)
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-strong)" }}>Item próprio — preço digitado (MANUAL)</div>
                  <input value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} placeholder="Nome do produto" style={campoInput} />
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input value={draft.tamanho} onChange={(e) => setDraft((d) => ({ ...d, tamanho: e.target.value }))} inputMode="decimal" placeholder="Tam." style={{ ...campoInput, width: "70px", flex: "none" }} />
                    <select value={draft.unidade} onChange={(e) => setDraft((d) => ({ ...d, unidade: e.target.value as "L" | "kg" | "un" | "ml" }))} style={{ ...campoInput, width: "74px", flex: "none", padding: "0 8px", cursor: "pointer" }}>
                      <option value="L">L</option>
                      <option value="kg">kg</option>
                      <option value="un">un</option>
                      <option value="ml">ml</option>
                    </select>
                    <input value={draft.preco} onChange={(e) => setDraft((d) => ({ ...d, preco: e.target.value }))} inputMode="decimal" placeholder="Preço R$" style={{ ...campoInput, flex: 1 }} />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <Hoverable onClick={addCustom} base={{ flex: 1, height: "36px", borderRadius: "9px", border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }} hover={{ background: "var(--primary-hover)" }}>Adicionar item</Hoverable>
                    <button onClick={() => { setShowCustom(false); setDraft({ nome: "", tamanho: "", unidade: "L", preco: "" }); }} style={{ height: "36px", padding: "0 14px", borderRadius: "9px", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text-muted)", cursor: "pointer", fontSize: "13px" }}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Selecionados */}
          <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px", boxShadow: "var(--shadow-sm)", position: "sticky", top: "78px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-strong)", marginBottom: "12px" }}>Selecionados ({rows.length})</div>
            {rows.length === 0 ? (
              <div style={{ fontSize: "13px", color: "var(--text-subtle)", padding: "20px 0", textAlign: "center" }}>Adicione produtos do catálogo (ou um item próprio) ao lado.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {rows.map((r) => (
                  <div key={r.key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-strong)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.nome}</div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>{r.sub}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flex: "none" }}>
                      <button onClick={() => r.onQtd(r.qtd - 1)} style={qtdBtn}>−</button>
                      <span style={{ minWidth: "22px", textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: "13px" }}>{r.qtd}</span>
                      <button onClick={() => r.onQtd(r.qtd + 1)} style={qtdBtn}>+</button>
                    </div>
                    <button onClick={() => r.onQtd(0)} title="Remover" style={{ ...qtdBtn, color: "var(--danger)", borderColor: "transparent", background: "transparent" }}>×</button>
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", marginTop: "4px", paddingTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>Total</span>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>{fmt(total)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ TELA: IMPORTAR ORÇAMENTO ═══════════════════════ */

// Importa um orçamento pronto (PDF do ERP): extração de texto determinística +
// IA estruturando com GUARDA de preço (só entra preço que consta no documento;
// o que falha aparece em "rejeitados"). O vendedor confere e edita tudo aqui e
// a montagem converge no MESMO /api/montar-estruturado da Proposta manual.
type ItemImportado = { nome: string; quantidade: number; tamanho: string; unidade: "L" | "kg" | "un" | "ml"; preco: string; codigoCatalogo: string | null; nomeCatalogo: string | null };

function ImportarOrcamentoScreen({ onMontar }: { onMontar: (s: PropostaScope) => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [importando, setImportando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  const [rejeitados, setRejeitados] = useState<ItemRejeitado[]>([]);
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segmento, setSegmento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [tipo, setTipo] = useState<TipoProposta>("consolidada");
  const [itens, setItens] = useState<ItemImportado[]>([]);
  const [montando, setMontando] = useState(false);

  const campoLabel: CSSProperties = { fontSize: "11.5px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" };
  const campoInput: CSSProperties = { width: "100%", height: "38px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "var(--surface)", fontSize: "13.5px", color: "var(--text-strong)", fontFamily: "var(--font-sans)", outline: "none" };

  async function importar() {
    if (!arquivo || importando) return;
    setImportando(true);
    setErro(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const r = await fetch("/api/orcamento/importar", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro || `Falha ao importar (${r.status}).`);
      const res = d as OrcamentoImportResponse;
      setRazaoSocial(res.extraido.cliente.razaoSocial ?? "");
      setCnpj(res.extraido.cliente.cnpj ?? "");
      setSegmento(res.extraido.cliente.segmento ?? "");
      setResponsavel(res.extraido.cliente.responsavel ?? "");
      setItens(res.extraido.itens.map((it) => ({ nome: it.nome, quantidade: it.quantidade, tamanho: it.tamanho == null ? "" : String(it.tamanho), unidade: it.unidade ?? "un", preco: it.preco, codigoCatalogo: it.codigoCatalogo, nomeCatalogo: it.nomeCatalogo })));
      setRejeitados(res.rejeitados);
      setConferindo(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao importar o orçamento.");
    } finally {
      setImportando(false);
    }
  }

  async function montar() {
    if (montando) return;
    if (!razaoSocial.trim()) { setErro("Informe a razão social do cliente."); return; }
    if (itens.length === 0) { setErro("Nenhum item para montar — confira o orçamento."); return; }
    const invalido = itens.find((it) => !it.nome.trim() || !/^\d+([.,]\d{1,2})?$/.test(it.preco.trim()));
    if (invalido) { setErro(`Item "${invalido.nome || "sem nome"}": preço inválido (use ex.: 130,00).`); return; }
    setMontando(true);
    setErro(null);
    try {
      const body = {
        tipo,
        cliente: { razaoSocial: razaoSocial.trim(), cnpj: cnpj.trim() || null, segmento: segmento.trim() || null, responsavel: responsavel.trim() || null },
        itens: itens.map((it) => ({
          // codigo (quando casou com o catálogo) → foto/descrição do catálogo no PDF;
          // as embalagens SEMPRE vão junto: o preço autoritativo é o do orçamento.
          ...(it.codigoCatalogo ? { codigo: it.codigoCatalogo } : {}),
          nome: it.nome.trim(),
          embalagens: [{ tamanho: Number(it.tamanho) > 0 ? Number(it.tamanho) : 1, unidade: it.unidade, preco: Number(it.preco.replace(",", ".")).toFixed(2), diluicaoMax: null, custoDiluido: null }],
          quantidade: it.quantidade,
        })),
      };
      const r = await fetch("/api/montar-estruturado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`Falha ao montar a proposta (${r.status}).`);
      const scope = await r.json();
      if (!scope || !Array.isArray(scope.itens)) throw new Error("Resposta inesperada do servidor.");
      onMontar(scope as PropostaScope);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao montar a proposta.");
    } finally {
      setMontando(false);
    }
  }

  const setItem = (i: number, patch: Partial<ItemImportado>) => setItens((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div style={{ background: "var(--background)", minHeight: "100vh" }}>
      <ScreenHead
        title="Importar orçamento"
        sub="PDF do orçamento → proposta no padrão Indeba — preço sai do documento"
        right={
          conferindo ? (
            <Hoverable onClick={montar} base={{ display: "flex", alignItems: "center", gap: "7px", height: "38px", padding: "0 18px", borderRadius: "10px", border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600, boxShadow: "var(--shadow-accent)", opacity: montando ? 0.7 : 1 }} hover={{ background: "var(--accent-hover)" }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h10M8 3l5 5-5 5" /></svg>
              {montando ? "Montando…" : "Montar proposta"}
            </Hoverable>
          ) : undefined
        }
      />
      <div style={{ padding: "24px 28px 44px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "980px" }}>
        {/* Upload */}
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px", boxShadow: "var(--shadow-sm)", display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 16px", borderRadius: "10px", border: "1px dashed var(--border-strong)", background: "var(--surface-muted)", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--text-body)" }}>
            <svg width="16" height="16" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 11V3.5M5.5 6.5l3-3 3 3" /><path d="M3 11.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" /></svg>
            {arquivo ? arquivo.name : "Escolher arquivo (PDF, DOCX ou TXT)"}
            <input type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
          <Hoverable onClick={importar} base={{ display: "flex", alignItems: "center", gap: "7px", height: "38px", padding: "0 18px", borderRadius: "10px", border: "none", background: arquivo ? "var(--primary)" : "var(--surface-muted)", color: arquivo ? "#fff" : "var(--text-subtle)", cursor: arquivo ? "pointer" : "default", fontSize: "13px", fontWeight: 600, opacity: importando ? 0.7 : 1 }} hover={arquivo ? { background: "var(--primary-hover)" } : {}}>
            {importando ? "Extraindo…" : "Extrair dados"}
          </Hoverable>
          <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>A IA estrutura o documento; preços só entram se constarem no texto. Você confere tudo antes de montar.</span>
        </div>

        {erro && <div style={{ background: "var(--danger-soft, #FEE2E2)", border: "1px solid #fca5a5", color: "#b91c1c", borderRadius: "10px", padding: "10px 14px", fontSize: "13px" }}>{erro}</div>}

        {conferindo && rejeitados.length > 0 && (
          <div style={{ background: "#FFF7ED", border: "1px solid #fdba74", color: "#9a3412", borderRadius: "10px", padding: "10px 14px", fontSize: "13px" }}>
            <b>{rejeitados.length} {rejeitados.length === 1 ? "item ficou de fora" : "itens ficaram de fora"}</b> — preço não confere com o documento: {rejeitados.map((r) => `${r.nome} (${r.preco})`).join(", ")}. Confira o PDF e adicione manualmente se precisar.
          </div>
        )}

        {conferindo && (
          <>
            {/* Cliente + tipo */}
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px", boxShadow: "var(--shadow-sm)", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
              <label style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={campoLabel}>Razão social *</div>
                <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} placeholder="Ex.: Laticínio São João Ltda" style={campoInput} />
              </label>
              <label style={{ flex: "1 1 160px", minWidth: 0 }}>
                <div style={campoLabel}>CNPJ</div>
                <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" style={campoInput} />
              </label>
              <label style={{ flex: "1 1 150px", minWidth: 0 }}>
                <div style={campoLabel}>Segmento</div>
                <input value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Laticínio" style={campoInput} />
              </label>
              <label style={{ flex: "1 1 170px", minWidth: 0 }}>
                <div style={campoLabel}>Responsável</div>
                <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Quem recebe a proposta" style={campoInput} />
              </label>
              {TIPOS_SELECIONAVEIS.length > 1 && (
                <div>
                  <div style={campoLabel}>Tipo</div>
                  <div style={{ display: "flex", background: "var(--surface-muted)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
                    {TIPOS_SELECIONAVEIS.map((t) => {
                      const at = tipo === t.value;
                      return (
                        <button key={t.value} onClick={() => setTipo(t.value)} title={t.hint} style={{ padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: at ? 600 : 500, background: at ? "var(--primary)" : "transparent", color: at ? "#fff" : "var(--text-muted)", fontFamily: "inherit" }}>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Itens extraídos (conferência) */}
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-strong)", marginBottom: "12px" }}>Itens do orçamento <span style={{ fontWeight: 500, color: "var(--text-subtle)", fontSize: "12px" }}>— confira nome, embalagem e preço</span></div>
              <div style={{ display: "grid", gridTemplateColumns: "2.2fr 70px 90px 80px 120px 34px", gap: "8px", fontSize: "11px", fontWeight: 700, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: ".04em", padding: "0 2px 6px" }}>
                <span>Item</span><span>Qtd</span><span>Tamanho</span><span>Unid.</span><span>Preço (R$)</span><span />
              </div>
              {itens.map((it, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2.2fr 70px 90px 80px 120px 34px", gap: "8px", alignItems: "center", padding: "5px 0" }}>
                  <div style={{ minWidth: 0 }}>
                    <input value={it.nome} onChange={(e) => setItem(i, { nome: e.target.value })} style={campoInput} />
                    {it.nomeCatalogo && (
                      <div style={{ marginTop: "3px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "1px 8px", borderRadius: "999px", background: "var(--info-soft)", color: "var(--primary)", fontSize: "10px", fontWeight: 700, letterSpacing: ".04em" }} title="Foto e descrição virão do catálogo; o preço segue o do orçamento">
                        CATÁLOGO · {it.nomeCatalogo}
                      </div>
                    )}
                  </div>
                  <input value={String(it.quantidade)} onChange={(e) => setItem(i, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} style={{ ...campoInput, textAlign: "center", padding: "0 6px" }} />
                  <input value={it.tamanho} onChange={(e) => setItem(i, { tamanho: e.target.value })} placeholder="ex.: 5" style={{ ...campoInput, textAlign: "center", padding: "0 6px" }} />
                  <select value={it.unidade} onChange={(e) => setItem(i, { unidade: e.target.value as ItemImportado["unidade"] })} style={{ ...campoInput, padding: "0 6px" }}>
                    {(["L", "kg", "un", "ml"] as const).map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input value={it.preco} onChange={(e) => setItem(i, { preco: e.target.value })} style={{ ...campoInput, textAlign: "right", fontFamily: "var(--font-mono)" }} />
                  <button onClick={() => setItens((xs) => xs.filter((_, j) => j !== i))} title="Remover" style={{ width: "30px", height: "30px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-subtle)", cursor: "pointer", fontSize: "15px", lineHeight: 1 }}>×</button>
                </div>
              ))}
              {itens.length === 0 && <div style={{ fontSize: "13px", color: "var(--text-subtle)", padding: "8px 0" }}>Nenhum item aprovado pela guarda de preço — confira o documento.</div>}
            </div>
          </>
        )}
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
  editarPreco,
  onRefinar,
  onEditarTexto,
  onComandoChat,
  refining,
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
  editarPreco: (codigo: string, idx: number, valor: string) => void;
  onRefinar: (texto: string) => void;
  onEditarTexto: (texto: string) => void;
  onComandoChat: (r: { comando: ComandoEdicao; numero: string | null; itemResolvido: PropostaItem | null; itensSelecionados: PropostaItem[] | null }) => string | void;
  refining: boolean;
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
    fontFamily: "var(--font-sans), sans-serif",
  });

  const orangeBtn: CSSProperties = { display: "flex", alignItems: "center", gap: "7px", padding: "8px 18px", background: "var(--orange-500)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: 600, color: "white", boxShadow: "0 2px 8px rgba(236,122,28,.35)", transition: "transform .12s ease,background .18s ease,box-shadow .18s ease" };
  const orangeHover: CSSProperties = { background: "#D2680F", boxShadow: "0 4px 14px rgba(236,122,28,.5)", transform: "translateY(-1px)" };
  const orangeActive: CSSProperties = { transform: "translateY(0)", background: "#A8530C" };

  const qtyBtn: CSSProperties = { width: "26px", height: "26px", borderRadius: "6px", border: "1px solid var(--gray-200)", background: "white", cursor: "pointer", fontSize: "15px", color: "var(--gray-500)", display: "flex", alignItems: "center", justifyContent: "center" };
  const qtyBtnSm: CSSProperties = { ...qtyBtn, width: "24px", height: "24px", borderRadius: "5px", fontSize: "13px" };

  const [ajuste, setAjuste] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--gray-50)" }}>
      <ScreenHead
        title="Revisão da proposta"
        sub={`${scope.cliente.razaoSocial} · ${includedItems.length} produtos selecionados`}
        right={
          <>
            <button onClick={goToBriefing} title="Nova proposta" style={{ display: "flex", alignItems: "center", gap: "5px", height: "38px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "var(--surface)", cursor: "pointer", fontSize: "13px", color: "var(--text-muted)" }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2L3 6.5 8 11" />
              </svg>
              Nova
            </button>
            <div style={{ display: "flex", background: "var(--surface-muted)", borderRadius: "10px", padding: "3px", gap: "2px" }}>
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
          </>
        }
      />

      {/* Aviso: Proposta de Solução sem WhatsApp/e-mail configurado — o cliente não teria
          como responder. Não bloqueia (rascunho/teste local), só deixa impossível não ver. */}
      {scope.tipo === "consolidada" && !scope.consolidada?.contato?.whatsapp && !scope.consolidada?.contato?.emailConsultor && (
        <div style={{ margin: "14px 28px 0", padding: "11px 14px", background: "var(--danger-soft, #FEF2F2)", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>
          Esta proposta vai sair sem WhatsApp nem e-mail de contato — o cliente não vai ter como responder. Configure <code>INDEBA_WHATSAPP</code>/<code>INDEBA_CONSULTOR_EMAIL</code> no ambiente.
        </div>
      )}

      {/* Edição e refino pelo funcionário (antes do PDF final): texto editável + refino por IA */}
      <div style={{ flex: "none", padding: "14px 28px 0", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ background: "white", border: "1px solid var(--gray-200)", borderLeft: "3px solid var(--blue-500)", borderRadius: "8px", padding: "12px 16px", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--blue-500)", background: "var(--blue-50)", borderRadius: "999px", padding: "2px 8px", whiteSpace: "nowrap" }}>{scope.textoApresentacao.procedencia}</span>
            <span style={{ fontSize: "11.5px", color: "var(--gray-400)" }}>Texto de apresentação — edite à vontade</span>
          </div>
          <textarea
            value={scope.textoApresentacao.conteudo}
            onChange={(e) => onEditarTexto(e.target.value)}
            rows={3}
            placeholder="Texto de apresentação da proposta…"
            style={{ width: "100%", border: "1px solid var(--gray-200)", borderRadius: "6px", padding: "8px 10px", fontSize: "13px", color: "var(--gray-900)", lineHeight: 1.55, resize: "vertical", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "var(--gray-50)", boxSizing: "border-box" }}
          />
        </div>

        {/* Refino por IA — anexa o ajuste ao briefing e reprocessa (preço segue do catálogo) */}
        <form
          onSubmit={(e) => { e.preventDefault(); if (ajuste.trim() && !refining) { onRefinar(ajuste); setAjuste(""); } }}
          style={{ display: "flex", gap: "8px", alignItems: "center", background: "white", border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "7px 8px 7px 14px", boxShadow: "var(--shadow-sm)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--orange-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
            <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15l-1.9-4.1L5.5 9l4.6-1.4L12 3z" />
            <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
          </svg>
          <input
            value={ajuste}
            onChange={(e) => setAjuste(e.target.value)}
            disabled={refining}
            placeholder="Refinar com IA — ex.: adicione mais desinfetantes, deixe o texto mais curto e formal"
            style={{ flex: 1, border: "none", outline: "none", fontSize: "13px", color: "var(--gray-900)", fontFamily: "var(--font-sans), sans-serif", background: "transparent" }}
          />
          <button
            type="submit"
            disabled={refining || !ajuste.trim()}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "7px", border: "none", background: refining || !ajuste.trim() ? "var(--gray-200)" : "var(--blue-800)", color: "white", cursor: refining || !ajuste.trim() ? "default" : "pointer", fontSize: "13px", fontWeight: 600, fontFamily: "inherit", flex: "none" }}
          >
            {refining ? (
              <>
                <span style={{ width: "13px", height: "13px", border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                Refinando…
              </>
            ) : (
              "Refinar"
            )}
          </button>
        </form>

        {/* Chat de correção pontual — adicional ao Refinar com IA acima */}
        <EdicaoChat scope={scope} onComando={onComandoChat} />
      </div>

      <div className="ies-scroll" style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {reviewVariant === "A" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
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
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <span style={{ fontSize: "13px", color: "var(--blue-500)", fontWeight: 700 }}>R$</span>
                        <input
                          aria-label={`Preço de ${p.nome}`}
                          defaultValue={precoUnit(p).toFixed(2)}
                          onBlur={(ev) => editarPreco(p.codigo, 0, ev.target.value)}
                          style={{ width: "72px", textAlign: "right", fontSize: "15px", fontWeight: 700, color: "var(--blue-500)", border: "1px solid var(--gray-200)", borderRadius: "6px", padding: "2px 6px", fontFamily: "var(--font-sans), sans-serif" }}
                        />
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--gray-400)" }}>/ {unidadeDe(p)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleProduct(p.codigo)}
                    style={{ marginTop: "10px", width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid " + (included ? "#A7F3D0" : "#E3EBF3"), background: included ? "#DCFCE7" : "#F7F9FC", color: included ? "#16A34A" : "#94A6B8", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-sans), sans-serif" }}
                  >
                    {included ? "✓ Incluído" : "+ Incluir"}
                  </button>
                </Hoverable>
              );
            })}
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--gray-200)", overflowX: "auto", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 110px 110px 100px", minWidth: "640px", padding: "11px 20px", background: "var(--gray-100)", borderBottom: "1px solid var(--gray-200)" }}>
              {["Produto", "Origem", "Qtd", "Preço unit.", "Total", "Status"].map((h, i) => (
                <div key={h} style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".05em", textAlign: i === 2 || i === 5 ? "center" : i === 3 || i === 4 ? "right" : "left" }}>{h}</div>
              ))}
            </div>
            {scope.itens.map((p) => {
              const included = !excluded.has(p.codigo);
              return (
                <div key={p.codigo} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 80px 110px 110px 100px", minWidth: "640px", padding: "13px 20px", borderBottom: "1px solid #EEF3F8", alignItems: "center", background: included ? "#FFFFFF" : "#F7F9FC", opacity: included ? 1 : 0.45 }}>
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
                  <div style={{ textAlign: "right" }}>
                    <input
                      aria-label={`Preço de ${p.nome}`}
                      defaultValue={precoUnit(p).toFixed(2)}
                      onBlur={(ev) => editarPreco(p.codigo, 0, ev.target.value)}
                      style={{ width: "88px", textAlign: "right", fontSize: "13.5px", color: "var(--gray-700)", border: "1px solid var(--gray-200)", borderRadius: "6px", padding: "3px 6px", fontFamily: "var(--font-sans), sans-serif" }}
                    />
                  </div>
                  <div style={{ textAlign: "right", fontSize: "13.5px", fontWeight: 700, color: "var(--blue-500)" }}>{fmt(precoUnit(p) * p.quantidade)}</div>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button onClick={() => toggleProduct(p.codigo)} style={{ padding: "4px 10px", borderRadius: "6px", border: "none", cursor: "pointer", background: included ? "#DCFCE7" : "#EEF3F8", color: included ? "#16A34A" : "#94A6B8", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", whiteSpace: "nowrap" }}>{included ? "✓ Incluído" : "+ Incluir"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* paddingRight extra abre espaço para o launcher do chatbot (fixed, canto inf. dir.) */}
      <div style={{ flex: "none", padding: "14px 96px 14px 28px", background: "white", borderTop: "1px solid var(--gray-200)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
  onTipoChange,
}: {
  scope: PropostaScope;
  includedItems: PropostaItem[];
  total: number;
  downloading: boolean;
  baixarPdf: () => void;
  goToReview: () => void;
  error: string | null;
  onTipoChange: (t: TipoProposta) => void;
}) {
  const c = scope.condicoesComerciais;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");

  return (
    <div style={{ background: "#DDE1E7", minHeight: "100vh", padding: "28px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button onClick={goToReview} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", border: "1px solid #B0BAC5", background: "white", cursor: "pointer", fontSize: "13px", color: "var(--gray-500)" }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 2L3 6.5 8 11" />
            </svg>
            Voltar e editar
          </button>
          {/* Toggle de tipo de proposta — troca o modelo do PDF (render roteia por tipo). */}
          {TIPOS_SELECIONAVEIS.length > 1 && (
            <div style={{ display: "flex", gap: "2px", background: "#EEF3F8", padding: "3px", borderRadius: "9px", border: "1px solid var(--gray-200)" }} title="Tipo de proposta">
              {TIPOS_SELECIONAVEIS.map((t) => {
                const ativo = scope.tipo === t.value;
                return (
                  <button
                    key={t.value}
                    onClick={() => onTipoChange(t.value)}
                    title={t.hint}
                    style={{ padding: "6px 13px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "12.5px", fontWeight: ativo ? 600 : 500, background: ativo ? "var(--blue-800)" : "transparent", color: ativo ? "white" : "var(--gray-500)", fontFamily: "inherit", transition: "background .15s ease, color .15s ease" }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
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

      {/* Documento A4 — espelha o template do servidor por tipo (§4: o que vê = o que sai) */}
      {scope.tipo === "orcamento" && (
      <div style={{ maxWidth: "820px", margin: "0 auto", background: "white", boxShadow: "0 8px 40px rgba(0,0,0,.18)", borderRadius: "2px", padding: "40px 44px", color: "#25303f", fontSize: "12px" }}>
        {/* topo: data / nº */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", color: "var(--gray-500)", paddingBottom: "10px" }}>
          <span>{data}</span>
          <span style={{ color: "#25303f", fontSize: "15px" }}>{tipoLabel(scope.tipo)} <strong style={{ color: "var(--blue-800)", fontWeight: 800 }}>{numeroDoc(scope.id)}</strong></span>
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
            {scope.cliente.responsavel && <div style={{ fontSize: "10.5px", color: "var(--gray-500)", marginTop: "3px" }}>A/C: {scope.cliente.responsavel}</div>}
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
      )}

      {scope.tipo === "implantacao" && <ImplantacaoPreview scope={scope} itens={includedItems} />}
      {scope.tipo === "comercial" && <ComercialPreview scope={scope} itens={includedItems} />}
      {scope.tipo === "consolidada" && <ConsolidadaPreview scope={scope} itens={includedItems} />}

      <p style={{ textAlign: "center", fontSize: "11.5px", color: "var(--gray-500)", marginTop: "16px" }}>
        {scope.tipo === "orcamento"
          ? "Pré-visualização fiel — o PDF final é gerado pelo servidor a partir desta mesma proposta."
          : `Resumo da proposta — o PDF final usa o modelo ${tipoLabel(scope.tipo)} (estrutura completa, multi-página).`}
      </p>
    </div>
  );
}

// Preview do modelo Implantação (Express) — espelha template.ts (resumo, não paginado).
function ImplantacaoPreview({ scope, itens }: { scope: PropostaScope; itens: PropostaItem[] }) {
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");
  const creme = "#FBF6E9";
  const cremeBorda = "#E9DEC2";
  const bar = (label: string, value: string) => (
    <div style={{ background: creme, border: `1px solid ${cremeBorda}`, borderLeft: "4px solid var(--orange-500)", borderRadius: "0 6px 6px 0", padding: "8px 14px", display: "flex", gap: "12px", alignItems: "baseline" }}>
      <span style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: ".06em", color: "#8a7a4f", fontWeight: 700, minWidth: "84px" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--blue-800)" }}>{value}</span>
    </div>
  );
  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", background: "white", boxShadow: "0 8px 40px rgba(0,0,0,.18)", borderRadius: "2px", overflow: "hidden", color: "#25303f" }}>
      {/* banner navy */}
      <div style={{ background: "var(--blue-800)", padding: "16px 44px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px" }}>
        <div style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--blue-500)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: "11px" }}>ies</div>
        <span style={{ color: "white", fontWeight: 700, fontSize: "15px" }}>indeba <span style={{ color: "#EC7A1C" }}>express</span></span>
      </div>
      <div style={{ padding: "26px 44px 36px" }}>
        <h1 style={{ fontSize: "23px", fontWeight: 800, color: "var(--blue-800)", textAlign: "center", margin: "4px 0 6px" }}>Proposta de Implantação</h1>
        <div style={{ width: "70px", height: "4px", background: "var(--orange-500)", borderRadius: "2px", margin: "0 auto 18px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "7px", marginBottom: "16px" }}>
          {bar("Cliente", scope.cliente.razaoSocial)}
          {bar("Responsável", "Matheus Resende")}
          {bar("Data", data)}
        </div>
        {scope.textoApresentacao.conteudo && <p style={{ fontSize: "12px", color: "#3a4757", lineHeight: 1.6, textAlign: "justify", marginBottom: "18px" }}>{scope.textoApresentacao.conteudo}</p>}
        {itens.map((p, i) => {
          const e = p.embalagens[0];
          return (
            <div key={p.codigo} style={{ marginBottom: "22px" }}>
              <div style={{ color: "var(--blue-500)", fontSize: "14px", fontWeight: 800, lineHeight: 1.4, marginBottom: "10px" }}>{i + 1}. Item: {p.nome} – {p.descricaoUso.toUpperCase()}</div>
              <div style={{ textAlign: "center", marginBottom: "12px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.imagemPath} alt={p.nome} style={{ maxWidth: "220px", maxHeight: "230px", objectFit: "contain" }} onError={(ev) => (ev.currentTarget.style.display = "none")} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ background: creme, border: `1px solid ${cremeBorda}`, borderRadius: "6px", padding: "9px 14px", fontSize: "12px" }}><span style={{ color: "var(--orange-500)", fontWeight: 800, marginRight: "6px" }}>o</span> Valor embalagem de <b>{e?.tamanho} {e?.unidade}</b> R$: <b style={{ color: "var(--blue-800)" }}>{dec(precoUnit(p))}</b></div>
                {e?.diluicaoMax && e?.custoDiluido && (
                  <div style={{ background: creme, border: `1px solid ${cremeBorda}`, borderRadius: "6px", padding: "9px 14px", fontSize: "12px" }}><span style={{ color: "var(--orange-500)", fontWeight: 800, marginRight: "6px" }}>o</span> Valor por litro diluído (Diluição de até <b>{e.diluicaoMax}</b>) R$: <b style={{ color: "var(--blue-800)" }}>{dec(Number(e.custoDiluido))}</b></div>
                )}
                <div style={{ background: creme, border: `1px solid ${cremeBorda}`, borderRadius: "6px", padding: "9px 14px", fontSize: "11.5px", color: "#3a4757", lineHeight: 1.5 }}><span style={{ color: "var(--orange-500)", fontWeight: 800, marginRight: "6px" }}>o</span> Observações: Para mais informações solicitar ficha técnica. A diluição máxima é teórica; na prática pode variar conforme a sujidade.</div>
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: "8px", padding: "12px 14px", background: "var(--gray-50)", border: "1px dashed var(--gray-300)", borderRadius: "8px", fontSize: "11.5px", color: "var(--gray-500)" }}>
          Fechamento no PDF: <b>Diluidores Seko Pro Max</b> + <b>painel de fichas técnicas/EPI</b> + assinatura (Matheus Resende). 1 produto por página.
        </div>
      </div>
    </div>
  );
}

// Preview do modelo Comercial (fabricante) — espelha template-comercial.ts (resumo).
function ComercialPreview({ scope, itens }: { scope: PropostaScope; itens: PropostaItem[] }) {
  const c = scope.condicoesComerciais;
  const mesAno = new Date(scope.criadoEm).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase();
  const navy = "#0b4f8a";
  const box = (label: string, value: string, sub?: string) => (
    <div style={{ flex: 1, background: "#eef4fb", border: "1px solid #d8e6f3", borderRadius: "8px", padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: navy, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "#1f3a52" }}>{value}{sub && <span style={{ fontSize: "9px", fontWeight: 400, color: "#7a8696" }}> {sub}</span>}</div>
    </div>
  );
  const etapas = ["Pré-lavagem", "Limpeza", "Enxágue", "Desinfecção", "Materiais de Comunicação"];
  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", background: "white", boxShadow: "0 8px 40px rgba(0,0,0,.18)", borderRadius: "2px", padding: "36px 44px", color: "#25303f" }}>
      {/* capa compacta */}
      <div style={{ textAlign: "center", paddingBottom: "20px", borderBottom: "2px solid #e6ecf4", marginBottom: "18px" }}>
        <div style={{ fontSize: "26px", fontWeight: 800, color: navy, letterSpacing: "-.5px" }}>Indeba</div>
        <div style={{ fontSize: "10px", fontStyle: "italic", color: "#6b7787", marginBottom: "14px" }}>Química e Soluções em Higiene</div>
        <div style={{ fontSize: "20px", fontWeight: 800, color: navy }}>Proposta Comercial</div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#1f3a52", marginTop: "8px" }}>{scope.cliente.razaoSocial.toUpperCase()}</div>
        <div style={{ fontSize: "10px", color: "#6b7787" }}>{mesAno}</div>
      </div>
      <div style={{ background: "#eef4fb", border: "1px solid #d8e6f3", borderRadius: "8px", padding: "10px 14px", fontSize: "11px", color: "#3a4757", marginBottom: "20px" }}>
        Páginas institucionais incluídas no PDF: <b>A Indeba é uma Indústria Química</b> (linhas de atuação + mapa de distribuidores) e <b>Programa Experiência Segura</b> (8 pilares).
      </div>
      {/* 5 etapas */}
      <h2 style={{ fontSize: "14px", fontWeight: 800, color: navy, borderBottom: "2px solid #e6ecf4", paddingBottom: "5px", marginBottom: "12px" }}>As 5 Etapas Essenciais de Higienização</h2>
      <div style={{ display: "flex", gap: "6px", marginBottom: "22px", flexWrap: "wrap" }}>
        {etapas.map((et, i) => (
          <div key={et} style={{ flex: 1, minWidth: "120px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: navy, color: "white", fontWeight: 800, fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>{i + 1}</div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: navy }}>{et}</span>
          </div>
        ))}
      </div>
      {/* soluções */}
      <h2 style={{ fontSize: "14px", fontWeight: 800, color: navy, borderBottom: "2px solid #e6ecf4", paddingBottom: "5px", marginBottom: "14px" }}>Soluções Indicadas para o {scope.cliente.razaoSocial}</h2>
      {itens.map((p) => {
        const e = p.embalagens[0];
        return (
          <div key={p.codigo} style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ flex: "0 0 90px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fbfcfe", border: "1px solid #eef2f7", borderRadius: "8px", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imagemPath} alt={p.nome} style={{ maxWidth: "82px", maxHeight: "92px", objectFit: "contain" }} onError={(ev) => (ev.currentTarget.style.display = "none")} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: navy, fontSize: "13.5px", fontWeight: 800 }}>{p.nome}</div>
              <div style={{ fontSize: "11px", color: "#5a6878", lineHeight: 1.45, margin: "4px 0 10px" }}>{p.descricaoUso}</div>
              <div style={{ display: "flex", gap: "10px" }}>
                {box("Embalagem", e ? `${e.tamanho} ${e.unidade}` : "—")}
                {box("Preço", fmt(precoUnit(p)))}
                {box("Custo final por litro diluído", e?.custoDiluido ? fmt(Number(e.custoDiluido)) : "—", e?.diluicaoMax ? `até ${e.diluicaoMax}` : undefined)}
              </div>
            </div>
          </div>
        );
      })}
      {/* condições */}
      <h2 style={{ fontSize: "14px", fontWeight: 800, color: navy, borderBottom: "2px solid #e6ecf4", paddingBottom: "5px", margin: "18px 0 12px" }}>Condições Comerciais</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <tbody>
          {[["Validade desta proposta", c.validade], ["Prazo de entrega", c.prazoEntrega], ["Condições de pagamento", c.pagamento], ["Frete", c.frete], ["Pedido mínimo (frete CIF)", "Sob consulta"]].map(([l, v]) => (
            <tr key={l}>
              <td style={{ border: "1px solid #d8e6f3", padding: "7px 10px", background: "#eef4fb", color: navy, fontWeight: 700, width: "42%" }}>{l}</td>
              <td style={{ border: "1px solid #d8e6f3", padding: "7px 10px" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: "10px", color: "#5a6878", lineHeight: 1.6, marginTop: "12px" }}>
        <b style={{ color: navy }}>Observações:</b><br />— Assistência técnica e manutenção dos equipamentos Indeba são permanentes;<br />— Produtos ofertados são de fabricação da Indeba Indústria e Comércio Ltda, origem nacional e marca Indeba.
      </p>
    </div>
  );
}

// Preview do modelo Proposta de Solução (IES) — espelha template-consolidada.ts (resumo,
// não paginado: a ficha rica por produto e as seções institucionais completas só saem no PDF).
function ConsolidadaPreview({ scope, itens }: { scope: PropostaScope; itens: PropostaItem[] }) {
  const c = scope.consolidada;
  const cli = scope.cliente;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR");
  const navy = "#0b2a4a";
  const orange = "#e8622a";
  const info = (label: string, value: string) => (
    <div style={{ flex: 1, background: "#f2f5f9", border: "1px solid #e5ebf2", borderRadius: "8px", padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: navy, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#1f3a52" }}>{value || "—"}</div>
    </div>
  );
  const box = (label: string, value: string, sub?: string) => (
    <div style={{ flex: 1, background: "#f2f5f9", border: "1px solid #e5ebf2", borderRadius: "8px", padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em", color: navy, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "13px", fontWeight: 700, color: navy }}>{value}{sub && <span style={{ fontSize: "9px", fontWeight: 400, color: "#7a8696" }}> {sub}</span>}</div>
    </div>
  );
  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", background: "white", boxShadow: "0 8px 40px rgba(0,0,0,.18)", borderRadius: "2px", padding: "36px 44px", color: "#25303f" }}>
      {/* capa compacta */}
      <div style={{ textAlign: "center", paddingBottom: "18px", borderBottom: "2px solid #e5ebf2", marginBottom: "18px" }}>
        <div style={{ fontSize: "20px", fontWeight: 800, color: navy, letterSpacing: "3px" }}>PROPOSTA DE SOLUÇÃO</div>
        <div style={{ fontSize: "11px", color: orange, fontWeight: 700, marginTop: "4px" }}>{c?.capa.subtitulo ?? "Soluções em Higienização Profissional"}</div>
      </div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
        {info("Cliente", cli.razaoSocial)}
        {info("CNPJ", cli.cnpj ?? "—")}
        {info("Segmento", cli.segmento ?? "—")}
        {info("Responsável", cli.responsavel ?? "—")}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#5a6878", marginBottom: "22px" }}>
        <span>Consultor responsável: <b style={{ color: navy }}>{c?.capa.consultor ?? "—"}</b></span>
        <span>{c?.capa.cidade ?? ""} · {data}</span>
      </div>

      <h2 style={{ fontSize: "14px", fontWeight: 800, color: navy, borderBottom: "2px solid #e5ebf2", paddingBottom: "5px", marginBottom: "14px" }}>Soluções Indicadas para o {cli.razaoSocial}</h2>
      {itens.map((p) => {
        const e = p.embalagens[0];
        return (
          <div key={p.codigo} style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "16px" }}>
            <div style={{ flex: "0 0 90px", height: "100px", display: "flex", alignItems: "center", justifyContent: "center", background: "#fbfcfe", border: "1px solid #eef2f7", borderRadius: "8px", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.imagemPath} alt={p.nome} style={{ maxWidth: "82px", maxHeight: "92px", objectFit: "contain" }} onError={(ev) => (ev.currentTarget.style.display = "none")} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: navy, fontSize: "13.5px", fontWeight: 800 }}>{p.ficha?.titulo ?? p.nome}</div>
              <div style={{ fontSize: "11px", color: "#5a6878", lineHeight: 1.45, margin: "4px 0 10px" }}>{p.ficha?.descricao ?? p.descricaoUso}</div>
              <div style={{ display: "flex", gap: "10px" }}>
                {box("Embalagem", e ? `${e.tamanho} ${e.unidade}` : "—")}
                {box("Preço", fmt(precoUnit(p)))}
                {box("Custo final por litro diluído", e?.custoDiluido ? fmt(Number(e.custoDiluido)) : "—", e?.diluicaoMax ? `até ${e.diluicaoMax}` : undefined)}
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: "8px", padding: "12px 14px", background: "var(--gray-50)", border: "1px dashed var(--gray-300)", borderRadius: "8px", fontSize: "11.5px", color: "var(--gray-500)" }}>
        Fechamento no PDF: capa + apresentação institucional + <b>comodatos oferecidos</b> + <b>1 ficha rica por produto</b> + condições comerciais. Aqui é o resumo — o documento final é multi-página.
      </div>

      <h2 style={{ fontSize: "14px", fontWeight: 800, color: navy, borderBottom: "2px solid #e5ebf2", paddingBottom: "5px", margin: "18px 0 12px" }}>Condições Comerciais</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
        <tbody>
          {[
            ["Validade da proposta", scope.condicoesComerciais.validade],
            ["Prazo de implantação", scope.condicoesComerciais.prazoEntrega],
            ["Forma de pagamento", scope.condicoesComerciais.pagamento],
            ["Frete e entrega", scope.condicoesComerciais.frete],
          ].map(([l, v]) => (
            <tr key={l}>
              <td style={{ border: "1px solid #e5ebf2", padding: "7px 10px", background: "#f2f5f9", color: navy, fontWeight: 700, width: "42%" }}>{l}</td>
              <td style={{ border: "1px solid #e5ebf2", padding: "7px 10px" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════ TELA: HISTORY ═══════════════════════ */

function HistoryScreen({
  propostas,
  erro,
  goToBriefing,
  onReabrir,
  onStatus,
}: {
  propostas: PropostaLog[] | null;
  erro: string | null;
  goToBriefing: () => void;
  onReabrir: (id: string) => void;
  onStatus: (id: string, status: StatusProposta) => void;
}) {
  const cols = "1.7fr 1fr 80px 130px 80px 110px 150px";
  const lista = propostas ?? [];
  // Faturamento = só o que o cliente APROVOU (status comercial real, não o que foi gerado).
  const aprovado = lista.filter((p) => p.status === "aprovada").reduce((s, p) => s + (Number(p.total) || 0), 0);
  const totalItens = lista.reduce((s, p) => s + p.qtdItens, 0);
  const clientes = new Set(lista.map((p) => p.cliente)).size;
  const stats = [
    { label: "Propostas", value: String(lista.length), color: "var(--gray-900)" },
    { label: "Clientes", value: String(clientes), color: "var(--blue-500)" },
    { label: "Itens", value: String(totalItens), color: "#16A34A" },
    { label: "Aprovado", value: fmt(aprovado), color: "var(--gray-900)" },
  ];

  return (
    <div style={{ padding: "28px" }}>
      <div style={{ margin: "-28px -28px 24px" }}>
        <ScreenHead
          title="Propostas"
          sub={propostas === null ? "Carregando…" : `${lista.length} proposta(s) gerada(s)`}
          right={
            <Hoverable
              base={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 18px", background: "var(--orange-500)", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "white", boxShadow: "0 2px 8px rgba(236,122,28,.35)", transition: "transform .12s ease,background .18s ease,box-shadow .18s ease" }}
              hover={{ background: "#D2680F", boxShadow: "0 4px 14px rgba(236,122,28,.5)", transform: "translateY(-1px)" }}
              active={{ transform: "translateY(0)", background: "#A8530C" }}
              onClick={goToBriefing}
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
                <path d="M7.5 1.5v12M1.5 7.5h12" />
              </svg>
              Nova proposta
            </Hoverable>
          }
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "14px", marginBottom: "24px" }}>
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
        <div style={{ background: "white", borderRadius: "12px", border: "1px solid var(--gray-200)", overflowX: "auto", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, minWidth: "720px", padding: "11px 20px", background: "var(--gray-100)", borderBottom: "1px solid var(--gray-200)" }}>
            {[
              { t: "Cliente", a: "left" },
              { t: "Segmento", a: "left" },
              { t: "Data", a: "left" },
              { t: "Status", a: "center" },
              { t: "Itens", a: "center" },
              { t: "Valor", a: "right" },
              { t: "Ações", a: "right" },
            ].map((h, i) => (
              <div key={i} style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", textTransform: "uppercase", letterSpacing: ".05em", textAlign: h.a as CSSProperties["textAlign"] }}>{h.t}</div>
            ))}
          </div>
          {lista.map((p, idx) => {
            const data = new Date(p.atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
            const su = STATUS_UI[p.status];
            return (
              <Hoverable
                key={p.id + idx}
                as="div"
                base={{ display: "grid", gridTemplateColumns: cols, minWidth: "720px", padding: "13px 20px", borderBottom: "1px solid var(--gray-100)", alignItems: "center", transition: "background .15s ease" }}
                hover={{ background: "var(--gray-50)" }}
              >
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--gray-900)" }}>{p.cliente}</div>
                <div style={{ fontSize: "13px", color: "var(--gray-500)", textTransform: "capitalize" }}>{p.segmento ? p.segmento.replace(/_/g, " ") : "—"}</div>
                <div style={{ fontSize: "13px", color: "var(--gray-400)" }}>{data}</div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {/* Status comercial editável: muda direto na lista (PATCH otimista). */}
                  <select
                    value={p.status}
                    onChange={(e) => onStatus(p.id, e.target.value as StatusProposta)}
                    style={{ appearance: "none", padding: "3px 10px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 600, background: su.bg, color: su.fg, border: "none", cursor: "pointer", textAlign: "center" }}
                  >
                    {(Object.keys(STATUS_UI) as StatusProposta[]).map((s) => (
                      <option key={s} value={s}>{STATUS_UI[s].label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ textAlign: "center", fontSize: "13px", color: "var(--gray-500)" }}>{p.qtdItens} itens</div>
                <div style={{ textAlign: "right", fontSize: "14px", fontWeight: 700, color: "var(--gray-900)" }}>{fmt(Number(p.total) || 0)}</div>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => onReabrir(p.id)}
                    style={{ padding: "5px 10px", fontSize: "12px", fontWeight: 600, color: "var(--gray-700)", background: "white", border: "1px solid var(--gray-200)", borderRadius: "7px", cursor: "pointer" }}
                  >
                    Abrir
                  </button>
                </div>
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
      <div style={{ margin: "-28px -28px 22px" }}>
        <ScreenHead
          title="Catálogo"
          sub={catalogo === null ? "Carregando…" : `${filtered.length} produtos · Higiene & Limpeza`}
          right={
            <Hoverable
              base={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 18px", background: "var(--blue-500)", border: "none", borderRadius: "10px", cursor: "not-allowed", fontSize: "13px", fontWeight: 600, color: "white", boxShadow: "0 2px 8px rgba(30,107,184,.3)", opacity: 0.6 }}
              title="Cadastro de produto — em breve"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round">
                <path d="M7.5 1.5v12M1.5 7.5h12" />
              </svg>
              Novo produto
            </Hoverable>
          }
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "white", border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "9px 14px", flex: 1, minWidth: "200px", maxWidth: "300px" }}>
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#94A6B8" strokeWidth={1.5} strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4" />
            <path d="M10 10l3 3" />
          </svg>
          <input type="text" placeholder="Buscar produto ou SKU..." style={{ border: "none", background: "transparent", fontSize: "14px", color: "var(--gray-900)", flex: 1, fontFamily: "var(--font-sans), sans-serif" }} />
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {allCats.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              style={{ padding: "5px 14px", borderRadius: "999px", border: "1px solid " + (catFilter === cat ? "#1E6BB8" : "#E3EBF3"), cursor: "pointer", fontSize: "13px", fontWeight: catFilter === cat ? 600 : 400, background: catFilter === cat ? "#EAF2FA" : "white", color: catFilter === cat ? "#1E6BB8" : "#5B6E7D", fontFamily: "var(--font-sans), sans-serif" }}
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
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
                    <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--blue-500)" }}>{e?.preco ? fmt(Number(e.preco)) : "—"}</div>
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

/* ═══════════════════════ TELA: PROSPECÇÃO ═══════════════════════ */

// Payload do handoff prospecção → proposta: dados do cliente já estruturados
// (sem re-extrair por heurística) + a "dor" que personaliza o texto da proposta.
type ProspectParaProposta = {
  briefing: string;
  razaoSocial: string;
  segmento: string | null;
  contexto: { problema: string; comoAjudar: string };
};

function ProspeccaoScreen({ onGerarProposta }: { onGerarProposta: (d: ProspectParaProposta) => void }) {
  const [nicho, setNicho] = useState("");
  const [tipoCliente, setTipoCliente] = useState("");
  const [servicoOferecido, setServicoOferecido] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<ProspeccaoResponse | null>(null);

  const podeBuscar = nicho.trim() && tipoCliente.trim() && servicoOferecido.trim() && !loading;

  async function prospectar() {
    if (!podeBuscar) return;
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch("/api/prospectar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nicho,
          tipoCliente,
          servicoOferecido,
          localizacao: localizacao.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? `Falha na prospecção (${r.status}).`);
      setRes(d as ProspeccaoResponse);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao prospectar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ScreenHead title="Prospecção" sub="Garimpe leads reais — a IA escreve a abordagem" />
      <div style={{ padding: "28px", maxWidth: "1120px" }}>
      {/* ── Hero ── */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "18px", padding: "26px 30px", marginBottom: "24px", background: "linear-gradient(120deg,var(--blue-700) 0%,var(--blue-500) 52%,var(--orange-500) 135%)", boxShadow: "0 14px 34px rgba(30,107,184,.28)", animation: "fadeUp .5s ease both" }}>
        <div style={{ position: "absolute", top: "-60px", right: "-30px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
        <div style={{ position: "absolute", bottom: "-80px", right: "130px", width: "150px", height: "150px", borderRadius: "50%", background: "rgba(255,255,255,.07)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", animation: "floatY 3.4s ease-in-out infinite" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
              <path d="M11 8v6M8 11h6" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: 800, color: "white", letterSpacing: "-.5px", margin: 0 }}>Prospecção de leads</h2>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,.88)", marginTop: "4px", maxWidth: "640px" }}>
              Descreva o que você vende e o cliente ideal — a IA garimpa empresas reais, minera contatos e escreve a abordagem pronta pra enviar.
            </div>
          </div>
        </div>
      </div>

      {/* ── Formulário ── */}
      <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "22px", boxShadow: "var(--shadow-md)", marginBottom: "24px", animation: "fadeUp .5s ease both", animationDelay: "60ms" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
          <CampoTexto label="Nicho / o que você vende" value={nicho} onChange={setNicho} placeholder="Ex: Produtos de limpeza industrial" onEnter={prospectar} />
          <CampoTexto label="Tipo de cliente desejado" value={tipoCliente} onChange={setTipoCliente} placeholder="Ex: Hospitais, hotéis e indústrias" onEnter={prospectar} />
          <div style={{ gridColumn: "1 / -1" }}>
            <CampoTexto label="O que você oferece (diferencial)" value={servicoOferecido} onChange={setServicoOferecido} placeholder="Ex: Entrega rápida, suporte técnico e preço de fábrica" onEnter={prospectar} />
          </div>
          <CampoTexto label="Localização" opcional value={localizacao} onChange={setLocalizacao} placeholder="Ex: Salvador, BA" onEnter={prospectar} />
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <Hoverable
              onClick={podeBuscar ? prospectar : undefined}
              base={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", padding: "11px 22px", background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))", border: "none", borderRadius: "10px", cursor: podeBuscar ? "pointer" : "not-allowed", fontSize: "14px", fontWeight: 700, color: "white", boxShadow: "0 6px 18px rgba(236,122,28,.4)", transition: "transform .14s ease,box-shadow .2s ease,opacity .2s ease", opacity: podeBuscar ? 1 : 0.5, width: "100%" }}
              hover={podeBuscar ? { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(236,122,28,.48)" } : {}}
              active={podeBuscar ? { transform: "translateY(0)" } : {}}
            >
              {loading ? (
                <span style={{ width: "15px", height: "15px", border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", flex: "none" }} />
              ) : (
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="6.5" cy="6.5" r="4" />
                  <path d="M10 10l3 3" />
                </svg>
              )}
              {loading ? "Garimpando…" : "Buscar prospects"}
            </Hoverable>
          </div>
        </div>
      </div>

      {erro && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", fontSize: "14px", color: "#DC2626", marginBottom: "24px", animation: "popIn .3s ease both" }}>{erro}</div>
      )}

      {loading && !res && <ProspeccaoSkeleton />}

      {res && (
        <>
          {/* ── Prospects ── */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", animation: "fadeUp .4s ease both" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", margin: 0, letterSpacing: "-.3px" }}>Prospects</h3>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--blue-500)", background: "var(--blue-50)", border: "1px solid var(--blue-200)", borderRadius: "999px", padding: "2px 10px" }}>{res.total} encontrados</span>
          </div>
          {res.prospects.length === 0 ? (
            <div style={{ background: "white", border: "1px dashed var(--gray-300)", borderRadius: "12px", padding: "40px", textAlign: "center", color: "var(--gray-500)", fontSize: "14px", marginBottom: "32px" }}>
              Nenhum prospect encontrado. Tente um nicho ou localização diferente.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "16px", marginBottom: "34px" }}>
              {res.prospects.map((p, i) => (
                <ProspectCard
                  key={`${p.nome}-${i}`}
                  p={p}
                  index={i}
                  onGerarProposta={(pr) =>
                    onGerarProposta({
                      // briefing rico guia a seleção de produtos: dor real + como ajudamos
                      briefing: `${pr.nome} — ${pr.setor}. Necessidade: ${pr.problema || servicoOferecido.trim() || nicho.trim()}. Solução proposta: ${pr.comoAjudar}`,
                      razaoSocial: pr.nome,
                      segmento: pr.setor || null,
                      contexto: { problema: pr.problema || "", comoAjudar: pr.comoAjudar || "" },
                    })
                  }
                />
              ))}
            </div>
          )}

          {/* ── Abordagens ── */}
          {res.abordagens.length > 0 && (
            <>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginBottom: "16px", letterSpacing: "-.3px", animation: "fadeUp .4s ease both" }}>Estratégias de abordagem</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                {res.abordagens.map((a, i) => (
                  <AbordagemCard key={`${a.titulo}-${i}`} a={a} index={i} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
    </>
  );
}

/* Campo de texto com estado de foco (glow azul) — usado no formulário de prospecção. */
function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
  opcional,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  opcional?: boolean;
  onEnter?: () => void;
}) {
  const [foco, setFoco] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginBottom: "6px" }}>
        {label} {opcional && <span style={{ fontWeight: 400, color: "var(--gray-400)" }}>(opcional)</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFoco(true)}
        onBlur={() => setFoco(false)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        style={{
          width: "100%",
          border: `1px solid ${foco ? "var(--blue-500)" : "var(--gray-200)"}`,
          borderRadius: "10px",
          padding: "11px 13px",
          fontSize: "14px",
          color: "var(--gray-900)",
          fontFamily: "var(--font-sans), sans-serif",
          background: "white",
          outline: "none",
          boxShadow: foco ? "0 0 0 3px rgba(30,107,184,.14)" : "none",
          transition: "border-color .16s ease,box-shadow .16s ease",
        }}
      />
    </div>
  );
}

/* Esqueletos animados (shimmer) enquanto a IA garimpa. */
function ProspeccaoSkeleton() {
  const linha = (w: string, h = "12px") => (
    <div className="ies-skeleton" style={{ width: w, height: h, borderRadius: "6px" }} />
  );
  return (
    <div style={{ animation: "fadeUp .4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "16px", color: "var(--blue-500)", fontSize: "13.5px", fontWeight: 600 }}>
        {[0, 0.16, 0.32].map((d) => (
          <span key={d} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--blue-500)", animation: `wave 1.3s ease-in-out infinite ${d}s` }} />
        ))}
        <span style={{ marginLeft: "4px" }}>Garimpando empresas e minerando contatos…</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "16px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "18px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "12px", animation: "popIn .4s ease both", animationDelay: `${i * 80}ms` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                {linha("60%", "15px")}
                {linha("38%")}
              </div>
              {linha("70px", "20px")}
            </div>
            {linha("100%")}
            {linha("85%")}
            <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
              {linha("90px", "26px")}
              {linha("90px", "26px")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Ícone por tipo de contato. */
function IconeContato({ tipo }: { tipo: "email" | "tel" | "site" | "linkedin" | "instagram" | "facebook" | "whatsapp" }) {
  const props = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (tipo) {
    case "email": return <svg {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
    case "tel": return <svg {...props}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></svg>;
    case "site": return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>;
    case "whatsapp": return <svg {...props}><path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.3-5.3A8.5 8.5 0 1 1 21 11.5Z" /></svg>;
    case "linkedin": return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4" /></svg>;
    case "instagram": return <svg {...props}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="3.5" /><path d="M17 7v.01" /></svg>;
    case "facebook": return <svg {...props}><path d="M14 8h2V5h-2a3 3 0 0 0-3 3v2H9v3h2v6h3v-6h2l1-3h-3V8a1 1 0 0 1 1-1Z" /></svg>;
  }
}

function ProspectCard({ p, index, onGerarProposta }: { p: Prospect; index: number; onGerarProposta: (p: Prospect) => void }) {
  const [copiado, setCopiado] = useState(false);
  const confirmado = p.confiabilidade === "confirmado";
  const acento = confirmado ? "#16A34A" : "#D97706";

  type Tipo = "email" | "tel" | "site" | "linkedin" | "instagram" | "facebook" | "whatsapp";
  type Contato = { tipo: Tipo; valor: string; href: string };
  const limpo = (v: string) => v.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const contatos: Contato[] = [
    ...p.emails.map((v): Contato => ({ tipo: "email", valor: v, href: `mailto:${v}` })),
    ...p.telefones.map((v): Contato => ({ tipo: "tel", valor: v, href: `tel:${v.replace(/[^\d+]/g, "")}` })),
    ...(p.site ? [{ tipo: "site" as const, valor: limpo(p.site), href: p.site.startsWith("http") ? p.site : `https://${p.site}` }] : []),
    ...(p.redes.whatsapp ? [{ tipo: "whatsapp" as const, valor: "WhatsApp", href: p.redes.whatsapp }] : []),
    ...(p.redes.linkedin ? [{ tipo: "linkedin" as const, valor: "LinkedIn", href: p.redes.linkedin }] : []),
    ...(p.redes.instagram ? [{ tipo: "instagram" as const, valor: "Instagram", href: p.redes.instagram }] : []),
    ...(p.redes.facebook ? [{ tipo: "facebook" as const, valor: "Facebook", href: p.redes.facebook }] : []),
  ];

  function copiar() {
    if (!p.mensagemPronta) return;
    navigator.clipboard?.writeText(p.mensagemPronta).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }

  return (
    <Hoverable
      as="div"
      base={{ position: "relative", overflow: "hidden", background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "16px 18px 16px 21px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "11px", transition: "transform .18s ease,box-shadow .18s ease,border-color .18s ease", animation: "fadeUp .45s ease both", animationDelay: `${index * 60}ms` }}
      hover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)", borderColor: "var(--blue-200)" }}
    >
      {/* faixa de procedência */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: acento }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "15.5px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.25 }}>{p.nome}</div>
          <div style={{ fontSize: "12px", color: "var(--gray-500)", marginTop: "2px" }}>{p.setor}</div>
        </div>
        <span
          title={confirmado ? "Confirmado: contato real encontrado na web" : "Estimado pela IA — sem contato comprovado; confirme antes de usar"}
          style={{ display: "flex", alignItems: "center", gap: "5px", flex: "none", fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", whiteSpace: "nowrap", color: acento, background: confirmado ? "#ECFDF5" : "#FFF7ED", border: `1px solid ${confirmado ? "#A7F3D0" : "#FED7AA"}` }}
        >
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: acento }} />
          {confirmado ? "Confirmado" : "Estimado"}
        </span>
      </div>

      {p.problema && (
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "9px", padding: "9px 11px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: "1px" }}>
            <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <span style={{ fontSize: "12.5px", color: "#9A3412", lineHeight: 1.45 }}><strong style={{ fontWeight: 700 }}>Dor:</strong> {p.problema}</span>
        </div>
      )}

      <p style={{ fontSize: "13px", color: "#3a4757", lineHeight: 1.5, margin: 0 }}><strong style={{ color: "var(--blue-700)", fontWeight: 700 }}>Como você resolve: </strong>{p.comoAjudar}</p>

      {contatos.length > 0 && (
        <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: "11px", display: "flex", flexWrap: "wrap", gap: "7px" }}>
          {contatos.map((c, i) => (
            <a
              key={`${c.tipo}-${i}`}
              href={c.href}
              target="_blank"
              rel="noreferrer"
              title={c.valor}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", maxWidth: "100%", fontSize: "12px", fontWeight: 500, color: "var(--blue-700)", background: "var(--blue-50)", border: "1px solid var(--blue-200)", borderRadius: "999px", padding: "4px 11px", textDecoration: "none", lineHeight: 1.2 }}
            >
              <IconeContato tipo={c.tipo} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "150px" }}>{c.valor}</span>
            </a>
          ))}
        </div>
      )}

      {p.mensagemPronta && (
        <details style={{ borderTop: "1px solid var(--gray-100)", paddingTop: "10px" }}>
          <summary style={{ cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "var(--orange-600)", listStyle: "none", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" /></svg>
            Mensagem pronta para enviar
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
            <p style={{ fontSize: "12.5px", color: "#3a4757", lineHeight: 1.5, margin: 0, whiteSpace: "pre-line", background: "var(--gray-50)", border: "1px solid var(--gray-100)", borderRadius: "9px", padding: "10px 12px" }}>{p.mensagemPronta}</p>
            <Hoverable
              onClick={copiar}
              base={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 600, color: copiado ? "#16A34A" : "var(--gray-900)", background: copiado ? "#ECFDF5" : "white", border: `1px solid ${copiado ? "#A7F3D0" : "var(--gray-200)"}`, borderRadius: "8px", padding: "5px 11px", cursor: "pointer", transition: "all .16s ease" }}
              hover={{ borderColor: "var(--orange-500)", color: copiado ? "#16A34A" : "var(--orange-600)" }}
            >
              {copiado ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              )}
              {copiado ? "Copiado!" : "Copiar mensagem"}
            </Hoverable>
          </div>
        </details>
      )}

      <div style={{ borderTop: "1px solid var(--gray-100)", paddingTop: "11px", marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        {p.fonte ? (
          <a href={p.fonte} target="_blank" rel="noreferrer" title={p.fonte} style={{ fontSize: "11px", color: "var(--gray-400)", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>fonte: {p.fonte} ↗</a>
        ) : (
          <span />
        )}
        <Hoverable
          onClick={() => onGerarProposta(p)}
          title="Leva os dados deste prospect para o briefing da proposta"
          base={{ flex: "none", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600, color: "white", background: "var(--orange-500)", border: "none", borderRadius: "8px", padding: "6px 12px", cursor: "pointer", boxShadow: "0 2px 8px rgba(236,122,28,.32)", transition: "transform .12s ease,box-shadow .18s ease" }}
          hover={{ transform: "translateY(-1px)", boxShadow: "0 4px 12px rgba(236,122,28,.4)" }}
        >
          <svg width="13" height="13" viewBox="0 0 17 17" fill="none" stroke="white" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M9.5 2H4.5A1 1 0 003.5 3v11a1 1 0 001 1h8a1 1 0 001-1V6.5L9.5 2z" /><path d="M9.5 2v4.5h4.5" /></svg>
          Gerar proposta
        </Hoverable>
      </div>
    </Hoverable>
  );
}

function AbordagemCard({ a, index }: { a: Abordagem; index: number }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard?.writeText(a.roteiro).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }
  return (
    <Hoverable
      as="div"
      base={{ background: "white", border: "1px solid var(--gray-200)", borderLeft: "3px solid var(--blue-500)", borderRadius: "12px", padding: "16px 18px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "9px", transition: "transform .18s ease,box-shadow .18s ease", animation: "fadeUp .45s ease both", animationDelay: `${index * 70}ms` }}
      hover={{ transform: "translateY(-3px)", boxShadow: "var(--shadow-md)" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.3 }}>{a.titulo}</div>
        <button onClick={copiar} title="Copiar roteiro" style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "center", width: "26px", height: "26px", borderRadius: "8px", border: `1px solid ${copiado ? "#A7F3D0" : "var(--gray-200)"}`, background: copiado ? "#ECFDF5" : "var(--gray-50)", cursor: "pointer", color: copiado ? "#16A34A" : "var(--gray-500)", transition: "all .16s ease" }}>
          {copiado ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          )}
        </button>
      </div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--blue-500)", background: "var(--blue-50)", borderRadius: "999px", padding: "2px 9px" }}>{a.canal}</span>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", background: "var(--gray-100)", borderRadius: "999px", padding: "2px 9px" }}>{a.tom}</span>
      </div>
      <p style={{ fontSize: "12.5px", color: "#3a4757", lineHeight: 1.5, margin: 0, whiteSpace: "pre-line" }}>{a.roteiro}</p>
      <div style={{ fontSize: "12px", color: "var(--gray-500)", borderTop: "1px solid var(--gray-100)", paddingTop: "8px", marginTop: "auto" }}>
        <span style={{ color: "var(--orange-500)", fontWeight: 700, marginRight: "5px" }}>Dica</span>{a.dica}
      </div>
    </Hoverable>
  );
}

/* ═══════════════════════ TELA: POSTS INSTAGRAM ═══════════════════════ */

const TONS_POST: { value: TomPost; label: string }[] = [
  { value: "profissional", label: "Profissional" },
  { value: "descontraido", label: "Descontraído" },
  { value: "inspirador", label: "Inspirador" },
  { value: "humoristico", label: "Humorístico" },
  { value: "educativo", label: "Educativo" },
];

/* Pollinations.ai — geração de imagem grátis, SEM chave e SEM login (modelo Flux).
   O endpoint devolve a imagem direto, então a URL é usada como src do <img>.
   Seed derivada do prompt = URL estável (não regenera a cada render); nonce força nova. */
function pollinationsUrl(prompt: string, nonce: number): string {
  const p = prompt.slice(0, 800);
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (h * 31 + p.charCodeAt(i)) >>> 0;
  const seed = (h + nonce * 7919) % 1_000_000;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=1024&height=1280&model=flux&nologo=true&seed=${seed}`;
}

// Feedback reutilizável por qualquer agente: 👍/👎 + correção humana. 👎 com correção é o que
// faz o sistema aprender (no Atendimento, a correção vira conhecimento indexado no Qdrant).
function FeedbackResposta({ agente, pergunta, resposta }: { agente: string; pergunta: string | null; resposta: string }) {
  const [estado, setEstado] = useState<"idle" | "corrigir" | "enviado">("idle");
  const [correcao, setCorrecao] = useState("");
  const [detalhe, setDetalhe] = useState("");

  async function enviar(util: boolean, corr: string | null) {
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agente, pergunta, resposta, util, correcao: corr }),
      });
      const d = (await r.json()) as { detalhe?: string };
      setDetalhe(d.detalhe ?? "Obrigado pelo feedback!");
    } catch {
      setDetalhe("Feedback registrado.");
    }
    setEstado("enviado");
  }

  if (estado === "enviado") return <div style={{ fontSize: "11px", color: "var(--gray-400)", marginTop: "5px" }}>✓ {detalhe}</div>;

  return (
    <div style={{ marginTop: "5px" }}>
      {estado === "idle" && (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ fontSize: "11px", color: "var(--gray-400)" }}>Útil?</span>
          <button onClick={() => enviar(true, null)} title="Útil" style={{ border: "none", background: "none", cursor: "pointer", fontSize: "13px" }}>👍</button>
          <button onClick={() => setEstado("corrigir")} title="Corrigir" style={{ border: "none", background: "none", cursor: "pointer", fontSize: "13px" }}>👎</button>
        </div>
      )}
      {estado === "corrigir" && (
        <div style={{ marginTop: "4px" }}>
          <textarea value={correcao} onChange={(e) => setCorrecao(e.target.value)} rows={2} placeholder="Qual era a resposta certa? (vira conhecimento da base)" style={{ width: "100%", border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "7px 9px", fontSize: "12px", outline: "none", resize: "vertical" }} />
          <div style={{ display: "flex", gap: "6px", marginTop: "5px" }}>
            <button onClick={() => enviar(false, correcao.trim() || null)} style={{ padding: "5px 12px", border: "none", borderRadius: "7px", background: "var(--blue-600)", color: "white", fontSize: "11.5px", fontWeight: 700, cursor: "pointer" }}>Enviar correção</button>
            <button onClick={() => setEstado("idle")} style={{ padding: "5px 10px", border: "1px solid var(--gray-200)", borderRadius: "7px", background: "white", color: "var(--gray-500)", fontSize: "11.5px", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

type MsgRag = { role: "user" | "assistant"; texto: string; fontes?: RagResposta["fontes"] };

function AtendimentoScreen() {
  const [msgs, setMsgs] = useState<MsgRag[]>([]);
  const [pergunta, setPergunta] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [docTitulo, setDocTitulo] = useState("");
  const [docTexto, setDocTexto] = useState("");
  const [info, setInfo] = useState<string | null>(null);
  const podePerguntar = pergunta.trim().length > 0 && !loading;

  async function chamar(body: object) {
    const r = await fetch("/api/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await r.text();
    let d: unknown = null;
    try {
      d = raw ? JSON.parse(raw) : null;
    } catch {
      /* corpo não-JSON */
    }
    if (!r.ok || !d) {
      const e = (d as { erro?: unknown } | null)?.erro;
      throw new Error(typeof e === "string" ? e : `Falha (HTTP ${r.status}).`);
    }
    return d;
  }

  async function perguntar() {
    if (!podePerguntar) return;
    const texto = pergunta.trim();
    setMsgs((m) => [...m, { role: "user", texto }]);
    setPergunta("");
    setLoading(true);
    setErro(null);
    try {
      const res = (await chamar({ acao: "perguntar", pergunta: texto })) as RagResposta;
      setMsgs((m) => [...m, { role: "assistant", texto: res.resposta, fontes: res.fontes }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro no atendimento.";
      setErro(msg);
      setMsgs((m) => [...m, { role: "assistant", texto: msg }]);
    } finally {
      setLoading(false);
    }
  }

  async function reindexar() {
    setLoading(true);
    setErro(null);
    setInfo(null);
    try {
      const r = (await chamar({ acao: "indexar-catalogo" })) as { pontos: number; colecao: string };
      setInfo(`Catálogo reindexado: ${r.pontos} produto(s) na coleção "${r.colecao}".`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao reindexar.");
    } finally {
      setLoading(false);
    }
  }

  async function indexarDoc() {
    if (!docTitulo.trim() || !docTexto.trim()) return;
    setLoading(true);
    setErro(null);
    setInfo(null);
    try {
      const r = (await chamar({ acao: "indexar-doc", titulo: docTitulo, texto: docTexto })) as { pontos: number };
      setInfo(`Documento "${docTitulo}" indexado em ${r.pontos} trecho(s).`);
      setDocTitulo("");
      setDocTexto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao indexar documento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--gray-50)", display: "flex", flexDirection: "column", height: "100vh" }}>
      <ScreenHead
        title="Atendimento"
        sub="Dúvidas sobre produtos — responde só com o que está na base e cita a fonte"
        right={
          <button onClick={() => setAdmin((a) => !a)} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--gray-200)", background: admin ? "var(--blue-50)" : "white", color: admin ? "var(--blue-600)" : "var(--gray-700)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            {admin ? "Fechar base" : "Gerenciar base"}
          </button>
        }
      />

      {(info || erro || admin) && (
        <div style={{ padding: "16px 28px 0" }}>
          {info && <div style={{ marginBottom: "12px", padding: "11px 14px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "10px", color: "#047857", fontSize: "13px" }}>{info}</div>}
          {erro && <div style={{ marginBottom: "12px", padding: "11px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>{erro}</div>}
          {admin && (
            <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "12px", padding: "18px", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
                <div style={{ fontSize: "13px", color: "var(--gray-600)" }}>Indexe o catálogo (base de produtos) e anexe documentos (FAQ, políticas).</div>
                <Hoverable onClick={loading ? undefined : reindexar} base={{ padding: "9px 16px", background: "var(--blue-600)", border: "none", borderRadius: "9px", cursor: loading ? "wait" : "pointer", fontSize: "13px", fontWeight: 700, color: "white", opacity: loading ? 0.6 : 1 }} hover={loading ? {} : { transform: "translateY(-2px)" }}>Reindexar catálogo</Hoverable>
              </div>
              <input value={docTitulo} onChange={(e) => setDocTitulo(e.target.value)} placeholder="Título do documento (ex.: Política de troca)" style={{ width: "100%", border: "1px solid var(--gray-200)", borderRadius: "10px", padding: "10px 12px", fontSize: "13.5px", marginBottom: "8px", outline: "none" }} />
              <textarea value={docTexto} onChange={(e) => setDocTexto(e.target.value)} rows={4} placeholder="Cole o texto do documento…" style={{ width: "100%", border: "1px solid var(--gray-200)", borderRadius: "10px", padding: "10px 12px", fontSize: "13.5px", outline: "none", resize: "vertical", minHeight: "90px", lineHeight: 1.5 }} />
              <div style={{ marginTop: "10px" }}>
                <Hoverable onClick={loading || !docTitulo.trim() || !docTexto.trim() ? undefined : indexarDoc} base={{ display: "inline-flex", padding: "9px 18px", background: "white", border: "1px solid var(--gray-200)", borderRadius: "9px", cursor: loading || !docTitulo.trim() || !docTexto.trim() ? "not-allowed" : "pointer", fontSize: "13px", fontWeight: 700, color: "var(--gray-700)", opacity: loading || !docTitulo.trim() || !docTexto.trim() ? 0.5 : 1 }} hover={{ border: "1px solid var(--blue-500)", color: "var(--blue-600)" }}>Indexar documento</Hoverable>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="ies-scroll" style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
        {msgs.length === 0 ? (
          <div style={{ margin: "auto", textAlign: "center", maxWidth: "440px", fontSize: "13px", color: "var(--gray-400)", lineHeight: 1.6 }}>
            Ex.: “qual produto desengordurante vocês têm?”, “o Primmax serve pra cozinha industrial?”, “qual a embalagem e preço?”. (Indexe o catálogo primeiro em “Gerenciar base”.)
          </div>
        ) : (
          msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} style={{ alignSelf: "flex-end", maxWidth: "70%", background: "var(--blue-600)", color: "#fff", padding: "11px 15px", borderRadius: "14px", borderBottomRightRadius: "4px", fontSize: "13.5px", lineHeight: 1.5, whiteSpace: "pre-wrap", animation: "fadeUp .3s var(--ease-out) both" }}>{m.texto}</div>
            ) : (
              <div key={i} style={{ alignSelf: "flex-start", maxWidth: "82%", animation: "fadeUp .3s var(--ease-out) both" }}>
                <div style={{ background: "white", border: "1px solid var(--gray-200)", padding: "14px 16px", borderRadius: "14px", borderBottomLeftRadius: "4px", boxShadow: "var(--shadow-sm)", fontSize: "13.5px", color: "var(--gray-800)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {m.texto}
                  {m.fontes && m.fontes.length > 0 && (
                    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
                      {m.fontes.map((f, j) => (
                        <div key={j} style={{ fontSize: "11px", color: "var(--gray-500)", background: "var(--gray-50)", border: "1px solid var(--gray-200)", borderRadius: "8px", padding: "6px 9px" }}>
                          <b>[{j + 1}] {f.titulo}</b> <span style={{ color: "var(--gray-400)" }}>· {f.tipo} · {(f.score * 100).toFixed(0)}%</span>
                          <div style={{ marginTop: "2px", color: "var(--gray-500)" }}>{f.trecho.slice(0, 160)}…</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <FeedbackResposta agente="atendimento" pergunta={msgs[i - 1]?.texto ?? null} resposta={m.texto} />
              </div>
            ),
          )
        )}
        {loading && <div style={{ alignSelf: "flex-start", fontSize: "13px", color: "var(--gray-400)" }}>Buscando na base…</div>}
      </div>

      <div style={{ padding: "14px 28px 22px", background: "linear-gradient(to top,var(--gray-50) 70%,transparent)" }}>
        <div style={{ maxWidth: "760px", margin: "0 auto", background: "white", border: "1.5px solid var(--gray-200)", borderRadius: "14px", boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", padding: "8px 8px 8px 16px", gap: "8px" }}>
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); perguntar(); } }}
            placeholder="Pergunte sobre os produtos…"
            style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", fontFamily: "var(--font-sans), sans-serif", color: "var(--gray-900)", background: "transparent" }}
          />
          <button onClick={() => podePerguntar && perguntar()} disabled={!podePerguntar} title="Enviar" style={{ width: "38px", height: "38px", borderRadius: "10px", background: "var(--orange-500)", border: "none", cursor: podePerguntar ? "pointer" : "not-allowed", opacity: podePerguntar ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            {loading ? (
              <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function ContratoScreen({ scope, onVerProposta }: { scope: PropostaScope | null; onVerProposta: () => void }) {
  const [modo, setModo] = useState<"gerar" | "analisar">("gerar");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [contrato, setContrato] = useState<ContratoScope | null>(null);
  const [texto, setTexto] = useState("");
  const [analise, setAnalise] = useState<ContratoAnalise | null>(null);
  const [extraindo, setExtraindo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function chamar(body: object) {
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch("/api/contrato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await r.text();
      let d: unknown = null;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const e = (d as { erro?: unknown } | null)?.erro;
        throw new Error(typeof e === "string" ? e : `Falha (HTTP ${r.status}).`);
      }
      return d;
    } finally {
      setLoading(false);
    }
  }

  async function gerar() {
    if (!scope) return;
    setContrato(null);
    try {
      setContrato((await chamar({ acao: "gerar", proposta: scope })) as ContratoScope);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar.");
    }
  }

  async function analisar() {
    if (!texto.trim()) return;
    setAnalise(null);
    try {
      setAnalise((await chamar({ acao: "analisar", texto })) as ContratoAnalise);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao analisar.");
    }
  }

  // Anexa o contrato do computador: extrai o texto (PDF/DOCX/TXT) no servidor e preenche
  // o campo. A extração é determinística (sem IA); a análise continua sendo o passo seguinte.
  async function anexar(file: File | null | undefined) {
    if (!file) return;
    setExtraindo(true);
    setErro(null);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      const r = await fetch("/api/contrato/extrair", { method: "POST", body: fd });
      const raw = await r.text();
      let d: unknown = null;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const e = (d as { erro?: unknown } | null)?.erro;
        throw new Error(typeof e === "string" ? e : `Falha ao ler o arquivo (HTTP ${r.status}).`);
      }
      setTexto((d as { texto: string }).texto);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler o arquivo.");
    } finally {
      setExtraindo(false);
    }
  }

  function imprimir(c: ContratoScope) {
    const itens = c.itens
      .map((i) => `<tr><td>${i.codigo}</td><td>${i.nome}</td><td style="text-align:right">${i.quantidade}</td><td style="text-align:right">R$ ${i.precoUnitario}</td><td style="text-align:right">R$ ${i.subtotal}</td></tr>`)
      .join("");
    const clausulas = c.clausulas
      .map((cl, n) => `<h3>${n + 1}. ${cl.titulo}</h3><p>${cl.texto}</p>`)
      .join("");
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato</title>
<style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;color:#1a1a1a;line-height:1.6;padding:0 24px}h1{text-align:center;font-size:20px}h3{font-size:14px;margin:18px 0 4px}table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}td,th{border:1px solid #ccc;padding:6px 8px}.tot{text-align:right;font-weight:bold;font-size:15px;margin-top:8px}.parte{margin:6px 0;font-size:14px}</style></head>
<body><h1>CONTRATO DE FORNECIMENTO</h1>
<p class="parte"><b>CONTRATADA:</b> ${c.contratada.razaoSocial} — CNPJ ${c.contratada.cnpj}</p>
<p class="parte"><b>CONTRATANTE:</b> ${c.contratante.razaoSocial} — CNPJ ${c.contratante.cnpj}</p>
<p><b>Objeto:</b> ${c.objeto}.</p>
<table><thead><tr><th>Cód.</th><th>Item</th><th>Qtd</th><th>Preço un.</th><th>Subtotal</th></tr></thead><tbody>${itens}</tbody></table>
<p class="tot">Valor total: R$ ${c.valorTotal}</p>
${clausulas}
<p style="margin-top:40px;font-size:12px;color:#777">Gerado pelo Agente de Proposta Indeba — origem proposta ${c.origemPropostaId}.</p>
</body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }

  const corSev = (s: string) =>
    s === "alta" ? { bg: "#FEF2F2", fg: "#B91C1C", bd: "#FECACA" } : s === "media" ? { bg: "#FFFBEB", fg: "#B45309", bd: "#FDE68A" } : { bg: "#F3F4F6", fg: "#4B5563", bd: "#E5E7EB" };

  return (
    <div style={{ background: "var(--gray-50)", minHeight: "100vh", paddingBottom: "40px" }}>
      <ScreenHead
        title="Contrato"
        sub="View determinística da proposta · cláusulas redigidas pela IA"
        right={
          <div style={{ display: "flex", background: "var(--gray-100)", borderRadius: "8px", padding: "3px", gap: "2px" }}>
            {(["gerar", "analisar"] as const).map((m) => (
              <button key={m} onClick={() => { setModo(m); setErro(null); }} style={{ padding: "6px 14px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: modo === m ? 600 : 400, background: modo === m ? "var(--blue-800)" : "transparent", color: modo === m ? "#fff" : "var(--gray-500)", fontFamily: "inherit" }}>{m === "gerar" ? "Gerar" : "Analisar recebido"}</button>
            ))}
          </div>
        }
      />
      <div style={{ padding: "20px 28px", maxWidth: "860px", margin: "0 auto" }}>
        {erro && <div style={{ marginBottom: "16px", padding: "11px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>{erro}</div>}

        {modo === "gerar" ? (
          !scope ? (
            <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "40px", textAlign: "center", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: "14px", color: "var(--gray-500)", marginBottom: "14px" }}>Nenhuma proposta aberta. Gere ou abra uma proposta para criar o contrato a partir dela.</div>
              <Hoverable onClick={onVerProposta} base={{ display: "inline-flex", padding: "10px 18px", background: "var(--blue-600)", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "white" }} hover={{ transform: "translateY(-2px)" }}>Ir para a proposta</Hoverable>
            </div>
          ) : !contrato ? (
            <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "28px", textAlign: "center", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ fontSize: "13px", color: "var(--gray-600)", marginBottom: "16px" }}>Proposta de <b>{scope.cliente.razaoSocial}</b> — {scope.itens.length} {scope.itens.length === 1 ? "item" : "itens"}.</div>
              <Hoverable onClick={loading ? undefined : gerar} base={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "11px 22px", background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))", border: "none", borderRadius: "10px", cursor: loading ? "wait" : "pointer", fontSize: "14px", fontWeight: 700, color: "white", boxShadow: "0 6px 18px rgba(236,122,28,.4)", opacity: loading ? 0.6 : 1 }} hover={loading ? {} : { transform: "translateY(-2px)" }}>{loading ? "Gerando…" : "Gerar contrato"}</Hoverable>
            </div>
          ) : (
            <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", overflow: "hidden", boxShadow: "var(--shadow-sm)", animation: "fadeUp .4s var(--ease-out) both" }}>
              <div style={{ padding: "22px 28px", borderBottom: "1px solid var(--gray-200)", textAlign: "center" }}>
                <div style={{ fontSize: "11px", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--gray-400)" }}>Contrato de Fornecimento</div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--gray-900)", marginTop: "4px" }}>{contrato.contratada.razaoSocial} × {contrato.contratante.razaoSocial}</div>
              </div>
              <div style={{ padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", borderBottom: "1px solid var(--gray-200)", background: "var(--gray-50)" }}>
                <div><div style={{ fontSize: "11px", color: "var(--gray-400)", marginBottom: "3px" }}>CONTRATADA</div><div style={{ fontSize: "13.5px", fontWeight: 600 }}>{contrato.contratada.razaoSocial}</div><div style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "var(--font-mono)" }}>CNPJ {contrato.contratada.cnpj}</div></div>
                <div><div style={{ fontSize: "11px", color: "var(--gray-400)", marginBottom: "3px" }}>CONTRATANTE</div><div style={{ fontSize: "13.5px", fontWeight: 600 }}>{contrato.contratante.razaoSocial}</div><div style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "var(--font-mono)" }}>CNPJ {contrato.contratante.cnpj}</div></div>
              </div>
              <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>
                {contrato.clausulas.map((cl, n) => (
                  <div key={n} style={{ animation: `fadeUp .35s var(--ease-out) ${n * 0.06}s both` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                      <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--gray-900)" }}>{n + 1}. {cl.titulo}</span>
                      <ProcBadge proc={cl.procedencia} />
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--gray-600)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>{cl.texto}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: "16px 28px", borderTop: "1px solid var(--gray-200)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--gray-50)" }}>
                <span style={{ fontSize: "13px", color: "var(--gray-500)" }}>Valor total <b style={{ fontFamily: "var(--font-mono)", color: "var(--blue-600)", fontSize: "15px" }}>R$ {contrato.valorTotal}</b></span>
                <Hoverable onClick={() => imprimir(contrato)} base={{ display: "flex", alignItems: "center", gap: "7px", padding: "9px 18px", background: "var(--orange-500)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600, color: "white" }} hover={{ transform: "translateY(-1px)" }}>
                  <svg width="14" height="14" viewBox="0 0 17 17" fill="none" stroke="white" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 2v8M5.5 7.5l3 3 3-3M3 13.5h11" /></svg>Baixar PDF
                </Hoverable>
              </div>
            </div>
          )
        ) : (
          <div>
            <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "18px 20px", boxShadow: "var(--shadow-sm)", marginBottom: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-700)" }}>Cole o texto do contrato recebido — ou anexe o arquivo</div>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }} onChange={(e) => { anexar(e.target.files?.[0]); e.target.value = ""; }} />
                <Hoverable onClick={extraindo ? undefined : () => fileRef.current?.click()} base={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "8px 14px", background: "white", border: "1px solid var(--gray-200)", borderRadius: "9px", cursor: extraindo ? "wait" : "pointer", fontSize: "12.5px", fontWeight: 600, color: "var(--gray-700)" }} hover={extraindo ? {} : { border: "1px solid var(--blue-500)", color: "var(--blue-600)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                  {extraindo ? "Lendo arquivo…" : "Anexar PDF/DOCX/TXT"}
                </Hoverable>
              </div>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} placeholder="Cole aqui o contrato recebido… ou anexe um arquivo acima" style={{ width: "100%", border: "1px solid var(--gray-200)", borderRadius: "10px", padding: "12px 14px", fontSize: "13.5px", color: "var(--gray-900)", fontFamily: "var(--font-sans), sans-serif", outline: "none", resize: "vertical", minHeight: "140px", lineHeight: 1.5 }} />
              <div style={{ marginTop: "12px" }}>
                <Hoverable onClick={loading || !texto.trim() ? undefined : analisar} base={{ display: "inline-flex", padding: "11px 22px", background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))", border: "none", borderRadius: "10px", cursor: loading || !texto.trim() ? "not-allowed" : "pointer", fontSize: "14px", fontWeight: 700, color: "white", boxShadow: "0 6px 18px rgba(236,122,28,.4)", opacity: loading || !texto.trim() ? 0.5 : 1 }} hover={loading || !texto.trim() ? {} : { transform: "translateY(-2px)" }}>{loading ? "Analisando…" : "Analisar riscos"}</Hoverable>
              </div>
            </div>
            {analise && (
              <div style={{ animation: "fadeUp .4s var(--ease-out) both" }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-700)", marginBottom: "10px" }}>{analise.achados.length} ponto(s) encontrado(s)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
                  {analise.achados.map((a, i) => {
                    const c = corSev(a.severidade);
                    return (
                      <div key={i} style={{ background: "white", border: "1px solid var(--gray-200)", borderLeft: `3px solid ${c.fg}`, borderRadius: "10px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "14px", boxShadow: "var(--shadow-xs)", animation: `fadeUp .35s var(--ease-out) ${i * 0.07}s both` }}>
                        <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", background: c.bg, color: c.fg, minWidth: "60px", textAlign: "center" }}>{a.tipo}</span>
                        {a.valor && <span style={{ fontFamily: "var(--font-mono)", fontSize: "13px", fontWeight: 700, color: "var(--gray-900)", minWidth: "80px" }}>{a.valor}</span>}
                        <span style={{ fontSize: "13px", color: "var(--gray-600)", flex: 1, fontStyle: "italic" }}>“…{a.trecho}…”</span>
                      </div>
                    );
                  })}
                </div>
                {analise.explicacao && <div style={{ fontSize: "13.5px", color: "var(--gray-700)", lineHeight: 1.6, whiteSpace: "pre-wrap", background: "var(--gray-50)", border: "1px solid var(--gray-200)", borderRadius: "10px", padding: "14px" }}>{analise.explicacao}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Lê um arquivo de planilha como CSV: .xlsx/.xls são convertidos no navegador (SheetJS,
// import dinâmico, 1ª aba); .csv vai como texto. Compartilhado por Financeiro e Cobrança.
async function planilhaParaCsv(f: File): Promise<string> {
  if (/\.xlsx?$/i.test(f.name)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer());
    return XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
  }
  return f.text();
}

// Monta uma célula CSV segura: neutraliza formula injection (célula iniciada por
// =,+,-,@ ou tab/CR é tratada como fórmula pelo Excel/Sheets → prefixa aspa simples
// para virar texto inerte) e escapa aspas. Use em todo export CSV.
function csvCelula(valor: unknown): string {
  const s = String(valor ?? "");
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${seguro.replace(/"/g, '""')}"`;
}

// ── Relatório unificado (print → PDF) ──────────────────────────────────────────
// Qualquer agente de análise monta "blocos" e chama abrirRelatorio(); abre uma janela
// limpa só com o relatório e dispara a impressão (salvar como PDF). Reutilizável.
type BlocoRelatorio = { titulo?: string } & (
  | { tipo: "texto"; conteudo: string }
  | { tipo: "kv"; itens: [string, string][] }
  | { tipo: "tabela"; colunas: string[]; linhas: string[][]; alinharDireita?: number[] }
);

function escHtml(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}

function relatorioHtml(titulo: string, subtitulo: string, blocos: BlocoRelatorio[], dataGeracao: string): string {
  const corpo = blocos
    .map((b) => {
      const h = b.titulo ? `<h2>${escHtml(b.titulo)}</h2>` : "";
      if (b.tipo === "texto") return `${h}<p>${escHtml(b.conteudo)}</p>`;
      if (b.tipo === "kv") return `${h}<div class="kv">${b.itens.map(([k, v]) => `<div><b>${escHtml(k)}:</b> ${escHtml(v)}</div>`).join("")}</div>`;
      const ad = new Set(b.alinharDireita ?? []);
      const thead = `<tr>${b.colunas.map((c, i) => `<th class="${ad.has(i) ? "num" : ""}">${escHtml(c)}</th>`).join("")}</tr>`;
      const tbody = b.linhas.map((l) => `<tr>${l.map((c, i) => `<td class="${ad.has(i) ? "num" : ""}">${escHtml(c)}</td>`).join("")}</tr>`).join("");
      return `${h}<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
    })
    .join("");
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escHtml(titulo)}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;max-width:820px;margin:32px auto;color:#1a1a1a;padding:0 28px}
.hd{border-bottom:3px solid #1E6BB8;padding-bottom:12px;margin-bottom:18px}
.hd h1{margin:0;font-size:22px;color:#1E3A8A}.hd .sub{color:#555;font-size:13px;margin-top:4px}.hd .meta{color:#999;font-size:11px;margin-top:6px}
h2{font-size:14px;color:#1E6BB8;margin:22px 0 8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0}th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#f3f4f6}.num{text-align:right}
.kv{font-size:13px;line-height:1.7}.kv b{display:inline-block;min-width:140px;color:#555}
p{font-size:13px;line-height:1.6;white-space:pre-wrap}.ft{margin-top:32px;border-top:1px solid #eee;padding-top:8px;color:#999;font-size:10px}
@media print{body{margin:0}}
</style></head><body>
<div class="hd"><h1>${escHtml(titulo)}</h1><div class="sub">${escHtml(subtitulo)}</div><div class="meta">Gerado em ${escHtml(dataGeracao)} · Agente de Proposta Indeba</div></div>
${corpo}
<div class="ft">Documento gerado automaticamente — confira os dados antes de usar.</div>
</body></html>`;
}

function abrirRelatorio(titulo: string, subtitulo: string, blocos: BlocoRelatorio[]) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(relatorioHtml(titulo, subtitulo, blocos, new Date().toLocaleString("pt-BR")));
  w.document.close();
  w.focus();
  w.print();
}

/* Cabeçalho de tela (design app.html) — barra branca fixa com título + subtítulo + ação. */
function ScreenHead({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const { openPalette, openAssistant } = useContext(ChromeContext);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "0 24px", height: "62px", background: "var(--surface)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 20, flex: "none" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--text-strong)", letterSpacing: "-.01em", lineHeight: 1.15 }}>{title}</div>
        {sub && <div style={{ fontSize: "12.5px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {right}
      {/* Busca global → abre a command palette (Ctrl/Cmd+K) */}
      <Hoverable
        onClick={openPalette}
        title="Buscar (Ctrl/Cmd+K)"
        base={{ display: "flex", alignItems: "center", gap: "9px", height: "38px", padding: "0 12px", borderRadius: "10px", border: "1px solid var(--border-strong)", background: "var(--surface-sunken)", color: "var(--text-subtle)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px", minWidth: "210px" }}
        hover={{ background: "var(--surface-muted)" }}
      >
        <svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5l4 4" /></svg>
        <span style={{ flex: 1, textAlign: "left" }}>Buscar telas, produtos…</span>
        <span style={{ fontSize: "10.5px", fontWeight: 700, padding: "2px 6px", borderRadius: "5px", background: "var(--surface-card)", border: "1px solid var(--border)", color: "var(--text-subtle)" }}>⌘K</span>
      </Hoverable>
      {/* Notificações → atalho para Cobrança (régua/inadimplência) */}
      <Hoverable
        onClick={openPalette}
        title="Notificações"
        base={{ position: "relative", width: "38px", height: "38px", borderRadius: "10px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
        hover={{ background: "var(--surface-muted)" }}
      >
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 7a3.5 3.5 0 017 0c0 3 1.5 4 1.5 4h-10S5 10 5 7z" /><path d="M7.3 13.5a1.4 1.4 0 002.4 0" /></svg>
        <span style={{ position: "absolute", top: "7px", right: "8px", width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent)", border: "1.5px solid var(--surface)" }} />
      </Hoverable>
      {/* Assistente → abre o overlay AjudaChat */}
      <Hoverable
        onClick={openAssistant}
        title="Assistente"
        base={{ display: "flex", alignItems: "center", gap: "7px", height: "38px", padding: "0 14px", borderRadius: "10px", border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "13px", fontWeight: 600, boxShadow: "var(--shadow-sm)" }}
        hover={{ background: "var(--primary-hover)" }}
      >
        <svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 2.2l1.5 3.3 3.3 1.5-3.3 1.5L8.5 12 7 8l-3.3-1.5L7 5z" /></svg>
        Assistente
      </Hoverable>
    </div>
  );
}

/* Selo de procedência (design app.html): MOTOR/MODELO-FIXO = verde (determinístico); IA = azul. */
function ProcBadge({ proc }: { proc: string }) {
  const motor = proc === "MOTOR" || proc === "MODELO-FIXO";
  return (
    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: motor ? "#DCFCE7" : "var(--blue-50)", color: motor ? "#16A34A" : "var(--blue-600)", letterSpacing: ".03em" }}>{proc}</span>
  );
}

function ContabilScreen() {
  const [res, setRes] = useState<ContabilResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const brl = (s: string) => Number(s).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  async function apurar(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    setNome(f.name);
    try {
      const csv = await planilhaParaCsv(f);
      const r = await fetch("/api/contabil", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planilha: { nome: f.name.replace(/\.[^.]+$/, ""), csv } }) });
      const raw = await r.text();
      let d: unknown = null;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const e = (d as { erro?: unknown } | null)?.erro;
        throw new Error(typeof e === "string" ? e : `Falha (HTTP ${r.status}).`);
      }
      setRes(d as ContabilResponse);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro na apuração contábil.");
    } finally {
      setLoading(false);
    }
  }

  function relatorio() {
    if (!res) return;
    const blocos: BlocoRelatorio[] = [
      { tipo: "kv", titulo: "Invariantes", itens: [["Partida dobrada", res.partidaDobradaOk ? "OK (D=C)" : "NÃO BATE"], ["Σ Débitos", `R$ ${brl(res.totalDebitos)}`], ["Σ Créditos", `R$ ${brl(res.totalCreditos)}`]] },
    ];
    if (res.bp) blocos.push({ tipo: "kv", titulo: `Balanço Patrimonial (${res.bp.fecha ? "fecha" : "NÃO fecha"})`, itens: [["Ativo", `R$ ${brl(res.bp.totalAtivo)}`], ["Passivo", `R$ ${brl(res.bp.totalPassivo)}`], ["PL", `R$ ${brl(res.bp.totalPL)}`], ["Resultado", `R$ ${brl(res.bp.resultado)}`]] });
    if (res.dre) blocos.push({ tipo: "kv", titulo: "DRE", itens: [["Receitas", `R$ ${brl(res.dre.totalReceitas)}`], ["Custos", `R$ ${brl(res.dre.totalCustos)}`], ["Despesas", `R$ ${brl(res.dre.totalDespesas)}`], ["Resultado", `R$ ${brl(res.dre.resultado)}`]] });
    blocos.push({ tipo: "tabela", titulo: "Balancete", colunas: ["Conta", "Natureza", "Débito", "Crédito", "Saldo"], linhas: res.balancete.map((b) => [b.conta, b.natureza ?? "—", `R$ ${brl(b.debito)}`, `R$ ${brl(b.credito)}`, `R$ ${brl(b.saldo)}`]), alinharDireita: [2, 3, 4] });
    if (res.resumo) blocos.push({ tipo: "texto", titulo: "Análise", conteudo: res.resumo });
    abrirRelatorio("Relatório Contábil", res.partidaDobradaOk ? "Escrituração balanceada" : "ATENÇÃO: partida dobrada não bate", blocos);
  }

  return (
    <>
      <ScreenHead title="Contábil" sub="Diário/razão → partida dobrada e equação patrimonial" />
      <div style={{ padding: "28px", maxWidth: "960px" }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "18px", padding: "26px 30px", marginBottom: "20px", background: "linear-gradient(120deg,#312E81 0%,#1E3A8A 60%,#0F766E 130%)", boxShadow: "0 14px 34px rgba(49,46,129,.26)", animation: "fadeUp .5s ease both" }}>
        <div style={{ position: "absolute", top: "-60px", right: "-30px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
        <div style={{ position: "relative" }}>
          <h2 style={{ fontSize: "25px", fontWeight: 800, color: "white", letterSpacing: "-.5px", margin: 0 }}>Contábil</h2>
          <div style={{ fontSize: "14px", color: "rgba(255,255,255,.9)", marginTop: "4px", maxWidth: "680px" }}>
            Suba o diário/razão (CSV/XLSX: conta, débito, crédito, natureza). O motor força partida dobrada (D=C) e a equação patrimonial (A = P + PL) — se D=C, o balanço fecha. A IA só comenta.
          </div>
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "20px", boxShadow: "var(--shadow-md)", marginBottom: "16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <Hoverable onClick={() => fileRef.current?.click()} base={{ padding: "11px 20px", background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "white", boxShadow: "0 6px 18px rgba(236,122,28,.4)" }} hover={{ transform: "translateY(-2px)" }}>
          {loading ? "Apurando…" : "Subir diário/razão"}
        </Hoverable>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display: "none" }} onChange={(e) => apurar(e.target.files)} />
        <div style={{ fontSize: "12.5px", color: "var(--gray-500)" }}>{nome ? `Arquivo: ${nome}` : "1 linha por partida."}</div>
        {res && <Hoverable onClick={relatorio} base={{ marginLeft: "auto", padding: "9px 16px", background: "var(--blue-600)", border: "none", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "white" }} hover={{ transform: "translateY(-1px)" }}>Relatório (PDF)</Hoverable>}
      </div>

      {erro && <div style={{ marginBottom: "16px", padding: "11px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>{erro}</div>}

      {res && (
        <div style={{ animation: "fadeUp .4s ease both" }}>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "14px" }}>
            <span style={{ fontSize: "13px", fontWeight: 800, color: res.partidaDobradaOk ? "#15803D" : "#B91C1C", background: res.partidaDobradaOk ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${res.partidaDobradaOk ? "#A7F3D0" : "#FECACA"}`, padding: "6px 12px", borderRadius: "999px" }}>
              {res.partidaDobradaOk ? "✓ Partida dobrada (D=C)" : "✗ D ≠ C"} · R$ {brl(res.totalDebitos)}
            </span>
            {res.bp && <span style={{ fontSize: "13px", fontWeight: 800, color: res.bp.fecha ? "#15803D" : "#B91C1C", background: res.bp.fecha ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${res.bp.fecha ? "#A7F3D0" : "#FECACA"}`, padding: "6px 12px", borderRadius: "999px" }}>{res.bp.fecha ? "✓ Balanço fecha" : "✗ Balanço não fecha"}</span>}
          </div>

          {res.aviso && <div style={{ marginBottom: "14px", padding: "11px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", color: "#B45309", fontSize: "13px" }}>{res.aviso}</div>}
          {res.divergencias.length > 0 && (
            <div style={{ marginBottom: "14px", display: "flex", flexDirection: "column", gap: "6px" }}>
              {res.divergencias.map((d, i) => <div key={i} style={{ padding: "9px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", color: "#B91C1C", fontSize: "12.5px" }}>{d.descricao}</div>)}
            </div>
          )}
          {res.resumo && <div style={{ marginBottom: "16px", padding: "14px 16px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: "12px", color: "#3730A3", fontSize: "13.5px", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{res.resumo}</div>}

          {res.bp && res.dre && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
              <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "12px", padding: "16px", fontSize: "13px" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--gray-500)", textTransform: "uppercase" }}>Balanço Patrimonial</h4>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Ativo</span><b>R$ {brl(res.bp.totalAtivo)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Passivo</span><b>R$ {brl(res.bp.totalPassivo)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>PL</span><b>R$ {brl(res.bp.totalPL)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: res.bp.resultado.startsWith("-") ? "#B91C1C" : "#15803D" }}><span>Resultado</span><b>R$ {brl(res.bp.resultado)}</b></div>
              </div>
              <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "12px", padding: "16px", fontSize: "13px" }}>
                <h4 style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--gray-500)", textTransform: "uppercase" }}>DRE</h4>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Receitas</span><b>R$ {brl(res.dre.totalReceitas)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Custos</span><b>− R$ {brl(res.dre.totalCustos)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Despesas</span><b>− R$ {brl(res.dre.totalDespesas)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", color: res.dre.resultado.startsWith("-") ? "#B91C1C" : "#15803D" }}><span>Resultado</span><b>R$ {brl(res.dre.resultado)}</b></div>
              </div>
            </div>
          )}

          <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "12px", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <thead><tr style={{ background: "var(--gray-50)", color: "var(--gray-500)", textAlign: "left" }}><th style={{ padding: "8px" }}>Conta</th><th style={{ padding: "8px" }}>Natureza</th><th style={{ padding: "8px", textAlign: "right" }}>Débito</th><th style={{ padding: "8px", textAlign: "right" }}>Crédito</th><th style={{ padding: "8px", textAlign: "right" }}>Saldo</th></tr></thead>
              <tbody>
                {res.balancete.map((b, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--gray-100)" }}>
                    <td style={{ padding: "8px" }}>{b.conta}</td>
                    <td style={{ padding: "8px", color: "var(--gray-400)" }}>{b.natureza ?? "—"}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>R$ {brl(b.debito)}</td>
                    <td style={{ padding: "8px", textAlign: "right" }}>R$ {brl(b.credito)}</td>
                    <td style={{ padding: "8px", textAlign: "right", fontWeight: 600 }}>R$ {brl(b.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

function FiscalScreen() {
  const [res, setRes] = useState<FiscalResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function ler(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    setNome(f.name);
    try {
      const xml = await f.text();
      const r = await fetch("/api/fiscal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xml }),
      });
      const raw = await r.text();
      let d: unknown = null;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const e = (d as { erro?: unknown } | null)?.erro;
        throw new Error(typeof e === "string" ? e : `Falha (HTTP ${r.status}).`);
      }
      setRes(d as FiscalResponse);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao ler a NF-e.");
    } finally {
      setLoading(false);
    }
  }

  const corSev = (s: string) => (s === "alta" ? { bg: "#FEF2F2", fg: "#B91C1C" } : s === "media" ? { bg: "#FFFBEB", fg: "#B45309" } : { bg: "#F3F4F6", fg: "#4B5563" });

  function relatorio() {
    if (!res) return;
    const n = res.nota;
    abrirRelatorio(`Relatório NF-e ${n.numero}`, `${n.emitente.nome} → ${n.destinatario.nome}`, [
      { tipo: "kv" as const, titulo: "Dados da nota", itens: [["Número", n.numero], ["Série", n.serie], ["Emissão", n.dataEmissao], ["Natureza", n.naturezaOperacao], ["Chave", n.chaveAcesso], ["Emitente", `${n.emitente.nome} (${n.emitente.documento})`], ["Destinatário", `${n.destinatario.nome} (${n.destinatario.documento})`]] },
      { tipo: "tabela" as const, titulo: "Itens", colunas: ["Código", "Descrição", "Qtd", "Vlr un.", "Total"], linhas: n.itens.map((i) => [i.codigo, i.descricao, i.quantidade, `R$ ${i.valorUnitario}`, `R$ ${i.valorTotal}`]), alinharDireita: [2, 3, 4] },
      { tipo: "kv" as const, titulo: "Totais", itens: [["Produtos", `R$ ${n.valorProdutos}`], ["Frete", `R$ ${n.valorFrete}`], ["ICMS", `R$ ${n.valorICMS}`], ["Total", `R$ ${n.valorTotal}`]] },
      ...(res.achados.length ? [{ tipo: "texto" as const, titulo: "Achados", conteudo: res.achados.map((a) => `[${a.severidade}] ${a.descricao}`).join("\n") }] : []),
      { tipo: "texto" as const, titulo: "Resumo", conteudo: res.resumo },
    ]);
  }

  return (
    <div style={{ background: "var(--gray-50)", minHeight: "100vh", paddingBottom: "40px" }}>
      <ScreenHead
        title="Fiscal / NF-e"
        sub="Parse do XML · validações do motor"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {res && <Hoverable onClick={relatorio} base={{ padding: "8px 14px", background: "white", border: "1px solid var(--gray-200)", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "var(--gray-700)" }} hover={{ border: "1px solid var(--blue-500)", color: "var(--blue-600)" }}>Relatório (PDF)</Hoverable>}
            <Hoverable onClick={() => fileRef.current?.click()} base={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 16px", background: "var(--blue-600)", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "13.5px", fontWeight: 600, color: "white" }} hover={{ background: "var(--blue-700)" }}>
              <svg width="14" height="14" viewBox="0 0 17 17" fill="none" stroke="white" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 11V3M5.5 6l3-3 3 3M3 13.5h11" /></svg>
              {loading ? "Lendo…" : "Carregar XML"}
            </Hoverable>
          </div>
        }
      />
      <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" style={{ display: "none" }} onChange={(e) => ler(e.target.files)} />
      <div style={{ padding: "20px 28px" }}>
        {erro && <div style={{ marginBottom: "16px", padding: "11px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>{erro}</div>}
        {!res && !erro && (
          <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "40px", textAlign: "center", color: "var(--gray-400)", fontSize: "14px", boxShadow: "var(--shadow-sm)" }}>
            {nome ? `Arquivo: ${nome}` : "Carregue o XML de uma NF-e (modelo 55) para extrair os dados e ver as validações do motor."}
          </div>
        )}
        {res && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "20px", animation: "fadeUp .4s var(--ease-out) both" }}>
            {/* nota */}
            <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ background: "var(--gradient-brand)", color: "#fff", padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                <div><div style={{ fontSize: "11px", opacity: .8, letterSpacing: ".08em", textTransform: "uppercase" }}>Nota Fiscal Eletrônica</div><div style={{ fontSize: "18px", fontWeight: 800, marginTop: "2px" }}>Nº {res.nota.numero} · Série {res.nota.serie}</div></div>
                <div style={{ textAlign: "right", fontSize: "12px", opacity: .9 }}>{res.nota.dataEmissao}<br />{res.nota.naturezaOperacao}</div>
              </div>
              <div style={{ padding: "16px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", fontSize: "13px" }}>
                <div><div style={{ fontSize: "11px", color: "var(--gray-400)", marginBottom: "2px" }}>Emitente</div><div style={{ fontWeight: 600, color: "var(--gray-900)" }}>{res.nota.emitente.nome}</div><div style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "var(--font-mono)" }}>{res.nota.emitente.documento}</div></div>
                <div><div style={{ fontSize: "11px", color: "var(--gray-400)", marginBottom: "2px" }}>Destinatário</div><div style={{ fontWeight: 600, color: "var(--gray-900)" }}>{res.nota.destinatario.nome}</div><div style={{ fontSize: "12px", color: "var(--gray-500)", fontFamily: "var(--font-mono)" }}>{res.nota.destinatario.documento}</div></div>
              </div>
              <div style={{ padding: "0 22px 6px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{["Código", "Descrição", "Qtd", "Unit.", "Total"].map((h, j) => <th key={h} style={{ padding: "8px 6px", fontSize: "10.5px", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", textAlign: j >= 2 ? "right" : "left", borderBottom: "1px solid var(--gray-200)" }}>{h}</th>)}</tr></thead>
                  <tbody>{res.nota.itens.map((it, n) => (
                    <tr key={n}>
                      <td style={{ padding: "9px 6px", fontSize: "12px", fontFamily: "var(--font-mono)", color: "var(--gray-500)", borderBottom: "1px solid var(--gray-100)" }}>{it.codigo}</td>
                      <td style={{ padding: "9px 6px", fontSize: "12.5px", color: "var(--gray-800)", borderBottom: "1px solid var(--gray-100)" }}>{it.descricao}</td>
                      <td style={{ padding: "9px 6px", fontSize: "12.5px", textAlign: "right", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--gray-100)" }}>{it.quantidade}</td>
                      <td style={{ padding: "9px 6px", fontSize: "12.5px", textAlign: "right", fontFamily: "var(--font-mono)", borderBottom: "1px solid var(--gray-100)" }}>R$ {it.valorUnitario}</td>
                      <td style={{ padding: "9px 6px", fontSize: "12.5px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, borderBottom: "1px solid var(--gray-100)" }}>R$ {it.valorTotal}</td>
                    </tr>
                  ))}</tbody>
                </table>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "28px", padding: "12px 6px 16px", fontSize: "13px" }}>
                  <span style={{ color: "var(--gray-500)" }}>Frete <b style={{ fontFamily: "var(--font-mono)", color: "var(--gray-800)" }}>R$ {res.nota.valorFrete}</b></span>
                  <span style={{ color: "var(--gray-500)" }}>ICMS <b style={{ fontFamily: "var(--font-mono)", color: "var(--gray-800)" }}>R$ {res.nota.valorICMS}</b></span>
                  <span style={{ color: "var(--gray-900)", fontWeight: 700 }}>Total <b style={{ fontFamily: "var(--font-mono)", color: "var(--blue-600)", fontSize: "15px" }}>R$ {res.nota.valorTotal}</b></span>
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--gray-400)", fontFamily: "var(--font-mono)", wordBreak: "break-all", paddingBottom: "12px" }}>Chave: {res.nota.chaveAcesso}</div>
              </div>
            </div>
            {/* achados */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-700)" }}>Validações do motor</div>
              {res.achados.map((a, i) => {
                const c = corSev(a.severidade);
                return (
                  <div key={i} style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "10px", padding: "12px 14px", boxShadow: "var(--shadow-xs)", animation: `fadeUp .4s var(--ease-out) ${i * 0.08}s both` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                      <svg width="15" height="15" viewBox="0 0 17 17" fill="none" stroke={c.fg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="8.5" cy="8.5" r="6.5" /><path d="M5.5 8.5l2 2 4-4.5" /></svg>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--gray-900)" }}>{a.tipo}</span>
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--gray-500)", lineHeight: 1.5 }}>{a.descricao}</div>
                  </div>
                );
              })}
              {res.resumo && (
                <div style={{ background: "var(--blue-50)", border: "1px solid var(--blue-200)", borderRadius: "10px", padding: "12px 14px", marginTop: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "5px" }}><ProcBadge proc="IA-TEXTO" /><span style={{ fontSize: "11px", color: "var(--gray-500)" }}>resumo</span></div>
                  <div style={{ fontSize: "12.5px", color: "var(--gray-700)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{res.resumo}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ComprasScreen() {
  const [res, setRes] = useState<ComprasResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function comparar(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    setNome(f.name);
    try {
      const csv = await planilhaParaCsv(f);
      const r = await fetch("/api/compras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planilha: { nome: f.name.replace(/\.[^.]+$/, ""), csv }, taxaMensal: null }),
      });
      const raw = await r.text();
      let d: unknown = null;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const e = (d as { erro?: unknown } | null)?.erro;
        throw new Error(typeof e === "string" ? e : `Falha (HTTP ${r.status}).`);
      }
      setRes(d as ComprasResponse);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao comparar as cotações.");
    } finally {
      setLoading(false);
    }
  }

  function baixarCsv() {
    if (!res) return;
    const head = ["Fornecedor", "Item", "Preço un.", "Qtd", "Frete", "Prazo (dias)", "Custo total", "Custo efetivo"];
    const linhas = [head, ...res.cotacoes.map((c) => [c.fornecedor, c.item ?? "", c.precoUnitario, String(c.quantidade), c.frete, String(c.prazoDias), c.custoTotal, c.custoEfetivo])];
    const csv = linhas.map((l) => l.map(csvCelula).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = "cotacoes.csv";
    a.click();
  }

  const brl = (s: string) => Number(s).toLocaleString("pt-BR", { minimumFractionDigits: 2 });

  function relatorio() {
    if (!res) return;
    abrirRelatorio("Relatório de Cotações", `Melhor: ${res.melhorFornecedor} · economia R$ ${brl(res.economia)}`, [
      ...(res.recomendacao ? [{ tipo: "texto" as const, titulo: "Recomendação", conteudo: res.recomendacao }] : []),
      {
        tipo: "tabela" as const,
        titulo: "Ranking por custo efetivo",
        colunas: ["#", "Fornecedor", "Custo total", "Custo efetivo", "Prazo"],
        linhas: res.cotacoes.map((c, i) => [i === 0 ? "★" : String(i + 1), c.fornecedor + (c.item ? ` · ${c.item}` : ""), `R$ ${brl(c.custoTotal)}`, `R$ ${brl(c.custoEfetivo)}`, `${c.prazoDias}d`]),
        alinharDireita: [2, 3, 4],
      },
    ]);
  }

  return (
    <div style={{ background: "var(--gray-50)", minHeight: "100vh", paddingBottom: "40px" }}>
      <ScreenHead title="Compras / Cotação" sub="Ranking por custo efetivo (valor do dinheiro no tempo)" />
      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* upload + ações */}
        <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "12px", padding: "16px 20px", boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Hoverable onClick={() => fileRef.current?.click()} base={{ padding: "11px 20px", background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "white", boxShadow: "0 6px 18px rgba(236,122,28,.4)" }} hover={{ transform: "translateY(-2px)" }}>
            {loading ? "Comparando…" : "Subir cotações"}
          </Hoverable>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display: "none" }} onChange={(e) => comparar(e.target.files)} />
          <div style={{ fontSize: "12.5px", color: "var(--gray-500)" }}>{nome ? `Arquivo: ${nome}` : "Espera: fornecedor, preço, quantidade, frete, prazo."}</div>
          {res && res.cotacoes.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <Hoverable onClick={relatorio} base={{ padding: "9px 16px", background: "var(--blue-600)", border: "none", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "white" }} hover={{ transform: "translateY(-1px)" }}>Relatório (PDF)</Hoverable>
              <Hoverable onClick={baixarCsv} base={{ padding: "9px 16px", background: "white", border: "1px solid var(--gray-200)", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "var(--gray-700)" }} hover={{ border: "1px solid var(--blue-500)", color: "var(--blue-600)" }}>Baixar planilha (CSV)</Hoverable>
            </div>
          )}
        </div>

        {erro && <div style={{ padding: "11px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>{erro}</div>}
        {res?.aviso && <div style={{ padding: "11px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", color: "#B45309", fontSize: "13px" }}>{res.aviso}</div>}

        {res?.recomendacao && (
          <div style={{ display: "flex", gap: "12px", padding: "14px 16px", borderRadius: "12px", background: "var(--success-soft)", borderLeft: "3px solid var(--success)", animation: "fadeUp var(--duration-base) var(--ease-out) both" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--success)", marginBottom: "3px" }}>Melhor escolha: {res.melhorFornecedor}</div>
              <div style={{ fontSize: "13.5px", color: "var(--text-body)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{res.recomendacao}</div>
            </div>
          </div>
        )}

        {res && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {res.cotacoes.map((c, i) => {
              const best = i === 0;
              return (
                <div key={i} style={{ background: "white", border: `1px solid ${best ? "#A7F3D0" : "var(--gray-200)"}`, borderRadius: "12px", padding: "16px 20px", boxShadow: best ? "0 4px 16px rgba(22,163,74,.12)" : "var(--shadow-sm)", display: "flex", alignItems: "center", gap: "20px", animation: `fadeUp .4s var(--ease-out) ${i * 0.08}s both` }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px", background: best ? "#16A34A" : "var(--gray-200)", color: best ? "#fff" : "var(--gray-500)" }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--gray-900)" }}>{c.fornecedor}</span>
                      {best && <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: "#DCFCE7", color: "#16A34A" }}>★ Melhor compra</span>}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "var(--gray-500)", marginTop: "3px" }}>{c.item ? `${c.item} · ` : ""}{c.quantidade} un · frete R$ {brl(c.frete)} · {c.prazoDias === 0 ? "à vista" : `${c.prazoDias} dias`}</div>
                  </div>
                  <div style={{ textAlign: "right", flex: "none" }}>
                    <div style={{ fontSize: "11px", color: "var(--gray-400)" }}>Custo efetivo</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: best ? "#16A34A" : "var(--gray-900)", fontFamily: "var(--font-mono)" }}>R$ {brl(c.custoEfetivo)}</div>
                    <div style={{ fontSize: "11px", color: "var(--gray-400)", fontFamily: "var(--font-mono)" }}>total R$ {brl(c.custoTotal)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CobrancaScreen() {
  const [res, setRes] = useState<CobrancaResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [nome, setNome] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function analisar(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    setNome(f.name);
    try {
      const csv = await planilhaParaCsv(f);
      const r = await fetch("/api/cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planilha: { nome: f.name.replace(/\.[^.]+$/, ""), csv }, hoje: null }),
      });
      const raw = await r.text();
      let d: unknown = null;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const e = (d as { erro?: unknown } | null)?.erro;
        throw new Error(typeof e === "string" ? e : `Falha (HTTP ${r.status}).`);
      }
      setRes(d as CobrancaResponse);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao analisar a inadimplência.");
    } finally {
      setLoading(false);
    }
  }

  function baixarCsv() {
    if (!res) return;
    const head = ["Cliente", "Valor devido", "Titulos", "Venc. mais antigo", "Dias atraso", "Severidade", "Mensagem"];
    const linhas = [head, ...res.inadimplentes.map((i) => [i.cliente, i.valorDevido, String(i.titulos), i.vencimentoMaisAntigo, String(i.diasAtraso), i.severidade, i.mensagem.replace(/\n/g, " ")])];
    const csv = linhas.map((l) => l.map(csvCelula).join(";")).join("\n");
    const a = document.createElement("a");
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = "cobranca.csv";
    a.click();
  }

  const corSev = (s: string) => (s === "grave" ? { bg: "#FEF2F2", fg: "#B91C1C" } : s === "media" ? { bg: "#FFFBEB", fg: "#B45309" } : { bg: "#F0FDF4", fg: "#15803D" });

  function relatorio() {
    if (!res) return;
    const brl = (s: string) => Number(s).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    abrirRelatorio("Relatório de Cobrança", `Total devido: R$ ${brl(res.totalDevido)} · ${res.inadimplentes.length} cliente(s)`, [
      ...(res.aviso ? [{ tipo: "texto" as const, conteudo: res.aviso }] : []),
      {
        tipo: "tabela" as const,
        titulo: "Inadimplentes",
        colunas: ["Cliente", "Valor devido", "Títulos", "Venc. mais antigo", "Dias", "Severidade"],
        linhas: res.inadimplentes.map((i) => [i.cliente, `R$ ${brl(i.valorDevido)}`, String(i.titulos), i.vencimentoMaisAntigo, String(i.diasAtraso), i.severidade]),
        alinharDireita: [1, 2, 4],
      },
    ]);
  }

  return (
    <div style={{ background: "var(--gray-50)", minHeight: "100vh", paddingBottom: "40px" }}>
      <ScreenHead
        title="Cobrança"
        sub="Inadimplentes do motor · régua redigida pela IA"
        right={
          res && res.inadimplentes.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 14px", background: "#FDEAEA", borderRadius: "10px" }}>
              <span style={{ fontSize: "11px", color: "#991B1B", fontWeight: 500 }}>Total devido</span>
              <span style={{ fontSize: "15px", fontWeight: 800, color: "#DC2626", fontFamily: "var(--font-mono)" }}>R$ {Number(res.totalDevido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          ) : undefined
        }
      />
      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* upload + ações */}
        <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "12px", padding: "16px 20px", boxShadow: "var(--shadow-sm)", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <Hoverable onClick={() => fileRef.current?.click()} base={{ padding: "11px 20px", background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "white", boxShadow: "0 6px 18px rgba(236,122,28,.4)" }} hover={{ transform: "translateY(-2px)" }}>
            {loading ? "Analisando…" : "Subir contas a receber"}
          </Hoverable>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display: "none" }} onChange={(e) => analisar(e.target.files)} />
          <div style={{ fontSize: "12.5px", color: "var(--gray-500)" }}>{nome ? `Arquivo: ${nome}` : "Espera colunas: cliente, valor, vencimento, status, email."}</div>
          {res && res.inadimplentes.length > 0 && (
            <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
              <Hoverable onClick={relatorio} base={{ padding: "9px 16px", background: "var(--blue-600)", border: "none", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "white" }} hover={{ transform: "translateY(-1px)" }}>Relatório (PDF)</Hoverable>
              <Hoverable onClick={baixarCsv} base={{ padding: "9px 16px", background: "white", border: "1px solid var(--gray-200)", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "var(--gray-700)" }} hover={{ border: "1px solid var(--blue-500)", color: "var(--blue-600)" }}>Baixar planilha (CSV)</Hoverable>
              <Hoverable
                onClick={async () => {
                  if (!res) return;
                  const comEmail = res.inadimplentes.filter((i) => i.email).length;
                  if (!window.confirm(`Disparar cobrança por e-mail para ${comEmail} cliente(s) com e-mail e enviar o resumo ao gestor?`)) return;
                  try {
                    const r = await fetch("/api/cobranca/disparar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inadimplentes: res.inadimplentes, totalDevido: res.totalDevido }) });
                    const d = await r.json();
                    if (!r.ok) throw new Error(typeof d.erro === "string" ? d.erro : "Falha ao disparar a cobrança.");
                    setErro(null);
                    window.alert(`Cobrança disparada: ${d.enviados ?? 0} e-mail(s) ao cliente + resumo ao gestor.`);
                  } catch (e) {
                    setErro(e instanceof Error ? e.message : "Falha ao disparar a cobrança.");
                  }
                }}
                base={{ padding: "9px 16px", background: "var(--orange-500)", border: "none", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "white" }}
                hover={{ transform: "translateY(-1px)" }}
              >
                Disparar cobranças
              </Hoverable>
            </div>
          )}
        </div>

        {erro && <div style={{ padding: "11px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", color: "#B91C1C", fontSize: "13px" }}>{erro}</div>}
        {res?.aviso && <div style={{ padding: "11px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", color: "#B45309", fontSize: "13px" }}>{res.aviso}</div>}

        {res?.inadimplentes.map((i, n) => {
          const c = corSev(i.severidade);
          const sevLabel = i.severidade === "grave" ? "Grave" : i.severidade === "media" ? "Média" : "Leve";
          return (
            <div key={n} style={{ background: "white", border: "1px solid var(--gray-200)", borderLeft: `4px solid ${c.fg}`, borderRadius: "12px", padding: "16px 20px", boxShadow: "var(--shadow-sm)", animation: `fadeUp .4s var(--ease-out) ${n * 0.06}s both` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--gray-900)" }}>{i.cliente}</span>
                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", background: c.bg, color: c.fg }}>{sevLabel}</span>
                  </div>
                  <div style={{ display: "flex", gap: "20px", marginBottom: "12px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12.5px", color: "var(--gray-500)" }}>Devido: <b style={{ color: "var(--gray-900)", fontFamily: "var(--font-mono)" }}>R$ {Number(i.valorDevido).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></span>
                    <span style={{ fontSize: "12.5px", color: "var(--gray-500)" }}>{i.titulos} título{i.titulos > 1 ? "s" : ""}</span>
                    <span style={{ fontSize: "12.5px", color: c.fg, fontWeight: 600 }}>{i.diasAtraso} dias de atraso</span>
                  </div>
                  <div style={{ background: "var(--gray-50)", borderRadius: "8px", padding: "11px 14px", fontSize: "13px", color: "var(--gray-700)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}><ProcBadge proc="IA-TEXTO" /><span style={{ fontSize: "11px", color: "var(--gray-400)" }}>mensagem de cobrança</span></div>
                    {i.mensagem}
                  </div>
                </div>
                <Hoverable onClick={() => navigator.clipboard?.writeText(i.mensagem)} base={{ flex: "none", padding: "8px 14px", background: "var(--blue-50)", border: "1px solid var(--blue-200)", borderRadius: "8px", cursor: "pointer", fontSize: "13px", color: "var(--blue-600)", fontWeight: 600, whiteSpace: "nowrap" }} hover={{ background: "var(--blue-100)" }}>Copiar mensagem</Hoverable>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type MsgFinanceiro = { role: "user" | "assistant"; texto: string; resumo?: string };

function FinanceiroScreen() {
  const [planilhas, setPlanilhas] = useState<{ nome: string; csv: string }[]>([]);
  const [planilhaAtual, setPlanilhaAtual] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [msgs, setMsgs] = useState<MsgFinanceiro[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [foco, setFoco] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const podePerguntar = pergunta.trim().length > 0 && !loading;

  async function adicionarArquivos(files: FileList | null) {
    if (!files) return;
    const novos: { nome: string; csv: string }[] = [];
    try {
      for (const f of Array.from(files)) {
        const nome = f.name.replace(/\.[^.]+$/, "");
        novos.push({ nome, csv: await planilhaParaCsv(f) });
      }
    } catch {
      setErro("Não consegui ler a planilha. Aceito CSV e XLSX (.xlsx/.xls).");
      return;
    }
    setPlanilhas((p) => {
      const merged = [...p.filter((x) => !novos.some((n) => n.nome === x.nome)), ...novos];
      return merged.slice(0, 8);
    });
    setErro(null);
  }

  function removerPlanilha(nome: string) {
    setPlanilhas((p) => p.filter((x) => x.nome !== nome));
    if (planilhaAtual === nome) setPlanilhaAtual(null);
  }

  async function perguntar() {
    if (!podePerguntar) return;
    const texto = pergunta.trim();
    setMsgs((m) => [...m, { role: "user", texto }]);
    setPergunta("");
    setLoading(true);
    setErro(null);
    try {
      const r = await fetch("/api/financeiro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: texto, planilhas, planilhaAtual }),
      });
      const raw = await r.text();
      let d: unknown = null;
      try {
        d = raw ? JSON.parse(raw) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const erroApi = (d as { erro?: unknown } | null)?.erro;
        const msg =
          typeof erroApi === "string"
            ? erroApi
            : r.status === 503
              ? "A IA está indisponível (precisa do Ollama no ar) — sem ela não consigo entender a pergunta."
              : `Falha ao responder (HTTP ${r.status}).`;
        throw new Error(msg);
      }
      const res = d as FinanceiroResponse;
      if (res.planilhaAtual) setPlanilhaAtual(res.planilhaAtual);
      setMsgs((m) => [
        ...m,
        { role: "assistant", texto: res.resposta, resumo: res.resumoNumerico || undefined },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao responder.";
      setErro(msg);
      setMsgs((m) => [...m, { role: "assistant", texto: msg }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--gray-50)", display: "flex", flexDirection: "column", height: "100vh" }}>
      <ScreenHead title="Financeiro" sub="Pergunte sobre suas planilhas — a IA roteia, o motor calcula" />
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ── Planilhas (sidebar) ── */}
        <div style={{ width: "240px", flex: "none", borderRight: "1px solid var(--gray-200)", background: "white", padding: "18px 16px", overflowY: "auto" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-400)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: "12px" }}>Planilhas carregadas</div>
          {planilhas.length === 0 ? (
            <div style={{ fontSize: "12.5px", color: "var(--gray-400)", lineHeight: 1.5 }}>Nenhuma planilha ainda. Adicione uma para consultar; duas para conciliar.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {planilhas.map((p) => {
                const ativa = planilhaAtual === p.nome;
                return (
                  <div key={p.nome} onClick={() => setPlanilhaAtual(p.nome)} title="Definir como planilha ativa" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: `1px solid ${ativa ? "var(--blue-200)" : "var(--gray-200)"}`, background: ativa ? "var(--blue-50)" : "var(--gray-50)", cursor: "pointer" }}>
                    <svg width="16" height="16" viewBox="0 0 17 17" fill="none" stroke={ativa ? "var(--blue-600)" : "var(--gray-400)"} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="2.5" width="12" height="12" rx="2" /><path d="M2.5 6.5h12M6.5 6.5v8" /></svg>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 600, color: ativa ? "var(--blue-700)" : "var(--gray-800)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.nome}</div>
                    </div>
                    <span onClick={(e) => { e.stopPropagation(); removerPlanilha(p.nome); }} title="Remover" style={{ opacity: 0.6, cursor: "pointer", fontWeight: 700, color: "var(--gray-500)" }}>×</span>
                  </div>
                );
              })}
            </div>
          )}
          <button onClick={() => fileRef.current?.click()} style={{ marginTop: "14px", width: "100%", padding: "9px 0", border: "1.5px dashed var(--gray-300)", borderRadius: "10px", background: "transparent", color: "var(--gray-500)", fontSize: "12.5px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>+ Carregar planilha</button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,text/csv" multiple style={{ display: "none" }} onChange={(e) => adicionarArquivos(e.target.files)} />
        </div>

        {/* ── Conversa ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div className="ies-scroll" style={{ flex: 1, padding: "24px 28px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
            {msgs.length === 0 ? (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: "420px", fontSize: "13px", color: "var(--gray-400)", lineHeight: 1.6 }}>
                Ex.: “quanto vendi no total?”, “total por categoria”, “bate as vendas com as notas”, “calcule ICMS no presumido sobre 10.000”.
              </div>
            ) : (
              msgs.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} style={{ alignSelf: "flex-end", maxWidth: "70%", background: "var(--blue-600)", color: "#fff", padding: "11px 15px", borderRadius: "14px", borderBottomRightRadius: "4px", fontSize: "13.5px", lineHeight: 1.5, whiteSpace: "pre-wrap", animation: "fadeUp .3s var(--ease-out) both" }}>{m.texto}</div>
                ) : (
                  <div key={i} style={{ alignSelf: "flex-start", maxWidth: "82%", animation: "fadeUp .3s var(--ease-out) both" }}>
                    <div style={{ background: "white", border: "1px solid var(--gray-200)", padding: "14px 16px", borderRadius: "14px", borderBottomLeftRadius: "4px", boxShadow: "var(--shadow-sm)" }}>
                      <div style={{ fontSize: "13.5px", color: "var(--gray-800)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: m.resumo ? "12px" : 0 }}>{m.texto}</div>
                      {m.resumo && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "9px 12px", background: "#F0FDF4", borderRadius: "8px", border: "1px solid #A7F3D0" }}>
                          <ProcBadge proc="MOTOR" />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "#15803d", whiteSpace: "pre-wrap" }}>{m.resumo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )
            )}
            {loading && <div style={{ alignSelf: "flex-start", fontSize: "13px", color: "var(--gray-400)" }}>Calculando…</div>}
          </div>

          <div style={{ padding: "14px 28px 22px", background: "linear-gradient(to top,var(--gray-50) 70%,transparent)" }}>
            <div style={{ maxWidth: "760px", margin: "0 auto", background: "white", border: `1.5px solid ${foco ? "var(--blue-500)" : "var(--gray-200)"}`, borderRadius: "14px", boxShadow: "var(--shadow-md)", display: "flex", alignItems: "center", padding: "8px 8px 8px 16px", gap: "8px" }}>
              <input
                value={pergunta}
                onChange={(e) => setPergunta(e.target.value)}
                onFocus={() => setFoco(true)}
                onBlur={() => setFoco(false)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); perguntar(); } }}
                placeholder="Ex.: Some o valor da coluna total agrupado por cliente…"
                style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", fontFamily: "var(--font-sans), sans-serif", color: "var(--gray-900)", background: "transparent" }}
              />
              <button onClick={() => podePerguntar && perguntar()} disabled={!podePerguntar} title="Enviar" style={{ width: "38px", height: "38px", borderRadius: "10px", background: "var(--orange-500)", border: "none", cursor: podePerguntar ? "pointer" : "not-allowed", opacity: podePerguntar ? 1 : 0.5, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                {loading ? (
                  <div style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                )}
              </button>
            </div>
            {erro ? (
              <p style={{ textAlign: "center", fontSize: "12px", color: "#DC2626", marginTop: "8px" }}>{erro}</p>
            ) : (
              <p style={{ textAlign: "center", fontSize: "11px", color: "var(--gray-400)", marginTop: "8px" }}>Todo número vem do motor determinístico — a IA só verbaliza o resultado.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InstagramScreen() {
  const [briefing, setBriefing] = useState("");
  const [nicho, setNicho] = useState("");
  const [produto, setProduto] = useState("");
  const [publico, setPublico] = useState("");
  const [tom, setTom] = useState<TomPost>("profissional");
  const numPosts = 1; // travado em 1 post — foco em qualidade máxima
  const [foco, setFoco] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<InstagramResponse | null>(null);
  const [perfil, setPerfil] = useState<PerfilEstilo | null>(null);
  const podeGerar = briefing.trim().length > 0 && !loading;

  // Perfil de estilo ativo (GET /api/referencias/sync) — derivado das referências sincronizadas
  // pelo n8n/Drive. As imagens dos posts seguem esse descritor visual. 404 = nenhum ainda.
  useEffect(() => {
    fetch("/api/referencias/sync")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.descritorVisual === "string") setPerfil(d as PerfilEstilo);
      })
      .catch(() => {});
  }, []);

  async function gerar() {
    if (!podeGerar) return;
    setLoading(true);
    setErro(null);
    setRes(null);
    try {
      const r = await fetch("/api/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          briefing,
          nicho: nicho.trim() || null,
          produtoServico: produto.trim() || null,
          publicoAlvo: publico.trim() || null,
          tom,
          numPosts,
        }),
      });
      // A resposta pode não ser JSON (ex.: página de timeout/erro da Vercel) — não quebre.
      const txt = await r.text();
      let d: unknown = null;
      try {
        d = txt ? JSON.parse(txt) : null;
      } catch {
        /* corpo não-JSON */
      }
      if (!r.ok || !d) {
        const erroApi = (d as { erro?: unknown } | null)?.erro;
        const msg =
          typeof erroApi === "string"
            ? erroApi
            : r.status === 504 || r.status === 502
              ? "O servidor demorou demais (timeout). Tente com menos posts, espere o modelo aquecer e gere de novo, ou rode local."
              : `Falha ao gerar os posts (HTTP ${r.status}).`;
        throw new Error(msg);
      }
      setRes(d as InstagramResponse);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar os posts.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ScreenHead title="Posts Instagram" sub="Descreva o que divulgar — a IA escreve e gera a imagem" />
      <div style={{ padding: "28px", maxWidth: "1120px" }}>
      {/* ── Hero ── */}
      <div style={{ position: "relative", overflow: "hidden", borderRadius: "18px", padding: "26px 30px", marginBottom: "24px", background: "linear-gradient(120deg,#7C3AED 0%,#DB2777 55%,var(--orange-500) 135%)", boxShadow: "0 14px 34px rgba(219,39,119,.28)", animation: "fadeUp .5s ease both" }}>
        <div style={{ position: "absolute", top: "-60px", right: "-30px", width: "200px", height: "200px", borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
        <div style={{ position: "absolute", bottom: "-80px", right: "130px", width: "150px", height: "150px", borderRadius: "50%", background: "rgba(255,255,255,.07)" }} />
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "rgba(255,255,255,.16)", border: "1px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", animation: "floatY 3.4s ease-in-out infinite" }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="white" stroke="none" />
            </svg>
          </div>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: 800, color: "white", letterSpacing: "-.5px", margin: 0 }}>Posts para Instagram</h2>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,.9)", marginTop: "4px", maxWidth: "640px" }}>
              Descreva em linguagem natural o que quer divulgar — a IA escreve legenda, gancho, hashtags e horário, e gera a imagem 4:5 de cada post.
            </div>
          </div>
        </div>
      </div>

      {/* ── Perfil de estilo ativo (referências sincronizadas) ── */}
      {perfil && (
        <div style={{ background: "var(--surface-card)", border: "1px solid var(--border)", borderLeft: "3px solid var(--accent)", borderRadius: "14px", padding: "16px 18px", boxShadow: "var(--shadow-sm)", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 9px", borderRadius: "999px", background: "var(--warning-soft)", color: "var(--warning)", letterSpacing: ".03em" }}>PERFIL DE ESTILO ATIVO</span>
            <span style={{ fontSize: "12px", color: "var(--text-subtle)" }}>
              {perfil.fontes.length} referência{perfil.fontes.length === 1 ? "" : "s"} · atualizado em {new Date(perfil.atualizadoEm).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-body)", lineHeight: 1.55 }}>
            As imagens dos posts seguem este descritor visual derivado das suas referências:
          </div>
          <div style={{ fontSize: "12.5px", color: "var(--text-muted)", fontStyle: "italic", marginTop: "6px", background: "var(--surface-sunken)", borderRadius: "8px", padding: "9px 12px" }}>
            “{perfil.descritorVisual}”
          </div>
        </div>
      )}

      {/* ── Formulário ── */}
      <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "16px", padding: "22px", boxShadow: "var(--shadow-md)", marginBottom: "24px", animation: "fadeUp .5s ease both", animationDelay: "60ms" }}>
        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginBottom: "6px" }}>O que você quer postar?</label>
        <textarea
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          onFocus={() => setFoco(true)}
          onBlur={() => setFoco(false)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) gerar(); }}
          placeholder="Ex.: Lançamento do nosso desengordurante profissional com 20% de desconto na primeira compra. Foco em donos de restaurante e cozinha industrial."
          rows={3}
          style={{ width: "100%", border: `1px solid ${foco ? "var(--blue-500)" : "var(--gray-200)"}`, borderRadius: "12px", padding: "12px 14px", fontSize: "14px", color: "var(--gray-900)", fontFamily: "var(--font-sans), sans-serif", background: "white", outline: "none", resize: "vertical", minHeight: "84px", lineHeight: 1.55, boxShadow: foco ? "0 0 0 3px rgba(30,107,184,.14)" : "none", transition: "border-color .16s ease,box-shadow .16s ease" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginTop: "16px" }}>
          <CampoTexto label="Nicho / segmento" opcional value={nicho} onChange={setNicho} placeholder="Ex: limpeza profissional" onEnter={gerar} />
          <CampoTexto label="Produto / serviço" opcional value={produto} onChange={setProduto} placeholder="Ex: desengordurante industrial" onEnter={gerar} />
          <CampoTexto label="Público-alvo" opcional value={publico} onChange={setPublico} placeholder="Ex: donos de restaurante em Salvador" onEnter={gerar} />
          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--gray-500)", marginBottom: "6px" }}>Tom de voz</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {TONS_POST.map((t) => {
                const ativo = tom === t.value;
                return (
                  <button key={t.value} onClick={() => setTom(t.value)} style={{ padding: "7px 12px", borderRadius: "999px", border: `1px solid ${ativo ? "var(--blue-500)" : "var(--gray-200)"}`, background: ativo ? "var(--blue-50)" : "white", color: ativo ? "var(--blue-600)" : "var(--gray-500)", fontSize: "12.5px", fontWeight: ativo ? 700 : 500, cursor: "pointer", fontFamily: "var(--font-sans), sans-serif", transition: "all .15s ease" }}>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <Hoverable
              onClick={podeGerar ? gerar : undefined}
              base={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "9px", padding: "11px 22px", background: "linear-gradient(135deg,var(--orange-500),var(--orange-600))", border: "none", borderRadius: "10px", cursor: podeGerar ? "pointer" : "not-allowed", fontSize: "14px", fontWeight: 700, color: "white", boxShadow: "0 6px 18px rgba(236,122,28,.4)", transition: "transform .14s ease,box-shadow .2s ease,opacity .2s ease", opacity: podeGerar ? 1 : 0.5, width: "100%" }}
              hover={podeGerar ? { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(236,122,28,.48)" } : {}}
              active={podeGerar ? { transform: "translateY(0)" } : {}}
            >
              {loading ? (
                <span style={{ width: "15px", height: "15px", border: "2px solid rgba(255,255,255,.45)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", flex: "none" }} />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-14 9V3z" /></svg>
              )}
              {loading ? "Gerando…" : "Gerar posts"}
            </Hoverable>
          </div>
        </div>
      </div>

      {erro && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", fontSize: "14px", color: "#DC2626", marginBottom: "24px", animation: "popIn .3s ease both" }}>{erro}</div>
      )}

      {loading && !res && <InstagramSkeleton />}

      {res && (
        <>
          {res.notaEditorial && (
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", background: "var(--blue-50)", border: "1px solid var(--blue-200)", borderRadius: "12px", padding: "13px 16px", marginBottom: "20px", animation: "fadeUp .4s ease both" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-600)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: "1px" }}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg>
              <p style={{ fontSize: "13px", color: "var(--blue-700)", lineHeight: 1.5, margin: 0 }}>{res.notaEditorial}</p>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
            {res.posts.map((p, i) => (
              <PostInstagramCard key={p.versao} p={p} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
    </>
  );
}

/* Esqueleto animado (shimmer) enquanto a IA escreve os posts. */
function InstagramSkeleton() {
  const linha = (w: string, h = "12px") => <div className="ies-skeleton" style={{ width: w, height: h, borderRadius: "6px" }} />;
  return (
    <div style={{ animation: "fadeUp .4s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "16px", color: "#DB2777", fontSize: "13.5px", fontWeight: 600 }}>
        {[0, 0.16, 0.32].map((d) => (
          <span key={d} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#DB2777", animation: `wave 1.3s ease-in-out infinite ${d}s` }} />
        ))}
        <span style={{ marginLeft: "4px" }}>Escrevendo legendas, ganchos e hashtags…</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "16px" }}>
        {[0, 1].map((i) => (
          <div key={i} style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "18px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "12px", animation: "popIn .4s ease both", animationDelay: `${i * 80}ms` }}>
            <div className="ies-skeleton" style={{ width: "100%", aspectRatio: "4 / 5", borderRadius: "10px" }} />
            {linha("40%", "14px")}
            {linha("90%")}
            {linha("100%")}
            <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>{linha("70px", "22px")}{linha("70px", "22px")}{linha("70px", "22px")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Área de imagem 4:5 — carrega direto do Pollinations (Flux) via <img>, com retry. */
function ImagemPost({ prompt }: { prompt: string }) {
  const [estado, setEstado] = useState<"loading" | "ok" | "erro">("loading");
  const [nonce, setNonce] = useState(0);
  const url = pollinationsUrl(prompt, nonce);
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 5", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--gray-200)", background: "var(--gray-50)" }}>
      {estado !== "erro" && (
        <a href={url} target="_blank" rel="noreferrer" title="Abrir imagem em tamanho cheio" style={{ display: "block", width: "100%", height: "100%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Imagem do post gerada por IA"
            onLoad={() => setEstado("ok")}
            onError={() => setEstado("erro")}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: estado === "ok" ? "block" : "none", animation: "popIn .4s ease both" }}
          />
        </a>
      )}
      {estado === "loading" && (
        <div className="ies-skeleton" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#DB2777", fontSize: "12px", fontWeight: 600, background: "rgba(255,255,255,.78)", borderRadius: "999px", padding: "5px 12px" }}>
            <span style={{ width: "12px", height: "12px", border: "2px solid rgba(219,39,119,.35)", borderTopColor: "#DB2777", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
            Gerando imagem…
          </div>
        </div>
      )}
      {estado === "erro" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", padding: "14px", textAlign: "center" }}>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--gray-500)" }}>Não foi possível gerar a imagem.</span>
          <button onClick={() => { setEstado("loading"); setNonce((n) => n + 1); }} style={{ fontSize: "12px", fontWeight: 600, color: "white", background: "var(--orange-500)", border: "none", borderRadius: "8px", padding: "6px 13px", cursor: "pointer" }}>
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}

/* Card de um post gerado — imagem 1:1 no topo + copy pronto pra publicar. */
function PostInstagramCard({ p, index }: { p: PostInstagram; index: number }) {
  const [copiado, setCopiado] = useState(false);
  const textoCompleto = `${p.legenda}\n\n${p.hashtags.map((h) => `#${h}`).join(" ")}`;
  function copiar() {
    navigator.clipboard?.writeText(textoCompleto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    });
  }
  return (
    <div style={{ background: "white", border: "1px solid var(--gray-200)", borderRadius: "14px", padding: "18px", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: "12px", animation: "popIn .4s ease both", animationDelay: `${index * 90}ms` }}>
      <ImagemPost prompt={p.imagemPrompt} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#DB2777", background: "#FCE7F3", borderRadius: "999px", padding: "3px 11px" }}>Post {p.versao}</span>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--gray-500)", background: "var(--gray-100)", borderRadius: "999px", padding: "3px 10px" }}>{p.tema}</span>
        </div>
        <Hoverable
          onClick={copiar}
          title="Copiar legenda + hashtags"
          base={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px", fontWeight: 600, color: copiado ? "#16A34A" : "var(--gray-900)", background: copiado ? "#ECFDF5" : "white", border: `1px solid ${copiado ? "#A7F3D0" : "var(--gray-200)"}`, borderRadius: "8px", padding: "5px 11px", cursor: "pointer", transition: "all .16s ease" }}
          hover={{ borderColor: "var(--orange-500)", color: copiado ? "#16A34A" : "var(--orange-600)" }}
        >
          {copiado ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="m20 6-11 11-5-5" /></svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
          )}
          {copiado ? "Copiado!" : "Copiar"}
        </Hoverable>
      </div>

      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--gray-900)", lineHeight: 1.4, borderLeft: "3px solid #DB2777", paddingLeft: "10px" }}>{p.abertura}</div>

      <p style={{ fontSize: "13px", color: "#3a4757", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{p.legenda}</p>

      {p.hashtags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {p.hashtags.map((h, i) => (
            <span key={`${h}-${i}`} style={{ fontSize: "11.5px", fontWeight: 500, color: "var(--blue-700)", background: "var(--blue-50)", border: "1px solid var(--blue-200)", borderRadius: "999px", padding: "3px 10px" }}>#{h}</span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "7px", borderTop: "1px solid var(--gray-100)", paddingTop: "11px", marginTop: "auto" }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.45 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--orange-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: "1px" }}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
          <span><strong style={{ color: "var(--gray-900)", fontWeight: 600 }}>Criativo:</strong> {p.sugestaoCriativo}</span>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "12px", color: "var(--gray-500)", lineHeight: 1.45 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue-500)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: "1px" }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          <span><strong style={{ color: "var(--gray-900)", fontWeight: 600 }}>Melhor horário:</strong> {p.melhorHorario}</span>
        </div>
        <details style={{ fontSize: "11.5px", color: "var(--gray-400)" }}>
          <summary style={{ cursor: "pointer", listStyle: "none", userSelect: "none" }}>Prompt da imagem (técnico, inglês)</summary>
          <p style={{ margin: "6px 0 0", color: "#3a4757", lineHeight: 1.5 }}>{p.imagemPrompt}</p>
        </details>
      </div>
    </div>
  );
}
