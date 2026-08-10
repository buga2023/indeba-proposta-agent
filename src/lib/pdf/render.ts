import { readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import type { Browser } from "playwright-core";
import type { PropostaScope } from "../contracts";
import { chaveImagem } from "../imagem-produto";
import { documentoHtml } from "./template";
import { orcamentoHtml } from "./template-orcamento";
import { comercialHtml } from "./template-comercial";
import { consolidadaHtml, MARGEM_INFERIOR_CONSOLIDADA } from "./template-consolidada";

// Abre o navegador conforme o ambiente:
//  - Vercel (serverless): Chromium enxuto do @sparticuz/chromium + playwright-core.
//  - Local/on-premise: Playwright completo (browser já instalado).
// Import dinâmico para não empacotar o binário errado em cada alvo.
async function abrirNavegador(): Promise<Browser> {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: pw } = await import("playwright-core");
    return pw.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { chromium: pw } = await import("playwright");
  return pw.launch();
}

const PUBLIC_DIR = join(process.cwd(), "public");
const EXT_PERMITIDAS = /\.(png|jpe?g|svg|webp|woff2)$/i;

// Resolve um caminho DENTRO de public/ e rejeita path traversal. `imagemPath`
// chega do cliente (o PropostaScope é postado em /api/pdf), então é dado não
// confiável: sem isso, "/../.env" leria arquivos arbitrários do disco (LFI).
export function dentroDePublic(relPath: string): string | null {
  if (typeof relPath !== "string" || !EXT_PERMITIDAS.test(relPath)) return null;
  const abs = resolve(PUBLIC_DIR, "." + (relPath.startsWith("/") ? relPath : "/" + relPath));
  if (abs !== PUBLIC_DIR && !abs.startsWith(PUBLIC_DIR + sep)) return null;
  return abs;
}

// Lê um asset de public/ e devolve como data-URI (Chromium headless não resolve
// caminhos relativos via setContent). Detecta o mime pela extensão.
function dataUri(relPath: string): string {
  const abs = dentroDePublic(relPath);
  if (!abs) return "";
  try {
    const buf = readFileSync(abs);
    const lower = abs.toLowerCase();
    const mime = lower.endsWith(".svg")
      ? "image/svg+xml"
      : lower.endsWith(".png")
        ? "image/png"
        : lower.endsWith(".woff2")
          ? "font/woff2"
          : "image/jpeg";
    return `data:${mime};base64,` + buf.toString("base64");
  } catch {
    return "";
  }
}

// A foto de estúdio vem com MUITA margem transparente em volta: o recorte preserva a
// tela original do fotógrafo (750x900), e o recipiente ocupa só ~1/3 dela. Como o card
// da ficha escala o ARQUIVO (object-fit), essa moldura vazia virava branco morto dentro
// do card e o produto saía minúsculo. Aqui o arquivo é recortado na caixa do que
// realmente tem pixel — daí o card enquadra o produto, não a tela do fotógrafo.
//
// `trim()` usa o pixel do canto como fundo: em PNG recortado isso é o transparente, e o
// threshold baixo preserva sombra/reflexo (que fazem parte da foto). Qualquer falha do
// sharp devolve o arquivo original — imagem sempre sai, no pior caso do jeito antigo.
async function recortarMargem(buf: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import("sharp")).default;
    return await sharp(buf).trim({ threshold: 10 }).png({ compressionLevel: 9 }).toBuffer();
  } catch {
    return buf;
  }
}

// Recorte é caro (decodifica + reencoda PNG) e o mesmo produto reaparece em propostas
// diferentes: cache por caminho, vivo enquanto o processo viver.
const cacheRecorte = new Map<string, string>();

// Foto de produto SEM cutout também passa pelo recorte de margem: sem isso, na mesma
// proposta o produto com cutout saía enquadrado no card e o sem cutout saía minúsculo
// dentro da moldura de estúdio — as "artes saindo diferentes nas páginas" (CEO, ago/2026).
// SVG (artes de recipiente) não passa pelo sharp — segue direto como data-URI.
async function dataUriFotoProduto(relPath: string): Promise<string> {
  if (!/\.(png|jpe?g|webp)$/i.test(relPath)) return dataUri(relPath);
  const cacheado = cacheRecorte.get(relPath);
  if (cacheado !== undefined) return cacheado;
  const abs = dentroDePublic(relPath);
  let uri = "";
  if (abs) {
    try {
      const sharp = (await import("sharp")).default;
      const buf = await sharp(readFileSync(abs)).trim({ threshold: 10 }).png({ compressionLevel: 9 }).toBuffer();
      uri = "data:image/png;base64," + buf.toString("base64");
    } catch {
      uri = dataUri(relPath); // sharp indisponível/foto sem margem aparável: sai como está
    }
  }
  cacheRecorte.set(relPath, uri);
  return uri;
}

