import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mocka só o acesso ao banco (auth-db) — o foco é a ROTA (validação, 409, cookie).
const criarUsuario = vi.fn();
vi.mock("@/lib/auth-db", () => ({
  criarUsuario: (...a: unknown[]) => criarUsuario(...a),
  EmailEmUsoError: class EmailEmUsoError extends Error {},
}));

import { POST } from "@/app/api/cadastro/route";
import { EmailEmUsoError } from "@/lib/auth-db";

const req = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;

beforeEach(() => {
  criarUsuario.mockReset();
  process.env.AUTH_SESSION_SECRET = "segredo-de-teste";
});

describe("POST /api/cadastro — cadastro próprio (nome/e-mail/senha)", () => {
  it("400 quando falta campo obrigatório ou a senha é curta demais", async () => {
    const r = await POST(req({ nome: "Mateus", email: "mateus@indeba.com", senha: "123" }));
    expect(r.status).toBe(400);
    expect(criarUsuario).not.toHaveBeenCalled();
  });

  it("409 quando o e-mail já tem conta", async () => {
    criarUsuario.mockRejectedValue(new EmailEmUsoError());
    const r = await POST(req({ nome: "Mateus", email: "mateus@indeba.com", senha: "senha12345" }));
    expect(r.status).toBe(409);
  });

  it("201 + cookie de sessão no cadastro bem-sucedido (já loga direto, sem passo extra)", async () => {
    criarUsuario.mockResolvedValue({ email: "mateus@indeba.com", nome: "Mateus", papel: "user" });
    const r = await POST(req({ nome: "Mateus", email: "mateus@indeba.com", senha: "senha12345" }));
    expect(r.status).toBe(201);
    expect(r.cookies.get("sessao")?.value).toBeTruthy();
  });
});
