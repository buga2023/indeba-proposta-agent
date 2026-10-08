import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mocks: auth e rate limit. O foco é o ROTEAMENTO de proteção do middleware,
// não a criptografia da sessão (coberta em auth.test.ts).
const authAtiva = vi.fn();
const validarSessao = vi.fn();
const rateLimitOk = vi.fn();
vi.mock("@/lib/auth", () => ({ authAtiva: () => authAtiva(), validarSessao: (c: unknown) => validarSessao(c) }));
vi.mock("@/lib/ratelimit", () => ({ rateLimitOk: (ip: string) => rateLimitOk(ip) }));

import { middleware } from "@/middleware";

const reqDe = (path: string) => new NextRequest(new URL(`http://localhost${path}`));

beforeEach(() => {
  authAtiva.mockReset();
  validarSessao.mockReset();
  rateLimitOk.mockReset().mockResolvedValue(true); // sem rate limit por padrão
});

describe("middleware — gate de auth abrangente (fecha o matcher gap)", () => {
  it("auth desligada → libera qualquer rota", async () => {
    authAtiva.mockReturnValue(false);
    expect((await middleware(reqDe("/api/instagram"))).status).toBe(200);
  });

  it("rota ANTES sem gate (instagram) agora exige sessão → 401", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue(null);
    expect((await middleware(reqDe("/api/instagram"))).status).toBe(401);
  });

  it("subrota (cobranca/disparar, propostas/[id]) também coberta → 401 sem sessão", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue(null);
    expect((await middleware(reqDe("/api/cobranca/disparar"))).status).toBe(401);
    expect((await middleware(reqDe("/api/propostas/abc-123"))).status).toBe(401);
  });

  it("login/logout permanecem públicos (sem 401) mesmo com auth ativa", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue(null);
    expect((await middleware(reqDe("/api/login"))).status).toBe(200);
    expect((await middleware(reqDe("/api/logout"))).status).toBe(200);
  });

  // Ficha técnica anexada pelo gestor: o PDF da proposta linka /api/produtos/<codigo>/ficha
  // ("Ver ficha técnica completa"). Quem abre é o CLIENTE, sem sessão — exigir login aqui
  // devolvia 401 e "a ficha técnica não abre" (relato do Mateus, 08/10/2026). As fichas
  // versionadas em public/fichas-tecnicas já eram públicas; esta é o mesmo documento.
  it("GET da ficha técnica de produto é público (link do PDF aberto pelo cliente)", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue(null);
    expect((await middleware(reqDe("/api/produtos/AUTOCAR-1000/ficha"))).status).toBe(200);
    expect((await middleware(reqDe("/api/produtos/HTC%20EXPOLIDOR/ficha"))).status).toBe(200);
  });

  it("outras rotas de produto (imagem, PUT, subrotas) continuam exigindo sessão", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue(null);
    expect((await middleware(reqDe("/api/produtos/AUTOCAR-1000/imagem"))).status).toBe(401);
    expect((await middleware(reqDe("/api/produtos/AUTOCAR-1000/ficha/extra"))).status).toBe(401);
    expect((await middleware(reqDe("/api/produtos"))).status).toBe(401);
    const put = new NextRequest(new URL("http://localhost/api/produtos/AUTOCAR-1000/ficha"), { method: "PUT" });
    expect((await middleware(put)).status).toBe(401);
  });

  it("com sessão válida → passa", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue({ email: "gustavo@indeba.com", papel: "admin" });
    expect((await middleware(reqDe("/api/instagram"))).status).toBe(200);
  });

  it("rate limit estourado em rota de API → 429 antes de autenticar", async () => {
    rateLimitOk.mockResolvedValue(false);
    expect((await middleware(reqDe("/api/login"))).status).toBe(429);
  });

  it("página protegida sem sessão → redireciona pro /login (307)", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue(null);
    const r = await middleware(reqDe("/"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toContain("/login");
  });
});
