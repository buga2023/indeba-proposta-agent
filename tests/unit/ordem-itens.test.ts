import { describe, it, expect } from "vitest";
import { montarPropostaEstruturada } from "@/lib/montar";
import { consolidadaHtml } from "@/lib/pdf/template-consolidada";
import { orcamentoHtml } from "@/lib/pdf/template-orcamento";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope } from "@/lib/contracts";

// A ordem dos produtos na proposta é arrastável na montagem (painel "Selecionados") e o
// ÚNICO portador dessa escolha é a posição em `scope.itens`: não existe campo `ordem` no
// contrato. Estes testes são os guardiões do caminho — se algum passo passar a reordenar,
// o consultor arrasta na tela e o PDF sai em outra sequência, sem erro nenhum aparecendo.

const cliente = { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: null };
const emb = (preco: string) => [{ tamanho: 5, unidade: "L" as const, preco, diluicaoMax: "1:100", custoDiluido: null }];

describe("ordem dos itens — montagem", () => {
  it("montarPropostaEstruturada preserva a ordem do payload, item próprio no MEIO inclusive", async () => {
    const scope = await montarPropostaEstruturada({
      cliente,
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [
        { codigo: "CITY-PAN", quantidade: 1, embalagens: emb("100.00") },
        // Item próprio entre dois do catálogo: a tela deixa arrastá-lo para qualquer
        // posição, e antes disso ele era sempre concatenado no fim do payload.
        { nome: "Item Próprio", quantidade: 1, embalagens: emb("200.00") },
        { codigo: "AUTOCAR-PLUS", quantidade: 1, embalagens: emb("300.00") },
      ],
    });
    expect(scope.itens.map((i) => i.nome)).toEqual(["City Pan", "Item Próprio", "Autocar Plus"]);
  });

  it("a mesma seleção em ordem diferente sai em ordem diferente — nada de sort por preço/nome", async () => {
    const itens = [
      { codigo: "AUTOCAR-PLUS", quantidade: 1, embalagens: emb("300.00") },
      { codigo: "CITY-PAN", quantidade: 1, embalagens: emb("100.00") },
    ];
    const scope = await montarPropostaEstruturada({ cliente, tipo: "consolidada", textoApresentacao: "t", itens });
    expect(scope.itens.map((i) => i.codigo)).toEqual(["AUTOCAR-PLUS", "CITY-PAN"]);
    const invertido = await montarPropostaEstruturada({ cliente, tipo: "consolidada", textoApresentacao: "t", itens: [...itens].reverse() });
    expect(invertido.itens.map((i) => i.codigo)).toEqual(["CITY-PAN", "AUTOCAR-PLUS"]);
  });
});

const assets = { logo: "data:,logo", logoWhite: "data:,logo-white", fontSans: "data:,fonte-sans", fontMono: "data:,fonte-mono" };
const scopeAB: PropostaScope = {
  id: "1",
  criadoEm: "2026-07-30T00:00:00.000Z",
  status: "rascunho",
  tipo: "consolidada",
  template: "indeba_express",
  cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: null },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [
    { codigo: "A", nome: "Produto Alfa", descricaoUso: "uso A", imagemPath: "/a.png", embalagens: emb("100.00"), quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: null },
    { codigo: "B", nome: "Produto Beta", descricaoUso: "uso B", imagemPath: "/b.png", embalagens: emb("200.00"), quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: null },
  ],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: consolidadaDefaults(),
};
const inverso: PropostaScope = { ...scopeAB, itens: [...scopeAB.itens].reverse() };

describe("ordem dos itens — PDF", () => {
  // Na Consolidada cada item é uma página A4, e o índice do array vira o número impresso
  // no header ("Proposta de Solução 04") e a paginação — trocar a ordem troca as páginas.
  it("consolidada emite as fichas na ordem do array, e a numeração acompanha", () => {
    const html = consolidadaHtml(scopeAB, { A: "data:,x", B: "data:,y" }, assets);
    expect(html.indexOf("Produto Alfa")).toBeLessThan(html.indexOf("Produto Beta"));

    const html2 = consolidadaHtml(inverso, { A: "data:,x", B: "data:,y" }, assets);
    expect(html2.indexOf("Produto Beta")).toBeLessThan(html2.indexOf("Produto Alfa"));
    // Beta agora é a primeira página de produto (04) e Alfa a segunda (05) — a numeração
    // vive só no cabeçalho/runmark ("Proposta de Solução <b>05</b>").
    expect(html2.indexOf("Produto Beta")).toBeLessThan(html2.indexOf("Proposta de Solução <b>05</b>"));
  });

  it("orçamento emite as linhas da tabela na ordem do array", () => {
    const html = orcamentoHtml({ ...scopeAB, tipo: "orcamento" });
    expect(html.indexOf("Produto Alfa")).toBeLessThan(html.indexOf("Produto Beta"));

    const html2 = orcamentoHtml({ ...inverso, tipo: "orcamento" });
    expect(html2.indexOf("Produto Beta")).toBeLessThan(html2.indexOf("Produto Alfa"));
  });
});
