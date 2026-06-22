import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy — só em produção (em dev quebraria o HMR via websocket).
// Quase tudo é same-origin. Exceções: Google Fonts (design) e Puter.js
// (geração de imagem dos posts de Instagram via Nano Banana, client-side).
// 'unsafe-inline' é concessão ao Next (hidratação) — endurecer com nonce é melhoria futura.
const PUTER = "https://puter.com https://*.puter.com";
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `img-src 'self' data: blob: ${PUTER}`,
  // Google Fonts (Inter/Fraunces do design): CSS em fonts.googleapis.com, arquivos em fonts.gstatic.com.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `script-src 'self' 'unsafe-inline' ${PUTER}`,
  `connect-src 'self' ${PUTER}`,
  "font-src 'self' https://fonts.gstatic.com",
  `frame-src 'self' ${PUTER}`,
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
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  // Garante que o catálogo e as imagens vão no bundle das funções serverless
  // (são lidos via readFileSync em runtime; o tracing estático não os detecta).
  outputFileTracingIncludes: {
    "/api/montar": ["./data/**/*"],
    "/api/montar-estruturado": ["./data/**/*"],
    // public/** = imagens do PDF. browsers.json é dado interno do playwright-core
    // exigido em runtime (coreBundle.js) — o tracing não o detecta sozinho e a
    // função quebra com "Cannot find module .../browsers.json". Incluímos pelo
    // caminho REAL do pnpm (.pnpm/...), NUNCA pelo symlink node_modules/playwright-core
    // (a Vercel rejeita arquivos em diretórios symlinkados no pacote serverless).
    "/api/pdf": [
      "./public/**/*",
      "./node_modules/.pnpm/playwright-core@*/node_modules/playwright-core/browsers.json",
      // Binários do Chromium serverless (chromium.br, fonts/swiftshader/al2023 .tar.br):
      // são binários, o tracing não os segue. Sem eles: "The input directory .../bin
      // does not exist". Caminho REAL do pnpm (nunca o symlink @sparticuz/chromium).
      "./node_modules/.pnpm/@sparticuz+chromium@*/node_modules/@sparticuz/chromium/bin/**",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