// Fotos com fundo removido (recorte automático + revisão visual, jul/2026) vivem ao
// lado do original, mesmo nome + sufixo "-cutout.png" — usadas no card claro da ficha
// de produto (consolidada) pra evitar a "caixa branca" do fundo de estúdio original
// colidindo com o card. Nem toda foto tem uma boa (bordas translúcidas corroem no
// recorte) — cai pro original nesse caso, sem quebrar.
export async function resolverImagemProduto(imagemPath: string): Promise<string> {
  const cutoutPath = imagemPath.replace(/\.(jpe?g|png)$/i, "-cutout.png");
  if (cutoutPath === imagemPath) return "";
  const cacheado = cacheRecorte.get(cutoutPath);
  if (cacheado !== undefined) return cacheado;

  const abs = dentroDePublic(cutoutPath);
  let uri = "";
  if (abs) {
    try {
      uri = "data:image/png;base64," + (await recortarMargem(readFileSync(abs))).toString("base64");
    } catch {
      uri = ""; // sem cutout no disco: o chamador cai na imagem original
    }
  }
  cacheRecorte.set(cutoutPath, uri);
  return uri;
}

// Rodapé institucional repetido em toda página (Playwright footerTemplate).
const FOOTER = `
<div style="width:100%;font-family:Arial,sans-serif;font-size:7px;color:#5b6b82;padding:0 12mm;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #e3e8ef;">
  <span>Rua Cosme de Farias, 05 — Galpão 01, Boca do Rio, Salvador — BA · CEP 41710-010 · (71) 3369-2306</span>
  <span>Página <span class="pageNumber"></span>/<span class="totalPages"></span></span>
</div>`;

// Rodapé enxuto (só paginação) para Orçamento e Comercial — esses já têm cabeçalho próprio.
const FOOTER_PAG = `
<div style="width:100%;font-family:Arial,sans-serif;font-size:7px;color:#9aa7b8;padding:0 12mm;text-align:right;">
  Página <span class="pageNumber"></span>/<span class="totalPages"></span>
</div>`;

// Escolhe template, rodapé e margem superior conforme o tipo de proposta.
export function montarDocumento(
  scope: PropostaScope,
  imagens: Record<string, string>,
  banner: string,
  asset: (p: string) => string,
): { html: string; footer: string; marginTop: string; marginBottom?: string } {
  switch (scope.tipo) {
    case "orcamento":
      return { html: orcamentoHtml(scope), footer: FOOTER_PAG, marginTop: "12mm" };
    case "consolidada":
      // Logo Indeba Express (IES) — é a marca do modelo consolidado refinado.
      // Tipografia da marca (Geist/Geist Mono, mesma do app) embutida como data-URI —
      // o render bloqueia requisição externa (route abort acima), então não dá pra
      // carregar de CDN: tem que vir embutida, igual às imagens.
      return {
        html: consolidadaHtml(scope, imagens, {
          logo: asset("/marca/indeba-express-logo.png"),
          logoWhite: asset("/marca/indeba-express-logo-white.png"),
          fontSans: asset("/fonts/geist-sans-variable.woff2"),
          fontMono: asset("/fonts/geist-mono-variable.woff2"),
          siteUrl: process.env.SITE_URL || "",
          // Timbre "es" (Fase E): símbolo da logo a 2,8% de opacidade na capa e seções.
          simbolo: asset("/marca/indeba-express-simbolo.png"),
        }),
        // Sem rodapé nativo: a paginação da Consolidada é desenhada no próprio HTML
        // (.pgnum). O rodapé do Chromium só existe dentro da margem inferior, e é
        // justamente essa margem que virava a faixa branca cortando o fundo de toda
        // página — com margem 0 o desenho sangra até a borda.
        footer: "",
        marginTop: "0mm",
        marginBottom: `${MARGEM_INFERIOR_CONSOLIDADA}mm`,
      };
    case "comercial":
      return {
        html: comercialHtml(scope, imagens, {
          logo: asset("/marca/indeba-logo.png"),
          institucional: asset("/marca/dengo-institucional.png"),
          experienciaSegura: asset("/marca/dengo-experiencia-segura.png"),
        }),
        footer: FOOTER_PAG,
        marginTop: "8mm",
      };
    default:
      // Implantação (Modelo A): fechamento usa imagens opcionais (Seko Pro Max /
      // painel EPI) se existirem em public/marca; senão o template cai num bloco textual.
      return {
        html: documentoHtml(scope, imagens, banner, {
          seko: asset("/marca/seko-promax.png"),
          painelEpi: asset("/marca/painel-epi.png"),
          logoExpress: asset("/marca/indeba-express-logo.png"),
          simboloExpress: asset("/marca/indeba-express-simbolo.png"),
        }),
        footer: FOOTER,
        marginTop: "6mm",
      };
  }
}

