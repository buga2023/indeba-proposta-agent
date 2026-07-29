// Zera a tabela Proposta, com dump JSON antes (rede de segurança).
//
// DESTRUTIVO E IRREVERSÍVEL. Exige --confirmar explícito justamente pra não rodar por
// acidente (um `tsx scripts/*` distraído não apaga o banco). O dump sai antes do DELETE
// e é reinserível: Decimal/Date já vão convertidos pra string.
//
//   npx tsx --env-file=.env.local scripts/zerar-propostas.mts backup.json --confirmar
//
// Aponta pro banco do DATABASE_URL do --env-file: confira qual ambiente é ANTES.
// Não mexe no log append-only (lib/log.ts) — a auditoria dos PDFs emitidos continua.
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

// `vercel env pull` grava os valores entre aspas e o parser do --env-file do Node as
// mantém dentro do valor, então o Prisma recebia `"postgresql://…"` e recusava o
// protocolo. Normaliza aqui e passa a URL explícita — não depende de como o env veio.
const url = (process.env.DATABASE_URL ?? "").trim().replace(/^["']|["']$/g, "");
if (!/^postgres(ql)?:\/\//.test(url)) {
  // Diagnóstico sem vazar credencial: só o comprimento e o prefixo até o "://".
  const bruto = process.env.DATABASE_URL;
  const prefixo = url.slice(0, Math.max(url.indexOf("://") + 3, 14));
  throw new Error(
    `DATABASE_URL não parece uma URL Postgres.\n` +
      `  definida: ${bruto === undefined ? "NÃO (undefined)" : "sim"}\n` +
      `  comprimento após limpeza: ${url.length}\n` +
      `  começa com: ${JSON.stringify(prefixo)}\n` +
      `  confira o --env-file apontado.`,
  );
}

// Mostra em QUAL banco vai mexer, sem vazar usuário/senha: DELETE no ambiente errado
// é o tipo de engano que não tem desfazer.
const alvo = new URL(url);
console.log(`banco alvo: ${alvo.hostname}${alvo.port ? ":" + alvo.port : ""}${alvo.pathname}\n`);

const prisma = new PrismaClient({ datasources: { db: { url } } });
const [destino, ...resto] = process.argv.slice(2);

if (!destino) throw new Error("uso: zerar-propostas.mts <arquivo-de-backup.json> --confirmar");

const rows = await prisma.proposta.findMany({ orderBy: { criadoEm: "asc" } });
console.log(`propostas na tabela: ${rows.length}`);

const porStatus = new Map<string, number>();
for (const r of rows) porStatus.set(r.status, (porStatus.get(r.status) ?? 0) + 1);
console.log("por status:", [...porStatus].map(([s, n]) => `${s}=${n}`).join(" ") || "(vazia)");

writeFileSync(
  destino,
  JSON.stringify(
    rows.map((r) => ({
      ...r,
      total: r.total.toString(),
      criadoEm: r.criadoEm.toISOString(),
      atualizadoEm: r.atualizadoEm.toISOString(),
    })),
    null,
    2,
  ),
  "utf8",
);
console.log(`backup salvo em: ${destino}`);

if (!resto.includes("--confirmar")) {
  console.log("\nDRY-RUN: nada foi apagado. Repita com --confirmar pra executar o DELETE.");
  await prisma.$disconnect();
  process.exit(0);
}

const { count } = await prisma.proposta.deleteMany({});
console.log(`\nAPAGADAS: ${count} | restantes: ${await prisma.proposta.count()}`);
await prisma.$disconnect();
