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

// Busca por sigla exata, ou sigla mencionada DENTRO de uma frase, ou termo no nome
// (para o chat responder "o que é o ICMS?"). Siglas curtas (II/IE/IS) só por igualdade
// exata, p/ evitar falso-match em texto livre.
export function buscarTributo(termo: string): TributoRef | null {
  const t = termo.trim().toLowerCase();
  if (!t) return null;
  const exato = CAT.tributos.find((x) => x.sigla.toLowerCase() === t);
  if (exato) return exato;
  return (
    CAT.tributos.find((x) => {
      const sig = x.sigla.toLowerCase();
      if (sig.length >= 3 && new RegExp(`\\b${sig.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)) return true;
      return sig.includes(t) || x.nome.toLowerCase().includes(t);
    }) ?? null
  );
}
