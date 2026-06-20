// Smoke E2E do produto: briefing → /api/montar → /api/pdf, com o teste-guardião
// (preço que sai == preço do catálogo). Requer o dev server no ar e Ollama no host.
//   node scripts/e2e-smoke.mjs   (usa BASE=http://localhost:3000)
import { readFileSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const catalogo = JSON.parse(readFileSync("data/catalogo.json", "utf-8"));
const precoCatalogo = (codigo) =>
  catalogo.produtos.find((p) => p.codigo === codigo)?.embalagens.map((e) => e.preco);

const briefing =
  "GVA Alimentos, cozinha industrial. Desengordurante para louças e bancadas no diluidor automático, desinfecção do ambiente, sabonete e álcool gel para as mãos.";

console.log(`E2E @ ${BASE}\n${"=".repeat(56)}`);

// 1) briefing → PropostaScope
let t = Date.now();
const rMontar = await fetch(`${BASE}/api/montar`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ briefing, razaoSocial: "GVA Alimentos", cnpj: null, segmento: "cozinha_industrial" }),
});
if (!rMontar.ok) throw new Error(`montar ${rMontar.status}: ${await rMontar.text()}`);
const scope = await rMontar.json();
console.log(`1. montar OK (${Date.now() - t} ms) — ${scope.itens.length} itens, texto=${scope.textoApresentacao.procedencia}`);

// GUARDIÃO: todo preço do item bate exatamente com o catálogo
let fabricacoes = 0;
for (const it of scope.itens) {
  const esperado = precoCatalogo(it.codigo);
  const saiu = it.embalagens.map((e) => e.preco);
  const ok = esperado && JSON.stringify(esperado) === JSON.stringify(saiu);
  if (!ok) fabricacoes++;
  console.log(`   ${ok ? "✓" : "✗"} ${it.nome}: ${saiu.join("/")} (catálogo: ${esperado?.join("/") ?? "—"})`);
}

// 2) PropostaScope → PDF
t = Date.now();
const rPdf = await fetch(`${BASE}/api/pdf`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(scope),
});
if (!rPdf.ok) throw new Error(`pdf ${rPdf.status}: ${await rPdf.text()}`);
const buf = Buffer.from(await rPdf.arrayBuffer());
writeFileSync("generated/proposta-teste.pdf", buf);
const magic = buf.subarray(0, 4).toString("latin1");
console.log(`2. pdf OK (${Date.now() - t} ms) — ${(buf.length / 1024).toFixed(1)} KB, magic='${magic}'`);

console.log(`${"=".repeat(56)}`);
const pdfOk = magic === "%PDF";
console.log(`GUARDIÃO preço: ${fabricacoes === 0 ? "PASSOU (0 fabricações)" : `FALHOU (${fabricacoes})`}`);
console.log(`PDF válido: ${pdfOk ? "SIM" : "NÃO"}`);
console.log(`GATE briefing→PDF: ${fabricacoes === 0 && pdfOk ? "✅ VERDE" : "❌ VERMELHO"}`);
if (!(fabricacoes === 0 && pdfOk)) process.exitCode = 1;
