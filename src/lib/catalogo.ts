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
// orçamento) usa as duas funções abaixo.
//
// Em caso de código repetido, o BANCO vence — e essa precedência já foi a inversa. Antes o
// JSON ganhava, para que um cadastro novo não sequestrasse um código que já circula em
// proposta salva. Só que isso deixava os ~150 da base sem conserto pela tela: corrigir um
// preço errado exigia editar o arquivo e fazer deploy, e foi o que o Mateus esbarrou ("como é
// que eu edito um produto que já está cadastrado?"). A linha do banco agora é o OVERRIDE
// deliberado de um gestor — só admin escreve, e o formulário parte dos dados do próprio JSON.
//
// O que protege as propostas antigas não é esta precedência: é o snapshot. Toda proposta
// grava seu PropostaScope com preço e embalagem do momento em que foi montada, então mexer no
// catálogo hoje não reescreve o que já foi enviado ao cliente.
//
// A ORDEM da lista continua sendo a do JSON: o override troca o produto no lugar onde ele já
// estava, e só produto realmente novo entra no fim.
export async function catalogoCompleto(): Promise<Catalogo> {
  const base = carregarCatalogo();
  const { listarProdutosCustom, excluidosCustom } = await import("./produto-custom");
  let custom: Produto[] = [];
  let excluidos: string[] = [];
  try {
    [custom, excluidos] = await Promise.all([listarProdutosCustom(), excluidosCustom()]);
  } catch (e) {
    // Banco fora do ar não pode apagar o catálogo da tela: degrada para o JSON e registra.
    console.error("[catalogo] produtos cadastrados indisponíveis — servindo só o JSON:", e);
    return base;
  }
  if (!custom.length && !excluidos.length) return base;
  const porCodigo = new Map(base.produtos.map((p) => [p.codigo, p]));
  for (const p of custom) porCodigo.set(p.codigo, p);
  // A lápide é a ÚLTIMA palavra: um produto excluído sai da lista venha ele do JSON ou do
  // banco. Aplicada depois do override porque a mesma linha guarda as duas coisas — o
  // produto excluído continua com seus `dados` gravados, esperando um possível restaurar.
  for (const c of excluidos) porCodigo.delete(c);
  return { ...base, produtos: [...porCodigo.values()] };
}

export async function produtoPorCodigoCompleto(codigo: string): Promise<Produto | undefined> {
  const { linhaCustom } = await import("./produto-custom");
  try {
    // Banco primeiro, pela mesma razão: se existe override, é ele o produto atual.
    const linha = await linhaCustom(codigo);
    if (linha?.produto) return linha.produto;
    // Excluído é resposta definitiva: cair no JSON aqui ressuscitaria o produto da base que
    // o gestor tirou do catálogo, e ele voltaria a aparecer na montagem e na seleção.
    if (linha?.excluido) return undefined;
  } catch (e) {
    // Degradação, não erro: banco fora do ar não pode derrubar quem só queria reabrir uma
    // proposta. Cai no JSON abaixo, que é o pior caso aceitável (dado um pouco velho, não
    // tela quebrada) — bem melhor do que um 500 na leitura da proposta inteira.
    console.error(`[catalogo] override de ${codigo} indisponível — usando o JSON:`, e);
  }
  return produtoPorCodigo(codigo);
}
