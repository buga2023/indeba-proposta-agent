import { test, expect } from "@playwright/test";

/**
 * Pedidos dos áudios do Mateus de 03/11/2026, conferidos NA TELA:
 *  1. Ano travado no vigente — entrou "0026" no sistema; o <input type="date"> já nasce
 *     com min/max do ano corrente (o servidor recusa por cima, tests/unit/data-registro).
 *  2. O gestor edita a DATA de um lançamento (o vendedor continua sem).
 *  3. Solicitações pendentes em evidência: pasta "Pendentes" no topo, selo com a contagem
 *     na aba, e pendente antes de atendida dentro do mês.
 *
 * Roda local com as rotas de API interceptadas (mesmo desenho de pedidos-mateus-09-10):
 *   AUTH_ENABLED=false DATABASE_URL="postgresql://x:x@127.0.0.1:5432/x" npx next dev -H 127.0.0.1 -p 3123
 *   E2E_BASE_URL=http://127.0.0.1:3123 npx playwright test tests/e2e/pedidos-mateus-03-11.spec.ts
 */

const ANO = new Date().getFullYear();
const AUTOR = { autor: "gerencia@indebaexpress.com.br", autorNome: "Mateus Resende" };
const prospeccao = (id: string, data: string) => ({
  id, data, horario: "10:00", empresa: `Empresa ${id}`, contato: "Fulano", telefone: "71999990000", observacao: null, anexos: [],
  ...AUTOR, criadoEm: `${data}T12:00:00.000Z`, atualizadoEm: `${data}T12:00:00.000Z`,
});
const solicitacao = (id: string, dia: string, status: "pendente" | "atendida") => ({
  id, cliente: `Cliente ${id}`, tipo: "amostra_demonstracao", observacao: null, status, anexos: [],
  ...AUTOR, criadoEm: `${dia}T12:00:00.000Z`, atualizadoEm: `${dia}T12:00:00.000Z`,
});

function rotas(page: import("@playwright/test").Page, souGestor: boolean) {
  const papel = souGestor ? "admin" : "user";
  return Promise.all([
    page.route("**/api/me", (r) => r.fulfill({ json: { email: AUTOR.autor, nome: AUTOR.autorNome, papel } })),
    page.route("**/api/novas-prospeccoes**", (r) =>
      r.fulfill({ json: { relatorios: [prospeccao("p1", `${ANO}-10-07`)], souGestor, eu: AUTOR.autor } }),
    ),
    page.route("**/api/solicitacoes-comerciais**", (r) =>
      r.fulfill({
        json: {
          solicitacoes: [
            solicitacao("s-out-ok", `${ANO}-10-20`, "atendida"),
            solicitacao("s-out-pend", `${ANO}-10-02`, "pendente"),
            solicitacao("s-ago-pend", `${ANO}-08-20`, "pendente"),
          ],
          souGestor,
          eu: AUTOR.autor,
        },
      }),
    ),
    page.route("**/api/visitas**", (r) => r.fulfill({ json: { visitas: [], souGestor, eu: AUTOR.autor } })),
  ]);
}

test("o campo de data só aceita o ano vigente", async ({ page }) => {
  await rotas(page, false);
  await page.goto("/");
  await page.getByRole("button", { name: "Ferramentas Comerciais" }).first().click();
  await page.getByRole("button", { name: "Registro de Prospecções" }).click();
  const data = page.locator('form input[type="date"]').first();
  await expect(data).toHaveAttribute("min", `${ANO}-01-01`);
  await expect(data).toHaveAttribute("max", `${ANO}-12-31`);
});

test("gestor vê o campo Data na edição; vendedor vê o aviso de que a data não muda", async ({ page }) => {
  await rotas(page, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Ferramentas Comerciais" }).first().click();
  await page.getByRole("button", { name: "Registro de Prospecções" }).click();
  await page.getByRole("button", { name: "Editar" }).first().click();
  const data = page.getByLabel("Data da prospecção");
  await expect(data).toBeVisible();
  await expect(data).toHaveValue(`${ANO}-10-07`);
  await expect(page.getByText("A data não muda na edição")).toHaveCount(0);

  await page.unrouteAll();
  await rotas(page, false);
  await page.goto("/");
  await page.getByRole("button", { name: "Ferramentas Comerciais" }).first().click();
  await page.getByRole("button", { name: "Registro de Prospecções" }).click();
  await page.getByRole("button", { name: "Editar" }).first().click();
  await expect(page.getByText("A data não muda na edição")).toBeVisible();
  await expect(page.getByLabel("Data da prospecção")).toHaveCount(0);
});

test("solicitações pendentes ficam em evidência: selo na aba, pasta Pendentes no topo", async ({ page }) => {
  await rotas(page, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Ferramentas Comerciais" }).first().click();
  // Selo com a contagem aparece já na aba, antes de abrir a lista.
  const abaSolic = page.getByRole("button", { name: /Solicitações Comerciais/ });
  await expect(abaSolic.getByLabel("2 pendentes")).toBeVisible();
  await abaSolic.click();
  const pasta = page.getByRole("button", { name: /^Pendentes/ });
  await expect(pasta).toBeVisible();
  await expect(pasta).toContainText("(2)");
  // A pasta vem aberta e lista as duas pendentes, de meses diferentes; a atendida não entra.
  const cards = page.locator("text=Cliente s-");
  await expect(cards.filter({ hasText: "s-out-pend" }).first()).toBeVisible();
  await expect(cards.filter({ hasText: "s-ago-pend" }).first()).toBeVisible();
  // A pasta de Pendentes vem ANTES da pasta do ano.
  const botoes = await page.getByRole("button").allTextContents();
  expect(botoes.findIndex((t) => t.startsWith("Pendentes"))).toBeLessThan(botoes.findIndex((t) => t.startsWith(String(ANO))));
});
