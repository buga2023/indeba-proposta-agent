// Recalcula a imagem da embalagem cotada nas propostas JÁ SALVAS (tabela Proposta).
//
//   node --env-file=.env.local scripts/corrigir-imagem-propostas.mjs            # só o plano
//   node --env-file=.env.local scripts/corrigir-imagem-propostas.mjs --gravar   # aplica
//
// Por que existe: o `PropostaScope` guarda `itens[].imagemPath` RESOLVIDO na montagem — é
// um snapshot, e é ele que a revisão, o preview e o PDF usam quando a proposta é reaberta.
// Até 29/07 a tela manual mandava a embalagem cotada sem o `imagemPath` do catálogo, então
// a regra 1 de `imagemDaEmbalagem` ("foto do próprio tamanho vence tudo") não disparava e
// 29 pares com foto real do recipiente ficaram congelados na ARTE ilustrativa
// (src/lib/montar.ts, comFotoDoTamanho). Corrigir o código não desfaz o que já foi salvo:
// quem reabrir uma proposta antiga continua vendo o desenho. Daí este script.
//
// Ele só mexe em `scope.itens[].imagemPath`, e só quando o item é do CATÁLOGO (item próprio
// do vendedor traz imagem dele). Preço, quantidade, texto, status: nada é tocado.
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";

const gravar = process.argv.includes("--gravar");
const catalogo = JSON.parse(readFileSync("data/catalogo.json", "utf8"));
const porCodigo = new Map(catalogo.produtos.map((p) => [p.codigo, p]));

// Espelho de src/lib/imagem-produto.ts — o script roda em JS puro (sem build do TS), então
// a regra é reimplementada aqui. Guardião do original: tests/unit/embalagem-e-linha.test.ts.
const arte = (t, u) =>
  u === "ml" ? "_frasco" : u === "un" ? "_generico" :
  t <= 1 ? "_frasco" : t <= 9 ? "_galao-5l" : t <= 29 ? "_balde-20" :
  t <= 119 ? "_tonel-50" : t <= 600 ? "_tambor-200" : "_ibc-1000";

function imagemDaEmbalagem(p, e) {
  // re-hidrata a foto do próprio tamanho (o que a tela não reenvia) — igual comFotoDoTamanho
  const doCatalogo = p.embalagens.find((c) => c.tamanho === e.tamanho && c.unidade === e.unidade);
  const foto = e.imagemPath ?? doCatalogo?.imagemPath ?? null;
  if (foto) return foto;
  if (/^\/produtos\/_/.test(p.imagemPath)) return `/produtos/${arte(e.tamanho, e.unidade)}.svg`;
  if (!p.fotoEmbalagem) return p.imagemPath;
  return arte(e.tamanho, e.unidade) === arte(p.fotoEmbalagem.tamanho, p.fotoEmbalagem.unidade)
    ? p.imagemPath
    : `/produtos/${arte(e.tamanho, e.unidade)}.svg`;
}

const prisma = new PrismaClient();
const propostas = await prisma.proposta.findMany({ orderBy: { criadoEm: "desc" } });

let itensAuditados = 0;
const afetadas = [];
for (const row of propostas) {
  const itens = row.scope?.itens ?? [];
  const trocas = [];
  const novos = itens.map((it) => {
    itensAuditados++;
    const p = porCodigo.get(it.codigo);
    const e = it.embalagens?.[0];
    if (!p || !e) return it; // item próprio ou produto que saiu do catálogo: não mexe
    const alvo = imagemDaEmbalagem(p, e);
    if (alvo === it.imagemPath) return it;
    trocas.push({ nome: it.nome, tam: `${e.tamanho} ${e.unidade}`, de: it.imagemPath, para: alvo });
    return { ...it, imagemPath: alvo };
  });
  if (trocas.length) afetadas.push({ row, trocas, scope: { ...row.scope, itens: novos } });
}

console.log(`propostas: ${propostas.length} · itens auditados: ${itensAuditados} · afetadas: ${afetadas.length}\n`);
for (const { row, trocas } of afetadas) {
  console.log(`— ${row.criadoEm.toISOString().slice(0, 10)} · ${row.cliente} · ${row.status} · ${row.tipo} · ${row.id}`);
  for (const t of trocas) console.log(`    ${t.nome} ${t.tam}: ${t.de}  →  ${t.para}`);
}

if (!afetadas.length) {
  console.log("Nada a corrigir.");
} else if (!gravar) {
  console.log(`\nPlano apenas. Rode com --gravar para aplicar em ${afetadas.length} proposta(s).`);
} else {
  for (const { row, scope } of afetadas) {
    // `atualizadoEm` é @updatedAt e vai mudar — é correção de dado, e o histórico de PDFs
    // emitidos (log append-only) continua intocado.
    await prisma.proposta.update({ where: { id: row.id }, data: { scope } });
  }
  console.log(`\n${afetadas.length} proposta(s) corrigida(s).`);
}
await prisma.$disconnect();
