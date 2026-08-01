import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { AcessoPendenteError } from "@/lib/auth-db";

// Guardião do portão de entrada. O cadastro em /cadastro é ABERTO — qualquer pessoa com o
// link cria uma conta. O que separa "criou conta" de "entra no sistema" é a aprovação do
// gestor, e é isso que estes testes protegem: se alguém afrouxar o gate, um cadastro de
// fora do time passa a ver a carteira de propostas da Indeba.

const validarCredenciais = vi.fn();
const acessoDe = vi.fn();
const validarSessao = vi.fn();
const listarColaboradores = vi.fn();
const atualizarColaborador = vi.fn();

vi.mock("@/lib/auth-db", async (original) => ({
  ...(await original<typeof import("@/lib/auth-db")>()),
  validarCredenciais: (...a: unknown[]) => validarCredenciais(...a),
  acessoDe: (...a: unknown[]) => acessoDe(...a),
  listarColaboradores: (...a: unknown[]) => listarColaboradores(...a),
  atualizarColaborador: (...a: unknown[]) => atualizarColaborador(...a),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  validarSessao: (...a: unknown[]) => validarSessao(...a),
}));

import { POST as LOGIN } from "@/app/api/login/route";
import { GET as ME } from "@/app/api/me/route";
import { PATCH as COLAB } from "@/app/api/colaboradores/route";

const reqBody = (body: unknown) => ({ json: async () => body }) as unknown as NextRequest;
const reqCookie = () => ({ cookies: { get: () => ({ value: "cookie-qualquer" }) } }) as unknown as NextRequest;
const reqPatch = (body: unknown) =>
  ({ json: async () => body, cookies: { get: () => ({ value: "cookie-qualquer" }) } }) as unknown as NextRequest;

const GESTOR = { email: "gestor@indeba.com", nome: "Gestor", papel: "admin" as const };

beforeEach(() => {
  for (const m of [validarCredenciais, acessoDe, validarSessao, listarColaboradores, atualizarColaborador]) m.mockReset();
  process.env.AUTH_SESSION_SECRET = "segredo-de-teste";
});

describe("login — sem liberação do gestor, ninguém entra", () => {
  it("403 e NENHUMA sessão quando a conta está pendente", async () => {
    validarCredenciais.mockRejectedValue(new AcessoPendenteError("pendente"));
    const r = await LOGIN(reqBody({ email: "novo@indeba.com", senha: "senha-certa-123" }));
    expect(r.status).toBe(403);
    expect(r.cookies.get("sessao"), "cookie de sessão não pode ser emitido").toBeUndefined();
    expect((await r.json()).erro).toMatch(/aguardando libera/i);
  });

  it("403 quando o acesso foi revogado", async () => {
    validarCredenciais.mockRejectedValue(new AcessoPendenteError("bloqueado"));
    const r = await LOGIN(reqBody({ email: "exfuncionario@indeba.com", senha: "senha-certa-123" }));
    expect(r.status).toBe(403);
    expect((await r.json()).erro).toMatch(/encerrado/i);
  });

  // 403 e não 401: a senha está CERTA. Dizer "e-mail ou senha inválidos" mandaria a pessoa
  // redefinir uma senha que funciona, e ela nunca descobriria que só falta a aprovação.
  it("401 continua reservado para credencial errada de verdade", async () => {
    validarCredenciais.mockResolvedValue(null);
    expect((await LOGIN(reqBody({ email: "a@indeba.com", senha: "errada" }))).status).toBe(401);
  });

  it("aprovado entra normalmente, com cookie", async () => {
    validarCredenciais.mockResolvedValue({ email: "a@indeba.com", nome: "A", papel: "user" });
    const r = await LOGIN(reqBody({ email: "a@indeba.com", senha: "senha-certa-123" }));
    expect(r.status).toBe(200);
    expect(r.cookies.get("sessao")?.value).toBeTruthy();
  });
});

