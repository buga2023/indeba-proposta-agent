// Importa um pacote de fotos de produto da Indeba (a pasta "Fotos Produtos" que o Gustavo
// mandou em 29/07) para public/produtos + data/catalogo.json.
//
//   node scripts/importar-fotos-produto.mjs "<pasta do pacote>"            # só o plano
//   node scripts/importar-fotos-produto.mjs "<pasta do pacote>" --gravar   # aplica
//   node scripts/gerar-cutouts.mjs                                        # depois, sempre
//
// O NOME DO ARQUIVO diz a embalagem — é essa a informação que faltava pra imagem seguir a
// embalagem cotada em vez da foto fixa do produto (ver src/lib/imagem-produto.ts):
//
//   BB05L / BB05 / BB5L / BD05    bombona ou balde de 5 L
//   BD20 / BD20L / BB20 / SC20    balde 20, saco 20 (pó)
//   BD22 / BB25L                  balde 22, bombona 25
//   BD04                          balde 4
//   BB32 / BB35                   32 / 35 kg
//   BB50 / BB50L / 50L            bombona de 50 L
//   TB200 / TB220                 tambor de 200 / 220
//   G500 / Borrifador             frasco de 500 ml
//
// Regra de importação: entra SÓ o que falta — cada par (produto, embalagem) que hoje cai em
// arte ilustrativa, e cada produto sem foto nenhuma. Foto que já está certa no catálogo não
// é tocada, e nada sobrescreve `embalagens[].imagemPath` já cadastrado.
//
// O pacote costuma trazer coisa que NÃO entra: variante de fragrância de produto que o
// catálogo tem como um só, cópia duplicada, produto fora do catálogo e até planilha de
// clientes. Nada disso é adivinhado: o que não casa é listado no fim e fica de fora.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const GRAVAR = args.includes("--gravar");
const PACOTE = args.find((a) => !a.startsWith("--"));

if (!PACOTE || !fs.existsSync(PACOTE)) {
  console.error('uso: node scripts/importar-fotos-produto.mjs "<pasta do pacote>" [--gravar]');
  process.exit(1);
}

const CAT = path.join(RAIZ, "data/catalogo.json");
const PUBLIC = path.join(RAIZ, "public");
const cat = JSON.parse(fs.readFileSync(CAT, "utf8"));

// Código de embalagem no nome do arquivo → volume nominal do recipiente, em litros.
const CODIGOS = [
  [/[_\- ]?BB0?5L?\b/i, 5], [/[_\- ]?BD0?5L?\b/i, 5], [/\b0?5L\b/i, 5],
  [/[_\- ]?B[BD]20L?\b/i, 20], [/[_\- ]?SC20\b/i, 20], [/[_\- ]?B[BD]2[25]L?\b/i, 22],
  [/[_\- ]?B[BD]0?4\b/i, 4], [/[_\- ]?BB32\b/i, 32], [/[_\- ]?BB35\b/i, 35],
  [/[_\- ]?BB50L?\b/i, 50], [/\b50L\b/i, 50],
  [/[_\- ]?TB200\b/i, 200], [/[_\- ]?TB220\b/i, 220],
  [/[_\- ]?G500\b/i, 0.5], [/Borrifador/i, 0.5],
];

// Mesma faixa de recipiente de src/lib/imagem-produto.ts — em kg é o recipiente pesado,
// então 23 kg e 20 L são o mesmo balde e casam com a mesma foto.
const FAMILIA = (t) => (t <= 1 ? "frasco" : t <= 9 ? "galao" : t <= 29 ? "balde" : t <= 119 ? "tonel" : t <= 600 ? "tambor" : "ibc");
const familiaEmb = (e) => FAMILIA(e.unidade === "ml" ? e.tamanho / 1000 : e.tamanho);

const normal = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(\d+\)/g, "")
    .toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();

