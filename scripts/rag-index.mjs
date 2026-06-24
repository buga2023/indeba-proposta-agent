// Indexa o catálogo (data/catalogo.json) no Qdrant para o agente de Atendimento (RAG).
// Standalone (sem subir o Next/auth). Espelha src/lib/rag/indexar.ts::textoProduto.
// Uso: node --env-file=.env.local scripts/rag-index.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const QDRANT = process.env.QDRANT_URL ?? "http://localhost:6333";
const COLECAO = process.env.QDRANT_COLLECTION ?? "indeba_rag";
const API_KEY = process.env.QDRANT_API_KEY;

function qHeaders() {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["api-key"] = API_KEY;
  return h;
}

function textoProduto(p) {
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

async function embed(textos) {
  const r = await fetch(`${OLLAMA}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: textos }),
  });
  if (!r.ok) throw new Error(`Ollama embed ${r.status} — rodou 'ollama pull ${EMBED_MODEL}'?`);
  const d = await r.json();
  if (!d.embeddings?.length) throw new Error("Ollama: resposta sem embeddings.");
  return d.embeddings;
}

async function recriarColecao(dim) {
  await fetch(`${QDRANT}/collections/${COLECAO}`, { method: "DELETE", headers: qHeaders() }).catch(() => {});
  const r = await fetch(`${QDRANT}/collections/${COLECAO}`, {
    method: "PUT",
    headers: qHeaders(),
    body: JSON.stringify({ vectors: { size: dim, distance: "Cosine" } }),
  });
  if (!r.ok) throw new Error(`Qdrant criar coleção ${r.status}: ${await r.text()}`);
}

async function upsert(points) {
  const r = await fetch(`${QDRANT}/collections/${COLECAO}/points?wait=true`, {
    method: "PUT",
    headers: qHeaders(),
    body: JSON.stringify({ points }),
  });
  if (!r.ok) throw new Error(`Qdrant upsert ${r.status}: ${await r.text()}`);
}

const catalogo = JSON.parse(readFileSync(join(RAIZ, "data", "catalogo.json"), "utf-8"));
const produtos = catalogo.produtos.filter((p) => p.ativo);
console.log(`Catálogo: ${catalogo.produtos.length} produtos (${produtos.length} ativos). Marca: ${catalogo.marca}.`);
console.log(`Embeddings: ${EMBED_MODEL} @ ${OLLAMA} | Qdrant: ${COLECAO} @ ${QDRANT}`);

const textos = produtos.map(textoProduto);
const vetores = await embed(textos);
console.log(`Embeddings gerados: ${vetores.length} × ${vetores[0].length} dims.`);

await recriarColecao(vetores[0].length);
const points = produtos.map((p, i) => ({
  id: crypto.randomUUID(),
  vector: vetores[i],
  payload: { tipo: "produto", titulo: p.nome, codigo: p.codigo, texto: textos[i] },
}));
await upsert(points);
console.log(`\n✅ Indexados ${points.length} produtos na coleção "${COLECAO}".`);
