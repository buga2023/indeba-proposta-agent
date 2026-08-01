// A/B dos dois painéis lado a lado, e a promoção de vendedor a gestor valendo NA TELA.
//
// Duas perguntas, respondidas com o app rodando:
//   1. o painel do gestor e o do vendedor são mesmo diferentes?
//   2. o gestor consegue dar poder de gestor a outra pessoa?
//
//   pnpm db:up && pnpm dev
//   BASE=http://localhost:3000 npx vitest run --config vitest.qa.config.ts tests/qa-papel-ab.qa.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { criarSessao } from "@/lib/auth";
import { prisma } from "@/lib/db";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ORIGEM = new URL(BASE).origin;
const marca = `qa-ab-${Date.now()}`;

const GESTOR = { email: `${marca}-gestor@indeba.test`, nome: "Gestor QA", papel: "admin" as const };
const VENDEDOR = { email: `${marca}-vendedor@indeba.test`, nome: "Vendedor QA", papel: "user" as const };

let browser: Browser;

// Sessão assinada com o segredo do servidor — encarna o papel sem senha nenhuma.
async function abrirComo(u: { email: string; nome: string; papel: "admin" | "user" }): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addCookies([{ name: "sessao", value: await criarSessao(u), url: ORIGEM, httpOnly: true }]);
  return ctx.newPage();
}

// Abre e ESPERA a identidade chegar. Timeout fixo aqui é armadilha: /api/me consulta o banco
// (é o que faz revogar valer na hora), e enquanto ele não responde a tela trata todo mundo
// como vendedor de propósito — em dev, com a rota compilando na primeira chamada, um
// waitForTimeout(1200) fotografava justamente esse estado e "provava" que o gestor via 4 KPIs.
async function abrirLogado(u: { email: string; nome: string; papel: "admin" | "user" }): Promise<Page> {
  const page = await abrirComo(u);
  await page.goto(BASE, { waitUntil: "networkidle" });
  const rotulo = u.papel === "admin" ? "Administrador" : "Vendedor";
  await page.locator(`text=${rotulo}`).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(400); // deixa o resto do painel assentar
  return page;
}

const comoGestor = async (caminho: string, init: RequestInit = {}) =>
  fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Cookie: `sessao=${await criarSessao(GESTOR)}`, "Content-Type": "application/json" },
  });

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
  await prisma.usuario.deleteMany({ where: { email: { contains: marca } } });
  await browser?.close();
  await prisma.$disconnect();
});

const OUT = process.env.OUT ?? ".";

describe("1. Os dois painéis são diferentes?", () => {
  it("gestor: 5 KPIs, Atividade recente e Configurações no menu", async () => {
    const page = await abrirLogado(GESTOR);
    await page.screenshot({ path: `${OUT}/ab-gestor.png` });

    const kpis = (await page.locator(".ies-kpi > *").allInnerTexts()).map((t) => t.split("\n")[0]);
    const corpo = await page.locator("body").innerText();
    expect(kpis).toEqual(["Propostas", "Valor total", "Aprovadas", "Recusadas", "Produtos no catálogo"]);
    expect(corpo).toContain("Atividade recente");
    expect(corpo).toContain("Configurações");
    await page.close();
  });

  it("vendedor: 4 KPIs, sem Atividade recente, sem Configurações", async () => {
    const page = await abrirLogado(VENDEDOR);
    await page.screenshot({ path: `${OUT}/ab-vendedor.png` });

    const kpis = (await page.locator(".ies-kpi > *").allInnerTexts()).map((t) => t.split("\n")[0]);
    const corpo = await page.locator("body").innerText();
    expect(kpis).toEqual(["Propostas", "Valor total", "Aprovadas", "Recusadas"]);
    expect(corpo).not.toContain("Atividade recente");
    expect(corpo).not.toContain("Configurações");
    await page.close();
  });

  it("o vendedor não abre o painel nem forçando a tela (Ctrl+K não oferece)", async () => {
    const page = await abrirLogado(VENDEDOR);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(400);
    await page.keyboard.type("config");
    await page.waitForTimeout(400);
    expect(await page.locator("body").innerText()).not.toContain("Configurações");
    await page.close();
  });
});

describe("2. O gestor consegue dar poder de gestor a outra pessoa?", () => {
  it("clica em 'Tornar gestor' na tela e o papel muda no banco", async () => {
    const page = await abrirLogado(GESTOR);
    await page.getByRole("button", { name: "Configurações" }).first().click();
    await page.waitForTimeout(1200);

    const linha = page
      .locator("div")
      .filter({ hasText: VENDEDOR.email })
      .filter({ has: page.getByRole("button", { name: "Tornar gestor" }) })
      .last();
    await linha.getByRole("button", { name: "Tornar gestor" }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/ab-promovido.png` });
    await page.close();

    const depois = await prisma.usuario.findUnique({ where: { email: VENDEDOR.email } });
    expect(depois?.papel, "o papel tem que ter virado admin").toBe("admin");
  });

  it("e o painel do promovido passa a ser o de gestor — 5 KPIs e Configurações", async () => {
    // o papel viaja na sessão: a sessão NOVA já vem como admin
    const page = await abrirLogado({ ...VENDEDOR, papel: "admin" });
    const kpis = (await page.locator(".ies-kpi > *").allInnerTexts()).map((t) => t.split("\n")[0]);
    expect(kpis).toHaveLength(5);
    expect(await page.locator("body").innerText()).toContain("Configurações");
    await page.close();
  });

  it("e ele agora alcança a API do painel (403 → 200)", async () => {
    const r = await fetch(`${BASE}/api/colaboradores`, {
      headers: { Cookie: `sessao=${await criarSessao({ ...VENDEDOR, papel: "admin" })}` },
    });
    expect(r.status).toBe(200);
  });

  it("rebaixar de volta também funciona", async () => {
    const r = await comoGestor("/api/colaboradores", { method: "PATCH", body: JSON.stringify({ email: VENDEDOR.email, papel: "user" }) });
    expect(r.status).toBe(200);
    expect((await r.json()).papel).toBe("user");

    // e o rebaixado perde o acesso à API do painel na sessão seguinte
    const api = await fetch(`${BASE}/api/colaboradores`, {
      headers: { Cookie: `sessao=${await criarSessao({ ...VENDEDOR, papel: "user" })}` },
    });
    expect(api.status).toBe(403);
  });
});