// Nome do arquivo → código do catálogo, quando o nome não casa por si: erro de digitação do
// pacote, sufixo que o catálogo tem e o arquivo não, e vice-versa.
const ALIAS = {
  "SPAR FOOR PLUS": "SPAR-FLOOR-PLUS",
  "TEXPAR DTC": "TEXSPAR-DTC",
  "SPAR HT 5": "SPAR-HT-5",
  "SPAR HT 9": "SPAR-HT-9",
  "ALVACLOR 180": "ALVACLOR-180-ALVEJANTE",
  LETAZYME: "LETAHZYME-MULTIENZIMATICO-5E",
  "METALIC 2S": "METALIC-2-S",
  "METALIC 3SI": "METALIC-3-SI",
  "METALIC 4SI": "METALIC-4-SI",
  "METALIC 5SI": "METALIC-5-SI",
  "PRATT AMACIANETE PREMIUM": "PRATT-AMACIANTE-PREMIUM",
  "PRATT AMACIANTE": "PRATT-AMACIANTE",
  "PRATT HIPOCLORITO": "PRATT-HIPOCLORITO-1",
  "PRATT ALCOOL GEL 70": "PRATT-ALCOOL-GEL-70",
  "PRATT CLOR 2": "PRATT-CLOR-2",
  "PRATT MULTIUSO": "PRATT-MULTIUSO",
  "PRATT SABONETE ESPUMA LIRIO DO CAMPO": "PRATT-SABONETE-ESPUMA",
  "PRATT SABONETE PEROLIZADO": "PRATT-SABONETE-PEROLIZADO",
  "PRATT POS OBRA": "PRATT-POS-OBRA",
  "SPAR HT 2 FLORAL": "SPAR-HT2",
  "SPAR HT 3": "SPAR-HT3",
};

// Foto ambígua ou de produto fora do catálogo: fica de fora por decisão explícita — foto
// que não se sabe de que produto/tamanho é não vai pra proposta.
const IGNORAR = {
  "Primmax Oxy_BB05L.jpg": "catálogo tem 'Primma Oxy S' em 20 kg (saco), não bombona de 5 L",
  "Primmax CL_50L.png": "Primmax CL está cadastrado só em 5 L e 20 L",
  "Alvaclor_BD20.jpg": "não diz se é o 165 ou o 180",
  "Spar Pro 1_BB05L.png": "produto fora do catálogo",
  "Spar Pro 2_BB05L .png": "produto fora do catálogo",
  "Spar Pro 3_BB05L.png": "produto fora do catálogo",
  "Spar Pro 4_BB05L.png": "produto fora do catálogo",
  "Pratt Auto_BB05L.png": "produto fora do catálogo",
  "Pratt Letahgel_BB05L.jpg": "produto fora do catálogo",
  "Pratt Floral.png": "sem a linha no nome — não diz se é desinfetante ou sabonete",
  "Pratt Lavanda.png": "idem",
  "Pratt Citronela.png": "idem",
  "Pratt Limao do Bosque.png": "idem",
  "Pratt Ultra Aromas da Floresta.png": "variante; 'Pratt Ultra.png' é a do catálogo",
};

// Índice do pacote (recursivo — o pacote vem separado por linha de produto)
const fotos = [];
const varrer = (dir) => {
  for (const nome of fs.readdirSync(dir)) {
    const abs = path.join(dir, nome);
    if (fs.statSync(abs).isDirectory()) { varrer(abs); continue; }
    if (!/\.(png|jpe?g)$/i.test(nome)) continue;
    if (IGNORAR[nome] || /^Cópia de /i.test(nome)) continue; // cópia sempre tem o original ao lado
    let base = nome.replace(/\.(png|jpe?g)$/i, "");
    let volume = null;
    for (const [re, v] of CODIGOS) {
      if (re.test(base)) { volume = v; base = base.replace(re, " "); break; }
    }
    fotos.push({ arquivo: nome, abs, volume, chave: normal(base) });
  }
};
varrer(PACOTE);

const porChave = new Map(cat.produtos.map((p) => [normal(p.nome), p.codigo]));
const codigoDe = (chave) => ALIAS[chave] ?? porChave.get(chave) ?? null;

