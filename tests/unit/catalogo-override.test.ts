import { describe, it, expect, vi, beforeEach } from "vitest";

// Guardiões da PRECEDÊNCIA entre as duas fontes de produto. Ela já foi a inversa (o JSON
// vencia) e mudou em 05/08/2026 para que o gestor pudesse corrigir os ~150 da base pela tela:
// a linha do banco passou a ser o override deliberado, não um cadastro que "sequestra" código.
//
// O que precisa ficar de pé: o override vence, o produto da base sem override não some, a
// ORDEM da lista não embaralha (é ela que numera as páginas do PDF) e banco fora do ar degrada
// para o JSON em vez de esvaziar o catálogo.
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { produtoCustom: { findMany, findUnique: vi.fn() } } }));

import { catalogoCompleto, carregarCatalogo } from "@/lib/catalogo";

// Um produto real da base, para o override ter em quem pegar carona.
const DA_BASE = carregarCatalogo().produtos[0];

// A linha do banco guarda o produto em `dados` — é assim que produto-custom lê.
const linha = (codigo: string, dados: Record<string, unknown>, temImagem = true, temFicha = false) => ({
  codigo,
  dados: { ...DA_BASE, ...dados, codigo },
  imagemMime: temImagem ? "image/png" : null,
  fichaMime: temFicha ? "application/pdf" : null,
});

// Chaves obrigatórias aqui: `() => findMany.mockReset()` devolveria o próprio mock, e o
// vitest trata o retorno do beforeEach como função de teardown — ele chamaria findMany() ao
// fim de cada teste. Com uma implementação que lança, o teste morria com o erro que ele
// justamente prova estar sendo engolido.
beforeEach(() => {
  findMany.mockReset();
});

describe("catalogoCompleto — override vence o JSON", () => {
  it("sem nada no banco, o catálogo é o JSON inteiro", async () => {
    findMany.mockResolvedValue([]);
    const c = await catalogoCompleto();
    expect(c.produtos.length).toBe(carregarCatalogo().produtos.length);
  });

  it("GUARDIÃO: o produto editado aparece com o dado NOVO, e uma vez só", async () => {
    findMany.mockResolvedValue([linha(DA_BASE.codigo, { nome: "Nome Corrigido pelo Gestor" })]);
    const c = await catalogoCompleto();
    const encontrados = c.produtos.filter((p) => p.codigo === DA_BASE.codigo);
    expect(encontrados).toHaveLength(1);
    expect(encontrados[0].nome).toBe("Nome Corrigido pelo Gestor");
    // Duas fontes brigando pelo mesmo código era o risco da inversão — o total não muda.
    expect(c.produtos.length).toBe(carregarCatalogo().produtos.length);
  });

  // A ordem da lista vira a numeração das páginas do PDF na proposta Consolidada: um override
  // que jogasse o produto para o fim mudaria a proposta sem ninguém pedir.
  it("GUARDIÃO: o override fica no lugar do produto original, não no fim", async () => {
    findMany.mockResolvedValue([linha(DA_BASE.codigo, { nome: "Corrigido" })]);
    const c = await catalogoCompleto();
    expect(c.produtos[0].codigo).toBe(DA_BASE.codigo);
    expect(c.produtos[0].nome).toBe("Corrigido");
  });

  it("produto que nasceu na tela entra no fim, sem deslocar a base", async () => {
    findMany.mockResolvedValue([linha("PRODUTO-NOVO-XYZ", { nome: "Produto Novo" })]);
    const c = await catalogoCompleto();
    expect(c.produtos.length).toBe(carregarCatalogo().produtos.length + 1);
    expect(c.produtos[c.produtos.length - 1].codigo).toBe("PRODUTO-NOVO-XYZ");
  });

  // Sem bytes próprios, o override herda a foto e a ficha versionadas: exigir reenviar a
  // imagem só para corrigir um texto seria trabalho inventado — e apagá-la, perda silenciosa.
  it("GUARDIÃO: override sem imagem própria mantém a foto da base", async () => {
    findMany.mockResolvedValue([linha(DA_BASE.codigo, { nome: "Corrigido" }, false)]);
    const c = await catalogoCompleto();
    const p = c.produtos.find((x) => x.codigo === DA_BASE.codigo)!;
    expect(p.imagemPath).toBe(DA_BASE.imagemPath);
    expect(p.fichaTecnicaPath).toBe(DA_BASE.fichaTecnicaPath);
  });

  it("com imagem própria, o caminho passa a ser o da rota que serve os bytes", async () => {
    findMany.mockResolvedValue([linha(DA_BASE.codigo, { nome: "Corrigido" }, true)]);
    const c = await catalogoCompleto();
    const p = c.produtos.find((x) => x.codigo === DA_BASE.codigo)!;
    expect(p.imagemPath).toBe(`/api/produtos/${encodeURIComponent(DA_BASE.codigo)}/imagem`);
  });

  // Banco fora do ar não pode esvaziar a vitrine: o JSON é o piso, e ele basta para trabalhar.
  it("GUARDIÃO: banco indisponível degrada para o JSON, não derruba o catálogo", async () => {
    // Lança SÍNCRONO de propósito. Com `mockRejectedValue` (ou uma impl `async`) a promise
    // rejeitada fica registrada em `mock.results` e o vitest a acusa como erro não tratado,
    // mesmo com o catch de catalogoCompleto fazendo seu trabalho — o teste quebrava mostrando
    // exatamente o erro que ele existe para provar que é engolido.
    findMany.mockImplementation(() => {
      throw new Error("connection refused");
    });
    const c = await catalogoCompleto();
    expect(c.produtos.length).toBe(carregarCatalogo().produtos.length);
  });

  // Linha corrompida some da lista sem levar o catálogo junto (mesma postura de listarPropostas).
  it("linha fora do contrato é pulada e a base continua inteira", async () => {
    findMany.mockResolvedValue([{ codigo: "PODRE", dados: { nome: 42 }, imagemMime: "image/png", fichaMime: null }]);
    const c = await catalogoCompleto();
    expect(c.produtos.length).toBe(carregarCatalogo().produtos.length);
  });
});
