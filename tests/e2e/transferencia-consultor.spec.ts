import { test, expect } from "@playwright/test";

/**
 * Pedidos do Mateus (áudio de 02/09/2026), conferidos na TELA:
 *  - o histórico mostra o NOME de quem lançou, não o e-mail;
 *  - o gestor transfere a proposta para outro consultor pela própria lista.
 *
 * Roda contra o dev server local (E2E_BASE_URL=http://127.0.0.1:3123) com as rotas de
 * API interceptadas: esta máquina não tem Postgres, e o que está sob teste é a camada de
 * tela — o servidor é coberto pelos testes de unidade (propostas-escopo.test.ts).
 */

const PROPOSTA = {
  id: "p-1",
  status: "em_andamento",
  autor: "gerencia@indebaexpress.com.br",
  autorNome: "Mateus Resende",
  cliente: "Frigorífico Teste",
  segmento: null,
  tipo: "consolidada",
  total: "1000.00",
  qtdItens: 2,
  criadoEm: "2026-09-01T12:00:00.000Z",
  atualizadoEm: "2026-09-01T12:00:00.000Z",
};

const COLABORADORES = [
  { email: "gerencia@indebaexpress.com.br", nome: "Mateus Resende", papel: "admin", acesso: "aprovado" },
  { email: "austin@indeba.com", nome: "Austin Consultor", papel: "user", acesso: "aprovado" },
  { email: "bloqueado@indeba.com", nome: "Conta Bloqueada", papel: "user", acesso: "bloqueado" },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: "gerencia@indebaexpress.com.br", nome: "Mateus Resende", papel: "admin" } }));
  await page.route("**/api/colaboradores", (r) => r.fulfill({ json: { colaboradores: COLABORADORES } }));
  await page.route("**/api/propostas", (r) => r.fulfill({ json: { propostas: [PROPOSTA] } }));
});

async function abrirHistorico(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /hist[óo]rico/i }).first().click();
  await expect(page.getByText("Frigorífico Teste")).toBeVisible();
}

test("histórico mostra o NOME do consultor, não o e-mail", async ({ page }) => {
  await abrirHistorico(page);
  const consultor = page.getByLabel("Consultor responsável");
  await expect(consultor).toBeVisible();
  await expect(consultor).toHaveValue("gerencia@indebaexpress.com.br");
  // O que a linha EXIBE é o nome; o e-mail fica só como valor interno do select.
  await expect(consultor.locator("option:checked")).toHaveText("Mateus Resende");
  await expect(page.getByText("gerencia@indebaexpress.com.br", { exact: true })).toHaveCount(0);
});

test("conta bloqueada não aparece como destino da transferência", async ({ page }) => {
  await abrirHistorico(page);
  const opcoes = await page.getByLabel("Consultor responsável").locator("option").allTextContents();
  expect(opcoes).toContain("Austin Consultor");
  expect(opcoes).not.toContain("Conta Bloqueada");
});

test("o gestor transfere a proposta para outro consultor", async ({ page }) => {
  let corpoDoPatch: unknown = null;
  await page.route("**/api/propostas/p-1", async (route) => {
    corpoDoPatch = route.request().postDataJSON();
    await route.fulfill({ json: { ...PROPOSTA, autor: "austin@indeba.com", autorNome: "Austin Consultor" } });
  });

  await abrirHistorico(page);
  await page.getByLabel("Consultor responsável").selectOption("austin@indeba.com");

  await expect(page.getByText("Proposta transferida")).toBeVisible();
  expect(corpoDoPatch).toEqual({ autor: "austin@indeba.com" });
});
