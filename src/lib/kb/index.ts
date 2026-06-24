/**
 * Base de conhecimento versionada por ANO (o "GP Brain", camada determinística).
 *
 * Aqui ficam os PARÂMETROS DUROS — obrigações (prazo/dependência/leiaute) e tributos
 * (alíquotas) — lidos pelo CÓDIGO, nunca por busca semântica (§2: prazo/alíquota não saem
 * de RAG fuzzy). O texto normativo (CPC/NBC, manuais) é o acervo do Qdrant, à parte.
 *
 * Tudo aqui começa como ESQUELETO ("PREENCHER"): o contador preenche e valida; `pendentes()`
 * lista o que falta, pra o agente sinalizar a lacuna em vez de inventar.
 */
import obrig2026 from "./2026/obrigacoes.json";
import trib2026 from "./2026/tributos.json";

export type Obrigacao = {
  id: string;
  nome: string;
  esfera: string;
  periodicidade: string;
  prazo: string;
  leiaute: string | null;
  dependeDe: string[];
  regimes: string[];
  _status: string;
};

type BaseObrigacoes = { vigencia: string; obrigacoes: Obrigacao[] };
type BaseTributos = { vigencia: string; regimes: Record<string, { descricao: string; impostos: Record<string, number> }> };

const KB: Record<string, { obrigacoes: BaseObrigacoes; tributos: BaseTributos }> = {
  "2026": { obrigacoes: obrig2026 as BaseObrigacoes, tributos: trib2026 as BaseTributos },
};

export function anosDisponiveis(): string[] {
  return Object.keys(KB).sort();
}

export function obrigacoes(ano: string): Obrigacao[] {
  return KB[ano]?.obrigacoes.obrigacoes ?? [];
}

export function obrigacoesDoRegime(ano: string, regime: string): Obrigacao[] {
  return obrigacoes(ano).filter((o) => o.regimes.includes(regime));
}

/** Pré-requisitos (cadeia de dependência) de uma obrigação — a ordem importa. */
export function dependencias(ano: string, id: string): string[] {
  const mapa = new Map(obrigacoes(ano).map((o) => [o.id, o]));
  const out: string[] = [];
  const visitar = (oid: string) => {
    for (const dep of mapa.get(oid)?.dependeDe ?? []) {
      if (!out.includes(dep)) {
        visitar(dep);
        out.push(dep);
      }
    }
  };
  visitar(id);
  return out;
}

export function aliquota(ano: string, regime: string, imposto: string): number | null {
  const v = KB[ano]?.tributos.regimes?.[regime.toLowerCase()]?.impostos?.[imposto.toUpperCase()];
  return typeof v === "number" ? v : null;
}

/** Lacunas: o que o contador ainda precisa preencher/validar (sinaliza, não inventa). */
export function pendentes(ano: string): string[] {
  const lac: string[] = [];
  for (const o of obrigacoes(ano)) {
    if (o._status === "placeholder" || o.prazo === "PREENCHER") lac.push(`obrigação "${o.nome}": prazo/leiaute a preencher`);
  }
  const trib = KB[ano]?.tributos.regimes ?? {};
  for (const [regime, r] of Object.entries(trib)) {
    if (!r.impostos || Object.keys(r.impostos).length === 0) lac.push(`tributos do regime "${regime}": alíquotas a preencher`);
  }
  return lac;
}
