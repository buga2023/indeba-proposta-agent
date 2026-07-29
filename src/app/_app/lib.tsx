"use client";

/**
 * Helpers, tipos e o wrapper `Hoverable` compartilhados pelas telas
 * (extraídos de page.tsx na reestruturação do front). Lógica idêntica.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import type { PropostaItem } from "@/lib/contracts";
import { tamanhoLegivel } from "@/lib/embalagem";

/* ───────────────────────── helpers ───────────────────────── */

export const fmt = (n: number) => "R$ " + n.toFixed(2).replace(".", ",");
// Valor sem "R$" (preview do PDF de orçamento espelha o template, que omite o símbolo).
export const dec = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Nº do orçamento derivado do id (mesma lógica do template-orcamento.ts).
export const numeroDoc = (id: string) => String((parseInt(id.replace(/[^0-9a-f]/gi, "").slice(0, 6) || "0", 16) % 9000) + 1000);
export const precoUnit = (it: PropostaItem) => Number(it.embalagens[0]?.preco ?? 0);
export const unidadeDe = (it: PropostaItem) => {
  const e = it.embalagens[0];
  return e ? tamanhoLegivel(e.tamanho, e.unidade) : "—";
};

// Procedência (dado real do item) no lugar da "categoria" do mock.
export const procColor = (p: PropostaItem["procedenciaSelecao"]) => (p === "MANUAL" ? "#D97706" : "#1E6BB8");
export const procLabel = (p: PropostaItem["procedenciaSelecao"]) => (p === "MANUAL" ? "Manual" : "Seleção IA");

// Cores por linha do catálogo (facetas reais).
export const LINHA_COR: Record<string, string> = {
  lavanderia: "#1E6BB8",
  alimentos_bebidas: "#16A34A",
  limpeza_conservacao: "#7C3AED",
  higiene_clinica: "#0EA5E9",
  higiene_pessoal: "#DB2777",
  tratamento_pisos: "#D97706",
  automotiva: "#475569",
};
export const linhaCor = (l: string) => LINHA_COR[l] ?? "#5B6E7D";
export const humaniza = (l: string) => l.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function parseCliente(briefing: string): string {
  const h = briefing.split(":")[0].trim();
  return h && h.length <= 80 ? h : "Cliente";
}

/** Elemento com estados :hover / :active (o design usa style-hover/style-active). */
export function Hoverable({
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

/* ───────────────────────── tipos & constantes ───────────────────────── */

export type StatusProposta = "rascunho" | "em_edicao" | "enviada" | "aprovada" | "recusada";
// Espelha PropostaResumo (src/lib/contracts/proposta.ts): proposta persistida + status.
export type PropostaLog = {
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
export const STATUS_UI: Record<StatusProposta, { label: string; bg: string; fg: string }> = {
  rascunho: { label: "Rascunho", bg: "#F1F5F9", fg: "#64748B" },
  em_edicao: { label: "Em edição", bg: "#FEF3C7", fg: "#B45309" },
  enviada: { label: "Enviada", bg: "#DBEAFE", fg: "#2563EB" },
  aprovada: { label: "Aprovada", bg: "#DCFCE7", fg: "#16A34A" },
  recusada: { label: "Recusada", bg: "#FEE2E2", fg: "#DC2626" },
};

export const LOADING_MSGS = ["Analisando o briefing...", "Buscando no catálogo...", "Selecionando produtos...", "Finalizando a proposta..."];
export const LOADING_LABELS = ["Briefing analisado", "Catálogo consultado", "Produtos selecionados", "Proposta montada"];

export type Screen = "briefing" | "loading" | "review" | "pdf" | "history" | "catalog" | "prospeccao" | "instagram" | "financeiro" | "contrato" | "atendimento" | "cobranca" | "compras" | "fiscal" | "contabil" | "chamados" | "config";
export type TipoProposta = "orcamento" | "implantacao" | "comercial";

// Tipos de proposta → estrutura do PDF (render.ts roteia por tipo). O vendedor escolhe.
export const TIPOS: { value: TipoProposta; label: string; hint: string }[] = [
  { value: "orcamento", label: "Orçamento", hint: "Tabela ERP enxuta" },
  { value: "implantacao", label: "Implantação", hint: "Express, 1 produto/página" },
  { value: "comercial", label: "Comercial", hint: "Fabricante, institucional" },
];
export const tipoLabel = (t: string) => TIPOS.find((x) => x.value === t)?.label ?? "Orçamento";
