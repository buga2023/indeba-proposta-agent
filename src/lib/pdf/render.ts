import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
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
export async function abrirNavegador(): Promise<Browser> {
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
  try {
    return await pw.launch();
  } catch (e) {
    // Causa real do "geração de PDF falha" (out/2026): o Playwright pede o build EXATO da
    // sua versão (ex.: chromium_headless_shell-1234) e a máquina tinha outras revisões
    // (1223/1228) — "Executable doesn't exist". O Chromium instalado serve igual: procuramos
    // outro build do cache do Playwright e, por fim, o Chrome/Edge do sistema.
    const motivo = e instanceof Error ? e.message.split("\n")[0] : String(e);
    console.warn("[pdf] launch padrão do Playwright falhou, tentando alternativas:", motivo);
    for (const exe of executaveisAlternativos()) {
      try {
        return await pw.launch({ executablePath: exe });
      } catch {
        /* próximo candidato */
      }
    }
    for (const channel of ["chrome", "msedge"]) {
      try {
        return await pw.launch({ channel });
      } catch {
        /* próximo canal */
      }
    }
    throw e;
  }
}

// Candidatos a executável do Chromium: variável de ambiente, depois os builds do cache do
// Playwright (revisão mais nova primeiro; headless-shell antes do chromium completo).
export function executaveisAlternativos(): string[] {
  const achados: string[] = [];
  const env = process.env.CHROMIUM_PATH || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (env && existsSync(env)) achados.push(env);
  const raiz =
    process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== "0"
      ? process.env.PLAYWRIGHT_BROWSERS_PATH
      : process.platform === "win32"
        ? join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "ms-playwright")
        : process.platform === "darwin"
          ? join(homedir(), "Library", "Caches", "ms-playwright")
          : join(homedir(), ".cache", "ms-playwright");
  try {
    const pastas = readdirSync(raiz);
    const rev = (n: string) => Number(n.split("-").pop()) || 0;
    const sub: Record<string, string[]> = {
      win32: ["chrome-headless-shell-win64/chrome-headless-shell.exe", "chrome-win64/chrome.exe", "chrome-win/chrome.exe"],
      darwin: ["chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"],
      linux: ["chrome-headless-shell-linux64/chrome-headless-shell", "chrome-linux/chrome"],
    };
    for (const prefixo of ["chromium_headless_shell-", "chromium-"]) {
      pastas
        .filter((n) => n.startsWith(prefixo))
        .sort((a, b) => rev(b) - rev(a))
        .forEach((n) => {
          for (const rel of sub[process.platform] ?? sub.linux) {
            const exe = join(raiz, n, rel);
            if (existsSync(exe)) achados.push(exe);
          }
        });
    }
  } catch {
    /* cache do Playwright inexistente */
  }
  return achados;
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
export function dataUri(relPath: string): string {
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
      // Logo da marca no cabeçalho do orçamento (áudio do Mateus, 16/09/2026: "logo da
      // Indeba no PDF" — o orçamento era o único modelo sem a imagem, só o quadrado "ies").
      return { html: orcamentoHtml(scope, { logo: asset("/marca/indeba-express-logo.png") }), footer: FOOTER_PAG, marginTop: "12mm" };
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
  try {
    const { codigoDaRotaDeImagem, imagemDoProduto, rotaDeImagemEmbalagem, imagemDaEmbalagemDoProduto } = await import("@/lib/produto-custom");
    const codigo = codigoDaRotaDeImagem(caminho);
    const emb = rotaDeImagemEmbalagem(caminho);
    if (!codigo && !emb) return "";
    // Foto por embalagem (22/09/2026) vem de outra tabela, mas sai igual: data URI no PDF.
    const img = emb ? await imagemDaEmbalagemDoProduto(emb.codigo, emb.chave) : await imagemDoProduto(codigo!);
    return img ? `data:${img.mime};base64,` + img.bytes.toString("base64") : "";
  } catch {
    return ""; // banco fora do ar: cai no genérico, o PDF continua saindo
  }
}

// HTML → Chromium headless → PDF. É o motor, sem saber de proposta nenhuma: a montagem do
// HTML fica com quem chama. Extraído de `renderPdf` quando o Mateus pediu PDF dos registros
// das Ferramentas (áudio de 10/09/2026) — as travas daqui (rede abortada, espera de imagem
// e de fonte) foram todas pagas com bug em produção, e valem para qualquer documento.
export type OpcoesPdf = { footer?: string; marginTop?: string; marginBottom?: string };

const TIMEOUT_ETAPA_MS = 20_000;

