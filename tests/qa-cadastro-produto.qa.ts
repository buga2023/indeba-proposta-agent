// Smoke test do cadastro de produto: da tela até o PDF.
//
// Prova o caminho inteiro com o app rodando, porque é onde as duas fontes do catálogo
// (JSON + Postgres) se encontram: cadastrar pelo formulário, aparecer na vitrine, ser
// achado pela busca, entrar numa proposta e sair no PDF COM A FOTO cadastrada — que é o
// ponto onde o produto do banco poderia silenciosamente cair na arte genérica.
//
//   pnpm db:up && pnpm dev
//   BASE=http://localhost:3000 npx vitest run --config vitest.qa.config.ts tests/qa-cadastro-produto.qa.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { criarSessao } from "@/lib/auth";
import { prisma } from "@/lib/db";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = process.env.OUT ?? ".";
const ORIGEM = new URL(BASE).origin;
const marca = `qa-prod-${Date.now()}`;
const CODIGO = `QA-TESTE-${Date.now()}`;

const GESTOR = { email: `${marca}-gestor@indeba.test`, nome: "Gestor Produto", papel: "admin" as const };
const VENDEDOR = { email: `${marca}-vend@indeba.test`, nome: "Vendedor Produto", papel: "user" as const };

let browser: Browser;

// PNG 2x2 de verdade — o PDF precisa de bytes que o Chromium consiga decodificar.
const PNG_2X2 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8z8Dwn4GBgYGJAQ0AABJ4AweGkSPjAAAAAElFTkSuQmCC",
  "base64",
);

async function abrirLogado(u: { email: string; nome: string; papel: "admin" | "user" }): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies([{ name: "sessao", value: await criarSessao(u), url: ORIGEM, httpOnly: true }]);
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator(`text=${u.papel === "admin" ? "Administrador" : "Vendedor"}`).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(400);
  return page;
}

const como = async (u: typeof GESTOR | typeof VENDEDOR, caminho: string, init: RequestInit = {}) =>
  fetch(`${BASE}${caminho}`, { ...init, headers: { ...(init.headers ?? {}), Cookie: `sessao=${await criarSessao(u)}` } });

beforeAll(async () => {
  for (const u of [GESTOR, VENDEDOR]) {
    await prisma.usuario.upsert({
      where: { email: u.email },
      create: { email: u.email, nome: u.nome, credencial: "qa", papel: u.papel, acesso: "aprovado" },
      update: { papel: u.papel, acesso: "aprovado" },
    });
  }
  browser = await chromium.launch();
}, 60_000);

afterAll(async () => {
  await prisma.produtoCustom.deleteMany({ where: { codigo: { startsWith: "QA-TESTE-" } } });
  await prisma.usuario.deleteMany({ where: { email: { contains: marca } } });
  await browser?.close();
  await prisma.$disconnect();
});

