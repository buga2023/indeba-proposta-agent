/**
 * Fonte oficial de índices/câmbio: BACEN SGS (Sistema Gerenciador de Séries Temporais).
 *
 * API pública e gratuita, SEM credencial. O agente BUSCA o número (juros de mora,
 * correção, conversão de moeda) e nunca o inventa — cada resultado carimba a
 * PROCEDÊNCIA (série + data + URL exata) para o humano decidir se leva em conta
 * (constituição §2 dado crítico nunca do modelo · §6 IA sempre revisável).
 */

export type SerieBacen = { codigo: number; nome: string; unidade: string };

// Séries úteis para cálculo financeiro. Códigos do catálogo do BACEN SGS.
export const SERIES = {
  selic_meta: { codigo: 432, nome: "Meta Selic (Copom)", unidade: "% a.a." },
  selic_diaria: { codigo: 11, nome: "Selic diária", unidade: "% a.d." },
  ipca: { codigo: 433, nome: "IPCA", unidade: "% mês" },
  igpm: { codigo: 189, nome: "IGP-M", unidade: "% mês" },
  ptax_dolar: { codigo: 10813, nome: "Dólar PTAX (compra)", unidade: "R$/US$" },
} as const satisfies Record<string, SerieBacen>;

export type ChaveSerie = keyof typeof SERIES;

export type PontoSerie = { data: string; valor: number };
export type ResultadoBacen = {
  serie: SerieBacen;
  pontos: PontoSerie[];
  fonte: string; // URL exata consultada — procedência auditável
  referencia: string | null; // data do ponto mais recente (vigência do dado)
};

const BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs";

export function urlUltimos(codigo: number, n: number): string {
  const qtd = Math.min(Math.max(Math.trunc(n), 1), 20); // SGS limita /ultimos a 20
  return `${BASE}.${codigo}/dados/ultimos/${qtd}?formato=json`;
}

export function urlPeriodo(codigo: number, dataInicial: string, dataFinal: string): string {
  return `${BASE}.${codigo}/dados?formato=json&dataInicial=${dataInicial}&dataFinal=${dataFinal}`;
}

// JSON do SGS: [{ "data": "dd/MM/aaaa", "valor": "14.25" }]. Valor vem como string
// (ponto OU vírgula decimal conforme a série) — normaliza para number.
export function parsePontos(json: Array<{ data: string; valor: string }>): PontoSerie[] {
  return (json ?? []).map((p) => ({
    data: p.data,
    valor: Number(String(p.valor).trim().replace(",", ".")),
  }));
}

function resolverSerie(chave: ChaveSerie | number): SerieBacen {
  if (typeof chave === "number") return { codigo: chave, nome: `SGS ${chave}`, unidade: "" };
  return SERIES[chave];
}

// Busca os N pontos mais recentes de uma série. Lança com a URL em caso de falha
// (rede/HTTP) — o caller (motor) decide degradar; nunca substitui por número inventado.
export async function buscarSerie(
  chave: ChaveSerie | number,
  opts: { ultimos?: number } = {},
): Promise<ResultadoBacen> {
  const serie = resolverSerie(chave);
  const url = urlUltimos(serie.codigo, opts.ultimos ?? 1);
  const r = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`BACEN SGS ${serie.codigo} (${serie.nome}): HTTP ${r.status} — ${url}`);
  const pontos = parsePontos((await r.json()) as Array<{ data: string; valor: string }>);
  return { serie, pontos, fonte: url, referencia: pontos.at(-1)?.data ?? null };
}

// Atalho: o valor mais recente + a procedência, pronto pra carimbar na resposta.
export async function valorMaisRecente(
  chave: ChaveSerie | number,
): Promise<{ valor: number; data: string | null; unidade: string; nome: string; fonte: string }> {
  const r = await buscarSerie(chave, { ultimos: 1 });
  const p = r.pontos.at(-1);
  return {
    valor: p?.valor ?? NaN,
    data: p?.data ?? null,
    unidade: r.serie.unidade,
    nome: r.serie.nome,
    fonte: r.fonte,
  };
}
