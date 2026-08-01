// QA de navegador do portão de aprovação: cadastro → fila → liberação → entrada, e a volta
// (revogar derruba). Roda contra dev server REAL com banco, porque o ponto todo é o estado
// no Postgres — mock não prova que o gestor consegue liberar alguém de fato.
//
//   pnpm db:up && pnpm dev
//   BASE=http://localhost:3000 npx vitest run --config vitest.qa.config.ts tests/qa-aprovacao-acesso.qa.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium, type Browser, type Page } from "playwright";
import { criarSessao } from "@/lib/auth";
import { prisma } from "@/lib/db";

const BASE = process.env.BASE ?? "http://localhost:3000";
const ORIGEM = new URL(BASE).origin;
const SENHA = "qa-senha-12345";
const marca = `qa-acesso-${Date.now()}`;
const emailNovo = `${marca}@indeba.test`;
const GESTOR = { email: `${marca}-gestor@indeba.test`, nome: "QA Gestor Acesso", papel: "admin" as const };

let browser: Browser;

async function abrirComo(u: { email: string; nome: string; papel: "admin" | "user" }): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
  await ctx.addCookies([{ name: "sessao", value: await criarSessao(u), url: ORIGEM, httpOnly: true }]);
  return ctx.newPage();
}

const comoGestor = async (caminho: string, init: RequestInit = {}) =>
  fetch(`${BASE}${caminho}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Cookie: `sessao=${await criarSessao(GESTOR)}`, "Content-Type": "application/json" },
  });

const logar = (email: string, senha = SENHA) =>
  fetch(`${BASE}/api/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, senha }) });

beforeAll(async () => {
  browser = await chromium.launch();
  // o gestor do QA precisa existir e estar aprovado para o painel responder
  await prisma.usuario.upsert({
    where: { email: GESTOR.email },
    create: { email: GESTOR.email, nome: GESTOR.nome, credencial: "x", papel: "admin", acesso: "aprovado" },
    update: { papel: "admin", acesso: "aprovado" },
  });
}, 60_000);

afterAll(async () => {
  await prisma.usuario.deleteMany({ where: { email: { contains: marca } } });
  await browser?.close();
  await prisma.$disconnect();
});

