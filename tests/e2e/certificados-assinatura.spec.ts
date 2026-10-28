import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

/**
 * Gerador de Certificados, versão nova do Mateus (27/10/2026): assinatura dele no certificado
 * ("Matheus Resende" cursiva + "Matheus Maristane Resende / Gestor — Indeba Express").
 * Não precisa de banco nem de login local:
 *   AUTH_ENABLED=false DATABASE_URL="postgresql://x:x@127.0.0.1:5432/x" npx next dev -H 127.0.0.1 -p 3123
 *   E2E_BASE_URL=http://127.0.0.1:3123 npx playwright test tests/e2e/certificados-assinatura.spec.ts
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/gerador-certificados/index.html");
});

test("prévia mostra a assinatura e o cargo do gestor", async ({ page }) => {
  await page.fill("#n", "Maria da Silva");
  await expect(page.getByText("Matheus Maristane Resende").first()).toBeVisible();
  await expect(page.getByText("Gestor — Indeba Express").first()).toBeVisible();
});

test("PDF único sai com a assinatura embutida, usando as bibliotecas da própria origem", async ({ page }) => {
  const scripts = await page.locator("script[src]").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
  expect(scripts.every((s) => s && !s.startsWith("http"))).toBe(true);
  await page.fill("#n", "Maria da Silva\nJoão Santos");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.click("#b1")]);
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  // Abre no próprio pdf-lib da página: 2 páginas (uma por pessoa) e uma imagem (a rubrica) em cada.
  const info = await page.evaluate(async (b64) => {
    const P = (window as unknown as { PDFLib: typeof import("pdf-lib") }).PDFLib;
    const doc = await P.PDFDocument.load(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    const imagens = doc.getPages().map((pg) => {
      const xo = pg.node.Resources()?.lookup(P.PDFName.of("XObject"), P.PDFDict);
      return xo ? xo.keys().length : 0;
    });
    return { paginas: doc.getPageCount(), imagens };
  }, pdf.toString("base64"));
  expect(info.paginas).toBe(2);
  expect(info.imagens.every((n) => n >= 1)).toBe(true);
});

test(".zip com nomes repetidos não sobrescreve ninguém", async ({ page }) => {
  await page.fill("#n", "Maria da Silva\nMaria da Silva\nJoão Santos");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.click("#b2")]);
  const zip = await readFile((await download.path())!);
  const nomes = await page.evaluate(async (b64) => {
    const JSZip = (window as unknown as { JSZip: { loadAsync(d: Uint8Array): Promise<{ files: Record<string, unknown> }> } }).JSZip;
    const z = await JSZip.loadAsync(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    return Object.keys(z.files).sort();
  }, zip.toString("base64"));
  expect(nomes).toEqual(["Certificado_Joao_Santos.pdf", "Certificado_Maria_da_Silva.pdf", "Certificado_Maria_da_Silva_2.pdf"]);
});
