// QA de layout do PDF — gera uma proposta com o CATÁLOGO INTEIRO (1 página por produto),
// abre no Chromium e varre as 150+ páginas procurando conteúdo cortado pelo overflow da
// página, imagem quebrada, elemento vazando a borda e colisão com a paginação. Foi assim
// que se achou o Primmax Sanap estourando a página (ficha longa demais → modo denso).
//
// NÃO roda na suíte (extensão .qa.ts, fora do include do vitest, e o CI não instala
// browsers do Playwright). Rode sob demanda:
//
//   pnpm exec playwright install chromium      # só na primeira vez
//   pnpm qa:layout
//
// Saída: generated/catalogo-completo.pdf + lista de problemas no console.
import { describe, it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { montarDocumento, renderPdf } from "@/lib/pdf/render";
import { carregarCatalogo } from "@/lib/catalogo";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope, PropostaItem } from "@/lib/contracts";

const PUBLIC = join(process.cwd(), "public");

function dataUri(rel: string): string {
  try {
    const buf = readFileSync(join(PUBLIC, rel.replace(/^\//, "")));
    const mime = rel.endsWith(".svg") ? "image/svg+xml" : rel.endsWith(".png") ? "image/png" : rel.endsWith(".woff2") ? "font/woff2" : "image/jpeg";
    return `data:${mime};base64,` + buf.toString("base64");
  } catch {
    return "";
  }
}

// Proposta-QA: TODOS os produtos do catálogo, uma página por produto.
function scopeTudo(): PropostaScope {
  const cat = carregarCatalogo();
  const itens: PropostaItem[] = cat.produtos.map((p) => ({
    codigo: p.codigo,
    nome: p.nome,
    descricaoUso: p.descricaoUso,
    imagemPath: p.imagemPath,
    // preço do catálogo quando existe; senão um valor de teste (isto é QA, não proposta real)
    embalagens: p.embalagens.map((e, i) => ({
      ...e,
      preco: e.preco ?? "100.00",
      diluicaoMax: i === 0 ? e.diluicaoMax ?? "1:100" : e.diluicaoMax,
    })),
    ficha: p.ficha ?? null,
    fichaTecnicaPath: p.fichaTecnicaPath,
    quantidade: 1,
    procedenciaSelecao: "MANUAL" as const,
    motivo: "",
  }));
  return {
    id: "qa-tudo", criadoEm: "2026-07-25T12:00:00.000Z", status: "rascunho",
    tipo: "consolidada", template: "indeba_express",
    cliente: { razaoSocial: "QA — Catálogo Completo", cnpj: "00.000.000/0001-00", segmento: "Todos", responsavel: "Gustavo" },
    textoApresentacao: { conteudo: "", procedencia: "MANUAL" },
    itens,
    condicoesComerciais: { validade: "30 dias", prazoEntrega: "15 dias", pagamento: "boleto", frete: "CIF" },
    consolidada: consolidadaDefaults({ emailConsultor: "gerencia@indebaexpress.com.br" }),
  };
}

describe("QA do catálogo completo", () => {
  it("gera o PDF e varre erros de layout no Playwright", async () => {
    const scope = scopeTudo();
    console.log("PRODUTOS:", scope.itens.length);

    const imagens: Record<string, string> = {};
    for (const it of scope.itens) {
      const cut = it.imagemPath.replace(/\.(jpe?g|png)$/i, "-cutout.png");
      imagens[it.codigo] = (cut !== it.imagemPath ? dataUri(cut) : "") || dataUri(it.imagemPath) || dataUri("/produtos/_generico.svg");
    }
    const { html } = montarDocumento(scope, imagens, "", dataUri);

    const { chromium } = await import("playwright");
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
    await page.route("**/*", (r) => (r.request().url().startsWith("data:") || r.request().url().startsWith("about:") ? r.continue() : r.abort()));
    await page.setContent("<!DOCTYPE html>" + html, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => {}))));

    const problemas = await page.evaluate(() => {
      const out: { pagina: number; tipo: string; detalhe: string }[] = [];
      const secs = Array.from(document.querySelectorAll("section"));
      secs.forEach((s, i) => {
        const pagina = i + 1;
        const el = s as HTMLElement;
        // conteúdo cortado pelo overflow:hidden da página
        if (el.scrollHeight > el.clientHeight + 1) {
          out.push({ pagina, tipo: "estouro-vertical", detalhe: `scrollHeight ${el.scrollHeight} > ${el.clientHeight} (${(el.querySelector(".pp-tit,.sec-tit,.capa-tit") as HTMLElement)?.innerText ?? ""})` });
        }
        if (el.scrollWidth > el.clientWidth + 1) {
          out.push({ pagina, tipo: "estouro-horizontal", detalhe: `scrollWidth ${el.scrollWidth} > ${el.clientWidth}` });
        }
        // imagem de produto que não carregou / placeholder genérico
        s.querySelectorAll("img").forEach((img) => {
          if (!img.complete || img.naturalWidth === 0) out.push({ pagina, tipo: "imagem-quebrada", detalhe: img.alt || img.className });
        });
        // elemento que passa da borda inferior/direita da página
        const rs = s.getBoundingClientRect();
        s.querySelectorAll<HTMLElement>(".pp-specs > *, .pp-price, .pp-contact, .pp-benes, .adv, .closing, .conds, .capa-card").forEach((c) => {
          const rc = c.getBoundingClientRect();
          if (rc.bottom > rs.bottom + 1) out.push({ pagina, tipo: "vaza-borda-inferior", detalhe: `${c.className} passa ${Math.round(rc.bottom - rs.bottom)}px` });
          if (rc.right > rs.right + 1) out.push({ pagina, tipo: "vaza-borda-direita", detalhe: `${c.className} passa ${Math.round(rc.right - rs.right)}px` });
        });
        // texto sobreposto ao rodapé de paginação
        const pg = s.querySelector<HTMLElement>(".pgnum");
        if (pg) {
          const rp = pg.getBoundingClientRect();
          s.querySelectorAll<HTMLElement>(".pt, .condi, .pill, .eq, .closing, .sign").forEach((c) => {
            const rc = c.getBoundingClientRect();
            if (rc.bottom > rp.top && rc.top < rp.bottom && rc.right > rp.left && rc.left < rp.right) {
              out.push({ pagina, tipo: "colisao-com-paginacao", detalhe: c.className });
            }
          });
        }
      });
      return out;
    });

    console.log("SEÇÕES:", await page.evaluate(() => document.querySelectorAll("section").length));
    console.log("PROBLEMAS:", problemas.length);
    for (const p of problemas.slice(0, 60)) console.log(`  p${p.pagina} [${p.tipo}] ${p.detalhe}`);
    await browser.close();

    const pdf = await renderPdf(scope);
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
    console.log("PÁGINAS NO PDF:", doc.numPages, "esperado:", scope.itens.length + 4);
    writeFileSync(join(process.cwd(), "generated", "catalogo-completo.pdf"), pdf);
  }, 600_000);
});
