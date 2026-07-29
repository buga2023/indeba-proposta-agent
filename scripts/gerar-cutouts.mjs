// Gera os recortes de fundo das fotos de produto (`<foto>-cutout.png`) usadas no card
// BRANCO da ficha da Proposta Consolidada. A foto de estúdio vem com fundo branco opaco;
// sobre o card branco isso desenha uma "caixa" visível ("o meio ficou branco com cinza",
// áudio do Matheus 24/07). O recorte tira só o fundo, nunca o produto.
//
// Método: flood-fill a partir das BORDAS da imagem (o fundo é o que encosta na moldura) —
// nunca por cor global, senão um rótulo branco no meio do frasco também sumiria.
//
//   node scripts/gerar-cutouts.mjs           # só os que faltam
//   node scripts/gerar-cutouts.mjs --forcar  # regenera todos
//   node scripts/gerar-cutouts.mjs --forcar Spar HT-1   # regenera os que casam com o filtro
//
// Nem toda foto sobrevive: embalagem translúcida (o fundo "vaza" pra dentro do produto) é
// corroída pelo flood-fill. Essas ficam listadas em EXCECOES e caem no fallback da foto
// original — `resolverImagemProduto` em src/lib/pdf/render.ts já trata a ausência.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const RAIZ = path.resolve(import.meta.dirname, "..");
const PUBLIC = path.join(RAIZ, "public");

// Fotos cujo recorte automático come o produto (bordas translúcidas). Mantidas SEM
// cutout de propósito — ver spec §5. Regenerar às cegas volta a estragá-las.
const EXCECOES = new Set(["Candall Cosmetic WR", "Spar HT3"]);

// Fundo = quase-branco. 236 deixa passar a sombra suave do estúdio sem morder o produto.
const LIMIAR_FUNDO = 236;
// Faixa de anti-aliasing: acima disso a borda vira semitransparente em vez de um degrau
// serrilhado branco contra o card.
const LIMIAR_BORDA = 214;

const eFundo = (d, i) => d[i] >= LIMIAR_FUNDO && d[i + 1] >= LIMIAR_FUNDO && d[i + 2] >= LIMIAR_FUNDO;

// Parte do catálogo já vem do fornecedor com fundo transparente (Soft's Concentrado,
// Spar HT-8 Oxy). Nesses não há o que recortar: gerar um "-cutout.png" idêntico só
// duplicaria peso no repo — o render cai na foto original, que já está certa.
const jaTransparente = (data, w, h, ch) => {
  if (ch < 4) return false;
  let borda = 0, vazios = 0;
  const olhar = (x, y) => { borda++; if (data[(y * w + x) * ch + 3] < 16) vazios++; };
  for (let x = 0; x < w; x++) { olhar(x, 0); olhar(x, h - 1); }
  for (let y = 0; y < h; y++) { olhar(0, y); olhar(w - 1, y); }
  return vazios / borda > 0.5;
};

async function recortar(origem, destino) {
  const img = sharp(origem).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  if (jaTransparente(data, w, h, ch)) return { jaOk: true };

  // Flood-fill iterativo (pilha própria — recursão estoura em foto de 900px).
  const fundo = new Uint8Array(w * h);
  const pilha = [];
  const empilhar = (x, y) => {
    const p = y * w + x;
    if (fundo[p]) return;
    if (!eFundo(data, p * ch)) return;
    fundo[p] = 1;
    pilha.push(p);
  };
  for (let x = 0; x < w; x++) { empilhar(x, 0); empilhar(x, h - 1); }
  for (let y = 0; y < h; y++) { empilhar(0, y); empilhar(w - 1, y); }

  while (pilha.length) {
    const p = pilha.pop();
    const x = p % w, y = (p / w) | 0;
    if (x > 0) empilhar(x - 1, y);
    if (x < w - 1) empilhar(x + 1, y);
    if (y > 0) empilhar(x, y - 1);
    if (y < h - 1) empilhar(x, y + 1);
  }

  // Alpha: fundo some; o que sobra fica opaco, exceto a franja clara que faz fronteira
  // com o fundo (anti-aliasing da foto original) — essa vira semitransparente.
  let opacos = 0;
  for (let p = 0; p < w * h; p++) {
    const i = p * ch;
    if (fundo[p]) { data[i + 3] = 0; continue; }
    opacos++;
    const x = p % w, y = (p / w) | 0;
    const vizinhoFundo =
      (x > 0 && fundo[p - 1]) || (x < w - 1 && fundo[p + 1]) ||
      (y > 0 && fundo[p - w]) || (y < h - 1 && fundo[p + w]);
    if (!vizinhoFundo) continue;
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (lum > LIMIAR_BORDA) {
      data[i + 3] = Math.round(255 * (1 - (lum - LIMIAR_BORDA) / (LIMIAR_FUNDO - LIMIAR_BORDA)));
    }
  }

  await sharp(data, { raw: { width: w, height: h, channels: ch } }).png({ compressionLevel: 9 }).toFile(destino);
  return { restante: opacos / (w * h) };
}

const args = process.argv.slice(2);
const forcar = args.includes("--forcar");
const filtro = args.filter((a) => !a.startsWith("--")).join(" ").toLowerCase();

const catalogo = JSON.parse(fs.readFileSync(path.join(RAIZ, "data/catalogo.json"), "utf8"));
const produtos = Array.isArray(catalogo) ? catalogo : catalogo.produtos;

for (const p of produtos) {
  if (!p.imagemPath) continue;
  if (filtro && !p.nome.toLowerCase().includes(filtro)) continue;
  if (EXCECOES.has(p.nome)) { console.log(`· ${p.nome} — exceção (embalagem translúcida), sem cutout`); continue; }

  const origem = path.join(PUBLIC, p.imagemPath);
  const destino = path.join(PUBLIC, p.imagemPath.replace(/\.(jpe?g|png)$/i, "-cutout.png"));
  if (!fs.existsSync(origem)) { console.log(`! ${p.nome} — foto original não existe: ${p.imagemPath}`); continue; }
  if (fs.existsSync(destino) && !forcar) continue;

  const { restante, jaOk } = await recortar(origem, destino);
  if (jaOk) { console.log(`· ${p.nome} — foto original já tem fundo transparente, dispensa cutout`); continue; }
  console.log(`✓ ${p.nome} — ${(restante * 100).toFixed(1)}% da área preservada → ${path.basename(destino)}`);
}
