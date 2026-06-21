// Busca web via Tavily — OPCIONAL. Sem TAVILY_API_KEY a função degrada para "" e a
// prospecção roda só com o conhecimento do modelo (mesma filosofia de degradação
// graciosa do Ollama). É a primeira integração externa do projeto: manda o termo de
// busca pra fora, por isso é opt-in via env.
const TAVILY_URL = "https://api.tavily.com/search";

export function tavilyDisponivel(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export async function buscarWeb(query: string, maxResults = 5): Promise<string> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return "";
  try {
    const r = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return "";
    const data = (await r.json()) as { results?: Array<{ url: string; content?: string }> };
    return (data.results ?? [])
      .map((x) => `Fonte: ${x.url}\n${x.content ?? ""}`)
      .join("\n\n");
  } catch {
    return "";
  }
}
