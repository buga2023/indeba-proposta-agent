// E2E — varredura do catálogo INTEIRO: todo produto tem campo de preço editável
// na tela de Proposta manual, em todos os tamanhos de embalagem.
//
// Para cada produto × cada embalagem verifica:
//  a) existe <input> de preço (não é texto fixo);
//  b) está habilitado;
//  c) vem pré-preenchido com o preço do catálogo daquele tamanho (ou vazio, se sem preço);
//  d) aceita digitação e o valor digitado prevalece.
//
// Uso: node tests/e2e/preco-todos-produtos.mjs
// (espera servidor em BASE_URL — padrão http://127.0.0.1:3187 — com AUTH_ENABLED=false)

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3187";
const catalogo = JSON.parse(readFileSync(new URL("../../data/catalogo.json", import.meta.url), "utf-8"));
const produtos = catalogo.produtos;

const falhas = [];
function fail(codigo, msg) {
  falhas.push(`${codigo}: ${msg}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
await page.route("**/api/montar-estruturado", (r) => r.abort());

console.log(`Varrendo ${produtos.length} produtos (${produtos.reduce((s, p) => s + p.embalagens.length, 0)} embalagens)…\n`);

try {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.getByText("Nova proposta", { exact: true }).first().click();
  const busca = page.getByPlaceholder(/Buscar produto/).first();
  await busca.waitFor({ timeout: 60_000 });

  let n = 0;
  for (const p of produtos) {
    n++;
    // Filtra pelo código exato → a lista fica só com este produto.
    await busca.fill(p.codigo);
    const campo = page.getByTestId(`preco-${p.codigo}`);
    try {
      await campo.waitFor({ state: "visible", timeout: 10_000 });
    } catch {
      fail(p.codigo, "campo de preço NÃO existe (preço fixo / produto não listado)");
      continue;
    }

    if (!(await campo.isEnabled())) fail(p.codigo, "campo de preço desabilitado");

    // Percorre cada tamanho de embalagem.
    const seletor = page.locator(`div:has(> [data-testid="preco-${p.codigo}"]) select`);
    const temSeletor = (await seletor.count()) > 0;
    for (let i = 0; i < p.embalagens.length; i++) {
      if (i > 0 && !temSeletor) break; // 1 embalagem só → sem seletor de tamanho
      if (temSeletor) await seletor.selectOption(String(i));
      const esperado = p.embalagens[i].preco == null ? "" : Number(p.embalagens[i].preco).toFixed(2);
      const atual = await campo.inputValue();
      if (atual !== esperado) {
        fail(p.codigo, `embalagem ${p.embalagens[i].tamanho}${p.embalagens[i].unidade}: campo="${atual}" esperado="${esperado}"`);
      }
    }

    // Digitação prevalece sobre o catálogo.
    await campo.fill("77,77");
    if ((await campo.inputValue()) !== "77,77") fail(p.codigo, "campo não aceitou digitação");
    await campo.fill("");

    if (n % 25 === 0) console.log(`  … ${n}/${produtos.length}`);
  }
} catch (e) {
  fail("GERAL", e.message);
} finally {
  await browser.close();
}

const totalEmb = produtos.reduce((s, p) => s + p.embalagens.length, 0);
console.log(`\n${produtos.length} produtos / ${totalEmb} embalagens verificados.`);
if (falhas.length === 0) {
  console.log("TODOS OS PRODUTOS COM PREÇO EDITÁVEL E CORRETO");
} else {
  console.log(`\n${falhas.length} FALHA(S):`);
  for (const f of falhas) console.log("  - " + f);
}
process.exit(falhas.length === 0 ? 0 : 1);
