// Mini-proxy autenticado na frente do Ollama. O cloudflared aponta pra cá (porta
// OLLAMA_PROXY_PORT, default 11435), NÃO direto pro Ollama. Só repassa pro Ollama
// (127.0.0.1:11434) quem mandar `Authorization: Bearer <OLLAMA_AUTH_TOKEN>`. Fecha o
// túnel aberto sem custo (sem domínio / Cloudflare Access). O app manda o mesmo Bearer
// via ollamaHeaders() (env OLLAMA_AUTH_TOKEN na Vercel).
//
//   node scripts/ollama-proxy.mjs            # token vem de OLLAMA_AUTH_TOKEN no ambiente
//
import http from "node:http";

const TOKEN = process.env.OLLAMA_AUTH_TOKEN;
const PORT = Number(process.env.OLLAMA_PROXY_PORT ?? 11435);
const OLLAMA_HOST = "127.0.0.1";
const OLLAMA_PORT = 11434;

if (!TOKEN) {
  console.error("Erro: defina OLLAMA_AUTH_TOKEN (o mesmo token setado na Vercel).");
  process.exit(1);
}

const server = http.createServer((req, res) => {
  if (req.headers["authorization"] !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { "content-type": "text/plain" });
    res.end("unauthorized");
    return;
  }
  // Repassa pro Ollama forçando Host: localhost:11434 (o Ollama responde 403 a Host
  // estranho, como o hostname do trycloudflare). Remove o Authorization (uso interno).
  const headers = { ...req.headers, host: `localhost:${OLLAMA_PORT}` };
  delete headers["authorization"];
  const upstream = http.request(
    { host: OLLAMA_HOST, port: OLLAMA_PORT, path: req.url, method: req.method, headers },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end("bad gateway (Ollama no ar?)");
  });
  req.pipe(upstream);
});

// Geração longa: sem timeout de corpo no proxy (o teto real é o maxDuration da Vercel).
server.requestTimeout = 0;
server.headersTimeout = 0;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`ollama-proxy: 127.0.0.1:${PORT} → ${OLLAMA_HOST}:${OLLAMA_PORT} (bearer exigido)`);
});
