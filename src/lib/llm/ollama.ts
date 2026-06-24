// Cliente mínimo do Ollama (spec: Qwen2.5 7B Instruct, saída JSON restrita por schema).
const BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b-instruct";

// Modelo para o TEXTO que o cliente lê (apresentação da proposta, cláusulas do contrato):
// qwen3:14b redige nitidamente melhor que o 7B. Classificação/extração continua no MODEL
// (rápido; o backbone determinístico já cobre os erros dele). Roteamento híbrido.
export const MODEL_TEXTO = process.env.OLLAMA_MODEL_TEXTO ?? "qwen3:14b";

export async function ollamaDisponivel(): Promise<boolean> {
  // Produção sem Ollama configurado → roda 100% determinístico, sem tentar
  // (evita o timeout a cada requisição na Vercel).
  if (process.env.VERCEL && !process.env.OLLAMA_BASE_URL) return false;
  // Com URL explícita (com-ia via túnel cloudflared), o caminho Vercel→túnel→PC tem
  // latência bem maior que o localhost: 1,5s não basta e dá 503 falso. Dá folga.
  const timeout = process.env.OLLAMA_BASE_URL ? 6000 : 1500;
  try {
    const r = await fetch(`${BASE}/api/tags`, { signal: AbortSignal.timeout(timeout) });
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
  think?: boolean, // modelos de raciocínio (qwen3): false desliga o <think> e corta MUITO o tempo
  numCtx = 8192, // janela de contexto: sem isso o Ollama cai no default (~2k) e TRUNCA
  // prompts longos (RAG, análise de contrato, catálogo) em silêncio — pior resposta.
): Promise<string> {
  const r = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: schema,
      options: { temperature, num_ctx: numCtx },
      ...(think === undefined ? {} : { think }), // só envia p/ modelos que suportam thinking
      keep_alive: "30m", // mantém o modelo na VRAM — evita cold start (que estoura 60s)
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  const data = (await r.json()) as { response: string };
  return data.response;
}

// Acumula uma resposta NDJSON do Ollama (stream:true) num texto só. Streaming evita o
// headers-timeout da fetch durante o cold-load de um modelo grande (ex.: visão).
async function acumularStream(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let saida = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const linha = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!linha) continue;
      const obj = JSON.parse(linha) as { response?: string; error?: string };
      if (obj.error) throw new Error(`Ollama: ${obj.error}`);
      if (obj.response) saida += obj.response;
    }
  }
  return saida.trim();
}

// Descreve uma imagem com um modelo de VISÃO (ex.: qwen2.5vl). `imagemBase64` cru,
// sem o prefixo "data:". Usado para extrair o estilo visual de posts de referência.
export async function descreverImagem(
  prompt: string,
  imagemBase64: string,
  timeoutMs = 300_000, // imagem grande + cold-load + disputa de VRAM pode passar de 180s
  model = process.env.OLLAMA_MODEL_VISAO ?? "qwen2.5vl:7b",
): Promise<string> {
  const r = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      images: [imagemBase64],
      stream: true,
      // num_ctx alto: imagem grande vira muitos "tokens visuais" e estoura o ctx padrão
      // (4096) → Ollama 400 exceed_context_size. 8192 cobre artes de post de alta resolução.
      options: { temperature: 0.2, num_ctx: 8192 },
      keep_alive: "30m",
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok || !r.body) {
    const corpo = await r.text().catch(() => "");
    throw new Error(`Ollama visão ${r.status}: ${corpo.slice(0, 300)}`);
  }
  return acumularStream(r.body);
}

export async function gerarTexto(prompt: string, model = MODEL): Promise<string> {
  const r = await fetch(`${BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      // num_ctx evita truncar o contexto; num_predict corta divagação (a saída já é
      // limitada a ~900 chars no chamador) e deixa a geração um pouco mais rápida.
      options: { temperature: 0.4, num_ctx: 8192, num_predict: 400 },
      ...(model.startsWith("qwen3") ? { think: false } : {}), // qwen3: sem <think> = bem mais rápido
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`Ollama ${r.status}`);
  const data = (await r.json()) as { response: string };
  return data.response.trim();
}
