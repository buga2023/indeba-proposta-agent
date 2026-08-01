import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mocka a sessão e a camada de persistência: o foco é QUEM pode ver O QUÊ, não o Prisma.
const usuarioAtual = vi.fn();
const listarPropostas = vi.fn();
const obterProposta = vi.fn();
const atualizarStatusProposta = vi.fn();
const salvarProposta = vi.fn();

vi.mock("@/lib/auth", () => ({ usuarioAtual: (req: NextRequest) => usuarioAtual(req) }));
vi.mock("@/lib/propostas", () => ({
  listarPropostas: (...a: unknown[]) => listarPropostas(...a),
  obterProposta: (...a: unknown[]) => obterProposta(...a),
  atualizarStatusProposta: (...a: unknown[]) => atualizarStatusProposta(...a),
  salvarProposta: (...a: unknown[]) => salvarProposta(...a),
}));

import { GET as LISTAR } from "@/app/api/propostas/route";
import { GET as ABRIR, PATCH } from "@/app/api/propostas/[id]/route";

const ADMIN = { email: "mateus@indeba.com", papel: "admin" };
const VENDEDOR_A = { email: "a@indeba.com", papel: "user" };

const reqLista = (qs = "") =>
  ({ nextUrl: { searchParams: new URLSearchParams(qs) } }) as unknown as NextRequest;
const reqVazio = () => ({}) as unknown as NextRequest;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const doOutro = {
  id: "p-do-b", autor: "b@indeba.com", status: "enviada", cliente: "Frigorífico B",
  segmento: null, tipo: "consolidada", total: "999.00", qtdItens: 1,
  criadoEm: "2026-07-01T00:00:00.000Z", atualizadoEm: "2026-07-01T00:00:00.000Z",
  scope: { id: "p-do-b", itens: [] },
};

beforeEach(() => {
  for (const m of [usuarioAtual, listarPropostas, obterProposta, atualizarStatusProposta, salvarProposta]) m.mockReset();
  listarPropostas.mockResolvedValue([]);
});

// Até 01/08/2026 o GET não lia a sessão: qualquer vendedor logado recebia o histórico da
// empresa inteira — nome de cliente e valor de cada proposta dos colegas. O gestor pediu
// como "deixa enxuto pros demais", mas o que está embaixo é isolamento de dado.
describe("GET /api/propostas — vendedor vê só a própria carteira", () => {
  it("vendedor: o e-mail dele vai como recorte de autor para o banco", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    await LISTAR(reqLista());
    expect(listarPropostas).toHaveBeenCalledWith(200, false, "a@indeba.com");
  });

  it("admin: sem recorte — o gestor vê o time inteiro", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    await LISTAR(reqLista());
    expect(listarPropostas).toHaveBeenCalledWith(200, false, undefined);
  });

  it("o recorte por autor convive com ?arquivadas=1", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    await LISTAR(reqLista("arquivadas=1"));
    expect(listarPropostas).toHaveBeenCalledWith(200, true, "a@indeba.com");
  });
});

// Escopar a listagem sem escopar o acesso direto seria fachada: bastava trocar o id na URL.
// A resposta é 404 e não 403 de propósito — 403 confirmaria que a proposta existe.
describe("GET /api/propostas/[id] — proposta de outro vendedor não existe", () => {
  it("vendedor A pedindo a proposta de B → 404", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    obterProposta.mockResolvedValue(doOutro);
    const r = await ABRIR(reqVazio(), params("p-do-b"));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ erro: "Proposta não encontrada." });
  });

  it("vendedor A pedindo a PRÓPRIA proposta → 200", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    obterProposta.mockResolvedValue({ ...doOutro, autor: "a@indeba.com" });
    expect((await ABRIR(reqVazio(), params("p-do-b"))).status).toBe(200);
  });

  it("admin abre a proposta de qualquer um → 200", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    obterProposta.mockResolvedValue(doOutro);
    expect((await ABRIR(reqVazio(), params("p-do-b"))).status).toBe(200);
  });
});

describe("PATCH /api/propostas/[id] — mudar status de proposta alheia", () => {
  const req = (status: string) => ({ json: async () => ({ status }) }) as unknown as NextRequest;

  it("vendedor A aprovando a proposta de B → 404 e nada é gravado", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    obterProposta.mockResolvedValue(doOutro);
    const r = await PATCH(req("aprovada"), params("p-do-b"));
    expect(r.status).toBe(404);
    expect(atualizarStatusProposta).not.toHaveBeenCalled();
  });

  it("vendedor A na própria proposta → grava", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    obterProposta.mockResolvedValue({ ...doOutro, autor: "a@indeba.com" });
    atualizarStatusProposta.mockResolvedValue({ ...doOutro, autor: "a@indeba.com", status: "aprovada" });
    await PATCH(req("aprovada"), params("p-do-b"));
    expect(atualizarStatusProposta).toHaveBeenCalledWith("p-do-b", "aprovada");
  });
});