describe("Fluxo completo: cadastro → fila → liberação → entrada", () => {
  it("1. o cadastro é criado, mas NÃO loga direto", async () => {
    const r = await fetch(`${BASE}/api/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "QA Colaborador", email: emailNovo, senha: SENHA }),
    });
    expect(r.status).toBe(201);
    expect((await r.json()).pendente).toBe(true);
    expect(r.headers.get("set-cookie"), "nenhuma sessão antes da aprovação").toBeNull();
  });

  it("2. com a senha CERTA, o login é barrado com 403 e o motivo certo", async () => {
    const r = await logar(emailNovo);
    expect(r.status, "403 e não 401 — a senha está certa, falta liberação").toBe(403);
    expect((await r.json()).erro).toMatch(/aguardando libera/i);
    expect(r.headers.get("set-cookie")).toBeNull();
  });

  it("3. a pessoa aparece na fila do painel do gestor", async () => {
    const { colaboradores } = await (await comoGestor("/api/colaboradores")).json();
    const eu = colaboradores.find((c: { email: string }) => c.email === emailNovo);
    expect(eu?.acesso).toBe("pendente");
    // pendente vem antes do resto — é o que o gestor abre o painel para resolver
    expect(colaboradores[0].acesso).toBe("pendente");
  });

  it("4. o gestor vê a fila na tela, com o botão de liberar", async () => {
    const page = await abrirComo(GESTOR);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Configurações" }).first().click();
    await page.waitForTimeout(900);
    const corpo = await page.locator("body").innerText();
    expect(corpo).toContain("Aguardando liberação");
    expect(corpo).toContain(emailNovo);
    expect(await page.getByRole("button", { name: "Liberar" }).count()).toBeGreaterThan(0);
    await page.close();
  });

  it("5. o badge do menu mostra quantos esperam", async () => {
    const page = await abrirComo(GESTOR);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const item = await page.getByTitle(/aguardando/i).first().innerText().catch(() => "");
    expect(Number(item.trim()), "o badge tem que contar pelo menos o nosso cadastro").toBeGreaterThan(0);
    await page.close();
  });

  it("6. o gestor libera pelo painel — e aí sim a pessoa entra", async () => {
    const page = await abrirComo(GESTOR);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Configurações" }).first().click();
    await page.waitForTimeout(900);

    // A linha do nosso cadastro: o div MAIS INTERNO que tem o e-mail E o botão — sem o
    // filtro por `has`, o .last() cai no <div> só do e-mail, que não contém botão nenhum.
    const linha = page
      .locator("div")
      .filter({ hasText: emailNovo })
      .filter({ has: page.getByRole("button", { name: "Liberar" }) })
      .last();
    await linha.getByRole("button", { name: "Liberar" }).click();
    await page.waitForTimeout(1200);
    await page.close();

    const r = await logar(emailNovo);
    expect(r.status, "liberado, o login passa").toBe(200);
    expect(r.headers.get("set-cookie")).toContain("sessao=");
  });

  it("7. revogar tira o acesso de novo, sem apagar a conta", async () => {
    const r = await comoGestor("/api/colaboradores", { method: "PATCH", body: JSON.stringify({ email: emailNovo, acesso: "bloqueado" }) });
    expect(r.status).toBe(200);

    const login = await logar(emailNovo);
    expect(login.status).toBe(403);
    expect((await login.json()).erro).toMatch(/encerrado/i);

    // a conta continua lá — revogar é reversível
    expect(await prisma.usuario.count({ where: { email: emailNovo } })).toBe(1);
  });

  it("8. quem já estava logado cai no próximo carregamento (sessão não é eterna)", async () => {
    // sessão emitida ANTES da revogação continua assinada e válida por 8h — é o /api/me
    // que confere no banco e derruba. Sem isso, revogar não teria efeito prático.
    const r = await fetch(`${BASE}/api/me`, {
      headers: { Cookie: `sessao=${await criarSessao({ email: emailNovo, nome: "QA Colaborador", papel: "user" })}` },
    });
    expect(r.status).toBe(401);
    expect(r.headers.get("set-cookie") ?? "", "o cookie tem que ser apagado").toMatch(/sessao=;|sessao=deleted|Max-Age=0/);
  });

  it("9. reaprovar devolve o acesso", async () => {
    await comoGestor("/api/colaboradores", { method: "PATCH", body: JSON.stringify({ email: emailNovo, acesso: "aprovado" }) });
    expect((await logar(emailNovo)).status).toBe(200);
  });
});

describe("Poderes e travas do painel", () => {
  it("promover a gestor muda o papel — sem redeploy nem ADMIN_EMAILS", async () => {
    const r = await comoGestor("/api/colaboradores", { method: "PATCH", body: JSON.stringify({ email: emailNovo, papel: "admin" }) });
    expect(r.status).toBe(200);
    expect((await r.json()).papel).toBe("admin");

    // e o papel novo já vale na sessão seguinte
    const login = await (await logar(emailNovo)).json();
    expect(login.papel).toBe("admin");

    await comoGestor("/api/colaboradores", { method: "PATCH", body: JSON.stringify({ email: emailNovo, papel: "user" }) });
  });

  it("GUARDIÃO: o gestor não consegue revogar o próprio acesso pelo painel", async () => {
    const r = await comoGestor("/api/colaboradores", { method: "PATCH", body: JSON.stringify({ email: GESTOR.email, acesso: "bloqueado" }) });
    expect(r.status).toBe(409);
    const eu = await prisma.usuario.findUnique({ where: { email: GESTOR.email } });
    expect(eu?.acesso, "continua liberado — senão ninguém desfaz").toBe("aprovado");
  });

  it("GUARDIÃO: vendedor não alcança a fila de aprovação", async () => {
    const vendedor = { email: emailNovo, nome: "QA Colaborador", papel: "user" as const };
    const r = await fetch(`${BASE}/api/colaboradores`, { headers: { Cookie: `sessao=${await criarSessao(vendedor)}` } });
    expect(r.status).toBe(403);
  });

  it("GUARDIÃO: vendedor não vê Configurações no menu", async () => {
    const page = await abrirComo({ email: emailNovo, nome: "QA Colaborador", papel: "user" });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    expect(await page.locator("body").innerText()).not.toContain("Configurações");
    await page.close();
  });
});
