import { test, expect } from "@playwright/test";

/**
 * Pedido do Mateus (áudio de 02/09/2026): "tá faltando isso aqui — análise de água e
 * tecidos, análise dos produtos químicos e outras solicitações". Confere na TELA que o
 * select de tipo oferece os cinco, e que a listagem mostra o nome de quem lançou.
 */

const SOLICITACAO = {
  id: "s-1",
  tipo: "analise_produtos_quimicos",
  cliente: "Teste",
  observacao: null,
  anexos: [],
  status: "pendente",
  autor: "gerencia@indebaexpress.com.br",
  autorNome: "Mateus Resende",
  criadoEm: "2026-09-02T12:00:00.000Z",
  atualizadoEm: "2026-09-02T12:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: "gerencia@indebaexpress.com.br", nome: "Mateus Resende", papel: "admin" } }));
  await page.route("**/api/solicitacoes-comerciais**", (r) => r.fulfill({ json: { solicitacoes: [SOLICITACAO], souGestor: true } }));
});

test("o select de tipo traz os cinco tipos de solicitação", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /ferramentas comerciais/i }).first().click();
  await page.getByRole("button", { name: "Solicitações Comerciais" }).click();

  const tipos = await page.locator("select").first().locator("option").allTextContents();
  expect(tipos).toEqual([
    "Análise de água e/ou tecidos",
    "Análise dos produtos químicos",
    "Visita do setor técnico",
    "Amostra para demonstração",
    "Outras solicitações",
  ]);
});

test("a listagem mostra o nome de quem lançou, não o e-mail", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /ferramentas comerciais/i }).first().click();
  await page.getByRole("button", { name: "Solicitações Comerciais" }).click();

  await expect(page.getByText("Mateus Resende").first()).toBeVisible();
  await expect(page.getByText("gerencia@indebaexpress.com.br")).toHaveCount(0);
});
