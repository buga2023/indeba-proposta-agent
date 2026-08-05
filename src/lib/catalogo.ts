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

// ── Catálogo completo: JSON + produtos cadastrados pela tela ──────────────────────
//
// `carregarCatalogo()` acima continua síncrono e só com o JSON de propósito — é o caminho
// quente, chamado em loop pelo matcher e pelo template do PDF, e tornar TUDO assíncrono só
// para acomodar a segunda fonte espalharia `await` por sete módulos sem ganho.
//
// Quem precisa ver o catálogo INTEIRO (a vitrine, a montagem, o RAG, a importação de
// orçamento) usa as duas funções abaixo. Produto do banco entra depois do JSON e, em caso de
// código repetido, o JSON vence: a base INDEBA/PRATT é a fonte histórica, e um cadastro novo
// não pode sequestrar um código que já circula em proposta salva. O `@unique` da tabela
// impede repetição dentro do banco; isto cobre a colisão ENTRE as fontes.
export async function catalogoCompleto(): Promise<Catalogo> {
  const base = carregarCatalogo();
  const { listarProdutosCustom } = await import("./produto-custom");
  let custom: Produto[] = [];
  try {
    custom = await listarProdutosCustom();
  } catch (e) {
    // Banco fora do ar não pode apagar o catálogo da tela: degrada para o JSON e registra.
    console.error("[catalogo] produtos cadastrados indisponíveis — servindo só o JSON:", e);
    return base;
  }
  const doJson = new Set(base.produtos.map((p) => p.codigo));
  const novos = custom.filter((p) => !doJson.has(p.codigo));
  return novos.length ? { ...base, produtos: [...base.produtos, ...novos] } : base;
}

export async function produtoPorCodigoCompleto(codigo: string): Promise<Produto | undefined> {
  const doJson = produtoPorCodigo(codigo);
  if (doJson) return doJson;
  const { produtoCustomPorCodigo } = await import("./produto-custom");
  try {
    return (await produtoCustomPorCodigo(codigo)) ?? undefined;
  } catch (e) {
    // Mesma degradação de `catalogoCompleto` acima: banco fora do ar não pode derrubar quem
    // só queria reabrir uma proposta. Quem chama já trata "não achei" (o item fica com a
    // imagem do snapshot) — bem melhor do que um 500 na leitura da proposta inteira.
    console.error(`[catalogo] produto cadastrado ${codigo} indisponível:`, e);
    return undefined;
  }
}
