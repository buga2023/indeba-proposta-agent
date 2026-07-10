import type { Tipo } from "./contracts";

// Detecta o tipo de proposta pelo prompt. Determinístico. Retorna null quando
// não há sinal claro → o sistema deve PERGUNTAR (melhor perguntar do que errar).
const SINAIS: Record<Tipo, string[]> = {
  orcamento: ["orçament", "orcament", "cotaç", "cotac", "orçar", "orcar", "tabela de preç", "só os preç", "so os prec", "valores dos produt"],
  implantacao: ["implantaç", "implantac", "implantar", "implementaç", "express"],
  comercial: ["proposta comercial", "comercial", "institucional", "fabricante", "experiência segura", "experiencia segura", "completa"],
  consolidada: ["consolidada", "proposta de soluç", "proposta de soluc", "solução completa", "solucao completa", "comodato", "ies"],
};

export type Deteccao = { tipo: Tipo | null; motivo: string };

export function detectarTipo(prompt: string): Deteccao {
  const t = prompt.toLowerCase();
  const placar = (Object.keys(SINAIS) as Tipo[]).map((tipo) => ({
    tipo,
    n: SINAIS[tipo].filter((kw) => t.includes(kw)).length,
  }));
  const max = Math.max(...placar.map((p) => p.n));
  const vencedores = placar.filter((p) => p.n === max && p.n > 0);

  if (vencedores.length === 1) {
    return { tipo: vencedores[0].tipo, motivo: `Prompt indica "${vencedores[0].tipo}".` };
  }
  if (vencedores.length > 1) {
    return { tipo: null, motivo: `Ambíguo entre ${vencedores.map((v) => v.tipo).join(", ")}.` };
  }
  return { tipo: null, motivo: "Prompt não indica o tipo de proposta." };
}

export const TIPOS_LABEL: Record<Tipo, string> = {
  orcamento: "Orçamento",
  implantacao: "Proposta de Implantação",
  comercial: "Proposta Comercial",
  consolidada: "Proposta de Solução",
};
