// Minerador de contatos — 100% determinístico. Extrai e-mail, telefone e links de
// redes sociais do TEXTO real de páginas web (snippets/raw_content da Tavily).
// É o núcleo que sustenta a §2: todo contato que sai daqui tem origem numa página,
// nunca no modelo. A IA não produz contato; só escreve a abordagem.

export type Contatos = {
  emails: string[];
  telefones: string[];
  redes: {
    linkedin: string[];
    instagram: string[];
    facebook: string[];
    whatsapp: string[];
  };
};

const RE_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Telefone BR: +55 opcional, DDD (com ou sem parênteses), 8-9 dígitos com separador.
const RE_TELEFONE = /(?:\+?55[\s.-]?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/g;
const RE_LINKEDIN = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9_%-]+/gi;
const RE_INSTAGRAM = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[A-Za-z0-9_.]+/gi;
const RE_FACEBOOK = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/[A-Za-z0-9_.-]+/gi;
const RE_WHATSAPP = /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)\d{8,}/gi;

// E-mails que parecem contato mas são lixo de página/asset/placeholder.
const EMAIL_LIXO = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", "@2x", "@sentry", "wixpress", "example.com", "domain.com", "email.com", "seuemail", "your@", "@example"];
// Caminhos genéricos das redes que NÃO são perfis de empresa.
const REDE_LIXO = ["/p/", "/reel", "/explore", "/accounts", "/sharer", "/tr?", "/plugins", "/dialog", "/feed", "/sharearticle", "/sharing", "/login", "/help", "/policy", "/policies", "/about/"];

// Handles reservados do Instagram/Facebook — são páginas de sistema, não perfis de
// empresa. O raw_content da Tavily (muito login-wall do IG) vaza estes como se fossem
// contato; filtra na origem além da checagem de individualidade no enriquecimento.
const HANDLE_RESERVADO = new Set([
  "p", "reel", "reels", "explore", "accounts", "about", "policy", "policies", "legal",
  "privacy", "terms", "help", "developer", "developers", "directory", "web", "watch",
  "events", "groups", "marketplace", "pages", "stories", "tv", "igtv", "v", "login",
  "signup", "sharer", "dialog", "tr", "plugins", "profile.php",
]);

// Instagram/Facebook: o "handle" é o 1º segmento do path. Vale como perfil só se não
// for reservado, não for puramente numérico (ID interno da rede) nem curto demais.
function handleValido(url: string): boolean {
  const m = url.match(/(?:instagram|facebook)\.com\/([a-z0-9_.-]+)/i);
  const h = m?.[1]?.toLowerCase().replace(/[._-]+$/, "") ?? "";
  if (h.length < 3) return false;
  if (HANDLE_RESERVADO.has(h)) return false;
  if (/^\d+$/.test(h)) return false; // ID numérico, não @perfil
  return true;
}

function unico(xs: string[]): string[] {
  return [...new Set(xs)];
}

function soDigitos(s: string): string {
  return s.replace(/\D/g, "");
}

function ehTelefoneValido(bruto: string): boolean {
  // Telefone real numa página vem FORMATADO: parênteses, espaço, traço ou +55.
  // Um bloco de dígitos cru (timestamp 1768422505, INT_MAX 2147483647, IDs de
  // tracking) NÃO é telefone — é o lixo que vaza do raw_content do LinkedIn.
  if (!/[\s().\-]/.test(bruto.replace(/^\+?55/, ""))) return false;

  const d = soDigitos(bruto);
  const semDdi = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  // DDD (2) + 8 ou 9 dígitos.
  if (semDdi.length !== 10 && semDdi.length !== 11) return false;
  // Descarta sequências triviais (00000000000, 11111111111).
  if (/^(\d)\1+$/.test(semDdi)) return false;
  // DDD válido (não existe < 11) e prefixo do número: celular (9 díg) começa com 9,
  // fixo (8 díg) começa 2-5. Barra timestamps que passariam pelo tamanho.
  if (parseInt(semDdi.slice(0, 2), 10) < 11) return false;
  const numero = semDdi.slice(2);
  if (numero.length === 9 && numero[0] !== "9") return false;
  if (numero.length === 8 && !"2345".includes(numero[0])) return false;
  return true;
}

function normalizarUrl(u: string): string {
  return u.startsWith("http") ? u : `https://${u}`;
}

function redeLimpa(u: string): boolean {
  const baixa = u.toLowerCase();
  return !REDE_LIXO.some((lixo) => baixa.includes(lixo));
}

export function minerarContatos(texto: string): Contatos {
  const t = texto ?? "";
  const baixa = t.toLowerCase();

  const emails = unico(
    (t.match(RE_EMAIL) ?? [])
      .map((e) => e.toLowerCase().replace(/[.,;]+$/, ""))
      .filter((e) => !EMAIL_LIXO.some((lixo) => e.includes(lixo))),
  );

  const telefones = unico(
    (t.match(RE_TELEFONE) ?? []).map((s) => s.trim()).filter(ehTelefoneValido),
  )
    // dedup por dígitos (formatações diferentes do mesmo número)
    .filter((tel, i, arr) => arr.findIndex((o) => soDigitos(o) === soDigitos(tel)) === i);

  const captura = (re: RegExp, validar?: (u: string) => boolean) =>
    unico(
      (baixa.match(re) ?? [])
        .map(normalizarUrl)
        .filter(redeLimpa)
        .filter((u) => !validar || validar(u)),
    );

  return {
    emails,
    telefones,
    redes: {
      linkedin: captura(RE_LINKEDIN),
      instagram: captura(RE_INSTAGRAM, handleValido),
      facebook: captura(RE_FACEBOOK, handleValido),
      whatsapp: captura(RE_WHATSAPP),
    },
  };
}