// A sessão é um cookie assinado de 8h que não toca o banco — ótimo para performance, ruim
// para revogar: sem esta checagem, quem perdeu o acesso continuaria usando o sistema até o
// cookie expirar. /api/me roda a cada carregamento do app e é o que fecha a janela.
describe("/api/me — revogar tem que derrubar quem já está logado", () => {
  it("401 e cookie apagado quando o acesso foi revogado durante a sessão", async () => {
    validarSessao.mockResolvedValue({ email: "a@indeba.com", nome: "A", papel: "user" });
    acessoDe.mockResolvedValue("bloqueado");
    const r = await ME(reqCookie());
    expect(r.status).toBe(401);
    expect(r.cookies.get("sessao")?.value, "o cookie tem que ser limpo").toBeFalsy();
  });

  it("401 quando a conta ainda está pendente", async () => {
    validarSessao.mockResolvedValue({ email: "novo@indeba.com", nome: "Novo", papel: "user" });
    acessoDe.mockResolvedValue("pendente");
    expect((await ME(reqCookie())).status).toBe(401);
  });

  it("200 com os dados da sessão quando o acesso está liberado", async () => {
    validarSessao.mockResolvedValue({ email: "a@indeba.com", nome: "A", papel: "user" });
    acessoDe.mockResolvedValue("aprovado");
    const r = await ME(reqCookie());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ email: "a@indeba.com", nome: "A", papel: "user" });
  });
});

describe("/api/colaboradores — só o gestor aprova, e não a si mesmo", () => {
  it("403 para quem não é admin", async () => {
    validarSessao.mockResolvedValue({ email: "vendedor@indeba.com", nome: "V", papel: "user" });
    const r = await COLAB(reqPatch({ email: "outro@indeba.com", acesso: "aprovado" }));
    expect(r.status).toBe(403);
    expect(atualizarColaborador).not.toHaveBeenCalled();
  });

  it("401 sem sessão", async () => {
    validarSessao.mockResolvedValue(null);
    expect((await COLAB(reqPatch({ email: "o@indeba.com", acesso: "aprovado" }))).status).toBe(401);
  });

  it("o gestor libera, revoga e promove outra pessoa", async () => {
    validarSessao.mockResolvedValue(GESTOR);
    atualizarColaborador.mockResolvedValue({ nome: "A", email: "a@indeba.com", papel: "admin", acesso: "aprovado", telefone: null, criadoEm: "2026-08-01T00:00:00.000Z" });

    await COLAB(reqPatch({ email: "a@indeba.com", acesso: "aprovado" }));
    expect(atualizarColaborador).toHaveBeenCalledWith("a@indeba.com", { acesso: "aprovado" });

    await COLAB(reqPatch({ email: "a@indeba.com", papel: "admin" }));
    expect(atualizarColaborador).toHaveBeenLastCalledWith("a@indeba.com", { papel: "admin" });
  });

  // Sem esta trava, um clique na própria linha derruba quem controla o painel — e só o
  // admin chega aqui, então não sobra ninguém para desfazer. Recuperação seria via banco.
  it("GUARDIÃO: o gestor não revoga o próprio acesso", async () => {
    validarSessao.mockResolvedValue(GESTOR);
    const r = await COLAB(reqPatch({ email: GESTOR.email, acesso: "bloqueado" }));
    expect(r.status).toBe(409);
    expect(atualizarColaborador).not.toHaveBeenCalled();
  });

  it("GUARDIÃO: o gestor não se rebaixa a vendedor", async () => {
    validarSessao.mockResolvedValue(GESTOR);
    const r = await COLAB(reqPatch({ email: GESTOR.email.toUpperCase(), papel: "user" }));
    expect(r.status, "e a comparação ignora caixa do e-mail").toBe(409);
    expect(atualizarColaborador).not.toHaveBeenCalled();
  });

  it("mas o gestor continua editando o próprio telefone", async () => {
    validarSessao.mockResolvedValue(GESTOR);
    atualizarColaborador.mockResolvedValue({ nome: "Gestor", email: GESTOR.email, papel: "admin", acesso: "aprovado", telefone: "11999", criadoEm: "2026-08-01T00:00:00.000Z" });
    const r = await COLAB(reqPatch({ email: GESTOR.email, telefone: "11999" }));
    expect(r.status).toBe(200);
  });

  it("recusa valor de acesso fora do enum", async () => {
    validarSessao.mockResolvedValue(GESTOR);
    const r = await COLAB(reqPatch({ email: "a@indeba.com", acesso: "liberado-geral" }));
    expect(r.status).toBe(400);
    expect(atualizarColaborador).not.toHaveBeenCalled();
  });
});
