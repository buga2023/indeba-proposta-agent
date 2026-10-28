import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Catálogo compartilhado do Gerador POP: o HTML em public/gerador-pop fala com estas rotas.
// O banco é mockado — o foco é o contrato (validação, auth, formato da resposta).
const listarPop = vi.fn();
const salvarPopProduto = vi.fn();
const excluirPopProduto = vi.fn();
const salvarPopPaleta = vi.fn();
const usuarioAtual = vi.fn();

vi.mock("@/lib/auth-db", () => ({ usuarioAtual: (...a: unknown[]) => usuarioAtual(...a) }));
vi.mock("@/lib/gerador-pop", async (orig) => ({
  ...(await orig<typeof import("@/lib/gerador-pop")>()),
  listarPop: (...a: unknown[]) => listarPop(...a),
  salvarPopProduto: (...a: unknown[]) => salvarPopProduto(...a),
  excluirPopProduto: (...a: unknown[]) => excluirPopProduto(...a),
  salvarPopPaleta: (...a: unknown[]) => salvarPopPaleta(...a),
}));

import { PopProduto, PopPaleta, POP_ID } from "@/lib/gerador-pop";
import { GET } from "@/app/api/gerador-pop/route";
import { PUT as PUT_PRODUTO, DELETE as DELETE_PRODUTO } from "@/app/api/gerador-pop/produtos/[id]/route";
import { PUT as PUT_PALETA } from "@/app/api/gerador-pop/paleta/route";

const req = (body?: unknown) => ({ json: async () => body, cookies: { get: () => undefined } }) as unknown as NextRequest;
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

const produto = {
  o: 1,
  nome: "Primmax DGA",
  cod: "",
  seg: "Alimentos e Bebidas",
  sub: "Desincrustante",
  serve: "Remove gordura pesada.",
  onde: "Coifas e chapas",
  dil: "",
  modo: "",
  epi: "",
  obs: "",
  cor: "#F5C400",
  i: [{ k: "Panelas", t: "Panelas" }],
};

beforeEach(() => {
  [listarPop, salvarPopProduto, excluirPopProduto, salvarPopPaleta, usuarioAtual].forEach((f) => f.mockReset());
  usuarioAtual.mockResolvedValue({ email: "mateus@indeba.com", papel: "user" });
});

describe("contrato do produto POP", () => {
  it("aceita o produto como o HTML envia (strip) e completa os ícones até 6", () => {
    const r = PopProduto.parse(produto);
    expect(r.i).toHaveLength(6);
    expect(r.i[1]).toEqual({ k: "", t: "" });
  });

  it("recusa cor fora de #RRGGBB e mais de 6 ícones", () => {
    expect(PopProduto.safeParse({ ...produto, cor: "red" }).success).toBe(false);
    expect(PopProduto.safeParse({ ...produto, i: Array(7).fill({ k: "", t: "" }) }).success).toBe(false);
  });

  it("id só com letras, números e hífen (é chave de URL e do banco)", () => {
    expect(POP_ID.safeParse("sol-plus").success).toBe(true);
    expect(POP_ID.safeParse("pmgx1a2b").success).toBe(true);
    expect(POP_ID.safeParse("../x").success).toBe(false);
  });

  it("paleta: até 40 cores #RRGGBB, normalizadas em maiúsculas", () => {
    expect(PopPaleta.parse({ cores: ["#c2255c"] }).cores).toEqual(["#C2255C"]);
    expect(PopPaleta.safeParse({ cores: Array(41).fill("#000000") }).success).toBe(false);
  });
});

describe("rotas /api/gerador-pop", () => {
  it("401 sem sessão em todas as rotas", async () => {
    usuarioAtual.mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
    expect((await PUT_PRODUTO(req(produto), ctx("dga"))).status).toBe(401);
    expect((await DELETE_PRODUTO(req(), ctx("dga"))).status).toBe(401);
    expect((await PUT_PALETA(req({ cores: [] }))).status).toBe(401);
    expect(salvarPopProduto).not.toHaveBeenCalled();
  });

  it("GET devolve produtos e paleta", async () => {
    listarPop.mockResolvedValue({ produtos: [{ id: "dga", ...produto }], paleta: ["#C2255C"] });
    const r = await GET(req());
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.produtos[0].id).toBe("dga");
    expect(j.paleta).toEqual(["#C2255C"]);
  });

  it("PUT salva com o autor da sessão; qualquer usuário logado edita (catálogo compartilhado)", async () => {
    const r = await PUT_PRODUTO(req(produto), ctx("dga"));
    expect(r.status).toBe(200);
    expect(salvarPopProduto).toHaveBeenCalledWith("dga", expect.objectContaining({ nome: "Primmax DGA" }), "mateus@indeba.com");
  });

  it("PUT 400 com corpo inválido ou id inválido", async () => {
    expect((await PUT_PRODUTO(req({ ...produto, cor: "x" }), ctx("dga"))).status).toBe(400);
    expect((await PUT_PRODUTO(req(produto), ctx("a/b"))).status).toBe(400);
    expect(salvarPopProduto).not.toHaveBeenCalled();
  });

  it("DELETE exclui pelo id", async () => {
    const r = await DELETE_PRODUTO(req(), ctx("dga"));
    expect(r.status).toBe(200);
    expect(excluirPopProduto).toHaveBeenCalledWith("dga");
  });

  it("PUT da paleta grava as cores normalizadas", async () => {
    const r = await PUT_PALETA(req({ cores: ["#abcdef"] }));
    expect(r.status).toBe(200);
    expect(salvarPopPaleta).toHaveBeenCalledWith(["#ABCDEF"]);
  });
});