// (produto, família de recipiente) → melhor foto. Empate: .png antes de .jpg, depois o
// nome mais curto — determinístico, pra rodar duas vezes dar o mesmo resultado.
const melhor = new Map();
const orfas = [];
for (const f of fotos) {
  const codigo = codigoDe(f.chave);
  const prod = codigo && cat.produtos.find((p) => p.codigo === codigo);
  if (!prod) { orfas.push(f); continue; }
  // Sem código de embalagem no nome (a linha Pratt inteira): assume o tamanho de galão do
  // produto, que é como a Pratt é vendida; sem galão, a primeira embalagem.
  const fam = f.volume !== null
    ? FAMILIA(f.volume)
    : prod.embalagens.some((e) => familiaEmb(e) === "galao") ? "galao" : familiaEmb(prod.embalagens[0]);
  const k = `${codigo}|${fam}`;
  const nota = (x) => [x.arquivo.toLowerCase().endsWith(".png") ? 0 : 1, x.arquivo.length, x.arquivo].join("");
  const atual = melhor.get(k);
  if (!atual || nota(f) < nota(atual)) melhor.set(k, { ...f, codigo, familia: fam });
}

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ilustrativa = (p) => /^\/produtos\/_/.test(p);

const plano = [];
for (const p of cat.produtos) {
  const semFotoPropria = ilustrativa(p.imagemPath);
  const famFoto = p.fotoEmbalagem ? familiaEmb(p.fotoEmbalagem) : null;
  for (const e of p.embalagens) {
    if (e.imagemPath) continue;                        // tamanho já tem foto própria
    const fam = familiaEmb(e);
    if (!semFotoPropria && famFoto === null) continue; // tamanho único não auditado: nada a trocar
    if (!semFotoPropria && fam === famFoto) continue;  // a foto do produto já é esse recipiente
    const f = melhor.get(`${p.codigo}|${fam}`);
    if (!f) { plano.push({ tipo: "FALTA", codigo: p.codigo, e, fam }); continue; }
    // Produto sem foto nenhuma: a foto do tamanho principal vira a foto do PRODUTO.
    const principal = semFotoPropria && familiaEmb(p.embalagens[0]) === fam;
    plano.push({
      tipo: principal ? "PRINCIPAL" : "TAMANHO", codigo: p.codigo, e, fam,
      origem: f.abs, arquivo: f.arquivo,
      destino: principal ? `/produtos/${slug(p.nome)}.png` : `/produtos/${slug(p.nome)}-${fam}.png`,
    });
  }
}

for (const it of plano) {
  const tam = `${it.e.tamanho}${it.e.unidade}`.padEnd(7);
  if (it.tipo === "FALTA") console.log(`  falta  ${it.codigo.padEnd(30)} ${tam} (${it.fam}) — o pacote não tem foto desse recipiente`);
  else console.log(`${it.tipo === "PRINCIPAL" ? "★ princ" : "  tam. "} ${it.codigo.padEnd(30)} ${tam} ← ${it.arquivo.padEnd(40)} → ${it.destino}`);
}
const importar = plano.filter((x) => x.tipo !== "FALTA");
console.log(`\n--- ${importar.length} fotos a importar; ${plano.length - importar.length} pares seguem em arte ilustrativa`);
if (orfas.length) {
  console.log(`--- ${orfas.length} fotos do pacote sem produto correspondente (ficam de fora):`);
  for (const o of orfas) console.log(`    ${o.arquivo}  → chave "${o.chave}"`);
}

if (!GRAVAR) { console.log("\n(plano só — rode com --gravar para aplicar)"); process.exit(0); }

for (const it of importar) {
  // Altura 900 é o padrão das fotos do repo (commit 2e0f012); fundo achatado em branco
  // porque é do fundo branco que gerar-cutouts.mjs recorta.
  const info = await sharp(it.origem)
    .flatten({ background: "#ffffff" })
    .resize({ height: 900, withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PUBLIC, it.destino));
  const prod = cat.produtos.find((p) => p.codigo === it.codigo);
  const emb = prod.embalagens.find((e) => e.tamanho === it.e.tamanho && e.unidade === it.e.unidade);
  if (it.tipo === "PRINCIPAL") {
    prod.imagemPath = it.destino;
    prod.fotoEmbalagem = { tamanho: emb.tamanho, unidade: emb.unidade };
  } else {
    emb.imagemPath = it.destino;
  }
  console.log(`✓ ${it.destino} (${info.width}x${info.height})`);
}
fs.writeFileSync(CAT, JSON.stringify(cat, null, 2) + "\n");
console.log("catálogo gravado — rode agora: node scripts/gerar-cutouts.mjs");
