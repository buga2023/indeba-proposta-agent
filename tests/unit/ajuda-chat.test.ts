import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";
import { responder, preco, SUGESTOES, FAQ, WELCOME, NAO_SEI } from "@/components/ajuda-chat-logic";

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

  // Este teste garantia que lavanderia caísse no "não temos" — a premissa era que o MVP
  // não tinha essa linha. Ela morreu em 01/08/2026: com o catálogo real no ar, lavanderia
  // é a MAIOR linha (50 produtos). A garantia que continua valendo é a mesma de sempre —
  // o que o assistente responde sai do catálogo, nunca da imaginação.
  it("necessidade atendida → responde com produto REAL do catálogo", () => {
    const r = responder("tem produto para lavanderia de roupas?", produtos);
    expect(r).toBeTruthy();
    const citados = produtos.filter((p) => p.ativo && r!.includes(p.nome));
    expect(citados.length).toBeGreaterThan(0);
    expect(r).not.toMatch(/R\$ \d/); // nenhum preço saiu do nada
  });

  it("HONESTIDADE: necessidade sem casamento no catálogo → não inventa produto", () => {
    // "não temos" ou null; o que não pode é devolver um produto que não existe
    const r = responder("vocês têm ração para gato?", produtos);
    if (r) expect(r).toMatch(/não temos|nao temos/i);
  });

  // O casamento do FAQ é "primeira entrada cuja palavra aparece no texto", e as entradas
  // antigas abrem com termos larguíssimos ("como", "usar", "criar"). Uma pergunta nova
  // colocada depois delas nunca é alcançada — o chip responde outra coisa e ninguém percebe,
  // porque a resposta errada AINDA é uma resposta plausível.
  it("todo chip de sugestão tem resposta — nenhum cai no 'não sei'", () => {
    for (const s of SUGESTOES) expect(responder(s, produtos), `sugestão sem resposta: ${s}`).toBeTruthy();
  });

  it("FAQ: cadastro pendente explica que falta a liberação do gestor, não a senha", () => {
    const r = responder("cadastrei e não consigo entrar", produtos)!;
    expect(r).toMatch(/gestor/i);
    expect(r).toMatch(/liberad|liberação|fila|aprova/i);
  });

  it("FAQ: 'só vejo as minhas propostas' explica a carteira — e que nada foi apagado", () => {
    const r = responder("por que só vejo as minhas propostas?", produtos)!;
    expect(r).toMatch(/carteira|você mesmo|voce mesmo/i);
    expect(r).toMatch(/gestor/i);
  });

  // Com 147 produtos ativos, listar um por linha devolvia uma parede ilegível — e todas as
  // linhas terminam iguais ("sob consulta"), já que preço saiu do catálogo.
  it("'ver todos os produtos' resume por linha em vez de despejar o catálogo", () => {
    const ativos = produtos.filter((p) => p.ativo);
    const r = responder("ver todos os produtos", produtos)!;
    expect(r).toContain(String(ativos.length)); // o total continua sendo dito
    expect(r.split("\n").length).toBeLessThan(ativos.length);
  });

  it("pergunta genérica de preço explica que quem cota é o consultor", () => {
    const r = responder("quais são os preços?", produtos)!;
    expect(r).toMatch(/não guarda preço|nao guarda preco/i);
    expect(r).not.toMatch(/R\$ \d/);
  });
});

// A marcação (**negrito**, "• ", "1. ") é escrita à mão em dezenas de strings e desenhada
// por `Resposta` em ajuda-chat.tsx. Um `**` sem par não quebra build nem teste de conteúdo:
// vira DOIS ASTERISCOS LITERAIS na bolha, e só o vendedor descobre. Estes testes são o par
// de olhos que ninguém tem na hora de editar uma resposta.
describe("assistente de ajuda — marcação das respostas", () => {
  const produtos = carregarCatalogo().produtos;
  const emitidas = () => [
    WELCOME,
    NAO_SEI,
    ...FAQ.map((f) => f.a),
    responder("primmax plus", produtos)!, // ficha completa
    responder("quanto custa o primmax plus?", produtos)!, // preço por embalagem
    responder("ver todos os produtos", produtos)!, // resumo por linha
    responder("algo para desengordurar louça", produtos)!, // lista por necessidade
    responder("vocês têm ração para gato?", produtos) ?? "", // "não temos"
  ];

  it("todo ** tem par — nenhum asterisco vaza para a tela", () => {
    for (const s of emitidas()) {
      expect((s.match(/\*\*/g) ?? []).length % 2, `marcação ímpar em: ${s.slice(0, 60)}…`).toBe(0);
    }
  });

  it("negrito nunca fica vazio nem atravessa quebra de linha", () => {
    for (const s of emitidas()) {
      expect(s, `negrito vazio em: ${s.slice(0, 60)}…`).not.toMatch(/\*\*\*\*/);
      for (const linha of s.split("\n")) {
        expect((linha.match(/\*\*/g) ?? []).length % 2, `negrito aberto e não fechado na linha: ${linha}`).toBe(0);
      }
    }
  });

  it("marcador de lista sempre vem com espaço — senão o renderizador não o reconhece", () => {
    for (const s of emitidas()) {
      for (const linha of s.split("\n")) {
        if (linha.startsWith("•")) expect(linha, `bullet sem espaço: ${linha}`).toMatch(/^• \S/);
        if (/^\d+\./.test(linha)) expect(linha, `item numerado sem espaço: ${linha}`).toMatch(/^\d+\. \S/);
      }
    }
  });
});
