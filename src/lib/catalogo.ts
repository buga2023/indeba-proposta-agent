import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Catalogo, type Produto } from "./contracts";
import { enriquecerFicha } from "./enriquecer-ficha";

let cache: Catalogo | null = null;

// Lê data/catalogo.json e valida contra o Zod. Fonte da verdade dos dados críticos.
// (MVP sem DB — migra pra Prisma no Marco 0 real, mesmo contrato.)
// Cada produto tem a ficha ENRIQUECIDA com o marketing individualizado (rascunho) já
// no carregamento — assim todo consumidor (montar/PDF/RAG/API) vê a ficha rica, e a
// página de produto sai sempre no layout completo (indicado para + benefícios).
export function carregarCatalogo(): Catalogo {
  if (cache) return cache;
  const raw = readFileSync(join(process.cwd(), "data", "catalogo.json"), "utf-8");
  const parsed = Catalogo.parse(JSON.parse(raw));
  cache = { ...parsed, produtos: parsed.produtos.map((p) => ({ ...p, ficha: enriquecerFicha(p) })) };
  return cache;
}

export function produtoPorCodigo(codigo: string): Produto | undefined {
  return carregarCatalogo().produtos.find((p) => p.codigo === codigo);
}
