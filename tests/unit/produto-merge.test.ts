import { describe, it, expect } from "vitest";
import { mesclarFicha, mesclarProduto } from "@/lib/produto-merge";
import type { Produto } from "@/lib/contracts";

// Guardiões da PERDA DE DADOS na edição de produto — o defeito relatado pelo Matheus em
// 06/08/2026: "editei o Primmax Inox só botando a foto, ele salvou com a foto e apagou as
// informações"; e no Sanquat, "apaguei uma opção de embalagem errada e ele perdeu as outras
// informações".
//
// A causa: a tela do Catálogo recebe a ficha recortada (/api/catalogo manda só título e
// descrição, para não trafegar 104 KB por request), o formulário abria com aquilo e devolvia
// no PUT um produto sem o resto. A gravação substituía o registro inteiro.
//
// A regra que estes testes fixam: campo AUSENTE no que chega significa "não mexi", e campo
// VAZIO significa "apaguei". Sem os dois lados, ou a edição continua apagando em silêncio, ou
// vira impossível limpar um campo errado.

const BASE: Produto = {
  codigo: "PRIMMAX-INOX",
  nome: "Primmax Inox",
  marca: "indeba",
  linha: "limpeza_conservacao",
  descricaoCurta: "Limpador de inox",
  descricaoUso: "Aplicar e polir",
  segmentos: ["cozinha_industrial"],
  funcoes: ["multiuso"],
  metodos: ["manual"],
  imagemPath: "/produtos/primmax-inox.png",
  fichaTecnicaPath: "/fichas-tecnicas/primmax-inox.pdf",
  ativo: true,
  embalagens: [
    { tamanho: 5, unidade: "L", preco: null, diluicaoMax: "1:100", custoDiluido: null },
    { tamanho: 20, unidade: "L", preco: null, diluicaoMax: "1:100", custoDiluido: null },
  ],
  ficha: {
    titulo: "Limpador de Inox",
    subtitulo: "Uso Profissional",
    linhaLabel: "KITCHEN",
    descricao: "Remove marcas sem agredir a superfície.",
    beneficios: ["Não risca", "Secagem rápida"],
    composicao: "Tensoativo não iônico, solvente e veículo.",
    aplicacao: "Superfícies de aço inoxidável em cozinhas profissionais.",
    diluicoes: [{ uso: "limpeza diária", razao: "1:100" }],
    rendimento: "1 L rende 100 L",
    caracteristicas: { pH: "7,0", aspecto: "Líquido", densidade: "0,99" },
  },
};

// O que o formulário mandava quando abria pela lista: ficha só com título e descrição.
const RECORTADO: Produto = { ...BASE, ficha: { titulo: BASE.ficha!.titulo, descricao: BASE.ficha!.descricao } };

describe("mesclarProduto — o que a edição não pode apagar sozinha", () => {
  it("GUARDIÃO: salvar com a ficha recortada não apaga benefícios, diluições nem características", () => {
    const r = mesclarProduto(BASE, RECORTADO);
    expect(r.ficha?.beneficios).toEqual(["Não risca", "Secagem rápida"]);
    expect(r.ficha?.diluicoes).toHaveLength(1);
    expect(r.ficha?.caracteristicas?.pH).toBe("7,0");
    expect(r.ficha?.subtitulo).toBe("Uso Profissional");
    expect(r.ficha?.composicao).toContain("Tensoativo");
  });

  // Campo que a tela nunca mostrou (linhaLabel, indicadoPara, e o que vier depois) sobrevive
  // por não vir no payload — é o que protege a edição de um formulário desatualizado.
  it("GUARDIÃO: campo que o formulário não conhece sobrevive à edição", () => {
    const r = mesclarProduto(BASE, RECORTADO);
    expect(r.ficha?.linhaLabel).toBe("KITCHEN");
  });

  it("o texto novo vence o gravado", () => {
    const r = mesclarProduto(BASE, { ...RECORTADO, nome: "Primmax Inox Plus" });
    expect(r.nome).toBe("Primmax Inox Plus");
  });

  // O outro lado da moeda: apagar uma embalagem errada tem que apagar mesmo. Listas são
  // substituídas, nunca somadas — foi a segunda queixa do Matheus (Sanquat).
  it("GUARDIÃO: remover uma embalagem remove de fato — listas substituem", () => {
    const r = mesclarProduto(BASE, { ...BASE, embalagens: [BASE.embalagens[0]] });
    expect(r.embalagens).toHaveLength(1);
    expect(r.embalagens[0].tamanho).toBe(5);
  });

  it("sem nada gravado antes (cadastro novo), o produto é o que chegou", () => {
    const r = mesclarProduto(null, BASE);
    expect(r.nome).toBe("Primmax Inox");
    expect(r.ficha?.beneficios).toHaveLength(2);
  });
});

describe("mesclarFicha — vazio apaga, ausente preserva", () => {
  it("campo enviado em branco apaga o valor antigo", () => {
    const r = mesclarFicha(BASE.ficha, { subtitulo: "", titulo: "Limpador de Inox" });
    expect(r?.subtitulo).toBeUndefined();
    expect(r?.titulo).toBe("Limpador de Inox");
  });

  it("campo ausente mantém o valor antigo", () => {
    const r = mesclarFicha(BASE.ficha, { titulo: "Outro" });
    expect(r?.subtitulo).toBe("Uso Profissional");
  });

  it("lista vazia apaga a lista", () => {
    const r = mesclarFicha(BASE.ficha, { beneficios: [] });
    expect(r?.beneficios).toBeUndefined();
  });

  // O bloco de características é o único aninhado: a tela mostra pH, aspecto, cor e odor, mas
  // o catálogo também guarda densidade, uso e cloro ativo. Editar a cor não pode apagar a
  // densidade que veio da ficha técnica.
  it("GUARDIÃO: característica fora da tela sobrevive à edição das que estão nela", () => {
    const r = mesclarFicha(BASE.ficha, { caracteristicas: { pH: "8,0", aspecto: "", cor: "Incolor", odor: "" } });
    expect(r?.caracteristicas?.densidade).toBe("0,99");
    expect(r?.caracteristicas?.pH).toBe("8,0");
    expect(r?.caracteristicas?.cor).toBe("Incolor");
    expect(r?.caracteristicas?.aspecto).toBeUndefined();
  });

  it("ficha ausente no payload preserva a gravada inteira", () => {
    const r = mesclarFicha(BASE.ficha, undefined);
    expect(r).toEqual(BASE.ficha);
  });

  it("ficha que fica sem nenhum campo vira null, não um objeto vazio", () => {
    const r = mesclarFicha({ titulo: "X" }, { titulo: "" });
    expect(r).toBeNull();
  });
});
