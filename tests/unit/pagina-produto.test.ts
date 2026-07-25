import { describe, it, expect } from "vitest";
import { paginaProduto } from "@/lib/pdf/template-consolidada";
import type { PropostaItem } from "@/lib/contracts";

const item: PropostaItem = {
  codigo: "PRIMMAX-PLUS",
  nome: "Primmax Plus",
  descricaoUso: "Lavar louças e pisos.",
  imagemPath: "/produtos/primmax-plus.png",
  embalagens: [
    { tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: "1:100", custoDiluido: "0.26" },
    { tamanho: 20, unidade: "L", preco: "480.00", diluicaoMax: "1:100", custoDiluido: "0.24" },
  ],
  quantidade: 1,
  procedenciaSelecao: "MANUAL",
  motivo: "",
  fichaTecnicaPath: null,
  ficha: {
    titulo: "Detergente Desengordurante",
    subtitulo: "Alcalino Concentrado",
    linhaLabel: "KITCHEN",
    descricao: "Remove as gorduras mais difíceis.",
    indicadoPara: [{ label: "Cozinhas industriais", icone: "cozinha" }],
    beneficios: ["Remove gordura pesada", "Alto rendimento"],
    diluicoes: [{ uso: "Limpeza pesada", razao: "1:20" }],
    rendimento: "Até 100 litros",
    caracteristicas: { pH: "12,5 – 13,5", cor: "Esverdeado", aspecto: "Líquido", odor: "Característico", uso: "Profissional" },
  },
};

