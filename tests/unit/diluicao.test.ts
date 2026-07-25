import { describe, it, expect } from "vitest";
import { fatoresDiluicao, diluicaoMaxima, custoLitroDiluido } from "@/lib/diluicao";
import { carregarCatalogo } from "@/lib/catalogo";
import type { Embalagem } from "@/lib/contracts";

const emb = (tamanho: number, preco: string, unidade: Embalagem["unidade"] = "L"): Embalagem =>
  ({ tamanho, unidade, preco, diluicaoMax: null, custoDiluido: null });

describe("fatoresDiluicao — textos reais do catálogo", () => {
  it("razão 1:N", () => {
    expect(fatoresDiluicao("solução de 0,4% p/v (1:250)")).toContain(250);
  });

  it("'X partes para até Y partes' → Y/X", () => {
    expect(Math.max(...fatoresDiluicao("2 partes de Primmax DGClor para até 100 partes de solução"))).toBe(50);
    expect(Math.max(...fatoresDiluicao("1 parte de Primmax Subzero para até 100 partes de solução"))).toBe(100);
  });

  it("faixa de partes usa a MENOR concentração (maior diluição)", () => {
    // "1 a 4 partes para até 100 partes" → 1:100 (e não 1:25)
    expect(Math.max(...fatoresDiluicao("diluir 1 a 4 parte do produto para até 100 partes de solução"))).toBe(100);
  });

  it("percentual → 100/%", () => {
    expect(Math.max(...fatoresDiluicao("adicionar de 0,10% a 0,30% de PRIMMAX DT"))).toBe(1000);
    expect(fatoresDiluicao("concentração de 2%")).toContain(50);
  });

  it("mL por litro de água", () => {
    expect(Math.max(...fatoresDiluicao("100 mL do produto para 10 litros de água"))).toBe(100);
  });

  it("texto sem diluição não produz fator (nem 1:1)", () => {
    expect(fatoresDiluicao("imergir durante 15 minutos, após lavar com escova e detergente")).toEqual([]);
    expect(fatoresDiluicao("")).toEqual([]);
  });
});

describe("diluicaoMaxima", () => {
  it("prefere a ficha técnica; sem ficha, cai no diluicaoMax da embalagem", () => {
    const ficha = { diluicoes: [{ uso: "limpeza leve", razao: "1 parte para até 100 partes" }, { uso: "pesada", razao: "20 partes para até 100 partes" }] };
    expect(diluicaoMaxima(ficha, [emb(5, "100.00")])).toBe(100); // a maior das duas
    expect(diluicaoMaxima(null, [{ ...emb(5, "100.00"), diluicaoMax: "1:250" }])).toBe(250);
    expect(diluicaoMaxima(null, [emb(5, "100.00")])).toBeNull();
  });
});

describe("custoLitroDiluido", () => {
  it("bate com o custoDiluido cadastrado no catálogo (Sanquat 5 L R$ 220,00 · 1:250 → R$ 0,18)", () => {
    const r = custoLitroDiluido([{ ...emb(5, "220.00"), diluicaoMax: "1:250" }]);
    expect(r?.valor).toBeCloseTo(0.176, 3);
    expect(r?.texto).toBe("R$ 0,18");
    expect(r?.rotulo).toBe("1:250");
  });

  it("usa o preço REALMENTE cotado (o vendedor pode ter mudado o preço na montagem)", () => {
    const barato = custoLitroDiluido([{ ...emb(5, "110.00"), diluicaoMax: "1:100" }]);
    const caro = custoLitroDiluido([{ ...emb(5, "220.00"), diluicaoMax: "1:100" }]);
    expect(barato?.texto).toBe("R$ 0,22");
    expect(caro?.texto).toBe("R$ 0,44");
  });

  it("abaixo de 10 centavos mostra 3 casas (1:1000 não pode virar 'R$ 0,02')", () => {
    const r = custoLitroDiluido([{ ...emb(5, "90.00"), diluicaoMax: "1:1000" }]);
    expect(r?.texto).toBe("R$ 0,018");
    expect(r?.rotulo).toBe("1:1000");
  });

  it("a diluição vem SEMPRE da embalagem cotada — nunca da ficha técnica", () => {
    // ficha rica no produto, mas o consultor não informou diluição: sem número inventado
    expect(custoLitroDiluido([emb(5, "90.00")])).toBeNull();
  });

  it("kg conta como litro; 'un' e preço zerado não geram valor", () => {
    expect(custoLitroDiluido([{ ...emb(4, "99.00", "kg"), diluicaoMax: "1:100" }])?.texto).toBe("R$ 0,25");
    expect(custoLitroDiluido([{ ...emb(1, "50.00", "un"), diluicaoMax: "1:100" }])).toBeNull();
    expect(custoLitroDiluido([{ ...emb(5, "0.00"), diluicaoMax: "1:100" }])).toBeNull();
    expect(custoLitroDiluido([])).toBeNull();
  });

  it("sai da embalagem COTADA (embalagens[0]), não da mais barata", () => {
    const r = custoLitroDiluido([{ ...emb(20, "290.00", "kg"), diluicaoMax: "1:100" }, { ...emb(200, "2000.00", "kg"), diluicaoMax: "1:100" }]);
    expect(r?.texto).toBe("R$ 0,15"); // 290/20/100
  });
});

describe("catálogo real — produtos da proposta MML têm diluição legível", () => {
  const cat = carregarCatalogo();
  const casos: Array<[string, number]> = [
    ["PRIMMAX-DGCLOR", 50],
    ["PRIMMAX-HORT-FLV", 100],
    ["PRIMMAX-SANQUAT", 250],
    ["PRIMMAX-DT", 1000],
    ["PRIMMAX-SUBZERO", 100],
    ["AUTOCAR-1000-PLUS", 100],
    ["CITY-T-LIQUIDO", 100],
  ];
  for (const [codigo, fator] of casos) {
    it(`${codigo} → 1:${fator}`, () => {
      const p = cat.produtos.find((x) => x.codigo === codigo)!;
      expect(diluicaoMaxima(p.ficha, p.embalagens as Embalagem[])).toBeCloseTo(fator, 5);
    });
  }
});