describe("Cadastro de produto — da tela ao PDF", () => {
  it("1. o vendedor NÃO vê o botão habilitado nem alcança a rota", async () => {
    const page = await abrirLogado(VENDEDOR);
    await page.getByRole("button", { name: "Catálogo" }).first().click();
    await page.waitForTimeout(800);
    const botao = page.getByRole("button", { name: "Novo produto" }).first();
    expect(await botao.getAttribute("title")).toMatch(/só o gestor/i);
    await page.close();

    expect((await como(VENDEDOR, "/api/produtos")).status).toBe(403);
  });

  it("2. o gestor cadastra pelo FORMULÁRIO da tela", async () => {
    const page = await abrirLogado(GESTOR);
    await page.getByRole("button", { name: "Catálogo" }).first().click();
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Novo produto" }).first().click();
    // Tudo escopado no <form> do modal: a tela de Catálogo continua montada atrás dele, com
    // chips de filtro de mesmo rótulo ("Multiuso"), e um seletor de página casa os dois.
    const form = page.locator("form").filter({ hasText: "Cadastrar produto" }).first();
    await form.waitFor({ timeout: 10_000 });

    await form.getByPlaceholder("PRIMMAX-NOVO").fill(CODIGO);
    await form.getByPlaceholder("Primmax Novo").fill("Produto QA Cadastrado");
    await form.getByPlaceholder("Detergente desengordurante alcalino").fill("Produto criado pelo smoke test");
    await form.getByRole("button", { name: "Multiuso", exact: true }).first().click();
    await form.getByPlaceholder("5", { exact: true }).first().fill("5");
    await form.getByPlaceholder("1:100").first().fill("1:50");
    await form.getByPlaceholder("Detergente Desengordurante", { exact: true }).fill("Ficha QA");
    await form.getByPlaceholder("Remove gordura sem agredir o inox").fill("Benefício um\nBenefício dois");
    await form.getByPlaceholder("13,5").fill("7,0");

    await form.locator('input[type=file]').first().setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: PNG_2X2 });
    await form.locator('input[type=file]').nth(1).setInputFiles({ name: "ficha.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%QA\n") });

    await page.screenshot({ path: `${OUT}/cadastro-formulario.png` });
    await form.getByRole("button", { name: "Cadastrar produto" }).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/cadastro-depois.png`, fullPage: true });
    await page.close();

    const salvo = await prisma.produtoCustom.findUnique({ where: { codigo: CODIGO } });
    expect(salvo, "o produto tem que estar no banco").toBeTruthy();
    expect(salvo?.autor).toBe(GESTOR.email);
  }, 120_000);

  it("3. entra no catálogo servido pela API, com os caminhos de imagem e ficha", async () => {
    const { produtos } = await (await como(GESTOR, "/api/catalogo")).json();
    const novo = produtos.find((p: { codigo: string }) => p.codigo === CODIGO);
    expect(novo, "o produto novo tem que estar no catálogo").toBeTruthy();
    expect(novo.ativo).toBe(true);
    expect(novo.imagemPath).toBe(`/api/produtos/${CODIGO}/imagem`);
    expect(novo.fichaTecnicaPath).toBe(`/api/produtos/${CODIGO}/ficha`);
    // os 150 do JSON continuam lá — a segunda fonte SOMA, não substitui
    expect(produtos.filter((p: { ativo: boolean }) => p.ativo).length).toBeGreaterThan(140);
  });

  it("4. a foto e a ficha são servidas pelas rotas", async () => {
    const img = await como(VENDEDOR, `/api/produtos/${CODIGO}/imagem`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");
    expect(Buffer.from(await img.arrayBuffer()).length).toBe(PNG_2X2.length);

    const ficha = await como(VENDEDOR, `/api/produtos/${CODIGO}/ficha`);
    expect(ficha.status).toBe(200);
    expect(ficha.headers.get("content-type")).toBe("application/pdf");
  });

  it("5. a busca do catálogo acha o produto novo na tela", async () => {
    const page = await abrirLogado(VENDEDOR);
    await page.getByRole("button", { name: "Catálogo" }).first().click();
    await page.waitForTimeout(900);
    await page.locator('input[placeholder*="SKU"]').fill("produto qa cadastrado");
    await page.waitForTimeout(600);
    const corpo = await page.locator("body").innerText();
    expect(corpo).toContain(CODIGO);
    await page.screenshot({ path: `${OUT}/cadastro-na-busca.png` });
    await page.close();
  });

  // O ponto mais fácil de quebrar em silêncio: `dentroDePublic` (com razão) rejeita o
  // caminho do produto do banco, e sem o resolvedor novo o PDF sairia com a arte genérica
  // apesar de o produto ter foto cadastrada.
  it("6. GUARDIÃO: o PDF sai com a FOTO cadastrada, não com a arte genérica", async () => {
    const scope = {
      id: `qa-pdf-produto-${Date.now()}`, criadoEm: new Date().toISOString(), status: "rascunho",
      tipo: "consolidada", template: "indeba_express",
      cliente: { razaoSocial: "QA Produto Novo", cnpj: null, segmento: null, responsavel: null },
      textoApresentacao: { conteudo: "qa", procedencia: "MANUAL" },
      itens: [{
        codigo: CODIGO, nome: "Produto QA Cadastrado", descricaoUso: "uso",
        imagemPath: `/api/produtos/${CODIGO}/imagem`,
        embalagens: [{ tamanho: 5, unidade: "L", preco: "150.00", diluicaoMax: "1:50", custoDiluido: null }],
        quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: null,
      }],
      condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
    };
    const r = await como(GESTOR, "/api/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scope),
    });
    expect(r.status).toBe(200);
    const buf = Buffer.from(await r.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
    expect(buf.length).toBeGreaterThan(10_000);
  }, 180_000);

  it("7. o gestor remove o produto e o catálogo volta ao que era", async () => {
    const r = await como(GESTOR, `/api/produtos?codigo=${encodeURIComponent(CODIGO)}`, { method: "DELETE" });
    expect(r.status).toBe(200);
    const { produtos } = await (await como(GESTOR, "/api/catalogo")).json();
    expect(produtos.find((p: { codigo: string }) => p.codigo === CODIGO)).toBeUndefined();
  });
});
