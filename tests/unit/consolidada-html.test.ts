import { describe, it, expect } from "vitest";
import { consolidadaHtml } from "@/lib/pdf/template-consolidada";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope } from "@/lib/contracts";

const assets = { logo: "data:,logo", fontSans: "data:,fonte-sans", fontMono: "data:,fonte-mono" };

const scope: PropostaScope = {
  id: "1", criadoEm: "2026-07-10T00:00:00.000Z", status: "rascunho",
  tipo: "consolidada", template: "indeba_express",
  cliente: { razaoSocial: "Sua Empresa", cnpj: "00.000.000/0000-00", segmento: "Alimentação", responsavel: "João" },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [
    { codigo: "A", nome: "Produto A", descricaoUso: "uso A", imagemPath: "/a.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: { titulo: "TitA" } },
    { codigo: "B", nome: "Produto B", descricaoUso: "uso B", imagemPath: "/b.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "200.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: null },
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
    expect(html).toContain("APRESENTAÇÃO");
    expect(html).toContain("COMODATOS");
    expect(html).toContain("CONDIÇÕES COMERCIAIS");
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

  it("onda decorativa (wave-sec) presente em apresentação/comodatos/condições", () => {
    const html = consolidadaHtml(scope, { A: "data:,x", B: "data:,y" }, assets);
    expect(html.match(/wave-sec/g)?.length).toBeGreaterThanOrEqual(3);
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
    expect(html).toContain("WhatsApp (71) 90000-0000");
    expect(html).toContain("consultor@indeba.com.br");

    // CSS sempre define as classes; o que não pode existir é o ELEMENTO renderizado
    const semContato = consolidadaHtml(scope, { A: "d", B: "d" }, assets);
    expect(semContato).not.toContain("WhatsApp");
    expect(semContato).not.toContain('class="cc-contato"');
    expect(semContato).not.toContain("null");
  });
});
