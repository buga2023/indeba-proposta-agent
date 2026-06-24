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

  it("com sessão válida → passa", async () => {
    authAtiva.mockReturnValue(true);
    validarSessao.mockResolvedValue({ login: "gustavo", papel: "admin" });
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
