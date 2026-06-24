// Cliente mínimo do Qdrant via REST (mesmo estilo fetch usado p/ Ollama/Tavily — sem SDK).
// Guarda só busca vetorial: criar coleção, upsert de pontos e search. Sobe via docker-compose.
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
export const COLECAO = process.env.QDRANT_COLLECTION ?? "indeba_rag";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (QDRANT_API_KEY) h["api-key"] = QDRANT_API_KEY;
  return h;
}

export type Ponto = { id: string; vetor: number[]; payload: Record<string, unknown> };
export type AchadoQdrant = { score: number; payload: Record<string, unknown> };

export async function qdrantDisponivel(): Promise<boolean> {
  try {
    const r = await fetch(`${QDRANT_URL}/healthz`, { signal: AbortSignal.timeout(2500) });
    return r.ok;
  } catch {
    return false;
  }
}

// Cria a coleção se ainda não existe (mantém o conteúdo). Usado ao anexar documentos.
export async function garantirColecao(dim: number): Promise<void> {
  const r = await fetch(`${QDRANT_URL}/collections/${COLECAO}`, { headers: headers() });
  if (r.ok) return;
  await criarColecao(dim);
}

// Recria do zero (apaga e cria) — reindexação limpa do catálogo.
export async function recriarColecao(dim: number): Promise<void> {
  await fetch(`${QDRANT_URL}/collections/${COLECAO}`, { method: "DELETE", headers: headers() }).catch(() => {});
  await criarColecao(dim);
}

async function criarColecao(dim: number): Promise<void> {
  const r = await fetch(`${QDRANT_URL}/collections/${COLECAO}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ vectors: { size: dim, distance: "Cosine" } }),
  });
  if (!r.ok) throw new Error(`Qdrant criar coleção ${r.status}: ${await r.text()}`);
}

export async function upsert(pontos: Ponto[]): Promise<void> {
  if (!pontos.length) return;
  const points = pontos.map((p) => ({ id: p.id, vector: p.vetor, payload: p.payload }));
  const r = await fetch(`${QDRANT_URL}/collections/${COLECAO}/points?wait=true`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ points }),
  });
  if (!r.ok) throw new Error(`Qdrant upsert ${r.status}: ${await r.text()}`);
}

export async function buscar(vetor: number[], limite = 5): Promise<AchadoQdrant[]> {
  const r = await fetch(`${QDRANT_URL}/collections/${COLECAO}/points/search`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ vector: vetor, limit: limite, with_payload: true }),
  });
  if (!r.ok) throw new Error(`Qdrant search ${r.status}: ${await r.text()}`);
  const data = (await r.json()) as { result?: { score: number; payload: Record<string, unknown> }[] };
  return (data.result ?? []).map((x) => ({ score: x.score, payload: x.payload }));
}
