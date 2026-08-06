import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Guardiões da EDIÇÃO e da EXCLUSÃO de produto pela tela (pedido do Mateus em 05/08/2026:
// "tem que deixar uma opção para eu, como administrador, adicionar, excluir ou editar").
//
// O que precisa ficar de pé aqui: quem pode escrever, o que a edição NÃO pode apagar sem
// pedido explícito (foto, ficha, estado de arquivado) e a fronteira com o catálogo-base —
// os 150 do JSON são versionados no git e não se editam por esta rota.
const { usuarioAtual, findUnique, update, remover, carregarCatalogo, listarProdutosCustom } = vi.hoisted(() => ({
  usuarioAtual: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  remover: vi.fn(),
  carregarCatalogo: vi.fn(),
  listarProdutosCustom: vi.fn(),
}));

vi.mock("@/lib/auth-db", () => ({ usuarioAtual }));
vi.mock("@/lib/db", () => ({
  prisma: { produtoCustom: { create: vi.fn(), findMany: vi.fn(), findUnique, update, delete: remover } },
}));
vi.mock("@/lib/catalogo", () => ({ carregarCatalogo }));
vi.mock("@/lib/produto-custom", () => ({ listarProdutosCustom }));

import { PUT, DELETE } from "@/app/api/produtos/route";

const GESTOR = { email: "gestor@indeba.com", papel: "admin" };
const VENDEDOR = { email: "vendedor@indeba.com", papel: "user" };

const EDICAO = {
  codigo: "TESTE-NOVO",
  nome: "Produto de Teste (renomeado)",
  marca: "indeba",
  linha: "limpeza_conservacao",
  descricaoCurta: "curta",
  descricaoUso: "uso",
  segmentos: [],
  funcoes: ["multiuso"],
  metodos: ["manual"],
  embalagens: [{ tamanho: 5, unidade: "L", preco: null, diluicaoMax: null, custoDiluido: null }],
};

// O que está gravado hoje: arquivado e com ficha técnica anexada.
const NO_BANCO = {
  dados: { ...EDICAO, nome: "Produto de Teste", ativo: false, imagemPath: "", fichaTecnicaPath: null },
  fichaMime: "application/pdf",
};

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "f.png", { type: "image/png" });
const pdf = () => new File([new Uint8Array([37, 80, 68, 70])], "f.pdf", { type: "application/pdf" });

function req(dados: unknown, extras: Record<string, File | string> = {}) {
  const form = new FormData();
  if (dados !== undefined) form.append("dados", JSON.stringify(dados));
  for (const [k, v] of Object.entries(extras)) form.append(k, v);
  return { formData: async () => form } as unknown as NextRequest;
}

const dadosSalvos = () => update.mock.calls[0][0].data.dados;

beforeEach(() => {
  for (const m of [usuarioAtual, findUnique, update, remover, carregarCatalogo]) m.mockReset();
  carregarCatalogo.mockReturnValue({ marca: "indeba_express", produtos: [{ codigo: "PRIMMAX-PLUS" }] });
  findUnique.mockResolvedValue(NO_BANCO);
  update.mockResolvedValue({});
  remover.mockResolvedValue({});
});

