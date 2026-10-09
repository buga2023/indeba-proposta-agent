import { test, expect } from "@playwright/test";

/**
 * Pedidos dos áudios do Mateus de 09/10/2026, conferidos NA TELA:
 *  1. Registro de Prospecções e Solicitações Comerciais com as pastas de ano/mês
 *     ("caixinha do calendário"), como Visitas de Rotina e as Ferramentas Técnicas;
 *  2. Gerador de Certificados de verdade no lugar do "em breve";
 *  3. Títulos das seções da Proposta de Solução editáveis no painel do gestor.
 *
 * Roda local com as rotas de API interceptadas (mesmo desenho de pedidos-mateus-10-09):
 *   AUTH_ENABLED=false DATABASE_URL="postgresql://x:x@127.0.0.1:5432/x" npx next dev -H 127.0.0.1 -p 3123
 *   E2E_BASE_URL=http://127.0.0.1:3123 npx playwright test tests/e2e/pedidos-mateus-09-10.spec.ts
 */

const AUTOR = { autor: "gerencia@indebaexpress.com.br", autorNome: "Mateus Resende" };
const prospeccao = (id: string, data: string) => ({
  id, data, horario: "10:00", empresa: `Empresa ${id}`, contato: "Fulano", telefone: "71999990000", observacao: null, fotos: [], documentos: [], anexos: [],
  ...AUTOR, criadoEm: `${data}T12:00:00.000Z`, atualizadoEm: `${data}T12:00:00.000Z`,
});
const solicitacao = (id: string, dia: string) => ({
  id, cliente: `Cliente ${id}`, tipo: "amostra", descricao: "Amostra para demonstração", status: "aberta", anexos: [],
  ...AUTOR, criadoEm: `${dia}T12:00:00.000Z`, atualizadoEm: `${dia}T12:00:00.000Z`,
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/me", (r) => r.fulfill({ json: { email: AUTOR.autor, nome: AUTOR.autorNome, papel: "admin" } }));
  await page.route("**/api/novas-prospeccoes**", (r) =>
    r.fulfill({ json: { relatorios: [prospeccao("p-out", "2026-10-07"), prospeccao("p-set", "2026-09-15")], souGestor: true } }),
  );
  await page.route("**/api/solicitacoes-comerciais**", (r) =>
    r.fulfill({ json: { solicitacoes: [solicitacao("s-out", "2026-10-02"), solicitacao("s-ago", "2026-08-20")], souGestor: true } }),
  );
  await page.route("**/api/visitas**", (r) => r.fulfill({ json: { visitas: [], souGestor: true } }));
});

test("Registro de Prospecções tem pastas de ano e mês", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ferramentas Comerciais" }).first().click();
  await page.getByRole("button", { name: "Registro de Prospecções" }).click();
  await expect(page.getByRole("button", { name: /^2026/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Outubro/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Setembro/ })).toBeVisible();
  // A pasta mais recente já vem aberta: o item de outubro aparece.
  await expect(page.getByText("Empresa p-out")).toBeVisible();
});

test("Solicitações Comerciais têm pastas de ano e mês pela data de abertura", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ferramentas Comerciais" }).first().click();
  await page.getByRole("button", { name: "Solicitações Comerciais" }).click();
  await expect(page.getByRole("button", { name: /^Outubro/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Agosto/ })).toBeVisible();
  await expect(page.getByText("Cliente s-out")).toBeVisible();
});

test("Gerador de Certificados abre a ferramenta real, não o 'em breve'", async ({ page }) => {
  // O app abre o gerador num iframe apontando para o index.html (public/ não resolve diretório).
  await page.goto("/gerador-certificados/index.html");
  await expect(page).toHaveTitle(/Certificados/);
  await expect(page.getByText(/em breve/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /PDF/i }).first()).toBeVisible();
  // Bibliotecas vendorizadas (a CSP de produção só permite script do próprio domínio).
  const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  expect(scripts.every((s) => s && !s.startsWith("http"))).toBe(true);
});

test("painel do gestor edita os títulos das seções da proposta", async ({ page }) => {
  await page.route("**/api/textos-padrao", (r) => {
    if (r.request().method() === "GET") {
      // A rota devolve { textos, fabrica } (src/app/api/textos-padrao/route.ts).
      const textos = {
        rotulos: { tituloProposta: "Proposta Comercial", comodatosTitulo: "Vantagens" },
        capaSubtitulo: "Soluções em Higienização Profissional",
        condicoesConsolidada: [],
        mensagemFechamento: "Obrigado.",
        condicoesComerciais: { validade: "15 dias", prazoEntrega: "72h", pagamento: "Boleto", frete: "CIF" },
      };
      return r.fulfill({ json: { textos, fabrica: { ...textos, rotulos: {} } } });
    }
    return r.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/colaboradores**", (r) => r.fulfill({ json: { colaboradores: [], pendentes: [] } }));
  await page.route("**/api/acessos**", (r) => r.fulfill({ json: { acessos: [] } }));
  await page.route("**/api/admin-config", (r) => r.fulfill({ json: { gestorEmail: AUTOR.autor } }));
  await page.route("**/api/plano", (r) => r.fulfill({ json: { ferramentas: [], plano: "completo", catalogo: [], presets: {} } }));
  await page.goto("/?tela=config");
  await expect(page.getByText("Títulos das seções")).toBeVisible();
  await expect(page.getByLabel("Título da proposta (capa e cabeçalho)", { exact: true })).toHaveValue("Proposta Comercial");
  await expect(page.getByLabel("Título da seção de equipamentos", { exact: true })).toHaveValue("Vantagens");
  await expect(page.getByLabel("Título das condições", { exact: true })).toHaveAttribute("placeholder", "Condições Comerciais");
});
