/**
 * IRPJ e CSLL no Lucro Presumido — com PRESUNÇÃO por atividade e ADICIONAL de 10%.
 *
 * IRPJ = 15% sobre a base presumida + 10% sobre o que exceder R$ 20.000/mês no período.
 * CSLL = 9% sobre a base presumida. Base presumida = receita × % de presunção (IRPJ:
 * 8% comércio/indústria, 32% serviços; CSLL: 12% / 32%). Tudo determinístico, com
 * memória de cálculo. §2: percentuais da tabela abaixo (típicos — validar a atividade
 * com o contador; serviços específicos têm presunção diferente).
 */
import type { Atividade } from "./apuracao";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (v: number) => `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

// Presunção de lucro (RIR/IN). Típicos; atividades específicas (transporte 16%, etc.) variam.
export const PRESUNCAO: Record<Atividade, { irpj: number; csll: number }> = {
  comercio: { irpj: 8, csll: 12 },
  industria: { irpj: 8, csll: 12 },
  servico: { irpj: 32, csll: 32 },
};

export const ALIQ_IRPJ = 15;
export const ALIQ_ADICIONAL = 10;
export const ALIQ_CSLL = 9;
export const LIMITE_ADICIONAL_MES = 20000; // R$ 20.000/mês isento do adicional
export const FONTE = "RIR/Decreto 9.580/2018 (presunção + adicional IRPJ) — validar atividade";

export type ResultadoLucro = {
  receita: number;
  atividade: Atividade;
  meses: number;
  baseIRPJ: number;
  irpjBase: number; // 15% da base
  adicional: number; // 10% do excedente
  irpjTotal: number;
  baseCSLL: number;
  csll: number;
  total: number; // IRPJ total + CSLL
  fonte: string;
  memoria: string;
};

// IRPJ + CSLL presumidos para uma receita num período de `meses` (1 = mês, 3 = trimestre).
export function irpjCsllPresumido(params: { receita: number; atividade: Atividade; meses?: number }): ResultadoLucro {
  const { receita, atividade } = params;
  const meses = params.meses ?? 3; // apuração trimestral é o padrão no presumido
  const pres = PRESUNCAO[atividade];

  const baseIRPJ = (receita * pres.irpj) / 100;
  const irpjBase = (baseIRPJ * ALIQ_IRPJ) / 100;
  const limite = LIMITE_ADICIONAL_MES * meses;
  const excedente = Math.max(0, baseIRPJ - limite);
  const adicional = (excedente * ALIQ_ADICIONAL) / 100;
  const irpjTotal = irpjBase + adicional;

  const baseCSLL = (receita * pres.csll) / 100;
  const csll = (baseCSLL * ALIQ_CSLL) / 100;
  const total = irpjTotal + csll;

  const memoria =
    `Receita ${brl(receita)} (${meses} ${meses === 1 ? "mês" : "meses"}), ${atividade}. ` +
    `IRPJ: base = ${brl(receita)} × ${pct(pres.irpj)} = ${brl(baseIRPJ)}; ` +
    `15% = ${brl(irpjBase)}` +
    (excedente > 0
      ? ` + adicional 10% sobre ${brl(excedente)} (excede ${brl(limite)}) = ${brl(adicional)}`
      : ` (sem adicional: base ≤ ${brl(limite)})`) +
    ` → IRPJ ${brl(irpjTotal)}. ` +
    `CSLL: base = ${brl(receita)} × ${pct(pres.csll)} = ${brl(baseCSLL)}; 9% = ${brl(csll)}. ` +
    `Total IRPJ+CSLL = ${brl(total)}.`;

  return { receita, atividade, meses, baseIRPJ, irpjBase, adicional, irpjTotal, baseCSLL, csll, total, fonte: FONTE, memoria };
}
