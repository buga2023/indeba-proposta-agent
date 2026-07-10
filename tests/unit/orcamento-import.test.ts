import { describe, it, expect, vi } from "vitest";
import { precoConstaNoTexto, validarPrecos, estruturarOrcamento, matchCatalogo } from "@/lib/orcamento/importar";

const { ollamaDisponivel, gerarJson } = vi.hoisted(() => ({
  ollamaDisponivel: vi.fn(),
  gerarJson: vi.fn(),
}));
vi.mock("@/lib/llm/ollama", () => ({ ollamaDisponivel, gerarJson }));

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
});

describe("estruturarOrcamento", () => {
  it("caminho feliz: estrutura via IA e mantém só itens com preço do documento", async () => {
    ollamaDisponivel.mockResolvedValue(true);
    gerarJson.mockResolvedValue(
      JSON.stringify({
        cliente: { razaoSocial: "Laticínio São João Ltda", cnpj: "12.345.678/0001-90", segmento: null, responsavel: "Maria Souza" },
        itens: [
          { nome: "PRIMMAX PLUS", quantidade: 2, tamanho: 5, unidade: "L", preco: "130.00" },
          { nome: "DGCLOR", quantidade: 1, tamanho: 20, unidade: "L", preco: "1234.56" },
          { nome: "Alucinado", quantidade: 1, tamanho: null, unidade: null, preco: "555.55" },
        ],
        condicoes: { validade: null, prazoEntrega: null, pagamento: "boleto 28 dias", frete: "CIF" },
      }),
    );
    const { extraido, rejeitados } = await estruturarOrcamento(TEXTO);
    expect(extraido.itens.map((i) => i.nome)).toEqual(["PRIMMAX PLUS", "DGCLOR"]);
    expect(extraido.itens[0].preco).toBe("130.00"); // idêntico ao documento
    expect(rejeitados.map((r) => r.nome)).toEqual(["Alucinado"]);
    expect(extraido.cliente.responsavel).toBe("Maria Souza");
  });

  it("sem Ollama: erro claro, sem chute", async () => {
    ollamaDisponivel.mockResolvedValue(false);
    await expect(estruturarOrcamento(TEXTO)).rejects.toThrow(/IA indisponível/);
  });
});
