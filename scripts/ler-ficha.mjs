// Extrai o texto de uma ficha técnica em public/fichas-tecnicas para conferência manual.
// A ficha é a fonte da verdade da EMBALAGEM (constituição §1) — foi por ela que se
// confirmaram os tamanhos de Spar HT-6 e Primmax Inox no QA de 29/07.
//
//   node scripts/ler-ficha.mjs spar-ht-6                 # texto inteiro
//   node scripts/ler-ficha.mjs spar-ht-6 --embalagem     # só as linhas de embalagem
import { readFileSync } from "node:fs";
import { join } from "node:path";

if (typeof globalThis.DOMMatrix === "undefined") globalThis.DOMMatrix = class DOMMatrix {};

const alvo = process.argv[2];
if (!alvo) {
  console.error("uso: node scripts/ler-ficha.mjs <slug-da-ficha> [--embalagem]");
  process.exit(1);
}
const soEmbalagem = process.argv.includes("--embalagem");
const caminho = join("public", "fichas-tecnicas", alvo.endsWith(".pdf") ? alvo : `${alvo}.pdf`);

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const tarefa = pdfjs.getDocument({ data: new Uint8Array(readFileSync(caminho)) });
const doc = await tarefa.promise;
const paginas = [];
for (let i = 1; i <= doc.numPages; i++) {
  const content = await (await doc.getPage(i)).getTextContent();
  paginas.push(content.items.map((it) => it.str ?? "").join(" "));
}
await tarefa.destroy();

const texto = paginas.join("\n");
if (!soEmbalagem) {
  console.log(texto);
} else {
  // "EMBALAGEM", "Embalagens", litros/ml/kg soltos — o rótulo varia por ficha.
  const linhas = texto.split(/\n|(?<=\.)\s{2,}/);
  const achados = linhas.filter((l) => /embalagem|embalagens|\b\d+\s?(ml|mL|L|litros?|kg)\b/i.test(l));
  console.log(achados.length ? achados.join("\n---\n") : "(nada que pareça embalagem)");
}
