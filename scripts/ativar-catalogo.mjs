// Põe o catálogo real no ar: `ativo: true` para todo produto que tenha foto E ficha técnica
// em disco.
//
//   node scripts/ativar-catalogo.mjs            # só o plano
//   node scripts/ativar-catalogo.mjs --gravar   # aplica
//
// Por que existe: dos 150 produtos do catálogo, 141 estavam com `ativo: false` — resquício de
// como a base técnica INDEBA/PRATT foi importada, não decisão de negócio. A tela de Catálogo
// lista só `ativo`, então o Mateus via 9 produtos de 150 e reclamou (com razão) de "não tá
// aparecendo todos os produtos" e "Subzero não apareceu". Corrigir isso com um `if` no front
// seria esconder o problema: `ativo` é dado, e dado se corrige no dado.
//
// ATENÇÃO — `ativo` governa QUATRO caminhos, não só a vitrine:
//   src/lib/selecao/matcher.ts        seleção automática de produtos
//   src/lib/rag/indexar.ts            o que entra no índice do Qdrant
//   src/app/api/comando-edicao        a lista que a IA pode citar ao editar
//   src/components/ajuda-chat-logic   o que o assistente conhece
// Depois de gravar, rode `pnpm rag:index` para o RAG parar de responder pelo catálogo velho.
//
// O critério é asset em disco, não uma lista de códigos: hoje passa 150/150, mas ele tranca a
// porta para a próxima importação que traga produto sem foto ou sem ficha. `ativo` marca "está
// em linha" — nunca marcou "tem preço" (nenhum produto do catálogo tem preço; o valor vem do
// humano na montagem).
//
// Idempotente: rodar duas vezes não muda nada na segunda.

import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..");
const GRAVAR = process.argv.slice(2).includes("--gravar");

const CAT = path.join(RAIZ, "data/catalogo.json");
const PUBLIC = path.join(RAIZ, "public");
const cat = JSON.parse(fs.readFileSync(CAT, "utf8"));

// Duplicatas do seed inicial: cada uma aponta para o MESMO PDF de ficha da sua contraparte
// importada, o que é a evidência de que são o mesmo produto com o código grafado de outro
// jeito — e a versão importada é a que tem código, nome e foto reais. `pratt-alcool-gel.pdf`
// nem chega a existir; PRATT-ALCOOL-GEL vinha usando a ficha do -70.
//
//   SPAR-HT2          ≡ SPAR-HT-2            (spar-ht-2.pdf)
//   SPAR-HT3          ≡ SPAR-HT-3            (spar-ht-3.pdf)
//   PRATT-ALCOOL-GEL  ≡ PRATT-ALCOOL-GEL-70  (pratt-alcool-gel-70.pdf)
//
// Ficam arquivadas. Desativar código já usado em proposta salva não quebra nada: o
// PropostaScope é snapshot e comImagensDoCatalogo() só recalcula enquanto o código existir.
//
// NÃO entram aqui PRIMMAX-HORT/PRIMMAX-HORT-FLV nem PRIMMAX-LDF/PRIMMAX-LDF-PLUS: cada um
// tem ficha técnica própria, ou seja, são produtos distintos e os quatro seguem ativos.
const DUPLICATAS = new Set(["SPAR-HT2", "SPAR-HT3", "PRATT-ALCOOL-GEL"]);

const existe = (p) => typeof p === "string" && p.length > 0 && fs.existsSync(path.join(PUBLIC, p));

const ativar = [];
const semAsset = [];
const arquivar = [];

for (const p of cat.produtos) {
  const temFoto = existe(p.imagemPath);
  const temFicha = existe(p.fichaTecnicaPath);

  if (DUPLICATAS.has(p.codigo)) {
    arquivar.push(p);
    continue;
  }
  if (!temFoto || !temFicha) {
    semAsset.push({ p, temFoto, temFicha });
    continue;
  }
  ativar.push(p);
}

const mudam = [
  ...ativar.filter((p) => p.ativo !== true).map((p) => ({ p, para: true })),
  ...arquivar.filter((p) => p.ativo !== false).map((p) => ({ p, para: false })),
  ...semAsset.filter(({ p }) => p.ativo !== false).map(({ p }) => ({ p, para: false })),
];

console.log(
  `produtos: ${cat.produtos.length} · ativos ao fim: ${ativar.length} · duplicatas arquivadas: ${arquivar.length} · sem asset: ${semAsset.length} · mudam agora: ${mudam.length}\n`,
);

for (const { p, para } of mudam) {
  console.log(`${para ? "★ ativa " : "  arquiva"} ${p.codigo.padEnd(30)} ${p.nome}`);
}
if (!mudam.length) console.log("  (nada a mudar — o catálogo já está no estado desejado)");

if (arquivar.length) {
  console.log(`\n--- ${arquivar.length} duplicatas que ficam arquivadas de propósito:`);
  for (const p of arquivar) console.log(`    ${p.codigo.padEnd(30)} ficha: ${p.fichaTecnicaPath}`);
}
if (semAsset.length) {
  console.log(`\n--- ${semAsset.length} produtos sem asset em disco (não podem ser ativados):`);
  for (const { p, temFoto, temFicha } of semAsset) {
    const falta = [!temFoto && "foto", !temFicha && "ficha"].filter(Boolean).join(" e ");
    console.log(`    ! ${p.codigo.padEnd(30)} falta ${falta}`);
  }
}

if (!GRAVAR) { console.log("\n(plano só — rode com --gravar para aplicar)"); process.exit(0); }
if (!mudam.length) { console.log("\nnada gravado."); process.exit(0); }

for (const { p, para } of mudam) p.ativo = para;
fs.writeFileSync(CAT, JSON.stringify(cat, null, 2) + "\n");
console.log(`\ncatálogo gravado (${mudam.length} produtos) — reinicie o dev server (o catálogo é cacheado em módulo) e rode: pnpm rag:index`);
