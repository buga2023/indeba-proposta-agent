import { describe, it, expect } from "vitest";
import { rodarChecklist, lacunas, CATEGORIAS } from "@/lib/contrato/checklist";

// Contrato curto: tem objeto, partes, pagamento, vigência, multa, foro — NÃO tem LGPD,
// confidencialidade, reajuste, força maior (lacunas que a varredura deve achar).
const CONTRATO = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS
As partes CONTRATANTE Restaurante X (CNPJ 00.000.000/0001-00) e CONTRATADA Indeba LTDA
têm por objeto deste contrato o fornecimento de produtos de limpeza.
Do pagamento: o valor total será pago via boleto, com vencimento em 30 dias.
Da vigência: o contrato vigorará pelo prazo de 12 meses.
Da multa: o descumprimento sujeita o infrator a multa de 10%.
Do foro: fica eleito o foro da comarca de Salvador/BA.
`;

describe("checklist CUAD-BR: cobertura garantida pelo código (anti-preguiça do LLM)", () => {
  const itens = rodarChecklist(CONTRATO);

  it("varre TODAS as categorias (presente/ausente para cada uma)", () => {
    expect(itens).toHaveLength(CATEGORIAS.length);
    expect(itens.every((i) => typeof i.presente === "boolean")).toBe(true);
  });

  it("detecta o que ESTÁ no contrato, com trecho literal", () => {
    const get = (id: string) => itens.find((i) => i.id === id)!;
    expect(get("objeto").presente).toBe(true);
    expect(get("preco_pagamento").presente).toBe(true);
    expect(get("vigencia").presente).toBe(true);
    expect(get("multa").presente).toBe(true);
    expect(get("foro").presente).toBe(true);
    expect(get("multa").trecho).toMatch(/multa/i); // trecho vem do texto, não da IA
  });

  it("acha as LACUNAS de alta severidade primeiro (LGPD ausente no topo)", () => {
    const faltando = lacunas(itens);
    const ids = faltando.map((i) => i.id);
    expect(ids).toContain("lgpd");
    expect(ids).toContain("confidencialidade");
    expect(ids).toContain("reajuste");
    // a primeira lacuna é de severidade alta
    expect(faltando[0].severidade).toBe("alta");
    // LGPD carrega o fundamento legal para ancorar (validável via LexML)
    expect(faltando.find((i) => i.id === "lgpd")?.fundamento).toMatch(/13\.709/);
  });
});
