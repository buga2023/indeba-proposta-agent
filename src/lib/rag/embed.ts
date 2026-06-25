// Embeddings via Ollama (/api/embed). Modelo leve por padrão (nomic-embed-text), roda
// junto do 7B. A dimensão do vetor é inferida do próprio retorno (robusto a troca de modelo).
import { ollamaHeaders } from "@/lib/llm/ollama";

const BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

export function embedModelo(): string {
  return EMBED_MODEL;
}

export async function embed(textos: string[], timeoutMs = 60_000): Promise<number[][]> {
  if (textos.length === 0) return [];
  const r = await fetch(`${BASE}/api/embed`, {
    method: "POST",
    headers: ollamaHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ model: EMBED_MODEL, input: textos }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`Ollama embed ${r.status} (modelo '${EMBED_MODEL}' — rodou 'ollama pull ${EMBED_MODEL}'?)`);
  const data = (await r.json()) as { embeddings?: number[][] };
  if (!data.embeddings?.length) throw new Error("Ollama embed: resposta sem embeddings.");
  return data.embeddings;
}

export async function embedUm(texto: string): Promise<number[]> {
  return (await embed([texto]))[0];
}
