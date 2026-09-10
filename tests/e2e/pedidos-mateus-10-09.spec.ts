import { test, expect } from "@playwright/test";

/**
 * Os três pedidos dos áudios do Mateus de 10/09/2026, conferidos NA TELA:
 *  1. a sidebar sem a palavra "Ferramentas" repetida;
 *  2. o botão de extrair o registro em PDF em Visita, Prospecção e Solicitação;
 *  3. a seção "Últimos acessos" no painel do gestor.
 *
 * Roda local com as rotas de API interceptadas (esta máquina não tem Postgres) — mesmo
 * desenho de solicitacoes-tipos.spec.ts:
 *   AUTH_ENABLED=false DATABASE_URL="postgresql://x:x@127.0.0.1:5432/x" npx next dev -H 127.0.0.1 -p 3123
 *   E2E_BASE_URL=http://127.0.0.1:3123 npx playwright test tests/e2e/pedidos-mateus-10-09.spec.ts
 */

const AUTOR = { autor: "gerencia@indebaexpress.com.br", autorNome: "Mateus Resende" };
const CARIMBO = { criadoEm: "2026-09-10T12:00:00.000Z", atualizadoEm: "2026-09-10T12:00:00.000Z" };

const VISITA = {
  id: "v-1",
  area: "tecnica",
  data: "2026-08-31",
  horario: "10:30",
  cliente: "FBC",
  quemRecebeu: "Monica/Graça",
  telefone: null,
  status: "resolvido",
  observacao: "Troca da mangueira do diluidor pelo tubo flex preto.",
  fotos: [],
  temDocumento: false,
  anexos: [],
  ...AUTOR,
  ...CARIMBO,
};

const PROSPECCAO = {
  id: "p-1",
  data: "2026-09-10",
  horario: "09:00",
  empresa: "Lavanderia Alfa",
  contato: "João",
  telefone: null,
  observacao: null,
  anexos: [],
  ...AUTOR,
  ...CARIMBO,
};

const SOLICITACAO = {
  id: "s-1",
  tipo: "analise_agua_tecidos",
  cliente: "Hotel Beta",
  observacao: null,
  status: "pendente",
  anexos: [],
  ...AUTOR,
  ...CARIMBO,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (r) =>
    r.fulfill({ json: { email: AUTOR.autor, nome: AUTOR.autorNome, papel: "admin" } }),
  );
  await page.route("**/api/visitas**", (r) => r.fulfill({ json: { visitas: [VISITA], souGestor: true } }));
  await page.route("**/api/novas-prospeccoes**", (r) => r.fulfill({ json: { relatorios: [PROSPECCAO], souGestor: true } }));
  await page.route("**/api/solicitacoes-comerciais**", (r) => r.fulfill({ json: { solicitacoes: [SOLICITACAO], souGestor: true } }));
});

/* ═══════════ 1. Sidebar ═══════════ */

test("a sidebar não repete a palavra Ferramentas", async ({ page }) => {
  await page.goto("/");
  const nav = page.locator("nav").first();

  // O grupo virou FERRAMENTAS e os itens ficaram com o recorte.
  await expect(nav.getByText("Ferramentas", { exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Comercial", exact: true })).toBeVisible();
  await expect(nav.getByRole("button", { name: "Técnico", exact: true })).toBeVisible();

  // O que a foto do Mateus mostrava e ele pediu para tirar.
  await expect(nav.getByText("Módulos", { exact: true })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Ferramentas Comerciais" })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "Ferramentas Técnicas" })).toHaveCount(0);
});

/* ═══════════ 2. PDF dos registros ═══════════ */

test("a visita de rotina tem botão de extrair PDF, apontando para a rota certa", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Técnico", exact: true }).click();

  const pdf = page.getByRole("link", { name: /PDF/ }).first();
  await expect(pdf).toBeVisible();
  await expect(pdf).toHaveAttribute("href", "/api/registros/visita/v-1/pdf");
  // Abre no visualizador do navegador, de onde a pessoa manda pro cliente.
  await expect(pdf).toHaveAttribute("target", "_blank");
});

test("a prospecção tem botão de extrair PDF", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Comercial", exact: true }).click();
  await page.getByRole("button", { name: "Registro de Prospecções" }).click();

  await expect(page.getByRole("link", { name: /PDF/ }).first()).toHaveAttribute(
    "href",
    "/api/registros/prospeccao/p-1/pdf",
  );
});

test("a solicitação comercial tem botão de extrair PDF", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Comercial", exact: true }).click();
  await page.getByRole("button", { name: "Solicitações Comerciais" }).click();

  await expect(page.getByRole("link", { name: /PDF/ }).first()).toHaveAttribute(
    "href",
    "/api/registros/solicitacao/s-1/pdf",
  );
});

// Recorte do Gustavo (10/09/2026): estoque é planilha interna e já exporta Excel/CSV.
test("o estoque de comodatos NÃO ganha botão de PDF", async ({ page }) => {
  await page.route("**/api/estoque-comodatos**", (r) =>
    r.fulfill({
      json: {
        itens: [{ id: "e-1", codigo: "ABC", peca: "Mangueira", quantidade: 3, obs: null, anexos: [], ...AUTOR, ...CARIMBO }],
        souGestor: true,
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Técnico", exact: true }).click();
  await page.getByRole("button", { name: /Estoque de Comodatos/i }).click();

  await expect(page.getByRole("link", { name: /^PDF$/ })).toHaveCount(0);
});

/* ═══════════ 3. Últimos acessos ═══════════ */

test("o painel do gestor mostra os últimos acessos, com entrada e recusa", async ({ page }) => {
  await page.route("**/api/acessos", (r) =>
    r.fulfill({
      json: {
        acessos: [
          {
            id: "a-1",
            email: AUTOR.autor,
            nome: "Mateus Resende",
            resultado: "entrou",
            motivo: null,
            ip: "203.0.113.7",
            agente: "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0",
            criadoEm: "2026-09-10T18:30:00.000Z",
          },
          {
            id: "a-2",
            email: "alguem@fora.com",
            nome: null,
            resultado: "recusado",
            motivo: "senha_invalida",
            ip: "198.51.100.2",
            agente: "Mozilla/5.0 (iPhone) Safari/605.1",
            criadoEm: "2026-09-10T18:20:00.000Z",
          },
        ],
      },
    }),
  );
  await page.route("**/api/admin-config", (r) => r.fulfill({ json: { gestorEmail: AUTOR.autor } }));
  await page.route("**/api/contatos**", (r) => r.fulfill({ json: { contatos: [] } }));
  await page.route("**/api/colaboradores**", (r) => r.fulfill({ json: { colaboradores: [] } }));

  await page.goto("/");
  await page.getByRole("button", { name: "Configurações" }).click();

  const secao = page.locator("section").filter({ hasText: "Últimos acessos" });
  await expect(secao).toBeVisible();

  // Quem entrou: nome do cadastro, não o e-mail cru.
  await expect(secao.getByText("Mateus Resende")).toBeVisible();
  await expect(secao.getByText("Entrou", { exact: true })).toBeVisible();
  await expect(secao.getByText("Chrome · Windows")).toBeVisible();

  // A tentativa recusada é metade do valor da trilha — tem que aparecer, com o motivo.
  await expect(secao.getByText("Recusado", { exact: true })).toBeVisible();
  await expect(secao.getByText("senha inválida")).toBeVisible();
  await expect(secao.getByText("alguem@fora.com")).toBeVisible();
  await expect(secao.getByText("Safari · iPhone/iPad")).toBeVisible();
});
