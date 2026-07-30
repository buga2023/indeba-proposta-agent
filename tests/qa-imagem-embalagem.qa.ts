// QA da imagem × embalagem cotada no PDF FINAL — os 8 casos-âncora da spec de QA de
// navegador (docs/spec-qa-navegador-imagem-embalagem.md, §7). Monta a proposta pelo mesmo
// caminho da tela manual (montarPropostaEstruturada), renderiza com o motor do servidor e
// verifica no documento:
//
//   - a imagem de cada item é a esperada para o TAMANHO cotado (chave = codigo#tamanhounidade);
//   - "Imagem ilustrativa da embalagem" aparece exatamente nos itens em ARTE (invariante
//     selo ⟺ arte, que o preview da tela quebrava até 29/07).
//
// NÃO roda na suíte (extensão .qa.ts, fora do include do vitest; o CI não instala browsers
// do Playwright). Sob demanda:
//
//   pnpm exec playwright install chromium      # só na primeira vez
//   pnpm exec vitest run --config vitest.qa.config.ts tests/qa-imagem-embalagem.qa.ts
//
// Saída: generated/qa-imagem-embalagem.pdf (8 páginas de ficha, uma por âncora).
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { montarPropostaEstruturada } from "@/lib/montar";
import { montarDocumento, renderPdf, resolverImagemProduto } from "@/lib/pdf/render";
import { carregarCatalogo } from "@/lib/catalogo";
import { chaveImagem, imagemEhIlustrativa } from "@/lib/imagem-produto";
import type { PropostaScope, Produto } from "@/lib/contracts";

const LEGENDA = "Imagem ilustrativa da embalagem";

