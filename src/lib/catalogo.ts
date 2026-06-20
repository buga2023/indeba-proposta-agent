import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Catalogo, type Produto } from "./contracts";

let cache: Catalogo | null = null;

// Lê data/catalogo.json e valida contra o Zod. Fonte da verdade dos dados críticos.
// (MVP sem DB — migra pra Prisma no Marco 0 real, mesmo contrato.)
export function carregarCatalogo(): Catalogo {
  if (cache) return cache;
  const raw = readFileSync(join(process.cwd(), "data", "catalogo.json"), "utf-8");
  cache = Catalogo.parse(JSON.parse(raw));
  return cache;
}

export function produtoPorCodigo(codigo: string): Produto | undefined {
  return carregarCatalogo().produtos.find((p) => p.codigo === codigo);
}