// Teto para etapas que o Playwright não cobre com timeout próprio (page.evaluate).
function comTeto<T>(p: Promise<T>, etapa: string, ms = TIMEOUT_ETAPA_MS): Promise<T> {
  let t: NodeJS.Timeout;
  const limite = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`tempo esgotado em: ${etapa}`)), ms);
  });
  return Promise.race([p, limite]).finally(() => clearTimeout(t));
}

export async function pdfDeHtml(html: string, opcoes: OpcoesPdf = {}): Promise<Buffer> {
  const browser = await comTeto(abrirNavegador(), "abertura do navegador", 30_000);
  try {
    const page = await browser.newPage();
    // Nenhuma etapa pode pendurar a requisição: tudo tem teto.
    page.setDefaultTimeout(TIMEOUT_ETAPA_MS);
    // Defesa em profundidade: durante o render só liberamos recursos embutidos
    // (data:/about:/blob:). Qualquer requisição externa — exfiltração/SSRF via
    // HTML injetado — é abortada. Tudo roda local, nada sai da máquina.
    await page.route("**/*", (route) => {
      const u = route.request().url();
      if (u.startsWith("data:") || u.startsWith("about:") || u.startsWith("blob:")) route.continue();
      else route.abort();
    });
    // "load" e não "networkidle": toda requisição externa é abortada acima e as imagens/fontes
    // são data:, então não há rede a esperar — networkidle só adicionava um ponto de travamento
    // (e 500ms de espera fixa). O decode e as fontes são aguardados explicitamente abaixo.
    await page.setContent(html, { waitUntil: "load", timeout: TIMEOUT_ETAPA_MS });
    // "networkidle" não cobre imagens embutidas via data: URI (não fazem fetch de rede) —
    // o decode delas ainda é assíncrono no Chromium. Sem esperar, o PDF às vezes sai com
    // uma foto de produto em branco (visto em produção: 1 de 5 produtos sem imagem, sempre
    // um diferente — race condition clássica, não dado/arquivo quebrado). `img.decode()`
    // garante que todo <img> já pintou antes de tirar o "print".
    await comTeto(
      page.evaluate(() => Promise.all(Array.from(document.images).map((img) => img.decode().catch(() => {})))),
      "decode das imagens",
    ).catch((e) => console.warn("[pdf]", e instanceof Error ? e.message : e));
    // Fontes embutidas (@font-face data-URI) também carregam de forma assíncrona: sem
    // esperar, o PDF saía com a fonte RESERVA do Chromium serverless — a "letra
    // grosseira/de resolução ruim" vista nas propostas. fonts.ready garante a Geist.
    await comTeto(
      page.evaluate(() => (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready),
      "carga das fontes",
    ).catch((e) => console.warn("[pdf]", e instanceof Error ? e.message : e));
    return await page.pdf({
      format: "A4",
      printBackground: true,
      // Rodapé nativo só quando o template pede um (a Consolidada imprime a paginação
      // dentro do HTML — ver montarDocumento).
      displayHeaderFooter: Boolean(opcoes.footer),
      headerTemplate: "<div></div>",
      footerTemplate: opcoes.footer || "<div></div>",
      // margens L/R zero: banner/imagens sangram full-width; conteúdo tem padding
      // próprio (.pg). Margem superior varia por tipo (ver montarDocumento).
      margin: { top: opcoes.marginTop ?? "0", bottom: opcoes.marginBottom ?? "15mm", left: "0", right: "0" },
    });
  } finally {
    await browser.close();
  }
}

// PropostaScope → HTML → Chromium headless → PDF (motor estilo editorial-pdf).
export async function renderPdf(scope: PropostaScope): Promise<Buffer> {
  // Foto vem da base (catálogo). Enquanto faltar, cai no placeholder — nunca quebra.
  const generico = dataUri("/produtos/_generico.svg");
  const imagens: Record<string, string> = {};
  for (const item of scope.itens) {
    // Foto nunca derruba o PDF: qualquer falha (sharp, disco, banco) cai no genérico.
    const tenta = async (f: () => Promise<string>) => f().catch(() => "");
    imagens[chaveImagem(item)] =
      (await tenta(() => resolverImagemProduto(item.imagemPath))) ||
      (await tenta(() => dataUriFotoProduto(item.imagemPath))) ||
      (await tenta(() => dataUriDoBanco(item.imagemPath))) ||
      generico;
  }
  const banner = dataUri("/marca/header-ies.png");

  const doc = montarDocumento(scope, imagens, banner, dataUri);
  return pdfDeHtml("<!DOCTYPE html>" + doc.html, {
    footer: doc.footer,
    marginTop: doc.marginTop,
    marginBottom: doc.marginBottom,
  });
}
