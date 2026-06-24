/**
 * Consulta tributária por VIGÊNCIA — sobre a base datada (tributario-base.json).
 *
 * Resolve a alíquota válida em um ANO específico (a reforma muda as regras ano a ano até
 * 2033). Sempre devolve a regra COM fonte + vigência; o caller carimba o aviso legal.
 * §2: o número vem da base, nunca do LLM; fonte "oficial:false" = exemplo a validar.
 */
import base from "./tributario-base.json";
import { BaseTributaria, type RegraTributaria } from "../contracts/tributario";

const BASE: BaseTributaria = BaseTributaria.parse(base);

export const AVISO_LEGAL = BASE.avisoLegal;
export const ATUALIZADO_EM = BASE.atualizadoEm;

function ano(dataIso: string): number {
  return Number(dataIso.slice(0, 4));
}

function vigenteNoAno(r: RegraTributaria, anoRef: number): boolean {
  const ini = ano(r.vigenciaInicio);
  const fim = r.vigenciaFim ? ano(r.vigenciaFim) : Number.POSITIVE_INFINITY;
  return anoRef >= ini && anoRef <= fim;
}

export function regrasVigentes(anoRef: number): RegraTributaria[] {
  return BASE.regras.filter((r) => vigenteNoAno(r, anoRef));
}

// Alíquota de um imposto num regime, VÁLIDA no ano. null = sem regra vigente (ex.: pedir
// IBS em 2025, antes da transição) — lacuna sinalizada, não alíquota inventada.
export function aliquotaVigente(
  regime: string,
  imposto: string,
  anoRef: number,
): RegraTributaria | null {
  const reg = regime.toLowerCase();
  const imp = imposto.toUpperCase();
  return regrasVigentes(anoRef).find((r) => r.regime === reg && r.imposto === imp) ?? null;
}

// Todos os impostos vigentes de um regime no ano (para comparar carga entre regimes).
export function impostosDoRegime(regime: string, anoRef: number): RegraTributaria[] {
  const reg = regime.toLowerCase();
  return regrasVigentes(anoRef).filter((r) => r.regime === reg);
}
