// E2E — preço do catálogo é EDITÁVEL na tela de proposta manual.
// Regressão do bug "alguns produtos ficam com o preço fixo": produtos que tinham
// preço no catálogo eram renderizados como texto, sem como alterar na proposta.
//
// Uso: node tests/e2e/preco-editavel.mjs
// (espera um servidor em BASE_URL — padrão http://127.0.0.1:3100 — com AUTH_ENABLED=false)

import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const COM_PRECO = "PRIMMAX-DGCLOR"; // catálogo: 5L = R$ 110,00
const SEM_PRECO = "AUTOCAR-1000-PLUS"; // arquivado, sem preço

let falhas = 0;
function check(nome, ok, detalhe = "") {
  console.log(`${ok ? "  ok  " : " FALHA"} — ${nome}${detalhe ? ` (${detalhe})` : ""}`);
  if (!ok) falhas++;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

// Captura o payload de /api/montar-estruturado sem depender do backend.
let payload = null;
await page.route("**/api/montar-estruturado", async (route) => {
  payload = route.request().postDataJSON();
  await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ erro: "stub e2e" }) });
});

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByText("Nova proposta", { exact: true }).first().click();

  const busca = page.getByPlaceholder(/buscar/i).first();
  await busca.waitFor({ timeout: 60_000 });

  // ── 1) Produto COM preço no catálogo: campo editável, pré-preenchido ──
  await busca.fill("DGClor");
  const campo = page.getByTestId(`preco-${COM_PRECO}`);
  await campo.waitFor({ timeout: 30_000 });
  check("produto com preço de catálogo tem campo de preço (não é texto fixo)", true);
  check("campo está habilitado", await campo.isEnabled());
  const inicial = await campo.inputValue();
  check("campo vem pré-preenchido com o preço do catálogo", inicial === "110.00", `valor="${inicial}"`);

  // ── 2) Editar o preço ──
  await campo.fill("99,50");
  const linha = page.locator(`div:has(> [data-testid="preco-${COM_PRECO}"])`).first();
  check("marca 'editado' aparece após alterar", await linha.getByText("editado").isVisible());

  // ── 3) Produto sem preço no catálogo continua com campo vazio ──
  await busca.fill("Autocar 1000 Plus");
  const campoSem = page.getByTestId(`preco-${SEM_PRECO}`);
  await campoSem.waitFor({ timeout: 30_000 });
  check("produto arquivado continua com campo vazio", (await campoSem.inputValue()) === "");

  // ── 4) Adicionar o produto editado → carrinho usa o preço digitado ──
  await busca.fill("DGClor");
  await campo.waitFor({ timeout: 30_000 });
  check("valor editado persiste após filtrar a lista", (await campo.inputValue()) === "99,50");
  await linha.getByRole("button", { name: "+" }).click();

  const carrinho = page.getByText(/preço digitado/).first();
  await carrinho.waitFor({ timeout: 15_000 });
  const sub = await carrinho.textContent();
  check("carrinho mostra o preço digitado", /99,50/.test(sub ?? ""), `sub="${sub}"`);

  // ── 5) Payload enviado carrega o preço digitado ──
  await page.getByLabel(/Raz.o social/).first().fill("Cliente Teste E2E");
  await page.getByRole("button", { name: /montar proposta/i }).first().click();
  await page.waitForTimeout(3000);

  check("POST /api/montar-estruturado foi disparado", payload !== null);
  const item = payload?.itens?.find((i) => i.codigo === COM_PRECO);
  check("item do catálogo vai com embalagens explícitas (override)", Boolean(item?.embalagens?.length));
  check(
    "preço enviado é o digitado, não o do catálogo",
    item?.embalagens?.[0]?.preco === "99.50",
    `preco="${item?.embalagens?.[0]?.preco}"`,
  );
  check("tamanho cotado preservado (5 L)", item?.embalagens?.[0]?.tamanho === 5);
} catch (e) {
  falhas++;
  console.error("ERRO:", e.message);
  await page.screenshot({ path: "tests/e2e/falha.png" }).catch(() => {});
} finally {
  await browser.close();
}

console.log(falhas === 0 ? "\nTODOS OS CHECKS PASSARAM" : `\n${falhas} CHECK(S) FALHARAM`);
process.exit(falhas === 0 ? 0 : 1);
