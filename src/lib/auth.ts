// Autenticação simples multiusuário por sessão assinada (HMAC). Edge-safe (Web Crypto,
// sem Buffer/Prisma) — importado pelo middleware (Edge Runtime).
// Os usuários vivem no banco (model Usuario — nome/e-mail/senha via cadastro próprio em
// /api/cadastro, ver src/lib/auth-db.ts, que roda em Node.js e por isso não pode ser
// importado aqui). A sessão é AUTOCONTIDA: o cookie carrega {email,nome,papel,exp}
// assinado, então validarSessao nunca consulta o banco — só valida a assinatura.

export type Papel = "admin" | "user";
export type Usuario = { email: string; nome: string; papel: Papel };

// `papel` é o que a pessoa PODE FAZER depois de entrar; `acesso` é se ela ENTRA. Como o
// cadastro é aberto (o colaborador cria a própria conta em /cadastro), quem se cadastra
// nasce `pendente` e o gestor libera no painel. Nunca entra no cookie de sessão: sessão é
// assinada e vale 8h sem tocar o banco, então um `acesso` carimbado ali envelheceria — a
// revogação ficaria valendo só depois de expirar. O estado é sempre lido do banco.
export type Acesso = "pendente" | "aprovado" | "bloqueado";

// Segredo que assina o cookie de sessão. FALHA FECHADA em produção: sem um
// AUTH_SESSION_SECRET próprio, quem assina é uma string que está pública no repositório —
// e com ela qualquer um forja um cookie `papel:"admin"` e lê todo dado sensível (financeiro,
// cobrança, time, todas as propostas). Antes o código caía nessa string em silêncio; agora,
// se a variável faltar (ou for justamente o fallback) num deploy de produção, assinar e
// validar sessão LANÇA — o site fica fora do ar até configurar, o que é infinitamente melhor
// do que ficar aberto com uma chave conhecida. Em dev (NODE_ENV !== production) o fallback
// segue valendo, para não travar o uso local em 127.0.0.1.
const DEV_SECRET = "dev-secret-trocar-em-producao";
function secret(): string {
  const s = process.env.AUTH_SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!s || s === DEV_SECRET)) {
    throw new Error(
      "AUTH_SESSION_SECRET ausente ou inseguro em produção. Defina um valor longo e aleatório (ex.: openssl rand -hex 32) no painel da Vercel.",
    );
  }
  return s || DEV_SECRET;
}

// Liga por padrão. Só desliga com AUTH_ENABLED=false explícito (uso local em 127.0.0.1
// sem quem logar ainda) — nunca desliga sozinha em produção.
export function authAtiva(): boolean {
  return process.env.AUTH_ENABLED !== "false";
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

// Gera "salt.hash" para uma senha — usado no cadastro (src/lib/auth-db.ts).
export async function gerarCredencial(senha: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${hex(salt.buffer)}.${await derivar(senha, salt)}`;
}

// Confere uma senha contra "salt.hash" — comparação de tamanho fixo (evita vazar por
// timing trivial). Usado por validarCredenciais (auth-db.ts).
export async function validarHash(senha: string, credencial: string): Promise<boolean> {
  const ponto = credencial.indexOf(".");
  if (ponto < 1) return false; // formato inesperado
  const esperado = credencial.slice(ponto + 1);
  const recebido = await derivar(senha, bytesDeHex(credencial.slice(0, ponto)));
  return recebido.length === esperado.length && recebido === esperado;
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

// base64url manual (sem Buffer — Edge Runtime não garante o polyfill). btoa/atob só
// trabalham em Latin1, por isso passa pelos bytes UTF-8 explicitamente (nome tem acento).
function base64url(bytes: Uint8Array): string {
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64urlParaBytes(s: string): Uint8Array {
  const pad = (4 - (s.length % 4)) % 4;
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

// Validade da sessão — casa com o maxAge do cookie (login/cadastro). A expiração vai
// ASSINADA no token: um cookie capturado deixa de ser replayável pra sempre.
const TTL_MS = 8 * 60 * 60 * 1000; // 8h

type SessaoPayload = { email: string; nome: string; papel: Papel; exp: number };

// Cookie de sessão = "base64url(json {email,nome,papel,exp}).hmac(payload)". Opaco,
// httpOnly, validável no edge sem tocar banco.
export async function criarSessao(usuario: Usuario, agora = Date.now()): Promise<string> {
  const dados: SessaoPayload = { email: usuario.email, nome: usuario.nome, papel: usuario.papel, exp: agora + TTL_MS };
  const payload = base64url(new TextEncoder().encode(JSON.stringify(dados)));
  return `${payload}.${await assinar(payload)}`;
}

export async function validarSessao(cookie: string | undefined, agora = Date.now()): Promise<Usuario | null> {
  if (!cookie) return null;
  const i = cookie.lastIndexOf(".");
  if (i < 1) return null;
  const payload = cookie.slice(0, i);
  const sig = cookie.slice(i + 1);
  const esperado = await assinar(payload);
  // comparação de tamanho fixo evita vazar por timing trivial
  if (sig.length !== esperado.length || sig !== esperado) return null;

  let dados: SessaoPayload;
  try {
    dados = JSON.parse(new TextDecoder().decode(base64urlParaBytes(payload)));
  } catch {
    return null; // payload corrompido/adulterado
  }
  if (!dados?.email || !dados.papel || !Number.isFinite(dados.exp)) return null;
  if (dados.exp < agora) return null; // expirada
  return { email: dados.email, nome: dados.nome ?? "", papel: dados.papel };
}

// Quem está pedindo, SEGUNDO O COOKIE. Em dev local sem auth, vira admin "local" pra não
// travar o uso. Com auth ativa e sem sessão válida → null (401 na rota).
//
// Edge-safe (este arquivo é importado pelo middleware, que não pode tocar o banco). Rota
// que decide por papel deve usar `usuarioAtual` de lib/auth-db.ts, que confirma o papel no
// banco: o cookie é assinado e vale 8h, então o papel gravado nele envelhece — promover
// alguém no painel não valeria até a pessoa sair e entrar de novo.
export type SessaoUsuario = { email: string; papel: Papel };

export async function sessaoDoRequest(req: { cookies: { get(n: string): { value: string } | undefined } }): Promise<SessaoUsuario | null> {
  const u = await validarSessao(req.cookies.get("sessao")?.value);
  if (u) return { email: u.email, papel: u.papel };
  if (!authAtiva()) return { email: "local", papel: "admin" };
  return null;
}
