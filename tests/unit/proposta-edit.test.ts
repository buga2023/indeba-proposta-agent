import { describe, it, expect } from "vitest";
import { setPrecoEmbalagem, normalizarPreco, extrairNumero, setClienteCampo, setQuantidadeAbsoluta, setCondicaoComercial, setCondicaoConsolidadaTexto, setCondicaoConsolidadaPorCampo, cortarParaOrcamento } from "@/lib/proposta-edit";
import type { PropostaScope } from "@/lib/contracts";

const scope = {
  cliente: { razaoSocial: "Cliente X", cnpj: null, segmento: null, responsavel: null },
  condicoesComerciais: { validade: "15 dias", prazoEntrega: "72h", pagamento: "Boleto", frete: "CIF" },
  itens: [
    { codigo: "A", quantidade: 1, embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }] },
  ],
} as unknown as PropostaScope;

describe("proposta-edit", () => {
  it("normalizarPreco força decimal string com 2 casas", () => {
    expect(normalizarPreco("150")).toBe("150.00");
    expect(normalizarPreco("150,5")).toBe("150.50");
    expect(normalizarPreco("abc")).toBe("0.00");
  });
  it("setPrecoEmbalagem atualiza sem mutar o original", () => {
    const novo = setPrecoEmbalagem(scope, "A", 0, "250,90");
    expect(novo.itens[0].embalagens[0].preco).toBe("250.90");
    expect(scope.itens[0].embalagens[0].preco).toBe("100.00"); // imutável
  });

  // Chat de correção (comando-edicao): a IA nunca decide o número — só extrairNumero,
  // sobre a mensagem ORIGINAL do vendedor, entrega o valor a aplicar.
  describe("extrairNumero — trava de preço/quantidade do chat de correção", () => {
    it("extrai preço em formato R$ e decimal com vírgula", () => {
      expect(extrairNumero("muda o preço pra R$ 25,90")).toBe("25,90");
      expect(extrairNumero("quero 25.90 nesse item")).toBe("25.90");
    });
    it("extrai quantidade inteira", () => {
      expect(extrairNumero("muda a quantidade pra 5")).toBe("5");
    });
    it("mensagem sem número reconhecível devolve null — não aplica, não adivinha", () => {
      expect(extrairNumero("troca o cliente")).toBeNull();
    });
  });

  it("setClienteCampo troca só o campo pedido, sem mutar o original", () => {
    const novo = setClienteCampo(scope, "cnpj", "00.000.000/0001-00");
    expect(novo.cliente.cnpj).toBe("00.000.000/0001-00");
    expect(novo.cliente.razaoSocial).toBe("Cliente X");
    expect(scope.cliente.cnpj).toBeNull(); // imutável
  });

  it("setQuantidadeAbsoluta define a quantidade (nunca abaixo de 1)", () => {
    expect(setQuantidadeAbsoluta(scope, "A", 5).itens[0].quantidade).toBe(5);
    expect(setQuantidadeAbsoluta(scope, "A", 0).itens[0].quantidade).toBe(1);
    expect(setQuantidadeAbsoluta(scope, "A", -3).itens[0].quantidade).toBe(1);
  });

  it("setCondicaoComercial troca só o campo pedido", () => {
    const novo = setCondicaoComercial(scope, "frete", "FOB");
    expect(novo.condicoesComerciais.frete).toBe("FOB");
    expect(novo.condicoesComerciais.pagamento).toBe("Boleto");
  });

  // scope.consolidada.condicoes.itens é o que o PDF do modelo Consolidada (único
  // selecionável hoje) realmente renderiza na página de fechamento — setCondicaoComercial
  // acima NÃO chega lá. Teste-guardião contra regressão desse bug (achado em auditoria).
  describe("condições comerciais do modelo Consolidada — o que o PDF final renderiza", () => {
    const scopeConsolidada = {
      ...scope,
      consolidada: {
        condicoes: {
          itens: [
            { titulo: "Validade da Proposta", texto: "30 dias", icone: "validade" },
            { titulo: "Prazo de Implantação", texto: "15 dias úteis", icone: "prazo" },
            { titulo: "Forma de Pagamento", texto: "Boleto 30 dias", icone: "pagamento" },
            { titulo: "Frete e Entrega", texto: "CIF", icone: "frete" },
          ],
          mensagemFechamento: "x",
          consultor: "y",
          cargo: "z",
        },
      },
    } as unknown as PropostaScope;

    it("setCondicaoConsolidadaTexto edita só o item do índice, sem mutar o original", () => {
      const novo = setCondicaoConsolidadaTexto(scopeConsolidada, 0, "7 dias corridos");
      expect(novo.consolidada!.condicoes.itens[0].texto).toBe("7 dias corridos");
      expect(novo.consolidada!.condicoes.itens[1].texto).toBe("15 dias úteis");
      expect(scopeConsolidada.consolidada!.condicoes.itens[0].texto).toBe("30 dias"); // imutável
    });

    it("setCondicaoConsolidadaPorCampo casa pelo ícone do item (chat de correção)", () => {
      const novo = setCondicaoConsolidadaPorCampo(scopeConsolidada, "frete", "FOB");
      expect(novo.consolidada!.condicoes.itens.find((i) => i.icone === "frete")!.texto).toBe("FOB");
    });

    it("setCondicaoConsolidadaPorCampo sem item correspondente não altera nada (nunca inventa item)", () => {
      const semFrete = { ...scopeConsolidada, consolidada: { ...scopeConsolidada.consolidada, condicoes: { ...scopeConsolidada.consolidada!.condicoes, itens: scopeConsolidada.consolidada!.condicoes.itens.slice(0, 3) } } } as unknown as PropostaScope;
      const novo = setCondicaoConsolidadaPorCampo(semFrete, "frete", "FOB");
      expect(novo).toBe(semFrete);
    });
  });

  // Chat "limitar_orcamento" — corta do mais barato pro mais caro, nunca esvazia a proposta.
  describe("cortarParaOrcamento", () => {
    const itens = [
      { codigo: "A", precoUnit: 100, quantidade: 1 },
      { codigo: "B", precoUnit: 300, quantidade: 1 },
      { codigo: "C", precoUnit: 50, quantidade: 1 },
    ]; // total = 450

    it("corta os mais baratos primeiro até caber no teto", () => {
      const r = cortarParaOrcamento(itens, 450, 200);
      expect(r.codigosRemover).toEqual(["C", "A"]); // 450 - 50 = 400 (ainda > 200) - 100 = 300... continua
    });

    it("já dentro do teto → não corta nada", () => {
      const r = cortarParaOrcamento(itens, 450, 1000);
      expect(r.codigosRemover).toEqual([]);
      expect(r.totalFinal).toBe(450);
    });

    it("nunca esvazia a proposta — para com 1 item restante mesmo sem caber no teto", () => {
      const r = cortarParaOrcamento(itens, 450, 10);
      expect(r.codigosRemover.length).toBe(2); // sobra 1 item (o mais caro), mesmo passando do teto
    });

    it("considera quantidade no total removido", () => {
      const comQtd = [{ codigo: "A", precoUnit: 100, quantidade: 3 }, { codigo: "B", precoUnit: 50, quantidade: 1 }];
      const r = cortarParaOrcamento(comQtd, 350, 100);
      expect(r.codigosRemover).toEqual(["B"]); // remove o mais barato por unidade primeiro
    });
  });
});
