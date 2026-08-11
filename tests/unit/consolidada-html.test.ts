import { describe, it, expect } from "vitest";
import { consolidadaHtml } from "@/lib/pdf/template-consolidada";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope } from "@/lib/contracts";

const assets = { logo: "data:,logo", logoWhite: "data:,logo-white", fontSans: "data:,fonte-sans", fontMono: "data:,fonte-mono" };

const scope: PropostaScope = {
  id: "1", criadoEm: "2026-07-10T00:00:00.000Z", status: "rascunho",
  tipo: "consolidada", template: "indeba_express",
  cliente: { razaoSocial: "Sua Empresa", cnpj: "00.000.000/0000-00", segmento: "Alimentação", responsavel: "João" },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [
    { codigo: "A", nome: "Produto A", descricaoUso: "uso A", imagemPath: "/a.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: { titulo: "TitA" } },
    { codigo: "B", nome: "Produto B", descricaoUso: "uso B", imagemPath: "/b.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "200.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: null },
  ],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: consolidadaDefaults(),
};

describe("consolidadaHtml", () => {
  it("emite as 5 seções e uma página por produto", () => {
    const html = consolidadaHtml(scope, { A: "data:,x", B: "data:,y" }, assets);
    expect(html).toContain("Proposta de Solução");
    expect(html).toContain("Sua Empresa");
    expect(html).toContain("00.000.000/0000-00");
    expect(html).toContain("João"); // responsável
    // Fase E: o H1 sai em title case no HTML (caixa alta via CSS), sem rótulo duplicado.
    expect(html).toContain("Apresentação");
    expect(html).toContain("Comodatos Oferecidos");
    expect(html).toContain("Condições Comerciais");
    expect(html).toContain("TitA"); // página produto A
    expect(html).toContain("Produto B"); // produto sem ficha cai no nome
    // duas páginas de produto (dois blocos prodpg — classe pode vir com " prodpg-simples" junto)
    expect(html.match(/class="prodpg(?: prodpg-simples)?"/g)?.length).toBe(2);
  });

  it("numeração do header deriva do índice real — bate com a contagem de produtos", () => {
    const html = consolidadaHtml(scope, { A: "data:,x", B: "data:,y" }, assets);
    // capa=01 (sem header) · apresentação=02 · comodatos=03 · produto A=04 · produto B=05 · condições=06
    expect(html).toContain("Proposta de Solução <b>02</b>");
    expect(html).toContain("Proposta de Solução <b>03</b>");
    expect(html).toContain("Proposta de Solução <b>04</b>");
    expect(html).toContain("Proposta de Solução <b>05</b>");
    expect(html).toContain("Proposta de Solução <b>06</b>");
  });

  // A faixa branca no pé de toda página (áudio do Matheus 24/07) era a margem inferior do
  // page.pdf, onde ficava o rodapé nativo. Agora a seção ocupa a página A4 inteira e a
  // paginação é impressa no HTML — regressão aqui significa o corte branco de volta.
  it("seções ocupam a página A4 cheia (sangria até a borda) e imprimem a paginação no HTML", () => {
    const html = consolidadaHtml(scope, { A: "data:,x", B: "data:,y" }, assets);
    expect(html).toContain("height: 297mm"); // capa/seções/páginas de produto
    expect(html).not.toContain("278mm");
    // Modelo onda-v3: numeração vive SÓ no cabeçalho ("Proposta de Solução | NN") —
    // nenhum rodapé "Página N/T" em lugar nenhum do documento.
    expect(html).not.toMatch(/Página \d+\/\d+/);
    expect(html).not.toContain('class="pgnum"');
  });

  it("onda rica presente em TODAS as páginas (capa, seções e produtos) — Fase E", () => {
    const html = consolidadaHtml(scope, { A: "data:,x", B: "data:,y" }, assets);
    // capa + apresentação + comodatos + 2 produtos + condições = 6 ornamentos
    expect(html.match(/class="wave"/g)?.length).toBe(6);
  });

  it("usa consolidadaDefaults quando scope.consolidada está ausente", () => {
    const html = consolidadaHtml({ ...scope, consolidada: undefined }, { A: "d", B: "d" }, assets);
    expect(html).toContain("Matheus Maristane Resende");
  });

  it("ajustes do Matheus: comodatos só título+ícone, Anvisa, região metropolitana e contrato mínimo", () => {
    const html = consolidadaHtml(scope, { A: "d", B: "d" }, assets);
    expect(html).toContain("Produtos Indeba certificados pela Anvisa.");
    expect(html).toContain("Diluidores Automáticos");
    expect(html).toContain("Dispensers de Sabonete e Papel");
    expect(html).toContain("Salvador e região metropolitana");
    expect(html).toContain("Contrato mínimo de 12 (doze) meses.");
    expect(html).toContain("Pedido mínimo para entrega e faturamento: R$ 400,00.");
  });

  it("contato preenchido aparece na ficha e no card das condições; null não vaza", () => {
    const comContato = {
      ...scope,
      consolidada: { ...consolidadaDefaults(), contato: { whatsapp: "(71) 90000-0000", emailConsultor: "consultor@indeba.com.br" } },
    };
    const html = consolidadaHtml(comContato, { A: "d", B: "d" }, assets);
    // Modelo onda-v3: contatos só na página de Condições (fechamento), sem o prefixo
    // "WhatsApp" — e nunca na página de produto.
    expect(html).toContain("(71) 90000-0000");
    expect(html).toContain("consultor@indeba.com.br");

    // CSS sempre define as classes; o que não pode existir é o ELEMENTO renderizado
    const semContato = consolidadaHtml(scope, { A: "d", B: "d" }, assets);
    expect(semContato).not.toContain("(71) 90000-0000");
    expect(semContato).not.toContain('class="cl-contato"');
    expect(semContato).not.toContain("null");
  });
});
