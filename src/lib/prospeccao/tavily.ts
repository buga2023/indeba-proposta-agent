// Busca web via Tavily — OPCIONAL. Sem TAVILY_API_KEY a função degrada para [] e a
// prospecção roda só com o conhecimento do modelo (mesma filosofia de degradação
// graciosa do Ollama). Manda termos de busca pra fora, por isso é opt-in via env.
//
// VERSÃO GRÁTIS: usa só o endpoint /search (com include_raw_content) — o texto das
// páginas vem nos próprios resultados. Quando a conta tiver o endpoint /extract,
// dá pra raspar páginas inteiras com mais cobertura (plugável aqui depois).
const TAVILY_URL = "https://api.tavily.com/search";

// Uma fonte web: a URL, seu domínio (pra casar com o site do prospect) e o texto
// cru da página (onde o minerador procura contatos).
export type FonteWeb = { url: string; dominio: string; texto: string };

export function tavilyDisponivel(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export function dominioDe(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

async function buscaUma(query: string, key: string, maxResults: number): Promise<FonteWeb[]> {
  try {
    const r = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        search_depth: "advanced",
        include_raw_content: true,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as {
      results?: Array<{ url: string; content?: string; raw_content?: string | null }>;
    };
    return (data.results ?? []).map((x) => ({
      url: x.url,
      dominio: dominioDe(x.url),
      texto: `${x.content ?? ""}\n${x.raw_content ?? ""}`.trim(),
    }));
  } catch {
    return [];
  }
}

// Roda várias queries em paralelo e devolve fontes deduplicadas por URL.
export async function buscarFontes(queries: string[], maxPorQuery = 5): Promise<FonteWeb[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  const lotes = await Promise.all(queries.map((q) => buscaUma(q, key, maxPorQuery)));
  const vistas = new Set<string>();
  const out: FonteWeb[] = [];
  for (const f of lotes.flat()) {
    if (f.url && !vistas.has(f.url)) {
      vistas.add(f.url);
      out.push(f);
    }
  }
  return out;
}
