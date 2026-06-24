// Indexação do corpus no Qdrant. Catálogo é a fonte base (produtos reais, do data/catalogo.json);
// documentos avulsos (FAQ, políticas) podem ser anexados. Embeddings vêm do Ollama.
import type { Produto, RagIndexResultado } from "../contracts";
import { carregarCatalogo } from "../catalogo";
import { embed } from "./embed";
import { chunk } from "./chunk";
import { COLECAO, garantirColecao, recriarColecao, upsert, type Ponto } from "./qdrant";

// Texto pesquisável de um produto — tudo que ajuda o atendente a responder sobre ele.
export function textoProduto(p: Produto): string {
  const emb = p.embalagens.map((e) => `${e.tamanho}${e.unidade} a R$ ${e.preco}`).join("; ");
  return [
    `Produto: ${p.nome} (código ${p.codigo}).`,
    `${p.descricaoCurta}.`,
    `Uso: ${p.descricaoUso}`,
    `Linha: ${p.linha}.`,
    `Segmentos: ${p.segmentos.join(", ")}.`,
    `Funções: ${p.funcoes.join(", ")}.`,
    `Métodos: ${p.metodos.join(", ")}.`,
    `Embalagens: ${emb}.`,
  ].join(" ");
}

// Reindexa o catálogo INTEIRO (coleção recriada do zero — sem duplicar).
export async function indexarCatalogo(): Promise<RagIndexResultado> {
  const produtos = carregarCatalogo().produtos.filter((p) => p.ativo);
  if (!produtos.length) return { ok: true, colecao: COLECAO, pontos: 0 };

  const textos = produtos.map(textoProduto);
  const vetores = await embed(textos);
  await recriarColecao(vetores[0].length);

  const pontos: Ponto[] = produtos.map((p, i) => ({
    id: crypto.randomUUID(),
    vetor: vetores[i],
    payload: { tipo: "produto", titulo: p.nome, codigo: p.codigo, texto: textos[i] },
  }));
  await upsert(pontos);
  return { ok: true, colecao: COLECAO, pontos: pontos.length };
}

// Anexa um documento (FAQ, política…) à coleção existente, dividido em chunks.
export async function indexarDoc(titulo: string, texto: string): Promise<RagIndexResultado> {
  const partes = chunk(texto);
  if (!partes.length) return { ok: true, colecao: COLECAO, pontos: 0 };

  const vetores = await embed(partes);
  await garantirColecao(vetores[0].length);

  const pontos: Ponto[] = partes.map((t, i) => ({
    id: crypto.randomUUID(),
    vetor: vetores[i],
    payload: { tipo: "doc", titulo, parte: i, texto: t },
  }));
  await upsert(pontos);
  return { ok: true, colecao: COLECAO, pontos: pontos.length };
}
