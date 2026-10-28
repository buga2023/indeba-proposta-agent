import { test, expect, type Page } from "@playwright/test";

/**
 * Gerador POP (guia de uso dos produtos de limpeza, áudio do Mateus de 26/10/2026), NA TELA:
 * entra pelo menu, abre o HTML real no iframe e usa o catálogo COMPARTILHADO via /api/gerador-pop.
 *
 * A API é interceptada com um banco em memória por teste (esta máquina não tem Postgres):
 *   AUTH_ENABLED=false DATABASE_URL="postgresql://x:x@127.0.0.1:5432/x" npx next dev -H 127.0.0.1 -p 3123
 *   E2E_BASE_URL=http://127.0.0.1:3123 npx playwright test tests/e2e/gerador-pop.spec.ts
 */

type Produto = { o: number; nome: string; dil: string; [k: string]: unknown };
type Banco = { produtos: Record<string, Produto>; paleta: string[]; chamadas: string[] };

async function apiEmMemoria(page: Page, banco: Banco) {
  await page.route("**/api/gerador-pop**", async (r) => {
    const req = r.request();
    const caminho = new URL(req.url()).pathname;
    banco.chamadas.push(`${req.method()} ${caminho}`);
    const m = caminho.match(/^\/api\/gerador-pop\/produtos\/(.+)$/);
    if (caminho === "/api/gerador-pop" && req.method() === "GET") {
      const produtos = Object.entries(banco.produtos).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.o - b.o);
      return r.fulfill({ json: { produtos, paleta: banco.paleta } });
    }
    if (caminho === "/api/gerador-pop/paleta" && req.method() === "PUT") banco.paleta = req.postDataJSON().cores;
    else if (m && req.method() === "PUT") banco.produtos[decodeURIComponent(m[1])] = req.postDataJSON();
    else if (m && req.method() === "DELETE") delete banco.produtos[decodeURIComponent(m[1])];
    else return r.fulfill({ status: 404, json: {} });
    return r.fulfill({ json: { ok: true } });
  });
}

const novoBanco = (): Banco => ({ produtos: {}, paleta: [], chamadas: [] });

async function abrirGerador(page: Page) {
  await page.goto("/gerador-pop/index.html");
  await expect(page.locator("#dbs")).toHaveText("Catálogo compartilhado");
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: "gerencia@indebaexpress.com.br", nome: "Mateus Resende", papel: "admin" } }));
});

test("menu lateral abre o Gerador POP no iframe, com o catálogo compartilhado", async ({ page }) => {
  await apiEmMemoria(page, novoBanco());
  await page.goto("/");
  await page.getByRole("button", { name: "Gerador POP" }).first().click();
  const frame = page.frameLocator('iframe[src="/gerador-pop/index.html"]');
  // 15 s: na primeira rodada o dev server ainda compila a home enquanto o iframe carrega.
  await expect(frame.locator("#dbs")).toHaveText("Catálogo compartilhado", { timeout: 15_000 });
  await expect(frame.locator("#sheet .pg").first()).toContainText("Guia de uso dos produtos de limpeza");
});

test("catálogo vazio recebe os exemplos; criar, salvar cor e excluir vão para a API", async ({ page }) => {
  const banco = novoBanco();
  await apiEmMemoria(page, banco);
  await abrirGerador(page);

  // Primeiro acesso do time: os 3 produtos de exemplo são gravados no banco.
  await expect.poll(() => Object.keys(banco.produtos).sort()).toEqual(["dga", "sanclor-dg", "sol-plus"]);

  await page.click("#add");
  await page.fill("#nome", "Primmax Hort FLV");
  await page.fill("#dil", "10 ml/L");
  await expect.poll(() => Object.values(banco.produtos).find((p) => p.nome === "Primmax Hort FLV")?.dil).toBe("10 ml/L");
  await expect(page.locator("#sheet")).toContainText("Primmax Hort FLV");

  await page.fill("#hex", "#123456");
  await page.click("#svc");
  await expect.poll(() => banco.paleta).toEqual(["#123456"]);

  await page.click("#del");
  await expect.poll(() => Object.values(banco.produtos).map((p) => p.nome)).not.toContain("Primmax Hort FLV");
  expect(banco.chamadas.some((c) => c.startsWith("DELETE /api/gerador-pop/produtos/"))).toBe(true);
});

test("segundo usuário vê o mesmo catálogo e a exclusão dele chega ao primeiro", async ({ browser }) => {
  const banco = novoBanco();
  const [a, b] = [await browser.newPage(), await browser.newPage()];
  for (const p of [a, b]) {
    await p.route("**/api/me", (r) => r.fulfill({ json: { email: "x@indeba.com", nome: "X", papel: "user" } }));
    await apiEmMemoria(p, banco);
  }
  banco.produtos = {
    um: { o: 1, nome: "Produto Um", dil: "", cor: "#C2255C", i: [] },
    dois: { o: 2, nome: "Produto Dois", dil: "", cor: "#1B3354", i: [] },
  };
  await abrirGerador(a);
  await abrirGerador(b);
  await expect(b.locator("#pl .pr button")).toHaveText(["Produto Um", "Produto Dois"]);

  await b.locator("#pl .pr button", { hasText: "Produto Dois" }).click();
  await b.click("#del");
  await expect.poll(() => Object.keys(banco.produtos)).toEqual(["um"]);

  // O usuário A volta para a aba (recarrega no foco, no máximo a cada 5 s).
  await a.waitForTimeout(5_100);
  await a.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(a.locator("#pl .pr button")).toHaveText(["Produto Um"]);
  await a.close();
  await b.close();
});

test("PDF baixa com as bibliotecas da própria origem (CSP de produção)", async ({ page }) => {
  await apiEmMemoria(page, novoBanco());
  await abrirGerador(page);
  const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((s) => s && !s.startsWith("http"))).toBe(true);
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.click("#pdf")]);
  expect(download.suggestedFilename()).toBe("pop-indeba-express.pdf");
});

test("API real fora do ar: a página avisa e segue em modo local, sem quebrar", async ({ page }) => {
  // Sem interceptar: o dev server aponta para um Postgres que não existe, a rota responde 500.
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  await page.goto("/gerador-pop/index.html");
  await expect(page.locator("#dbs")).toContainText("modo local");
  await expect(page.locator("#sheet .pg").first()).toContainText("Primmax DGA");
  expect(erros).toEqual([]);
});
