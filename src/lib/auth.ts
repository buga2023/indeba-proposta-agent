// Autenticação simples multiusuário por sessão assinada (HMAC). Edge-safe (Web Crypto).
// Os usuários vêm de AUTH_USERS (env) — nunca hardcoded no repositório. A senha é
// guardada com HASH (PBKDF2), nunca em texto puro:
//   AUTH_USERS="mateus:SALThex.HASHhex:user,gustavo:SALThex.HASHhex:admin"
// Gere os hashes com: npx tsx scripts/gerar-auth-users.mts "mateus:senha:user,..."
// Se AUTH_USERS for vazio, a autenticação fica DESLIGADA (uso local em 127.0.0.1).

export type Papel = "admin" | "user";
// `credencial` = "salt.hash" (PBKDF2). Mantém a senha real fora do env.
export type Usuario = { login: string; credencial: string; papel: Papel };

const secret = () => process.env.AUTH_SESSION_SECRET ?? "dev-secret-trocar-em-producao";

export function usuarios(): Usuario[] {
  const raw = process.env.AUTH_USERS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entrada) => {
      const [login, credencial, papel] = entrada.split(":");
      return { login: login?.trim(), credencial, papel: (papel?.trim() as Papel) || "user" };
    })
    .filter((u): u is Usuario => Boolean(u.login && u.credencial));
}

export function authAtiva(): boolean {
  return usuarios().length > 0;
}

// ── Hash de senha (PBKDF2-SHA256, Web Crypto — edge-safe) ──────────────
const PBKDF2_ITER = 100_000;

function hex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
function bytesDeHex(h: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function derivar(senha: string, salt: BufferSource): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(senha), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    key,
    256,
  );
  return hex(bits);
}

// Gera "salt.hash" para uma senha — usado pelo script gerador do AUTH_USERS.
export async function gerarCredencial(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${hex(salt.buffer)}.${await derivar(senha, salt)}`;
}

export async function validarCredenciais(login: string, senha: string): Promise<Usuario | null> {
  const u = usuarios().find((x) => x.login === login);
  if (!u) return null;
  const ponto = u.credencial.indexOf(".");
  if (ponto < 1) return null; // formato antigo (texto puro) → inválido; regenere o AUTH_USERS
  const esperado = u.credencial.slice(ponto + 1);
  const recebido = await derivar(senha, bytesDeHex(u.credencial.slice(0, ponto)));
  if (recebido.length !== esperado.length || recebido !== esperado) return null; // tempo ~constante
  return u;
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

// Validade da sessão — casa com o maxAge do cookie (login/route.ts). A expiração vai
// ASSINADA no token: um cookie capturado deixa de ser replayável pra sempre.
const TTL_MS = 8 * 60 * 60 * 1000; // 8h

// Cookie de sessão = "login.exp.hmac(login.exp)". Opaco, httpOnly, validável no edge.
export async function criarSessao(login: string, agora = Date.now()): Promise<string> {
  const payload = `${login}.${agora + TTL_MS}`;
  return `${payload}.${await assinar(payload)}`;
}

export async function validarSessao(cookie: string | undefined, agora = Date.now()): Promise<Usuario | null> {
  if (!cookie) return null;
  const i = cookie.lastIndexOf(".");
  if (i < 1) return null;
  const payload = cookie.slice(0, i); // "login.exp"
  const sig = cookie.slice(i + 1);
  const esperado = await assinar(payload);
  // comparação de tamanho fixo evita vazar por timing trivial
  if (sig.length !== esperado.length || sig !== esperado) return null;
  // exp é o último segmento (numérico) — separa do login mesmo que o login tenha ponto.
  const j = payload.lastIndexOf(".");
  if (j < 1) return null;
  const exp = Number(payload.slice(j + 1));
  if (!Number.isFinite(exp) || exp < agora) return null; // expirada
  const login = payload.slice(0, j);
  return usuarios().find((u) => u.login === login) ?? null;
}
