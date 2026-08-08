import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Guardiões do cadastro de produto pela tela. O catálogo é dado crítico — dele saem a foto,
// a ficha e o produto que entra na proposta —, então o que protege aqui é: quem escreve, o
// que é aceito, e a garantia de que a segunda fonte não atropela a primeira.
// vi.hoisted porque as fábricas de vi.mock sobem para o topo do arquivo — declarar os
// espiões como const comum daria "Cannot access before initialization".
const { usuarioAtual, create, updateMany, findUnique, findMany, carregarCatalogo, listarProdutosCustom, listarExcluidos } = vi.hoisted(() => ({
  usuarioAtual: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  carregarCatalogo: vi.fn(),
  listarProdutosCustom: vi.fn(),
  listarExcluidos: vi.fn(),
}));

vi.mock("@/lib/auth-db", () => ({ usuarioAtual }));
vi.mock("@/lib/db", () => ({ prisma: { produtoCustom: { create, updateMany, findUnique, findMany } } }));
vi.mock("@/lib/catalogo", () => ({ carregarCatalogo }));
vi.mock("@/lib/produto-custom", () => ({ listarProdutosCustom, listarExcluidos }));

import { POST } from "@/app/api/produtos/route";

const GESTOR = { email: "gestor@indeba.com", papel: "admin" };
const VENDEDOR = { email: "vendedor@indeba.com", papel: "user" };

const PRODUTO = {
  codigo: "TESTE-NOVO",
  nome: "Produto de Teste",
  marca: "indeba",
  linha: "limpeza_conservacao",
  descricaoCurta: "curta",
  descricaoUso: "uso",
  segmentos: [],
  funcoes: ["multiuso"],
  metodos: ["manual"],
  embalagens: [{ tamanho: 5, unidade: "L", preco: null, diluicaoMax: null, custoDiluido: null }],
};

const png = () => new File([new Uint8Array([137, 80, 78, 71])], "f.png", { type: "image/png" });

function req(dados: unknown, extras: Record<string, File> = {}) {
  const form = new FormData();
  if (dados !== undefined) form.append("dados", JSON.stringify(dados));
  for (const [k, v] of Object.entries(extras)) form.append(k, v);
  return { formData: async () => form } as unknown as NextRequest;
}

beforeEach(() => {
  for (const m of [usuarioAtual, create, updateMany, findUnique, findMany, carregarCatalogo]) m.mockReset();
  carregarCatalogo.mockReturnValue({ marca: "indeba_express", produtos: [{ codigo: "PRIMMAX-PLUS" }] });
  create.mockResolvedValue({});
  // Código livre no banco: `create` grava direto. O reuso de lápide (P2002 → updateMany) só
  // entra quando o create colide — coberto no teste de restauração/edição.
  findUnique.mockResolvedValue(null);
});

describe("POST /api/produtos — só o gestor cadastra", () => {
  it("401 sem sessão", async () => {
    usuarioAtual.mockResolvedValue(null);
    expect((await POST(req(PRODUTO, { imagem: png() }))).status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("403 para vendedor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    expect((await POST(req(PRODUTO, { imagem: png() }))).status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("201 para gestor, e o autor sai da sessão — nunca do cliente", async () => {
    usuarioAtual.mockResolvedValue(GESTOR);
    const r = await POST(req({ ...PRODUTO, autor: "outro@x.com" }, { imagem: png() }));
    expect(r.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ codigo: "TESTE-NOVO", autor: GESTOR.email }) }),
    );
  });
});

describe("POST /api/produtos — o que não entra no catálogo", () => {
  // Com chaves: sem elas, o retorno é o próprio mock e o vitest o executa como teardown.
  beforeEach(() => {
    usuarioAtual.mockResolvedValue(GESTOR);
  });

  // Dois produtos com o mesmo código fariam proposta, matcher e RAG disputarem qual é qual.
  // O @unique da tabela só enxerga o banco — a colisão com o JSON é barrada aqui.
  it("GUARDIÃO: código que já existe no JSON é recusado (409)", async () => {
    const r = await POST(req({ ...PRODUTO, codigo: "PRIMMAX-PLUS" }, { imagem: png() }));
    expect(r.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });

  it("sem foto não cadastra — produto sem imagem sai torto no PDF", async () => {
    expect((await POST(req(PRODUTO))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("foto que não é imagem é recusada", async () => {
    const exe = new File([new Uint8Array([1])], "x.exe", { type: "application/x-msdownload" });
    expect((await POST(req(PRODUTO, { imagem: exe }))).status).toBe(400);
  });

  it("ficha que não é PDF é recusada", async () => {
    const txt = new File([new Uint8Array([1])], "f.txt", { type: "text/plain" });
    expect((await POST(req(PRODUTO, { imagem: png(), ficha: txt }))).status).toBe(400);
  });

  it("dados fora do contrato Zod são recusados (linha inexistente)", async () => {
    expect((await POST(req({ ...PRODUTO, linha: "espacial" }, { imagem: png() }))).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("código com caractere fora de [A-Z0-9-] é recusado", async () => {
    expect((await POST(req({ ...PRODUTO, codigo: "../etc/passwd" }, { imagem: png() }))).status).toBe(400);
  });

  // `imagemPath` é DERIVADO do código na leitura. Aceitá-lo do cliente deixaria o cadastro
  // apontar a foto do produto para qualquer URL externa.
  it("GUARDIÃO: imagemPath enviado pelo cliente é ignorado, não gravado", async () => {
    await POST(req({ ...PRODUTO, imagemPath: "https://malicioso.example/x.png" }, { imagem: png() }));
    const dados = create.mock.calls[0][0].data.dados;
    expect(dados.imagemPath).toBe("");
    expect(JSON.stringify(dados)).not.toContain("malicioso");
  });

  it("produto novo nasce ATIVO — o gestor cadastrou para usar", async () => {
    await POST(req(PRODUTO, { imagem: png() }));
    expect(create.mock.calls[0][0].data.dados.ativo).toBe(true);
  });
});
