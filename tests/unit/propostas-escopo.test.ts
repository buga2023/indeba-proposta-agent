import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Mocka a sessão e a camada de persistência: o foco é QUEM pode ver O QUÊ, não o Prisma.
const usuarioAtual = vi.fn();
const listarPropostas = vi.fn();
const obterProposta = vi.fn();
const autorDaProposta = vi.fn();
const atualizarStatusProposta = vi.fn();
const salvarProposta = vi.fn();
const autorEStatusDaProposta = vi.fn();
const excluirPropostaDefinitivamente = vi.fn();

vi.mock("@/lib/auth-db", () => ({ usuarioAtual: (req: NextRequest) => usuarioAtual(req) }));
vi.mock("@/lib/propostas", () => ({
  listarPropostas: (...a: unknown[]) => listarPropostas(...a),
  obterProposta: (...a: unknown[]) => obterProposta(...a),
  autorDaProposta: (...a: unknown[]) => autorDaProposta(...a),
  atualizarStatusProposta: (...a: unknown[]) => atualizarStatusProposta(...a),
  salvarProposta: (...a: unknown[]) => salvarProposta(...a),
  autorEStatusDaProposta: (...a: unknown[]) => autorEStatusDaProposta(...a),
  excluirPropostaDefinitivamente: (...a: unknown[]) => excluirPropostaDefinitivamente(...a),
}));

import { GET as LISTAR, POST as SALVAR } from "@/app/api/propostas/route";
import { GET as ABRIR, PATCH, DELETE } from "@/app/api/propostas/[id]/route";

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
  for (const m of [usuarioAtual, listarPropostas, obterProposta, autorDaProposta, atualizarStatusProposta, salvarProposta, autorEStatusDaProposta, excluirPropostaDefinitivamente]) m.mockReset();
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
    autorDaProposta.mockResolvedValue("b@indeba.com");
    const r = await PATCH(req("aprovada"), params("p-do-b"));
    expect(r.status).toBe(404);
    expect(atualizarStatusProposta).not.toHaveBeenCalled();
  });

  // Desde 17/08/2026 mudar status (inclusive excluir/restaurar) é ação de GESTÃO: o
  // vendedor edita o conteúdo pelo POST, mas o status é do admin. 403 e não 404 — a
  // proposta é dele, ele a vê; o que falta é papel.
  it("vendedor A na própria proposta → 403 e nada é gravado", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    autorDaProposta.mockResolvedValue("a@indeba.com");
    const r = await PATCH(req("aprovada"), params("p-do-b"));
    expect(r.status).toBe(403);
    expect(atualizarStatusProposta).not.toHaveBeenCalled();
  });

  it("admin muda o status de qualquer proposta → grava", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    autorDaProposta.mockResolvedValue("b@indeba.com");
    atualizarStatusProposta.mockResolvedValue({ ...doOutro, status: "aprovada" });
    await PATCH(req("aprovada"), params("p-do-b"));
    expect(atualizarStatusProposta).toHaveBeenCalledWith("p-do-b", "aprovada");
  });

  // O gate confere o dono; carregar a proposta INTEIRA (scope + Zod + recálculo de imagem
  // pelo catálogo) para ler uma string era o custo que `autorDaProposta` corta.
  it("confere o dono sem carregar a proposta inteira", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    autorDaProposta.mockResolvedValue("b@indeba.com");
    atualizarStatusProposta.mockResolvedValue(doOutro);
    await PATCH(req("aprovada"), params("p-do-b"));
    expect(obterProposta).not.toHaveBeenCalled();
  });
});

// Exclusão definitiva: só admin, e só de proposta já arquivada (freio de duas etapas).
describe("DELETE /api/propostas/[id] — exclusão definitiva", () => {
  it("admin apagando uma arquivada → deleta", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    autorEStatusDaProposta.mockResolvedValue({ autor: "b@indeba.com", status: "arquivada" });
    const r = await DELETE(reqVazio(), params("p-do-b"));
    expect(r.status).toBe(200);
    expect(excluirPropostaDefinitivamente).toHaveBeenCalledWith("p-do-b");
  });

  it("admin numa proposta ATIVA → 409 e nada é apagado", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    autorEStatusDaProposta.mockResolvedValue({ autor: "b@indeba.com", status: "enviada" });
    const r = await DELETE(reqVazio(), params("p-do-b"));
    expect(r.status).toBe(409);
    expect(excluirPropostaDefinitivamente).not.toHaveBeenCalled();
  });

  it("vendedor na PRÓPRIA arquivada → 403", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    autorEStatusDaProposta.mockResolvedValue({ autor: "a@indeba.com", status: "arquivada" });
    const r = await DELETE(reqVazio(), params("p-do-b"));
    expect(r.status).toBe(403);
    expect(excluirPropostaDefinitivamente).not.toHaveBeenCalled();
  });

  it("vendedor na arquivada de OUTRO → 404 (não confirma que existe)", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    autorEStatusDaProposta.mockResolvedValue({ autor: "b@indeba.com", status: "arquivada" });
    const r = await DELETE(reqVazio(), params("p-do-b"));
    expect(r.status).toBe(404);
    expect(excluirPropostaDefinitivamente).not.toHaveBeenCalled();
  });
});

// O upsert do auto-save casa por `id`, e o `id` vem do cliente: sem este gate, reenviar o
// scope com o id de um colega sobrescreve a proposta dele. Escopar leitura sem escopar
// escrita não é isolamento — e até aqui só a leitura tinha teste.
describe("POST /api/propostas — gravar por cima da proposta alheia", () => {
  // Scope mínimo que passa no PropostaScope (Zod) — o foco aqui é o gate de autoria.
  const scope = {
    criadoEm: "2026-08-01T00:00:00.000Z",
    status: "rascunho",
    tipo: "orcamento",
    template: "indeba",
    cliente: { razaoSocial: "Frigorífico B", cnpj: null, segmento: null },
    textoApresentacao: { conteudo: "texto", procedencia: "MANUAL" },
    itens: [],
    condicoesComerciais: { validade: "30 dias", prazoEntrega: "5 dias", pagamento: "28ddl", frete: "CIF" },
  };
  const req = (id: string) => ({ json: async () => ({ ...scope, id }) }) as unknown as NextRequest;

  it("vendedor A reenviando o id de B → 404 e nada é gravado", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    autorDaProposta.mockResolvedValue("b@indeba.com");
    const r = await SALVAR(req("p-do-b"));
    expect(r.status).toBe(404);
    expect(salvarProposta).not.toHaveBeenCalled();
  });

  it("id que ainda não existe → grava normalmente, com A como autor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR_A);
    autorDaProposta.mockResolvedValue(null);
    salvarProposta.mockResolvedValue(doOutro);
    await SALVAR(req("p-novo"));
    expect(salvarProposta).toHaveBeenCalledWith(expect.objectContaining({ id: "p-novo" }), "a@indeba.com");
  });

  it("admin grava por cima de qualquer um", async () => {
    usuarioAtual.mockResolvedValue(ADMIN);
    autorDaProposta.mockResolvedValue("b@indeba.com");
    salvarProposta.mockResolvedValue(doOutro);
    expect((await SALVAR(req("p-do-b"))).status).toBe(201);
  });
});
