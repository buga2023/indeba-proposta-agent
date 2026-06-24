/**
 * Acesso ao banco de cláusulas (banco-clausulas.json). O agente de contrato GERA
 * montando daqui — nunca da memória do Qwen. Cada cláusula traz fonte + fundamento;
 * o aviso lembra que é rascunho a revisar por advogado (§6).
 */
import banco from "./banco-clausulas.json";
import { BancoClausulas, type Clausula, type TipoContrato } from "../contracts/clausulas";

const BANCO: BancoClausulas = BancoClausulas.parse(banco);

export const AVISO_CLAUSULAS = BANCO.aviso;

// Todas as cláusulas aplicáveis a um tipo de contrato (montagem da minuta).
export function clausulasPara(tipo: TipoContrato): Clausula[] {
  return BANCO.clausulas.filter((c) => c.tiposContrato.includes(tipo));
}

// A cláusula de uma categoria para um tipo (ex.: "lgpd" em "fornecimento"). null = o
// banco ainda não cobre — lacuna a curar, não texto inventado.
export function clausulaDe(categoria: string, tipo: TipoContrato): Clausula | null {
  return BANCO.clausulas.find((c) => c.categoria === categoria && c.tiposContrato.includes(tipo)) ?? null;
}

// Categorias do checklist que o banco AINDA não cobre para um tipo — orienta a curadoria.
export function categoriasSemModelo(categorias: string[], tipo: TipoContrato): string[] {
  return categorias.filter((cat) => !clausulaDe(cat, tipo));
}
