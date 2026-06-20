// Autenticação simples multiusuário por sessão assinada (HMAC). Edge-safe (Web Crypto).
// Os usuários vêm de AUTH_USERS (env) — nunca hardcoded no repositório.
//   AUTH_USERS="mateus:senha:user,gustavo:senha:admin"
// Se AUTH_USERS for vazio, a autenticação fica DESLIGADA (uso local em 127.0.0.1).

export type Papel = "admin" | "user";
export type Usuario = { login: string; senha: string; papel: Papel };

const secret = () => process.env.AUTH_SESSION_SECRET ?? "dev-secret-trocar-em-producao";

export function usuarios(): Usuario[] {
  const raw = process.env.AUTH_USERS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entrada) => {
      const [login, senha, papel] = entrada.split(":");
      return { login: login?.trim(), senha, papel: (papel?.trim() as Papel) || "user" };
    })
    .filter((u): u is Usuario => Boolean(u.login && u.senha));
}

export function authAtiva(): boolean {
  return usuarios().length > 0;
}

export function validarCredenciais(login: string, senha: string): Usuario | null {
  return usuarios().find((u) => u.login === login && u.senha === senha) ?? null;
}

async function assinar(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Cookie de sessão = "login.hmac(login)". Opaco, httpOnly, validável no edge.
export async function criarSessao(login: string): Promise<string> {
  return `${login}.${await assinar(login)}`;
}

export async function validarSessao(cookie: string | undefined): Promise<Usuario | null> {
  if (!cookie) return null;
  const i = cookie.lastIndexOf(".");
  if (i < 1) return null;
  const login = cookie.slice(0, i);
  const sig = cookie.slice(i + 1);
  const esperado = await assinar(login);
  // comparação de tamanho fixo evita vazar por timing trivial
  if (sig.length !== esperado.length || sig !== esperado) return null;
  return usuarios().find((u) => u.login === login) ?? null;
}
