// Screenshots da UI para verificação visual. Requer dev server no ar.
//   node scripts/shot.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1120, height: 880 }, deviceScaleFactor: 2 });

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: "generated/ui-1-inicial.png" });
console.log("1. estado inicial capturado");

// preenche cliente + briefing e envia
await page.getByPlaceholder("Cliente", { exact: true }).fill("GVA Alimentos");
await page.getByPlaceholder("Descreva o cliente e a necessidade…").fill(
  "Cozinha industrial: desengordurante para louças no diluidor automático, desinfecção do ambiente, sabonete e álcool gel para as mãos.",
);
await page.keyboard.press("Enter");
console.log("2. briefing enviado, aguardando proposta (LLM)…");

await page.getByText("Baixar PDF da proposta").waitFor({ timeout: 90_000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "generated/ui-2-proposta.png", fullPage: true });
console.log("3. proposta capturada");

await browser.close();