// Produto cadastrado pela tela guarda a foto no Postgres, não em public/ — o `imagemPath`
// dele é a rota que serve os bytes. `dentroDePublic` (com razão) rejeita esse caminho, então
// sem isto o produto novo sairia no PDF com a arte genérica, apesar de ter foto cadastrada.
// O PDF é montado no servidor, então dá para ler do banco direto, sem passar pela rota.
async function dataUriDoBanco(caminho: string): Promise<string> {
  const { codigoDaRotaDeImagem, imagemDoProduto } = await import("@/lib/produto-custom");
  const codigo = codigoDaRotaDeImagem(caminho);
  if (!codigo) return "";
  try {
    const img = await imagemDoProduto(codigo);
    return img ? `data:${img.mime};base64,` + img.bytes.toString("base64") : "";
  } catch {
    return ""; // banco fora do ar: cai no genérico, o PDF continua saindo
  }
}

// PropostaScope → HTML → Chromium headless → PDF (motor estilo editorial-pdf).
export async function renderPdf(scope: PropostaScope): Promise<Buffer> {
  // Foto vem da base (catálogo). Enquanto faltar, cai no placeholder — nunca quebra.
  const generico = dataUri("/produtos/_generico.svg");
  const imagens: Record<string, string> = {};
  for (const item of scope.itens) {
    imagens[chaveImagem(item)] =
      (await resolverImagemProduto(item.imagemPath)) ||
      (await dataUriFotoProduto(item.imagemPath)) ||
      (await dataUriDoBanco(item.imagemPath)) ||
      generico;
  }
  const banner = dataUri("/marca/header-ies.png");

  const doc = montarDocumento(scope, imagens, banner, dataUri);
  const html = "<!DOCTYPE html>" + doc.html;

  const browser = await abrirNavegador();
  try {
    const page = await browser.newPage();
    // Defesa em profundidade: durante o render só liberamos recursos embutidos
    // (data:/about:/blob:). Qualquer requisição externa — exfiltração/SSRF via
    // HTML injetado — é abortada. Tudo roda local, nada sai da máquina.
    await page.route("**/*", (route) => {
      const u = route.request().url();
      if (u.startsWith("data:") || u.startsWith("about:") || u.startsWith("blob:")) route.continue();
      else route.abort();
    });
    await page.setContent(html, { waitUntil: "networkidle" });
    // "networkidle" não cobre imagens embutidas via data: URI (não fazem fetch de rede) —
    // o decode delas ainda é assíncrono no Chromium. Sem esperar, o PDF às vezes sai com
    // uma foto de produto em branco (visto em produção: 1 de 5 produtos sem imagem, sempre
    // um diferente — race condition clássica, não dado/arquivo quebrado). `img.decode()`
    // garante que todo <img> já pintou antes de tirar o "print".
    await page.evaluate(() =>
      Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {}))),
    );
    // Fontes embutidas (@font-face data-URI) também carregam de forma assíncrona: sem
    // esperar, o PDF saía com a fonte RESERVA do Chromium serverless — a "letra
    // grosseira/de resolução ruim" vista nas propostas. fonts.ready garante a Geist.
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready);
    return await page.pdf({
      format: "A4",
      printBackground: true,
      // Rodapé nativo só quando o template pede um (a Consolidada imprime a paginação
      // dentro do HTML — ver montarDocumento).
      displayHeaderFooter: Boolean(doc.footer),
      headerTemplate: "<div></div>",
      footerTemplate: doc.footer || "<div></div>",
      // margens L/R zero: banner/imagens sangram full-width; conteúdo tem padding
      // próprio (.pg). Margem superior varia por tipo (ver montarDocumento).
      margin: { top: doc.marginTop, bottom: doc.marginBottom ?? "15mm", left: "0", right: "0" },
    });
  } finally {
    await browser.close();
  }
}
