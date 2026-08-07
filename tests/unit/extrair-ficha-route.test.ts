import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// Portões da rota que lê a ficha técnica para preencher o formulário. Ela não grava nada —
// devolve sugestão —, mas serve conteúdo de PDF a quem chamar, e a ficha de um produto é
// material comercial: o mesmo gate do cadastro vale aqui.
const { usuarioAtual, extrairTextoContrato, fichaDoProduto, produtoPorCodigoCompleto } = vi.hoisted(() => ({
  usuarioAtual: vi.fn(),
  extrairTextoContrato: vi.fn(),
  fichaDoProduto: vi.fn(),
  produtoPorCodigoCompleto: vi.fn(),
}));

vi.mock("@/lib/auth-db", () => ({ usuarioAtual }));
vi.mock("@/lib/contrato/extrair-texto", () => ({ extrairTextoContrato }));
vi.mock("@/lib/produto-custom", () => ({ fichaDoProduto }));
vi.mock("@/lib/catalogo", () => ({ produtoPorCodigoCompleto, carregarCatalogo: vi.fn() }));

import { POST } from "@/app/api/produtos/extrair-ficha/route";

const GESTOR = { email: "gestor@indeba.com", papel: "admin" };
const VENDEDOR = { email: "vendedor@indeba.com", papel: "user" };

const FICHA_REAL =
  "DETERGENTE ALCALINO PARA LIMPEZA PESADA. COMPOSIÇÃO: Tensoativo aniônico e veículo. APLICAÇÃO - USO PROFISSIONAL: Cozinhas industriais.";

// multipart com o PDF anexado — o caminho de quem ainda não salvou o produto.
function comArquivo(file: File) {
  const form = new FormData();
  form.append("ficha", file);
  return {
    headers: new Headers({ "content-type": "multipart/form-data; boundary=x" }),
    formData: async () => form,
    nextUrl: { searchParams: new URLSearchParams() },
  } as unknown as NextRequest;
}

// ?codigo= — o caminho de quem edita um produto que já tem ficha gravada.
function porCodigo(codigo: string) {
  return {
    headers: new Headers(),
    nextUrl: { searchParams: new URLSearchParams(`codigo=${codigo}`) },
  } as unknown as NextRequest;
}

const pdf = () => new File([new Uint8Array([37, 80, 68, 70])], "ficha.pdf", { type: "application/pdf" });

beforeEach(() => {
  for (const m of [usuarioAtual, extrairTextoContrato, fichaDoProduto, produtoPorCodigoCompleto]) m.mockReset();
  usuarioAtual.mockResolvedValue(GESTOR);
  extrairTextoContrato.mockResolvedValue(FICHA_REAL);
  fichaDoProduto.mockResolvedValue({ bytes: Buffer.from([37, 80, 68, 70]), mime: "application/pdf" });
});

describe("POST /api/produtos/extrair-ficha", () => {
  it("401 sem sessão", async () => {
    usuarioAtual.mockResolvedValue(null);
    expect((await POST(comArquivo(pdf()))).status).toBe(401);
  });

  it("403 para vendedor — quem cadastra produto é o gestor", async () => {
    usuarioAtual.mockResolvedValue(VENDEDOR);
    expect((await POST(comArquivo(pdf()))).status).toBe(403);
  });

  it("devolve os campos do PDF anexado", async () => {
    const r = await POST(comArquivo(pdf()));
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.campos.composicao).toBe("Tensoativo aniônico e veículo.");
    expect(d.campos.aplicacao).toBe("Cozinhas industriais.");
  });

  it("lê a ficha já gravada quando vem só o código", async () => {
    const r = await POST(porCodigo("PRIMMAX-PLUS"));
    expect(r.status).toBe(200);
    expect(fichaDoProduto).toHaveBeenCalledWith("PRIMMAX-PLUS");
  });

  it("arquivo que não é PDF é recusado", async () => {
    const txt = new File([new Uint8Array([1])], "f.txt", { type: "text/plain" });
    expect((await POST(comArquivo(txt))).status).toBe(400);
    expect(extrairTextoContrato).not.toHaveBeenCalled();
  });

  it("produto sem ficha anexada devolve 404 explicando", async () => {
    fichaDoProduto.mockResolvedValue(null);
    produtoPorCodigoCompleto.mockResolvedValue({ fichaTecnicaPath: null });
    const r = await POST(porCodigo("SEM-FICHA"));
    expect(r.status).toBe(404);
    expect((await r.json()).erro).toMatch(/ficha técnica/i);
  });

  // Ficha escaneada, ou fora do padrão: dizer que não deu é melhor do que devolver `{}` e
  // deixar o gestor achando que o botão não funcionou.
  it("ficha sem nenhum bloco reconhecível vira 422 com instrução", async () => {
    extrairTextoContrato.mockResolvedValue("texto solto sem cabeçalho nenhum");
    const r = await POST(comArquivo(pdf()));
    expect(r.status).toBe(422);
    expect((await r.json()).erro).toMatch(/à mão/i);
  });

  // GUARDIÃO: a rota nunca grava. Ela propõe, e quem salva é o PUT/POST depois da conferência
  // — extração automática que escrevesse direto no catálogo violaria a revisão humana.
  it("GUARDIÃO: só devolve campos, não persiste nada", async () => {
    const r = await POST(comArquivo(pdf()));
    const d = await r.json();
    expect(Object.keys(d)).toEqual(["campos"]);
  });
});
