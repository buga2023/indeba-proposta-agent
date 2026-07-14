/**
 * Migração única: injeta os usuários do antigo AUTH_USERS direto na tabela Usuario,
 * reaproveitando o hash de senha ("salt.hash", PBKDF2) já existente — ninguém troca de
 * senha. Pegue o AUTH_USERS atual (Vercel ou .env.local) e copie o "salt.hash" de cada
 * login (formato "login:salt.hash:papel", separados por vírgula).
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/migrar-usuarios-legado.mts \
 *     "Gustavo Santos:gustavossantos2905@gmail.com:SALTHEX.HASHHEX,Mateus Nome:mateus@email.com:SALTHEX.HASHHEX"
 *
 * papel é decidido por ADMIN_EMAILS (env) — mesma regra do cadastro novo
 * (src/lib/auth-db.ts), não o papel antigo do AUTH_USERS.
 *
 * Roda uma vez só. Depois de confirmar que os logins funcionam, remova AUTH_USERS do
 * env/Vercel (não é mais lido por nada).
 */
import { prisma } from "../src/lib/db.ts";

function papelPara(email: string): "admin" | "user" {
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase()) ? "admin" : "user";
}

const entrada = process.argv[2];
if (!entrada) {
  console.error(
    'Uso: npx tsx --env-file=.env.local scripts/migrar-usuarios-legado.mts "nome:email:salt.hash,..."',
  );
  process.exit(1);
}

for (const item of entrada.split(",")) {
  const partes = item.split(":");
  const [nome, email, credencial] = partes;
  if (partes.length !== 3 || !nome || !email || !credencial?.includes(".")) {
    console.error(`Entrada inválida (esperado nome:email:salt.hash): "${item}"`);
    process.exit(1);
  }
  const papel = papelPara(email);
  await prisma.usuario.upsert({
    where: { email },
    create: { nome, email, credencial, papel },
    update: { nome, credencial, papel },
  });
  console.log(`OK: ${email} → papel=${papel}`);
}

await prisma.$disconnect();
