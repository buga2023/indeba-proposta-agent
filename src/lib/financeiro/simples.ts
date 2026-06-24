/**
 * Apuração do Simples Nacional por anexo/faixa + Fator R, com MEMÓRIA DE CÁLCULO.
 *
 * Alíquota efetiva = (RBT12 × nominal − PD) / RBT12 (Anexos I–V, LC 123). O Fator R
 * (folha12/RBT12) escolhe entre Anexo III (≥28%) e V (<28%) para serviços. Cada cálculo
 * devolve a `memoria` — o passo a passo com os números reais — para o agente EXPLICAR
 * por que chegou no valor (auditável). §2: tabelas vêm da base, não do modelo.
 */
import tabela from "./simples-anexos.json";
import { TabelaSimples } from "../contracts/simples";

const TAB = TabelaSimples.parse(tabela);
export const FONTE_SIMPLES = TAB.fonte;
export type Anexo = "I" | "II" | "III" | "IV" | "V";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export type Faixa = { indice: number; ate: number; nominal: number; pd: number };

// Faixa da RBT12 num anexo. null = acima do teto do Simples (desenquadrado) ou RBT12<=0.
export function faixaDe(rbt12: number, anexo: Anexo): Faixa | null {
  if (rbt12 <= 0 || rbt12 > TAB.limiteRBT12) return null;
  const faixas = TAB.anexos[anexo]?.faixas ?? [];
  const idx = faixas.findIndex((f) => rbt12 <= f.ate);
  if (idx === -1) return null;
  return { indice: idx + 1, ...faixas[idx] };
}

export type ResultadoSimples = {
  anexo: Anexo;
  faixa: number;
  rbt12: number;
  nominal: number;
  pd: number;
  aliquotaEfetiva: number; // %
  receitaMes: number;
  das: number;
  fonte: string;
  memoria: string; // o "por quê" — passo a passo com os números
};

// Alíquota efetiva (%) da RBT12 num anexo. Lança se desenquadrado (não inventa).
export function aliquotaEfetiva(rbt12: number, anexo: Anexo): number {
  const f = faixaDe(rbt12, anexo);
  if (!f) throw new Error(`RBT12 ${brl(rbt12)} fora das faixas do Simples (teto ${brl(TAB.limiteRBT12)}).`);
  return ((rbt12 * f.nominal) / 100 - f.pd) / rbt12 * 100;
}

// DAS do mês = receita do mês × alíquota efetiva, com memória de cálculo.
export function calcularDAS(receitaMes: number, rbt12: number, anexo: Anexo): ResultadoSimples {
  const f = faixaDe(rbt12, anexo);
  if (!f) throw new Error(`RBT12 ${brl(rbt12)} fora das faixas do Simples (teto ${brl(TAB.limiteRBT12)}).`);
  const efetiva = ((rbt12 * f.nominal) / 100 - f.pd) / rbt12 * 100;
  const das = (receitaMes * efetiva) / 100;
  const memoria =
    `RBT12 ${brl(rbt12)} → Anexo ${anexo}, faixa ${f.indice} (até ${brl(f.ate)}): ` +
    `nominal ${pct(f.nominal)}, deduz ${brl(f.pd)}. ` +
    `Efetiva = (${brl(rbt12)} × ${pct(f.nominal)} − ${brl(f.pd)}) ÷ ${brl(rbt12)} = ${pct(efetiva)}. ` +
    `DAS = ${brl(receitaMes)} × ${pct(efetiva)} = ${brl(das)}.`;
  return { anexo, faixa: f.indice, rbt12, nominal: f.nominal, pd: f.pd, aliquotaEfetiva: efetiva, receitaMes, das, fonte: FONTE_SIMPLES, memoria };
}

export type ResultadoFatorR = {
  folha12: number;
  rbt12: number;
  fatorR: number; // %
  anexoAplicavel: "III" | "V";
  memoria: string;
};

// Fator R = folha12 / RBT12. ≥ 28% → Anexo III (mais barato); < 28% → Anexo V.
export function fatorR(folha12: number, rbt12: number): ResultadoFatorR {
  const r = rbt12 > 0 ? (folha12 / rbt12) * 100 : 0;
  const anexoAplicavel = r >= TAB.fatorRMinimoAnexoIII ? "III" : "V";
  const memoria =
    `Fator R = folha ${brl(folha12)} ÷ RBT12 ${brl(rbt12)} = ${pct(r)}. ` +
    `${r >= TAB.fatorRMinimoAnexoIII ? `≥ ${TAB.fatorRMinimoAnexoIII}% → Anexo III` : `< ${TAB.fatorRMinimoAnexoIII}% → Anexo V`}.`;
  return { folha12, rbt12, fatorR: r, anexoAplicavel, memoria };
}
