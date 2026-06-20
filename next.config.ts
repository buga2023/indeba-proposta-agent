import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy — só em produção (em dev quebraria o HMR via websocket).
// Tudo é same-origin: sem recurso externo, sem exfiltração. 'unsafe-inline' é
// concessão ao Next (hidratação) — endurecer com nonce é melhoria futura.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "font-src 'self'",
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
    "/api/pdf": ["./public/**/*"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
