import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";
import { responder, preco } from "@/components/ajuda-chat-logic";

// O assistente é DETERMINÍSTICO e aterrado no catálogo. Garante: preço sempre real
// (constituição §1.2), respostas batem com o catálogo, e quando não sabe → null
// (não inventa, conforme instrução do usuário).
describe("assistente de ajuda — aterrado no catálogo", () => {
  const produtos = carregarCatalogo().produtos;

  // O catálogo não guarda mais preço (quem cota é o consultor, na montagem), então a
  // resposta certa a "quanto custa" é "sob consulta" — nunca um valor inventado.
  it("pergunta de preço responde a partir do catálogo, sem inventar valor", () => {
    const plus = produtos.find((p) => p.codigo === "PRIMMAX-PLUS")!;
    const r = responder("quanto custa o Primmax Plus?", produtos)!;
    expect(r).toContain(preco(plus.embalagens[0].preco));
    expect(r).toContain("sob consulta");
    expect(r).not.toMatch(/R\$ \d/); // nenhum valor saiu do nada
  });

  it("nunca inventa preço — todo valor citado existe no catálogo", () => {
    const reais = new Set<string>();
    for (const p of produtos) for (const e of p.embalagens) reais.add(preco(e.preco));
    const r = responder("ver todos os produtos", produtos)!;
    // todo trecho "R$ x,xx" da resposta tem que ser um preço real do catálogo
    for (const achado of r.match(/R\$ \d+,\d{2}/g) ?? []) {
      expect(reais.has(achado)).toBe(true);
    }
  });

  it("necessidade → só produtos do catálogo que casam a faceta", () => {
    const r = responder("preciso de algo para desengordurar louça", produtos)!;
    const desengord = produtos.filter((p) => p.ativo && p.funcoes.includes("desengordurante"));
    expect(desengord.length).toBeGreaterThan(0);
    for (const p of desengord) expect(r).toContain(p.nome);
  });

  it("FAQ: 'como gero uma proposta' explica os dois caminhos (manual/importar)", () => {
    const r = responder("como gero uma proposta?", produtos)!;
    expect(r).toMatch(/manual/i);
    expect(r).toMatch(/importar/i);
  });

  it("FAQ: 'quais tipos de proposta' explica que só a Proposta de Solução é oferecida na criação", () => {
    const r = responder("quais tipos de proposta existem?", produtos)!;
    expect(r).toMatch(/proposta de solução/i);
  });

  it("HONESTIDADE: pergunta fora do escopo → null (não inventa)", () => {
    expect(responder("qual a capital da França?", produtos)).toBeNull();
    expect(responder("me conta uma piada", produtos)).toBeNull();
  });

  it("necessidade sem produto no catálogo → diz que não tem, sem inventar", () => {
    const r = responder("tem produto para lavanderia de roupas?", produtos);
    // catálogo do MVP não tem linha lavanderia; ou cai no 'não temos' ou no 'não sei'
    if (r) expect(r).toMatch(/não temos|nao temos/i);
  });
});
