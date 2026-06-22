// Cliente mínimo do Ollama (spec: Qwen2.5 7B Instruct, saída JSON restrita por schema).
const BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

export async function ollamaDisponivel(): Promise<boolean> {
  // Produção sem Ollama configurado → roda 100% determinístico, sem tentar
  // (evita o timeout de 1,5s a cada requisição na Vercel).
  if (process.env.VERCEL && !process.env.OLLAMA_BASE_URL) return false;
  try {
    const r = await fetch(`${BASE}/api/tags`, { signal: AbortSignal.timeout(1500) });
    return r.ok;
  } catch {
    return false;
  }
}

// Gera resposta com `format` = JSON Schema (saída restrita). Retorna o texto cru.
// `timeoutMs` e `temperature` são configuráveis: classificação usa 0 (determinístico);
// copy criativo (posts) pede temperatura mais alta pra não ficar genérico.
export async function gerarJson(
  prompt: string,
  schema: object,
  timeoutMs = 60_000,
  temperature = 0,
  model = MODEL,
): Promise<string> {
  const r = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: schema,
      options: { temperature },
      keep_alive: "30m", // mantém o modelo na VRAM — evita cold start (que estoura 60s)
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  const data = (await r.json()) as { response: string };
  return data.response;
}

export async function gerarTexto(prompt: string): Promise<string> {
  const r = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.4 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  const data = (await r.json()) as { response: string };
  return data.response.trim();
}
