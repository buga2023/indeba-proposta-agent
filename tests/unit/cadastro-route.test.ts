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

  // O cadastro é aberto — qualquer pessoa com o link cria conta. Desde 01/08/2026 ele NÃO
  // loga mais direto: a conta nasce pendente e o gestor libera no painel. Se isto voltar a
  // emitir cookie para colaborador, um cadastro de fora do time entra sozinho no sistema.
  it("GUARDIÃO: colaborador pendente recebe 201 SEM cookie de sessão", async () => {
    criarUsuario.mockResolvedValue({ email: "novo@indeba.com", nome: "Novo", papel: "user", acesso: "pendente" });
    const r = await POST(req({ nome: "Novo", email: "novo@indeba.com", senha: "senha12345" }));
    expect(r.status).toBe(201);
    expect(r.cookies.get("sessao")?.value, "nenhuma sessão antes da aprovação").toBeFalsy();
    const corpo = await r.json();
    expect(corpo.pendente).toBe(true);
    expect(corpo.mensagem).toMatch(/liberada pelo gestor/i);
  });

  // Exceção: o gestor de ADMIN_EMAILS nasce aprovado, porque não há quem o aprove.
  it("gestor já nasce aprovado e entra na hora, com cookie", async () => {
    criarUsuario.mockResolvedValue({ email: "gestor@indeba.com", nome: "Gestor", papel: "admin", acesso: "aprovado" });
    const r = await POST(req({ nome: "Gestor", email: "gestor@indeba.com", senha: "senha12345" }));
    expect(r.status).toBe(201);
    expect(r.cookies.get("sessao")?.value).toBeTruthy();
  });
});
