import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mocka só o acesso ao banco (auth-db) — o foco é a ROTA (validação, status, cookie).
const validarCredenciais = vi.fn();
vi.mock("@/lib/auth-db", () => ({ validarCredenciais: (...a: unknown[]) => validarCredenciais(...a) }));

import { POST } from "@/app/api/login/route";

const req = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;

beforeEach(() => {
  validarCredenciais.mockReset();
  process.env.AUTH_SESSION_SECRET = "segredo-de-teste";
});

describe("POST /api/login — e-mail/senha", () => {
  it("400 quando o e-mail não tem formato válido", async () => {
    const r = await POST(req({ email: "nao-e-email", senha: "12345678" }));
    expect(r.status).toBe(400);
    expect(validarCredenciais).not.toHaveBeenCalled();
  });

  it("401 quando as credenciais são inválidas", async () => {
    validarCredenciais.mockResolvedValue(null);
    const r = await POST(req({ email: "mateus@indeba.com", senha: "errada" }));
    expect(r.status).toBe(401);
  });

  it("200 + cookie de sessão quando as credenciais batem", async () => {
    validarCredenciais.mockResolvedValue({ email: "mateus@indeba.com", nome: "Mateus", papel: "user" });
    const r = await POST(req({ email: "mateus@indeba.com", senha: "indeba@2026" }));
    expect(r.status).toBe(200);
    expect((await r.json()).papel).toBe("user");
    expect(r.cookies.get("sessao")?.value).toBeTruthy();
  });
});
