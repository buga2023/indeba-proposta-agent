/**
 * QA de ponta a ponta da Proposta de Solução — roda com `pnpm exec vitest run --config
 * vitest.qa.config.ts` (não entra na suíte unitária: gera PDF de verdade, leva segundos).
 *
 * Monta uma proposta com EXATAMENTE o payload que a tela de montagem envia hoje
 * (uma embalagem cotada por item, diluição do consultor, segmento do cliente), gera o
 * PDF pelo mesmo `renderPdf` da rota /api/pdf e confere o resultado contra o catálogo
 * e contra as fichas técnicas em public/fichas-tecnicas/.
 *
 * O que ele prova, item a item da spec de ajustes (jul/2026):
 *  1. produto sem foto usa arte de recipiente compatível e a ficha diz "ilustrativa";
 *  2. o rótulo de LINHA é o segmento do cliente, não o linhaLabel do produto;
 *  3. só a embalagem escolhida sai com preço; os outros tamanhos aparecem sem valor;
 *  4. remontar com o mesmo id não cria proposta nova.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { montarPropostaEstruturada } from "@/lib/montar";
import { consolidadaHtml } from "@/lib/pdf/template-consolidada";
import { renderPdf } from "@/lib/pdf/render";
import { carregarCatalogo } from "@/lib/catalogo";
import type { PropostaScope } from "@/lib/contracts";

const SAIDA = join(process.cwd(), "tests", "__saida-qa");
const cliente = {
  razaoSocial: "Lavanderia Hospitalar Santa Clara Ltda",
  cnpj: "12.345.678/0001-90",
  segmento: "lavanderia_hospitalar",
  responsavel: "Marina Prado",
};

// Três produtos reais, cada um exercitando um caso diferente:
//  · PRIMMAX-DGCLOR — 3 tamanhos (5 L / 23 kg / 58 kg): cotamos o 23 kg, que NÃO é o
//    primeiro do catálogo — exatamente o caso que replicava preço em todos os tamanhos;
//  · TEXSPAR-DTT    — sem foto de estúdio: tem que cair na arte do balde;
//  · PRIMMAX-SANQUAT— produto pronto pra uso: sem diluição na cotada.
const ITENS = [
  { codigo: "PRIMMAX-DGCLOR", tamanho: 23, unidade: "kg" as const, preco: "77.00", diluicao: "1:100", qtd: 2 },
  { codigo: "TEXSPAR-DTT", tamanho: 20, unidade: "L" as const, preco: "150.00", diluicao: "1:50", qtd: 1 },
  { codigo: "PRIMMAX-SANQUAT", tamanho: 5, unidade: "L" as const, preco: "210.00", diluicao: null, qtd: 3 },
];

let scope: PropostaScope;
let html: string;

beforeAll(async () => {
  scope = await montarPropostaEstruturada({
    cliente,
    tipo: "consolidada",
    textoApresentacao: "Texto manual — QA (sem IA, para o resultado ser determinístico).",
    itens: ITENS.map((i) => ({
      codigo: i.codigo,
      quantidade: i.qtd,
      embalagens: [{ tamanho: i.tamanho, unidade: i.unidade, preco: i.preco, diluicaoMax: i.diluicao, custoDiluido: null }],
    })),
  });
  html = consolidadaHtml(scope, Object.fromEntries(scope.itens.map((i) => [i.codigo, ""])), {
    logo: "",
    logoWhite: "",
    fontSans: "",
    fontMono: "",
    siteUrl: "",
  });
}, 60_000);

describe("QA — proposta montada bate com o catálogo e com a spec", () => {
  it("cada item carrega UMA embalagem: a cotada, com o preço daquele tamanho", () => {
    for (const [n, it] of scope.itens.entries()) {
      expect(it.embalagens, `${it.nome}`).toHaveLength(1);
      expect(it.embalagens[0].tamanho).toBe(ITENS[n].tamanho);
      expect(it.embalagens[0].unidade).toBe(ITENS[n].unidade);
      expect(it.embalagens[0].preco).toBe(ITENS[n].preco);
    }
  });

  it("o total é Σ(preço da cotada × quantidade) — sem preço replicado por tamanho", () => {
    const esperado = ITENS.reduce((s, i) => s + Number(i.preco) * i.qtd, 0);
    const calculado = scope.itens.reduce((s, i) => s + Number(i.embalagens[0].preco) * i.quantidade, 0);
    expect(calculado).toBeCloseTo(esperado, 2);
    expect(calculado).toBeCloseTo(77 * 2 + 150 + 210 * 3, 2); // 934,00
  });

  it("tamanhos disponíveis = os do CATÁLOGO (ficha técnica), sem preço", () => {
    for (const it of scope.itens) {
      const p = carregarCatalogo().produtos.find((x) => x.codigo === it.codigo)!;
      expect(it.tamanhosDisponiveis).toEqual(p.embalagens.map((e) => ({ tamanho: e.tamanho, unidade: e.unidade })));
    }
  });

  it("a ficha lista os outros tamanhos e marca a cotada — sem valor nos demais", () => {
    // DGClor: catálogo tem 5 L, 23 kg e 58 kg. Cotamos 23 kg.
    expect(html).toContain(">23 kg<i>cotada</i>");
    expect(html).toContain(">5 L</span>");
    expect(html).toContain(">58 kg</span>");
    // o único preço do card é o da cotada
    const precos = html.match(/R\$&nbsp;|R\$ [\d.,]+/g) ?? [];
    for (const p of precos) expect(p).not.toContain("58");
  });

  it("Item 2 — a LINHA da ficha é o segmento do cliente, não o linhaLabel do produto", () => {
    expect(html).toContain("LINHA<b>LAVANDERIA HOSPITALAR</b>");
    // nenhum rótulo em inglês do catálogo sobreviveu no documento
    for (const ingles of ["KITCHEN", "LAUNDRY", "HANDWASH", "LINEN", ">AUTO<", ">FOOD<"]) {
      expect(html).not.toContain(ingles);
    }
  });

  it("Item 1 — produto sem foto usa a arte da embalagem e a ficha avisa que é ilustrativa", () => {
    const semFoto = scope.itens.find((i) => i.imagemPath.startsWith("/produtos/_"));
    expect(semFoto, "esperava ao menos um produto sem foto no cenário").toBeDefined();
    expect(semFoto!.imagemPath).toBe("/produtos/_balde-20.svg"); // Texspar DTT, 20 L
    expect(html).toContain("Imagem ilustrativa da embalagem");
    // produto COM foto real não ganha o aviso à toa
    const comFoto = scope.itens.filter((i) => !i.imagemPath.startsWith("/produtos/_"));
    expect(comFoto.length).toBeGreaterThan(0);
    expect(html.match(/Imagem ilustrativa da embalagem/g)!.length).toBe(1);
  });

  it("Item 4 — remontar com o mesmo id devolve o mesmo id (update, não duplicata)", async () => {
    const remontada = await montarPropostaEstruturada({
      id: scope.id,
      cliente,
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [{ codigo: "PRIMMAX-DGCLOR", quantidade: 1, embalagens: [{ tamanho: 23, unidade: "kg", preco: "77.00", diluicaoMax: "1:100", custoDiluido: null }] }],
    });
    expect(remontada.id).toBe(scope.id);
  });

  it("a ficha técnica linkada existe mesmo em public/ para todo item que a declara", () => {
    for (const it of scope.itens) {
      if (!it.fichaTecnicaPath) continue;
      expect(existsSync(join(process.cwd(), "public", it.fichaTecnicaPath)), it.fichaTecnicaPath).toBe(true);
    }
  });

  it("gera o PDF de verdade (mesmo caminho da rota /api/pdf)", async () => {
    const pdf = await renderPdf(scope);
    expect(pdf.length).toBeGreaterThan(50_000);
    writeFileSync(join(SAIDA, "proposta-qa.pdf"), pdf);
  }, 180_000);
});
