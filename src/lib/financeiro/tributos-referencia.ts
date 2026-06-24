/**
 * Acesso ao catálogo de tributos (tributos-referencia.json) — a base de conhecimento
 * que o chat fiscal usa para explicar "o que é / como apura" cada tributo, sem inventar
 * alíquota. Filtra por esfera, status (vigente/em extinção/novo) e busca por sigla/termo.
 */
import catalogo from "./tributos-referencia.json";
import { CatalogoTributos, type TributoRef, type Esfera, type StatusTributo } from "../contracts/tributos-referencia";

const CAT: CatalogoTributos = CatalogoTributos.parse(catalogo);

export const AVISO_TRIBUTOS = CAT.aviso;

export function todos(): TributoRef[] {
  return CAT.tributos;
}

export function porEsfera(esfera: Esfera): TributoRef[] {
  return CAT.tributos.filter((t) => t.esfera === esfera);
}

export function porStatus(status: StatusTributo): TributoRef[] {
  return CAT.tributos.filter((t) => t.status === status);
}

// Busca por sigla exata ou termo no nome/incidência (para o chat responder "o que é X").
export function buscarTributo(termo: string): TributoRef | null {
  const t = termo.trim().toLowerCase();
  if (!t) return null;
  return (
    CAT.tributos.find((x) => x.sigla.toLowerCase() === t) ??
    CAT.tributos.find((x) => x.sigla.toLowerCase().includes(t) || x.nome.toLowerCase().includes(t)) ??
    null
  );
}