describe("PUT /api/produtos — só o gestor edita", () => {
  it("401 sem sessão", async () => {
    usuarioAtual.mockResolvedValue(null);
    expect((await PUT(req(EDICAO))).status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });

  it("403 para vendedor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    expect((await PUT(req(EDICAO))).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/produtos — a fronteira com o catálogo-base", () => {
  beforeEach(() => usuarioAtual.mockResolvedValue(GESTOR));

  // Produto do JSON não tem linha no banco. Editar por aqui gravaria um segundo produto com
  // o mesmo código — as duas fontes brigando por quem é o PRIMMAX-PLUS de verdade.
  it("GUARDIÃO: produto que não veio da tela é recusado (404), não criado", async () => {
    findUnique.mockResolvedValue(null);
    const r = await PUT(req({ ...EDICAO, codigo: "PRIMMAX-PLUS" }));
    expect(r.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("dados fora do contrato Zod são recusados (linha inexistente)", async () => {
    expect((await PUT(req({ ...EDICAO, linha: "espacial" }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("GUARDIÃO: imagemPath enviado pelo cliente é ignorado, não gravado", async () => {
    await PUT(req({ ...EDICAO, imagemPath: "https://malicioso.example/x.png" }));
    expect(dadosSalvos().imagemPath).toBe("");
    expect(JSON.stringify(dadosSalvos())).not.toContain("malicioso");
  });
});

describe("PUT /api/produtos — o que a edição não pode apagar sozinha", () => {
  beforeEach(() => usuarioAtual.mockResolvedValue(GESTOR));

  it("salva o texto novo", async () => {
    const r = await PUT(req(EDICAO));
    expect(r.status).toBe(200);
    expect(dadosSalvos().nome).toBe("Produto de Teste (renomeado)");
  });

  // Editar só a descrição não pode exigir reenviar a foto — e não enviar não pode zerá-la.
  it("GUARDIÃO: sem foto anexada, os bytes da imagem não são tocados", async () => {
    await PUT(req(EDICAO));
    expect(update.mock.calls[0][0].data).not.toHaveProperty("imagem");
    expect(update.mock.calls[0][0].data).not.toHaveProperty("imagemMime");
  });

  it("com foto anexada, troca a imagem", async () => {
    await PUT(req(EDICAO, { imagem: png() }));
    expect(update.mock.calls[0][0].data.imagemMime).toBe("image/png");
  });

  it("foto que não é imagem é recusada", async () => {
    const exe = new File([new Uint8Array([1])], "x.exe", { type: "application/x-msdownload" });
    expect((await PUT(req(EDICAO, { imagem: exe }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  // A ficha só some com pedido explícito: "não anexei nada" é o caso comum de quem editou
  // apenas o texto, e apagar a ficha aí seria perda silenciosa.
  it("GUARDIÃO: sem sinal de remoção, a ficha técnica atual permanece", async () => {
    await PUT(req(EDICAO));
    expect(update.mock.calls[0][0].data).not.toHaveProperty("ficha");
  });

  it("removerFicha=1 apaga a ficha e o mime junto", async () => {
    await PUT(req(EDICAO, { removerFicha: "1" }));
    expect(update.mock.calls[0][0].data.ficha).toBeNull();
    expect(update.mock.calls[0][0].data.fichaMime).toBeNull();
  });

  it("ficha nova tem prioridade sobre o pedido de remoção", async () => {
    await PUT(req(EDICAO, { ficha: pdf(), removerFicha: "1" }));
    expect(update.mock.calls[0][0].data.fichaMime).toBe("application/pdf");
  });

  it("ficha que não é PDF é recusada", async () => {
    const txt = new File([new Uint8Array([1])], "f.txt", { type: "text/plain" });
    expect((await PUT(req(EDICAO, { ficha: txt }))).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  // Quem arquivou o produto fez isso de propósito. Corrigir um typo não pode ressuscitá-lo
  // no catálogo — `ativo` só muda quando a edição diz qual é o novo valor.
  it("GUARDIÃO: `ativo` ausente preserva o estado gravado (arquivado continua arquivado)", async () => {
    await PUT(req(EDICAO));
    expect(dadosSalvos().ativo).toBe(false);
  });

  it("`ativo: true` reativa o produto arquivado", async () => {
    await PUT(req({ ...EDICAO, ativo: true }));
    expect(dadosSalvos().ativo).toBe(true);
  });
});

describe("DELETE /api/produtos", () => {
  const reqDel = (codigo: string | null) =>
    ({ nextUrl: { searchParams: new URLSearchParams(codigo === null ? "" : `codigo=${codigo}`) } }) as unknown as NextRequest;

  it("401 sem sessão", async () => {
    usuarioAtual.mockResolvedValue(null);
    expect((await DELETE(reqDel("TESTE-NOVO"))).status).toBe(401);
    expect(remover).not.toHaveBeenCalled();
  });

  it("403 para vendedor — excluir produto é ato de gestor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    expect((await DELETE(reqDel("TESTE-NOVO"))).status).toBe(403);
    expect(remover).not.toHaveBeenCalled();
  });

  it("gestor remove pelo código", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    expect((await DELETE(reqDel("TESTE-NOVO"))).status).toBe(200);
    expect(remover).toHaveBeenCalledWith({ where: { codigo: "TESTE-NOVO" } });
  });

  // Produto do JSON não tem linha no banco: o delete falha e vira 404 — nunca um 500 que
  // pareceria falha do sistema.
  it("produto que não veio da tela devolve 404", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    remover.mockRejectedValue(new Error("registro não encontrado"));
    expect((await DELETE(reqDel("PRIMMAX-PLUS"))).status).toBe(404);
  });

  it("sem código, 400", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    expect((await DELETE(reqDel(null))).status).toBe(400);
  });
});
