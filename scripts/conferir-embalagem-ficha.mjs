// Confere a EMBALAGEM cadastrada em data/catalogo.json contra o que diz a FICHA TÉCNICA
// (public/fichas-tecnicas/*.pdf). A ficha é o documento oficial do produto: quando as duas
// discordam, é a ficha que manda (constituição §1 — dado crítico não se inventa).
//
//   node scripts/conferir-embalagem-ficha.mjs            # só as divergências
//   node scripts/conferir-embalagem-ficha.mjs --todos    # todos os produtos, um por linha
//
// Nasceu do QA de imagem × embalagem (29/07): a folha de contato mostrou Spar HT-6 e
// Primmax Inox, cadastrados em 500 ml, com a foto do galão de 5 L. A ficha dos dois diz
// "apresentado em borrifadores plásticos de 500ml" — cadastro certo, foto errada. Este
// script generaliza a pergunta para os 150 produtos.
//
// Leitura do texto: pdfjs-dist (mesmo caminho de src/lib/contrato/extrair-texto.ts).
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

if (typeof globalThis.DOMMatrix === "undefined") globalThis.DOMMatrix = class DOMMatrix {};

const todos = process.argv.includes("--todos");
const catalogo = JSON.parse(readFileSync("data/catalogo.json", "utf8"));
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function texto(caminho) {
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(readFileSync(caminho)) });
  const doc = await tarefa.promise;
  const pgs = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    pgs.push(c.items.map((it) => it.str ?? "").join(" "));
  }
  await tarefa.destroy();
  return pgs.join("\n");
}

// Âncora: TODA ficha descreve a embalagem como "é apresentado em ...". O título varia
// ("EMBALAGEM:" nas linhas Indeba, "EMBALAGEM" sem dois-pontos nas Pratt), e "EMBALAGEM"
// ainda aparece solto em "NÃO REUTILIZAR A EMBALAGEM VAZIA" — a frase é o que não varia.
// (Nota: "EMBALAGEM" é com M; `EMBALAGENS?` casaria "EMBALAGEN" e não casa nada.)
// `em|e` porque a ficha do Metalic 5 SI tem o typo "é apresentado e bombonas plásticas".
const FRASE = /apresentad[oa]s?\s+(?:em|e)\s+([\s\S]{0,260}?)(?:\.\s|\.$|$)/i;
const TAMANHO = /(\d+(?:[.,]\d+)?)\s*(ml|litros?|L|kg|quilos?)\b/gi;

// O texto extraído do PDF quebra unidade ("20k g", "500m l") e usa ponto de milhar
// ("IBC de 1.240 kg", "1.000 litros") — sem normalizar, 1.240 kg vira 1,24 kg.
const limpar = (s) =>
  s
    .replace(/(\d)\s*k\s*g\b/gi, "$1 kg")
    .replace(/(\d)\s*m\s*l\b/gi, "$1 ml")
    .replace(/\b(\d{1,3})\.(\d{3})\b/g, "$1$2");

const norm = (n, u) => {
  const valor = Number(String(n).replace(",", "."));
  const un = /^ml$/i.test(u) ? "ml" : /^(kg|quilos?)$/i.test(u) ? "kg" : "L";
  return `${valor}${un}`;
};

const semFicha = [];
const semSecao = [];
const divergentes = [];
const conferem = [];

for (const p of catalogo.produtos) {
  const rel = p.fichaTecnicaPath?.replace(/^\//, "");
  const caminho = rel ? join("public", rel) : null;
  if (!caminho || !existsSync(caminho)) {
    semFicha.push(p.codigo);
    continue;
  }
  const t = limpar((await texto(caminho)).replace(/\s+/g, " "));
  const secao = FRASE.exec(t)?.[1];
  if (!secao) {
    semSecao.push(p.codigo);
    continue;
  }
  const naFicha = [...secao.matchAll(TAMANHO)].map((m) => norm(m[1], m[2]));
  const noCadastro = p.embalagens.map((e) => `${e.tamanho}${e.unidade}`);
  const soNaFicha = naFicha.filter((x) => !noCadastro.includes(x));
  const soNoCadastro = noCadastro.filter((x) => !naFicha.includes(x));
  const linha = {
    codigo: p.codigo,
    nome: p.nome,
    cadastro: noCadastro,
    ficha: [...new Set(naFicha)],
    soNaFicha: [...new Set(soNaFicha)],
    soNoCadastro,
    trecho: secao.trim().slice(0, 180),
  };
  if (soNaFicha.length || soNoCadastro.length) divergentes.push(linha);
  else conferem.push(linha);
}

const total = catalogo.produtos.length;
console.log(`produtos: ${total} · conferem: ${conferem.length} · divergentes: ${divergentes.length} · sem a frase de embalagem na ficha: ${semSecao.length} · sem ficha: ${semFicha.length}\n`);

for (const d of divergentes) {
  console.log(`— ${d.nome} (${d.codigo})`);
  console.log(`    cadastro: [${d.cadastro.join(", ")}]  ficha: [${d.ficha.join(", ")}]`);
  if (d.soNoCadastro.length) console.log(`    NO CADASTRO E NÃO NA FICHA: ${d.soNoCadastro.join(", ")}`);
  if (d.soNaFicha.length) console.log(`    NA FICHA E NÃO NO CADASTRO: ${d.soNaFicha.join(", ")}`);
  console.log(`    "${d.trecho}"`);
}
if (todos) {
  console.log("\n--- conferem ---");
  for (const c of conferem) console.log(`  ${c.nome}: [${c.cadastro.join(", ")}]`);
}
if (semSecao.length) console.log(`\nsem a frase "apresentado em ..." na ficha: ${semSecao.join(", ")}`);
if (semFicha.length) console.log(`\nsem ficha técnica no repo: ${semFicha.join(", ")}`);
