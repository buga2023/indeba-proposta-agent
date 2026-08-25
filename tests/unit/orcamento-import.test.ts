import { describe, it, expect } from "vitest";
import { precoConstaNoTexto, validarPrecos, estruturarOrcamento, matchCatalogo, normalizarPreco } from "@/lib/orcamento/importar";

const TEXTO = `ORÇAMENTO Nº 4821 — IES Equipamentos
Cliente: Laticínio São João Ltda   CNPJ: 12.345.678/0001-90
A/C: Maria Souza

1. PRIMMAX PLUS - Bombona 5 L ........ 2 un ... R$ 130,00
2. DGCLOR - Bombona 20 L ............. 1 un ... R$ 1.234,56
3. Detergente neutro 5 L ............. 3 un ... R$ 99

Pagamento: boleto 28 dias   Frete: CIF`;

describe("guarda de preço (teste-guardião: preço vem do DOCUMENTO, não da IA)", () => {
  it("acha o preço em formato brasileiro, com e sem milhar", () => {
    expect(precoConstaNoTexto(TEXTO, "130.00")).toBe(true);
    expect(precoConstaNoTexto(TEXTO, "1234.56")).toBe(true);
  });

  it("preço redondo sem centavos no documento também confere", () => {
    expect(precoConstaNoTexto(TEXTO, "99.00")).toBe(true);
  });

  it("preço que NÃO está no documento é barrado", () => {
    expect(precoConstaNoTexto(TEXTO, "150.00")).toBe(false);
    expect(precoConstaNoTexto(TEXTO, "13.00")).toBe(false); // não casa com pedaço de "130,00"
  });

  it("validarPrecos separa alucinação em rejeitados", () => {
    const { aceitos, rejeitados } = validarPrecos(TEXTO, [
      { nome: "PRIMMAX PLUS", quantidade: 2, tamanho: 5, unidade: "L", preco: "130.00", codigoCatalogo: null, nomeCatalogo: null },
      { nome: "Inventado", quantidade: 1, tamanho: null, unidade: null, preco: "777.77", codigoCatalogo: null, nomeCatalogo: null },
    ]);
    expect(aceitos.map((i) => i.nome)).toEqual(["PRIMMAX PLUS"]);
    expect(rejeitados).toHaveLength(1);
    expect(rejeitados[0].nome).toBe("Inventado");
  });
});

describe("matchCatalogo — casa item do orçamento com produto do catálogo", () => {
  const PRODUTOS = [
    { codigo: "PRIMMAX", nome: "Primmax" },
    { codigo: "PRIMMAX-PLUS", nome: "Primmax Plus" },
    { codigo: "DGCLOR", nome: "DGClor" },
  ];

  it("casa por tokens, ignorando caixa/acentos/pontuação, e prefere o nome mais específico", () => {
    expect(matchCatalogo("PRIMMAX PLUS - Bombona 5 L", PRODUTOS)?.codigo).toBe("PRIMMAX-PLUS");
    expect(matchCatalogo("dgclor 20l", PRODUTOS)?.codigo).toBe("DGCLOR");
  });

  it("sem casamento → null (não força vínculo errado)", () => {
    expect(matchCatalogo("Detergente neutro genérico", PRODUTOS)).toBeNull();
  });

  // Achado em produção (2026-07-17): "Soft's Concentrado" no catálogo vs "SOFTS
  // CONCENTRADO" no texto do orçamento (ERP costuma escrever sem apóstrofo) — casava
  // errado antes porque "soft's" virava dois tokens ("soft" + "s") no normalizador.
  it("apóstrofo no nome do catálogo não impede o casamento com texto sem apóstrofo", () => {
    const comApostrofo = [{ codigo: "SOFTS-CONCENTRADO", nome: "Soft's Concentrado" }];
    expect(matchCatalogo("381286 - SOFTS CONCENTRADO - BD20", comApostrofo)?.codigo).toBe("SOFTS-CONCENTRADO");
  });
});

describe("normalizarPreco — formato brasileiro e decimal", () => {
  it("converte para a convenção decimal-string do projeto", () => {
    expect(normalizarPreco("1.234,56")).toBe("1234.56");
    expect(normalizarPreco("130,00")).toBe("130.00");
    expect(normalizarPreco("99")).toBe("99.00");
    expect(normalizarPreco("45.90")).toBe("45.90");
  });
  it("rejeita o que não é preço", () => {
    expect(normalizarPreco("0")).toBeNull();
    expect(normalizarPreco("abc")).toBeNull();
  });
});

describe("estruturarOrcamento — parser determinístico (sem IA)", () => {
  it("caminho feliz: itens, cliente e condições saem do próprio texto", async () => {
    const { extraido, rejeitados } = await estruturarOrcamento(TEXTO);
    expect(extraido.itens).toHaveLength(3);
    expect(extraido.itens[0]).toMatchObject({ quantidade: 2, tamanho: 5, unidade: "L", preco: "130.00" });
    expect(extraido.itens[0].nome).toContain("PRIMMAX PLUS");
    expect(extraido.itens[1]).toMatchObject({ quantidade: 1, tamanho: 20, unidade: "L", preco: "1234.56" });
    expect(extraido.itens[2]).toMatchObject({ quantidade: 3, tamanho: 5, unidade: "L", preco: "99.00" });
    expect(rejeitados).toHaveLength(0);
    expect(extraido.cliente.razaoSocial).toBe("Laticínio São João Ltda");
    expect(extraido.cliente.cnpj).toBe("12.345.678/0001-90");
    expect(extraido.cliente.responsavel).toBe("Maria Souza");
    expect(extraido.condicoes.pagamento).toBe("boleto 28 dias");
    expect(extraido.condicoes.frete).toBe("CIF");
  });

  it("a numeração da lista e o preenchimento de coluna não entram no nome", async () => {
    const { extraido } = await estruturarOrcamento(TEXTO);
    expect(extraido.itens[0].nome).toBe("PRIMMAX PLUS - Bombona 5 L");
    expect(extraido.itens[0].nome).not.toMatch(/^\d/);
  });

  it("linha de rótulo/total terminando em número não vira item", async () => {
    const texto = `Cliente: Fulano\nSabão em pó 1 kg .... R$ 25,50\nTotal: R$ 25,50\nValidade: 10 dias`;
    const { extraido } = await estruturarOrcamento(texto);
    expect(extraido.itens).toHaveLength(1);
    expect(extraido.itens[0]).toMatchObject({ tamanho: 1, unidade: "kg", preco: "25.50" });
    expect(extraido.condicoes.validade).toBe("10 dias");
  });

  it("sem nenhuma linha de item: erro claro, sem chute", async () => {
    await expect(estruturarOrcamento("Só um texto qualquer, sem itens.")).rejects.toThrow(/Não consegui extrair/);
  });
});