describe("paginaProduto", () => {
  it("renderiza título, benefícios, diluição, características e preço da embalagem cotada", () => {
    const html = paginaProduto(item, "data:image/png;base64,AAAA");
    expect(html).toContain("Detergente Desengordurante");
    expect(html).toContain("Alcalino Concentrado");
    expect(html).toContain("KITCHEN");
    expect(html).toContain("Remove gordura pesada");
    expect(html).toContain("Limpeza pesada");
    expect(html).toContain("1:20");
    expect(html).toContain("12,5 – 13,5"); // pH
    expect(html).toContain("R$ 130,00");
    expect(html).toContain('class="prodpg"'); // a quebra de página vem do CSS de consolidadaHtml
  });

  it("mostra só o preço da embalagem cotada (embalagens[0]) — nunca mais de um preço no card", () => {
    const html = paginaProduto(item, "data:,x");
    expect(html).toContain("R$ 130,00"); // 1ª embalagem (5 L, cotada) — com preço
    expect(html).not.toContain("R$ 480,00"); // 2ª embalagem (20 L) — nunca aparece com preço
  });

  it("mostra o valor por litro diluído da embalagem cotada, com a diluição informada na montagem", () => {
    const html = paginaProduto(item, "data:,x");
    // 5 L a R$ 130,00 → R$ 26,00/L de produto; diluição da cotada 1:100 → R$ 0,26 por litro de solução
    expect(html).toContain("Valor por litro diluído");
    expect(html).toContain("R$ 0,26");
    expect(html).toContain("diluição de 1:100");
  });

  it("sem diluição na embalagem cotada, não inventa valor por litro diluído (nem tira da ficha)", () => {
    const semDiluicao: PropostaItem = {
      ...item,
      embalagens: [{ tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: null, custoDiluido: null }],
    };
    const html = paginaProduto(semDiluicao, "data:,x");
    expect(html).not.toContain("Valor por litro diluído");
    expect(html).toContain("Modo de diluição"); // a ficha continua descrevendo a diluição
  });

  it("'Embalagens disponíveis' lista TODOS os tamanhos, incluindo a cotada, sempre sem preço (spec §8, decisão final: repetição permitida)", () => {
    const html = paginaProduto(item, "data:,x");
    expect(html).toContain("Embalagens disponíveis");
    expect(html).toContain('<span class="pp-emb-chip pp-emb-cotada">5 L<i>cotada</i></span>'); // a cotada (5L) aparece ali, sem preço, com selo
    expect(html).toContain('<span class="pp-emb-chip">20 L</span>');
  });

  it("marca a embalagem COTADA na lista de disponíveis (e só ela)", () => {
    const html = paginaProduto(item, "data:,x");
    expect(html.match(/pp-emb-cotada/g)?.length).toBe(1);
    expect(html).toContain("<i>cotada</i>");

    // troca a cotada: o selo acompanha embalagens[0], não o tamanho
    const cotada20: PropostaItem = { ...item, embalagens: [item.embalagens[1], item.embalagens[0]] };
    expect(paginaProduto(cotada20, "data:,x")).toContain('<span class="pp-emb-chip pp-emb-cotada">20 L<i>cotada</i></span>');
  });

  // kg conta como litro na ordenação (densidade ~1): sem isso "23 kg" (23) vinha antes de
  // "5 L" (5000) e o Primmax DGClor listava 23 kg · 58 kg · 5 L.
  it("ordena tamanhos em kg junto com os em litro", () => {
    const emKg: PropostaItem = {
      ...item,
      embalagens: [
        { tamanho: 5, unidade: "L", preco: "120.00", diluicaoMax: "1:100", custoDiluido: null },
        { tamanho: 23, unidade: "kg", preco: "500.00", diluicaoMax: null, custoDiluido: null },
        { tamanho: 58, unidade: "kg", preco: "1200.00", diluicaoMax: null, custoDiluido: null },
      ],
    };
    const html = paginaProduto(emKg, "data:,x");
    expect(html.indexOf("5 L<i>cotada</i>")).toBeLessThan(html.indexOf("23 kg"));
    expect(html.indexOf("23 kg")).toBeLessThan(html.indexOf("58 kg"));
  });

  it("ordena 'Embalagens disponíveis' por volume crescente, independente da ordem no payload", () => {
    const foraDeOrdem: PropostaItem = {
      ...item,
      embalagens: [
        { tamanho: 20, unidade: "L", preco: "480.00", diluicaoMax: "1:100", custoDiluido: "0.24" },
        { tamanho: 500, unidade: "ml", preco: "30.00", diluicaoMax: null, custoDiluido: null },
        { tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: "1:100", custoDiluido: "0.26" },
      ],
    };
    const html = paginaProduto(foraDeOrdem, "data:,x");
    const posMl = html.indexOf("500 ml");
    const pos5L = html.indexOf(">5 L</span>");
    const pos20L = html.indexOf("20 L<i>cotada</i>"); // 20 L é a cotada nesse payload
    expect(posMl).toBeLessThan(pos5L); // 500 ml < 5 L
    expect(pos5L).toBeLessThan(pos20L);
  });

  it("degrada com elegância quando não há ficha (usa nome + descricaoUso + preço)", () => {
    const semFicha = { ...item, ficha: null };
    const html = paginaProduto(semFicha, "data:image/png;base64,AAAA");
    expect(html).toContain("Primmax Plus");
    expect(html).toContain("R$ 130,00");
    expect(html).not.toContain("undefined");
  });

  it("rodapé: slogan fixo sempre; WhatsApp + e-mail só quando presentes no payload", () => {
    const html = paginaProduto(item, "data:,x", { whatsapp: "(71) 90000-0000", emailConsultor: "consultor@indeba.com.br" });
    expect(html).toContain("Qualidade Profissional");
    expect(html).toContain("WhatsApp (71) 90000-0000");
    expect(html).toContain("consultor@indeba.com.br");

    // sem contato: rodapé existe, mas nenhum telefone/e-mail (nunca dado fictício)
    for (const sem of [paginaProduto(item, "data:,x", { whatsapp: null, emailConsultor: null }), paginaProduto(item, "data:,x")]) {
      expect(sem).toContain("Qualidade Profissional");
      expect(sem).not.toContain("WhatsApp");
      expect(sem).not.toContain("@indeba");
    }
  });

  it("produto com ficha completa NÃO usa o layout compacto (prodpg-simples)", () => {
    const html = paginaProduto(item, "data:,x");
    expect(html).not.toContain("prodpg-simples");
  });

  it("produto sem ficha e sem diluição na embalagem (ex.: Pratt/Dermol) usa o layout compacto", () => {
    const semFicha = { ...item, embalagens: [{ tamanho: 800, unidade: "ml" as const, preco: "20.00", diluicaoMax: null, custoDiluido: null }], ficha: null };
    expect(paginaProduto(semFicha, "data:,x")).toContain("prodpg-simples");

    const fichaRasa = { ...semFicha, ficha: { titulo: "Só título" } };
    expect(paginaProduto(fichaRasa, "data:,x")).toContain("prodpg-simples");
  });

  it("Embalagens Disponíveis sempre aparece, mesmo no layout compacto (regressão da rodada 2)", () => {
    const semFicha = { ...item, ficha: null };
    const html = paginaProduto(semFicha, "data:,x");
    expect(html).toContain("Embalagens disponíveis");
  });

  it("sem ficha.diluicoes mas com diluicaoMax na EMBALAGEM (ex.: Primmax LDF/Hort) — mostra diluição real, não fica 'simples'", () => {
    // item já tem diluicaoMax:"1:100" nas embalagens; sem ficha, esse dado real de catálogo
    // (não inventado) deve aparecer, e o produto NÃO deve cair no layout ultra-compacto.
    const semFicha = { ...item, ficha: null };
    const html = paginaProduto(semFicha, "data:,x");
    expect(html).toContain("Modo de diluição");
    expect(html).toContain("1:100");
    expect(html).not.toContain("prodpg-simples");
  });

  it("sem linha definida na ficha, não renderiza eyebrow vazio (.pp-eyebrow)", () => {
    const semLinha = { ...item, ficha: { ...item.ficha, linhaLabel: undefined } };
    const html = paginaProduto(semLinha, "data:,x");
    expect(html).not.toContain('class="pp-eyebrow"');
  });

  it("com linha definida, renderiza o eyebrow da rail com o badge", () => {
    const html = paginaProduto(item, "data:,x");
    expect(html).toContain('class="pp-eyebrow"');
    expect(html).toContain("KITCHEN");
  });

  it("com características/rendimento mas sem indicado-para/benefícios, usa o layout 'sem-venda' (nem simples nem padrão) e mantém o grid técnico", () => {
    const semVenda = { ...item, ficha: { ...item.ficha, indicadoPara: undefined, beneficios: undefined } };
    const html = paginaProduto(semVenda, "data:,x");
    expect(html).toContain("prodpg-sem-venda");
    expect(html).not.toContain("prodpg-simples");
    expect(html).toContain("Características");
    expect(html).toContain("Rendimento aproximado");
  });

  it("numeração (runmark 'Proposta de Solução NN') só aparece quando passada — nunca inventada aqui", () => {
    expect(paginaProduto(item, "data:,x")).not.toContain("pp-runmark");
    expect(paginaProduto(item, "data:,x", undefined, "07")).toContain("Proposta de Solução <b>07</b>");
  });
});
