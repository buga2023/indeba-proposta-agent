/**
 * Grounding jurídico — liga o `fundamento` de cada categoria/cláusula à NORMA OFICIAL.
 *
 * Tabela curada (lei → URL canônica do Planalto): determinística, com procedência, para o
 * agente CITAR a fonte ("essa cláusula se ancora no art. X da Lei Y") em vez de afirmar
 * direito da memória do Qwen (§2). Uma fonte AO VIVO (LexML SRU, para puxar texto da norma
 * e jurisprudência) plugaria na interface FonteJuridica abaixo — não ligada aqui porque o
 * endpoint do LexML não respondeu na verificação (não shippo integração externa não testada).
 */

export type ReferenciaLegal = {
  lei: string; // "Lei 10.406/2002"
  nome: string; // "Código Civil"
  url: string; // URL canônica no Planalto (fonte oficial)
  fonte: "Planalto";
};

// Normas mais usadas em contrato comercial BR.
export const LEIS: Record<string, ReferenciaLegal> = {
  CC: { lei: "Lei 10.406/2002", nome: "Código Civil", url: "https://www.planalto.gov.br/ccivil_03/leis/2002/l10406compilada.htm", fonte: "Planalto" },
  CPC: { lei: "Lei 13.105/2015", nome: "Código de Processo Civil", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm", fonte: "Planalto" },
  CDC: { lei: "Lei 8.078/1990", nome: "Código de Defesa do Consumidor", url: "https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm", fonte: "Planalto" },
  LGPD: { lei: "Lei 13.709/2018", nome: "Lei Geral de Proteção de Dados", url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm", fonte: "Planalto" },
  LC214: { lei: "LC 214/2025", nome: "Reforma Tributária (IBS/CBS)", url: "https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp214.htm", fonte: "Planalto" },
  INQUILINATO: { lei: "Lei 8.245/1991", nome: "Lei do Inquilinato", url: "https://www.planalto.gov.br/ccivil_03/leis/l8245.htm", fonte: "Planalto" },
};

// Reconhece a lei citada num texto de fundamento (ex.: "CC art. 408", "Lei 13.709 (LGPD)").
export function referenciaDe(fundamento: string | null | undefined): ReferenciaLegal | null {
  const f = (fundamento ?? "").toLowerCase();
  if (!f) return null;
  if (/13\.?709|lgpd/.test(f)) return LEIS.LGPD;
  if (/lc\s*214|214\/2025|ibs|cbs/.test(f)) return LEIS.LC214;
  if (/\bcpc\b|13\.?105|processo civil/.test(f)) return LEIS.CPC;
  if (/\bcdc\b|8\.?078|consumidor/.test(f)) return LEIS.CDC;
  if (/8\.?245|inquilinato/.test(f)) return LEIS.INQUILINATO;
  if (/\bcc\b|10\.?406|c[óo]digo civil/.test(f)) return LEIS.CC;
  return null;
}

export type ItemAncorado<T> = T & { referencia: ReferenciaLegal | null };

// Enriquece itens que tenham `fundamento` com a referência legal oficial (provenance).
export function ancorar<T extends { fundamento: string | null }>(itens: T[]): ItemAncorado<T>[] {
  return itens.map((i) => ({ ...i, referencia: referenciaDe(i.fundamento) }));
}

// Interface para uma fonte jurídica AO VIVO (ex.: LexML SRU): retornaria o texto da norma
// e jurisprudência por URN. Plugar quando houver endpoint estável e verificado.
export interface FonteJuridica {
  buscarNorma(urnOuTermo: string): Promise<{ titulo: string; texto: string; fonte: string }[]>;
}
