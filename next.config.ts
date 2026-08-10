import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy — só em produção (em dev quebraria o HMR via websocket).
// Quase tudo é same-origin. Exceções: Google Fonts (design) e Pollinations.ai
// (imagem dos posts de Instagram, carregada via <img> — só img-src, sem script externo).
// 'unsafe-inline' é concessão ao Next (hidratação) — endurecer com nonce é melhoria futura.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data: blob: https://image.pollinations.ai https://*.pollinations.ai",
  // Google Fonts (Inter/Fraunces do design): CSS em fonts.googleapis.com, arquivos em fonts.gstatic.com.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "font-src 'self' https://fonts.gstatic.com",
  "form-action 'self'",
].join("; ");

// Cabeçalhos de segurança (OWASP A05 — Security Misconfiguration / Secure Headers).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  ...(isProd ? [{ key: "Content-Security-Policy", value: csp }] : []),
];

const nextConfig: NextConfig = {
  // Não revela o framework no header (OWASP A05).
  poweredByHeader: false,
  // Render do PDF roda no server — esses pacotes não podem ser empacotados pelo bundler.
  // pdfjs-dist/mammoth (extração de texto de contrato anexado) idem: o pdfjs procura o
  // pdf.worker.mjs por caminho de runtime — bundlado, ele quebra com "fake worker failed".
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium", "pdfjs-dist", "mammoth"],
  // Garante que o catálogo e as imagens vão no bundle das funções serverless
  // (são lidos via readFileSync em runtime; o tracing estático não os detecta).
  outputFileTracingIncludes: {
    "/api/montar": ["./data/**/*"],
    "/api/montar-estruturado": ["./data/**/*"],
    // Só as pastas de public/ que o render.ts realmente lê (produtos/marca/fonts —
    // ver EXT_PERMITIDAS em src/lib/pdf/render.ts). NUNCA "./public/**/*": isso
    // arrasta public/fichas-tecnicas/ (91MB de PDF, nunca lido por esta função) pro
    // bundle da Lambda e estoura o limite de 250MB descompactado. browsers.json é
    // dado interno do playwright-core exigido em runtime (coreBundle.js) — o tracing
    // não o detecta sozinho e a função quebra com "Cannot find module .../browsers.json".
    // Incluímos pelo caminho REAL do pnpm (.pnpm/...), NUNCA pelo symlink
    // node_modules/playwright-core (a Vercel rejeita arquivos em diretórios
    // symlinkados no pacote serverless).
    "/api/pdf": [
      "./public/produtos/**/*",
      "./public/marca/**/*",
      "./public/fonts/**/*",
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/browsers.json",
      // Binários do Chromium serverless (chromium.br, fonts/swiftshader/al2023 .tar.br):
      // são binários, o tracing não os segue. Sem eles: "The input directory .../bin
      // does not exist". Caminho REAL do pnpm (nunca o symlink @sparticuz/chromium).
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
    // pdfjs-dist tenta subir um worker (pdf.worker.mjs) por import dinâmico relativo ao
    // próprio pacote; sem isso no bundle serverless, quebra com "Setting up fake worker
    // failed: Cannot find module .../pdf.worker.mjs" (mesma classe de problema do
    // Chromium acima — o tracing estático não segue o require/import dinâmico do pacote
    // externo). Usado por Importar orçamento e Análise de contrato (extração de PDF).
    "/api/orcamento/importar": ["./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/contrato/extrair": ["./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    // "Preencher a partir da ficha" (cadastro de produto) usa o MESMO pdfjs — sem o worker
    // no bundle a rota devolvia 500 na Vercel ("Setting up fake worker failed"). E o fluxo
    // por ?codigo= lê a ficha herdada da base de public/fichas-tecnicas/ via readFile, que
    // o tracing também não segue (arquivos de public/ não entram na função por padrão).
    "/api/produtos/extrair-ficha": [
      "./node_modules/.pnpm/pdfjs-dist@*/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./public/fichas-tecnicas/**/*",
    ],
  },
  // Cinto de segurança: mesmo com o include acima já restrito a produtos/marca/fonts,
  // exclui explicitamente as fichas técnicas (91MB de PDF) do bundle do /api/pdf —
  // essa função nunca lê esses arquivos (só o Catálogo linka pra eles no navegador).
  outputFileTracingExcludes: {
    "/api/pdf": ["./public/fichas-tecnicas/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
