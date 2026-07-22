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

  it("'Embalagens disponíveis' lista TODOS os tamanhos, incluindo a cotada, sempre sem preço (spec §8, decisão final: repetição permitida)", () => {
    const html = paginaProduto(item, "data:,x");
    expect(html).toContain("Embalagens disponíveis");
    expect(html).toContain('<span class="pp-emb-chip">5 L</span>'); // a cotada (5L) TAMBÉM aparece ali, sem preço
    expect(html).toContain('<span class="pp-emb-chip">20 L</span>');
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
    const pos5L = html.indexOf('<span class="pp-emb-chip">5 L</span>');
    const pos20L = html.indexOf('<span class="pp-emb-chip">20 L</span>');
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
