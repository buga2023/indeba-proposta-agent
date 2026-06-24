/**
 * Gera o valor de AUTH_USERS com a senha já em HASH (PBKDF2), a partir de entradas
 * em texto puro. A senha real nunca fica no env nem no repositório.
 *
 * Uso:
 *   npx tsx scripts/gerar-auth-users.mts "mateus:senha1:user,gustavo:senha2:admin"
 *
 * Cole a saída em AUTH_USERS (.env.local) ou na Vercel:
 *   vercel env add AUTH_USERS production
 */
import { gerarCredencial } from "../src/lib/auth.ts";

const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: npx tsx scripts/gerar-auth-users.mts "login:senha:papel,login:senha:papel"');
  process.exit(1);
}

const partes: string[] = [];
for (const item of entrada.split(",")) {
  const [login, senha, papel] = item.split(":");
  if (!login || !senha) {
    console.error(`Entrada inválida (esperado login:senha:papel): "${item}"`);
    process.exit(1);
  }
  const credencial = await gerarCredencial(senha);
  partes.push(`${login.trim()}:${credencial}:${(papel?.trim() || "user")}`);
}

console.log(partes.join(","));
