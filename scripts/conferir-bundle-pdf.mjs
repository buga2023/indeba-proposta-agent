// Guardião do tamanho da função /api/pdf (revisão de ops, 08/10/2026, item #23).
//
// A função serverless que gera PDF carrega o Chromium do @sparticuz/chromium. Três vezes
// em 2026 o deploy passou no build e morreu em "Deploying outputs" porque o tracing arrastou
// arquivos demais (fichas em public/, cópias do navegador, chaves de glob erradas) e a
// Lambda estourou os 250 MB descompactados. Aqui lemos a lista de arquivos que o Next
// traçou para a rota (route.js.nft.json), somamos os tamanhos e falhamos ANTES do deploy
// se passar do teto. Roda no CI depois do `next build`; roda local também.
import { readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// Dois níveis: acima de AVISO_MB o CI avisa (margem apertando); acima de TETO_MB falha. O
// limite real da Lambda é 250 MB descompactados; a medição local em Windows inclui o engine
// do Prisma para Windows (~20 MB), então o número do CI (Linux) é o que vale.
const AVISO_MB = Number(process.env.PDF_BUNDLE_AVISO_MB ?? 220);
const TETO_MB = Number(process.env.PDF_BUNDLE_TETO_MB ?? 250);
// Modo: por padrao AVISA (exit 0) e imprime o numero; com PDF_BUNDLE_STRICT=1 FALHA acima do
// teto. Comeca em aviso para calibrar o numero do Linux no CI antes de bloquear deploy.
const ESTRITO = process.env.PDF_BUNDLE_STRICT === "1";
const nft = resolve(".next/server/app/api/pdf/route.js.nft.json");

let lista;
try {
  lista = JSON.parse(readFileSync(nft, "utf8"));
} catch {
  console.error(`[bundle-pdf] não achei ${nft} — rode \`next build\` antes.`);
  process.exit(2);
}

const base = dirname(nft);
let total = 0;
const maiores = [];
for (const rel of lista.files ?? []) {
  const abs = join(base, rel);
  try {
    const st = statSync(abs);
    if (!st.isFile()) continue;
    // Engine do Prisma de OUTRA plataforma (ex.: query_engine-windows.dll.node medido no Windows)
    // nunca vai para a Lambda Linux: nao conta.
    if (/query_engine-(windows|darwin)/.test(rel)) continue;
    total += st.size;
    maiores.push([st.size, rel]);
  } catch {
    /* symlink quebrado ou arquivo opcional: não conta */
  }
}
maiores.sort((a, b) => b[0] - a[0]);
const mb = (n) => (n / 1024 / 1024).toFixed(1);

console.log(`[bundle-pdf] ${lista.files?.length ?? 0} arquivos traçados, ${mb(total)} MB (aviso ${AVISO_MB} MB, teto ${TETO_MB} MB)`);
// No GitHub Actions, vira anotação do run (visível em `gh run view` e na aba do commit) —
// é como se lê o número do Linux sem precisar baixar o log.
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=bundle-pdf::${mb(total)} MB em ${lista.files?.length ?? 0} arquivos (aviso ${AVISO_MB} MB, teto ${TETO_MB} MB)`);
for (const [tam, rel] of maiores.slice(0, 8)) console.log(`  ${mb(tam).padStart(7)} MB  ${rel}`);

if (total > AVISO_MB * 1024 * 1024 && total <= TETO_MB * 1024 * 1024) {
  console.warn(`[bundle-pdf] aviso: ${mb(total)} MB — a margem até os 250 MB da Lambda está apertando.`);
}
if (total > TETO_MB * 1024 * 1024) {
  console.error(`[bundle-pdf] ESTOUROU: ${mb(total)} MB > ${TETO_MB} MB. O deploy vai morrer em "Deploying outputs". Veja outputFileTracingIncludes em next.config.ts.`);
  process.exit(ESTRITO ? 1 : 0);
}