// O arquivo existe em public/? (o render cai no placeholder genérico quando não existe)
const temArquivo = (rel: string) => existsSync(join("public", rel.replace(/^\//, "")));


// Mesmo embutimento do render do servidor (dataUri lá não é exportado).
function dataUriLocal(rel: string): string {
  try {
    const buf = readFileSync(join("public", rel.replace(/^\//, "")));
    const mime = rel.endsWith(".svg") ? "image/svg+xml" : rel.endsWith(".png") ? "image/png" : rel.endsWith(".woff2") ? "font/woff2" : "image/jpeg";
    return `data:${mime};base64,` + buf.toString("base64");
  } catch {
    return "";
  }
}

// Os 8 âncoras: cobrem os 4 ramos da regra + a regressão do chaveImagem (Autocar nos dois).
const ANCORAS = [
  { codigo: "TEXSPAR-DSA", tamanho: 20, unidade: "L" as const, esperado: "/produtos/texspar-dsa-balde.png" },
  { codigo: "TEXSPAR-DSA", tamanho: 50, unidade: "L" as const, esperado: "/produtos/texspar-dsa.png" },
  { codigo: "TEXSPAR-DTC", tamanho: 20, unidade: "L" as const, esperado: "/produtos/_balde-20.svg" },
  { codigo: "TEXSPAR-DTT", tamanho: 50, unidade: "L" as const, esperado: "/produtos/_tonel-50.svg" },
  { codigo: "AUTOCAR-PLUS", tamanho: 200, unidade: "kg" as const, esperado: "/produtos/autocar-plus-tambor.png" },
  { codigo: "AUTOCAR-PLUS", tamanho: 20, unidade: "kg" as const, esperado: "/produtos/autocar-plus.png" },
  { codigo: "CITY-T-LIQUIDO", tamanho: 5, unidade: "L" as const, esperado: "/produtos/city-t-liquido-galao.png" },
  { codigo: "SOFTS-MAX-KARICIA", tamanho: 20, unidade: "L" as const, esperado: "/produtos/_balde-20.svg" },
];

async function scopeDosAncoras(): Promise<PropostaScope> {
  return montarPropostaEstruturada({
    tipo: "consolidada",
    cliente: { razaoSocial: "QA Imagem — âncoras", cnpj: null, segmento: "Indústria Alimentícia", responsavel: "QA" },
    textoApresentacao: "Proposta de QA — verificação de imagem por embalagem cotada.",
    itens: ANCORAS.map((a) => ({
      codigo: a.codigo,
      quantidade: 1,
      // exatamente o payload da tela manual: sem imagemPath na embalagem
      embalagens: [{ tamanho: a.tamanho, unidade: a.unidade, preco: "100.00", diluicaoMax: "1:100", custoDiluido: null }],
    })),
  });
}

describe("QA — imagem × embalagem cotada no documento final", () => {
  it("cada âncora sai com a imagem do TAMANHO cotado", async () => {
    const scope = await scopeDosAncoras();
    const entregue = scope.itens.map((it, i) => `${it.codigo} ${ANCORAS[i].tamanho}${ANCORAS[i].unidade}: ${it.imagemPath}`);
    const esperado = ANCORAS.map((a) => `${a.codigo} ${a.tamanho}${a.unidade}: ${a.esperado}`);
    expect(entregue).toEqual(esperado);
  });

  it("mesmo produto em dois tamanhos = duas imagens no mapa do PDF (chaveImagem)", async () => {
    const scope = await scopeDosAncoras();
    const autocar = scope.itens.filter((it) => it.codigo === "AUTOCAR-PLUS");
    expect(autocar).toHaveLength(2);
    expect(chaveImagem(autocar[0])).not.toBe(chaveImagem(autocar[1]));
    expect(autocar[0].imagemPath).not.toBe(autocar[1].imagemPath);
  });

  it("legenda 'Imagem ilustrativa' aparece exatamente nos itens em ARTE", async () => {
    const scope = await scopeDosAncoras();
    const imagens: Record<string, string> = {};
    for (const item of scope.itens) {
      imagens[chaveImagem(item)] = (await resolverImagemProduto(item.imagemPath)) || "data:,";
    }
    const { html } = montarDocumento(scope, imagens, "", () => "");

    const emArte = scope.itens.filter((it) => imagemEhIlustrativa(it.imagemPath));
    expect(emArte.map((it) => it.codigo)).toEqual(["TEXSPAR-DTC", "TEXSPAR-DTT", "SOFTS-MAX-KARICIA"]);
    // uma legenda por item em arte — nem a mais (foto rotulada de desenho), nem a menos
    expect(html.split(LEGENDA).length - 1).toBe(emArte.length);
  });

  // Conferência VISUAL: uma imagem por ficha, para olhar se o recipiente desenhado/
  // fotografado é mesmo o do tamanho impresso ao lado. É o que nenhuma comparação de
  // string pega (catálogo que mente sobre a foto).
  it("captura a ficha de cada âncora em PNG", async () => {
    const scope = await scopeDosAncoras();
    const imagens: Record<string, string> = {};
    for (const item of scope.itens) {
      imagens[chaveImagem(item)] = (await resolverImagemProduto(item.imagemPath)) || dataUriLocal(item.imagemPath);
    }
    const { html } = montarDocumento(scope, imagens, dataUriLocal("/marca/header-ies.png"), dataUriLocal);

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
      await page.setContent("<!DOCTYPE html>" + html, { waitUntil: "networkidle" });
      mkdirSync(join("generated", "qa-fichas"), { recursive: true });
      const fichas = await page.locator(".prodpg").all();
      expect(fichas.length).toBe(scope.itens.length);
      for (let i = 0; i < fichas.length; i++) {
        const a = ANCORAS[i];
        await fichas[i].screenshot({ path: join("generated", "qa-fichas", `${i + 1}-${a.codigo}-${a.tamanho}${a.unidade}.png`) });
      }
      console.log(`fichas capturadas em generated/qa-fichas (${fichas.length})`);
    } finally {
      await browser.close();
    }
  }, 180_000);

  it("gera o PDF dos âncoras para conferência visual", async () => {
    const scope = await scopeDosAncoras();
    const pdf = await renderPdf(scope);
    mkdirSync("generated", { recursive: true });
    const destino = join("generated", "qa-imagem-embalagem.pdf");
    writeFileSync(destino, pdf);
    expect(pdf.length).toBeGreaterThan(50_000);
    console.log(`PDF de QA: ${destino} (${(pdf.length / 1024).toFixed(0)} KB)`);
  }, 120_000);
});

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO INTEIRO: um item por par (produto, embalagem) — 198 fichas em 29/07. É a
// Camada B da spec de navegador levada até o PDF: não só "o scope montado tem a imagem
// certa", mas "o documento final imprime a imagem certa, com a legenda certa, sem imagem
// quebrada". Cada par vira uma linha própria, então o mapa de imagens do PDF (chaveImagem)
// é exercitado no pior caso: o mesmo produto aparece até 3 vezes, em tamanhos diferentes.
// ─────────────────────────────────────────────────────────────────────────────

const arte = (t: number, u: string) =>
  u === "ml" ? "_frasco" : u === "un" ? "_generico"
  : t <= 1 ? "_frasco" : t <= 9 ? "_galao-5l" : t <= 29 ? "_balde-20"
  : t <= 119 ? "_tonel-50" : t <= 600 ? "_tambor-200" : "_ibc-1000";

// Oráculo independente da implementação (espelha a regra da spec, não chama o lib).
function imagemEsperada(p: Produto, e: Produto["embalagens"][number]): string {
  if (e.imagemPath) return e.imagemPath;
  if (imagemEhIlustrativa(p.imagemPath)) return `/produtos/${arte(e.tamanho, e.unidade)}.svg`;
  if (!p.fotoEmbalagem) return p.imagemPath;
  return arte(e.tamanho, e.unidade) === arte(p.fotoEmbalagem.tamanho, p.fotoEmbalagem.unidade)
    ? p.imagemPath
    : `/produtos/${arte(e.tamanho, e.unidade)}.svg`;
}

const PARES = carregarCatalogo().produtos.flatMap((p) => p.embalagens.map((e) => ({ p, e })));

async function scopeDoCatalogo(): Promise<PropostaScope> {
  return montarPropostaEstruturada({
    tipo: "consolidada",
    cliente: { razaoSocial: "QA — Catálogo inteiro por embalagem", cnpj: null, segmento: "Todos", responsavel: "QA" },
    textoApresentacao: "Proposta de QA — uma ficha por par (produto, embalagem cotada).",
    itens: PARES.map(({ p, e }) => ({
      codigo: p.codigo,
      quantidade: 1,
      embalagens: [{ tamanho: e.tamanho, unidade: e.unidade, preco: e.preco ?? "100.00", diluicaoMax: e.diluicaoMax ?? "1:100", custoDiluido: null }],
    })),
  });
}

describe("QA — catálogo inteiro, uma ficha por embalagem", () => {
  it("toda ficha sai com a imagem do seu tamanho (198 pares contra o oráculo)", async () => {
    const scope = await scopeDoCatalogo();
    expect(scope.itens).toHaveLength(PARES.length);
    const divergentes = scope.itens
      .map((it, i) => ({ it, alvo: imagemEsperada(PARES[i].p, PARES[i].e), par: PARES[i] }))
      .filter(({ it, alvo }) => it.imagemPath !== alvo)
      .map(({ it, alvo, par }) => `${it.nome} ${par.e.tamanho}${par.e.unidade}: ${it.imagemPath} (esperado ${alvo})`);
    expect(divergentes).toEqual([]);
  });

  it("o mapa de imagens do PDF não colide: uma entrada por par", async () => {
    const scope = await scopeDoCatalogo();
    const chaves = new Set(scope.itens.map(chaveImagem));
    expect(chaves.size).toBe(scope.itens.length);
  });

  it("nenhuma imagem quebrada e legenda exatamente nos itens em arte", async () => {
    const scope = await scopeDoCatalogo();
    const imagens: Record<string, string> = {};
    const semArquivo: string[] = [];
    for (const item of scope.itens) {
      if (!temArquivo(item.imagemPath)) semArquivo.push(`${item.nome}: ${item.imagemPath}`);
      imagens[chaveImagem(item)] = (await resolverImagemProduto(item.imagemPath)) || "data:,";
    }
    expect(semArquivo).toEqual([]); // nada cai no placeholder genérico

    const { html } = montarDocumento(scope, imagens, "", () => "");
    const emArte = scope.itens.filter((it) => imagemEhIlustrativa(it.imagemPath));
    console.log(`fichas: ${scope.itens.length} · em arte: ${emArte.length} · com foto: ${scope.itens.length - emArte.length}`);
    expect(html.split(LEGENDA).length - 1).toBe(emArte.length);
  }, 180_000);

  // Folha de contato: a imagem que VAI para a ficha, com o tamanho cotado embaixo. É a
  // única checagem que pega catálogo mentindo sobre a foto (path certo, recipiente errado)
  // — nenhuma comparação de string enxerga isso. 24 pares por folha.
  it("gera a folha de contato dos 198 pares para conferência visual", async () => {
    const scope = await scopeDoCatalogo();
    const cards = scope.itens.map((it, i) => {
      const e = it.embalagens[0];
      return {
        n: i + 1,
        nome: it.nome,
        rotulo: `${e.tamanho} ${e.unidade}`,
        uri: dataUriLocal(it.imagemPath),
        arquivo: it.imagemPath.split("/").pop() ?? "",
        arte: imagemEhIlustrativa(it.imagemPath),
      };
    });

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
      mkdirSync(join("generated", "qa-folha"), { recursive: true });
      const POR_FOLHA = 24;
      for (let f = 0; f * POR_FOLHA < cards.length; f++) {
        const lote = cards.slice(f * POR_FOLHA, (f + 1) * POR_FOLHA);
        const html = `<body style="margin:0;background:#fff;font:12px/1.25 system-ui">
          <div id="g" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;padding:6px">
          ${lote.map((c) => `<div style="border:1px solid #ddd;border-radius:6px;padding:5px;text-align:center">
            <div style="height:110px;display:flex;align-items:center;justify-content:center">
              <img src="${c.uri}" style="max-width:100%;max-height:108px;object-fit:contain">
            </div>
            <div style="font-weight:700;font-size:11px">${c.n}. ${c.nome}</div>
            <div style="font-size:15px;color:#0b4f8a;font-weight:800">${c.rotulo}</div>
            <div style="color:#999;font-size:9px">${c.arquivo}</div>
            <div style="color:${c.arte ? "#b45309" : "#16a34a"};font-size:9px;font-weight:700">${c.arte ? "ARTE" : "FOTO"}</div>
          </div>`).join("")}
          </div></body>`;
        await page.setContent(html, { waitUntil: "networkidle" });
        await page.locator("#g").screenshot({ path: join("generated", "qa-folha", `folha-${String(f + 1).padStart(2, "0")}.png`) });
      }
      console.log(`folha de contato: ${Math.ceil(cards.length / POR_FOLHA)} imagens em generated/qa-folha`);
    } finally {
      await browser.close();
    }
  }, 300_000);

  it("gera o PDF do catálogo inteiro por embalagem", async () => {
    const scope = await scopeDoCatalogo();
    const pdf = await renderPdf(scope);
    mkdirSync("generated", { recursive: true });
    const destino = join("generated", "qa-imagem-catalogo.pdf");
    writeFileSync(destino, pdf);
    console.log(`PDF do catálogo: ${destino} (${(pdf.length / 1024 / 1024).toFixed(1)} MB, ${scope.itens.length} fichas)`);
    expect(pdf.length).toBeGreaterThan(500_000);
  }, 600_000);
});
