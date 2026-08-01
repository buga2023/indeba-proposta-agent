// Promove uma conta a gestor (papel=admin, acesso=aprovado) direto no banco.
//
//   node --env-file=.env.local scripts/promover-gestor.mts            # só mostra quem é quem
//   node --env-file=.env.local scripts/promover-gestor.mts a@b.com --confirmar
//
// Existe para resolver o galinha-e-ovo do painel de acessos: quem aprova os outros é o
// gestor, e o painel só abre para quem já é gestor. Se a conta do dono foi criada ANTES de
// ADMIN_EMAILS existir, ela nasceu `user` — e aí não há por onde se promover pela interface.
// `papelPara()` (src/lib/auth-db.ts) só decide o papel no momento do cadastro; mudar a env
// depois não reclassifica ninguém.
//
// Imprime o host do banco antes de escrever, para não promover alguém no ambiente errado.
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.includes("@") ? process.argv[2].trim().toLowerCase() : null;
const CONFIRMAR = process.argv.includes("--confirmar");

// --env-file do Node não tira aspas em todo caso; o PrismaClient recebe a URL já limpa.
const url = (process.env.DATABASE_URL ?? "").replace(/^["']|["']$/g, "");
if (!url) {
  console.error("DATABASE_URL ausente — rode com: node --env-file=.env.local scripts/promover-gestor.mts");
  process.exit(1);
}

// Um `new URL()` cru aqui cospe stack trace de node:internal/url quando a string não é uma
// URL — e o caso mais comum não é digitação: é colar o texto do exemplo (<string-do-...>)
// achando que é o valor. O erro tem que dizer isso.
let host: string;
try {
  host = new URL(url).host;
} catch {
  console.error(`DATABASE_URL não é uma URL de banco válida: ${url}\n`);
  console.error("Ela precisa ser a connection string de verdade, começando com postgresql://");
  console.error("  local .....: node --env-file=.env.local scripts/promover-gestor.mts");
  console.error("  produção ..: pegue em Supabase → Project Settings → Database → Connection string");
  process.exit(1);
}
console.log(`banco: ${host}\n`);

const prisma = new PrismaClient({ datasources: { db: { url } } });

const usuarios = await prisma.usuario.findMany({
  select: { nome: true, email: true, papel: true, acesso: true },
  orderBy: { criadoEm: "asc" },
});

console.log(`${usuarios.length} conta(s):`);
for (const u of usuarios) {
  const marca = u.papel === "admin" ? "★" : " ";
  console.log(`  ${marca} ${u.email.padEnd(38)} ${u.papel.padEnd(6)} ${u.acesso}   ${u.nome}`);
}

const gestores = usuarios.filter((u) => u.papel === "admin" && u.acesso === "aprovado");
console.log(`\ngestores ativos: ${gestores.length}`);
if (gestores.length === 0) {
  console.log("!! Ninguém pode aprovar cadastros nem abrir o painel de Configurações.");
}

if (!email) {
  console.log("\n(sem e-mail no argumento — nada a fazer)");
  console.log("uso: node --env-file=.env.local scripts/promover-gestor.mts SEU@EMAIL.com --confirmar");
  await prisma.$disconnect();
  process.exit(0);
}

const alvo = usuarios.find((u) => u.email.toLowerCase() === email);
if (!alvo) {
  console.error(`\n! Nenhuma conta com o e-mail ${email}. Crie a conta em /cadastro primeiro.`);
  await prisma.$disconnect();
  process.exit(1);
}
if (alvo.papel === "admin" && alvo.acesso === "aprovado") {
  console.log(`\n${email} já é gestor com acesso liberado — nada a fazer.`);
  await prisma.$disconnect();
  process.exit(0);
}

console.log(`\nplano: ${email} → papel=admin, acesso=aprovado (era papel=${alvo.papel}, acesso=${alvo.acesso})`);
if (!CONFIRMAR) {
  console.log("(plano só — rode com --confirmar para aplicar)");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.usuario.update({ where: { email: alvo.email }, data: { papel: "admin", acesso: "aprovado" } });
console.log(`✓ ${email} agora é gestor. Saia e entre de novo para a sessão pegar o papel novo.`);
await prisma.$disconnect();
