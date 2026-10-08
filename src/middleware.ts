import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authAtiva, validarSessao } from "@/lib/auth";
import { rateLimitOk } from "@/lib/ratelimit";

// Rotas de API públicas: a própria autenticação. Tudo o mais exige sessão.
const API_PUBLICAS = ["/api/login", "/api/logout", "/api/cadastro"];

// Leitura pública da ficha técnica anexada pelo gestor. O PDF da Proposta de Solução linka
// "Ver ficha técnica completa" para /api/produtos/<codigo>/ficha quando a ficha veio pelo
// cadastro (produto-custom.ts); as versionadas em public/fichas-tecnicas sempre foram
// públicas. Quem clica é o CLIENTE, que não tem (nem deve ter) login: exigir sessão aqui
// dava 401 e "a ficha técnica não abre" (relato do Mateus, 08/10/2026). Só GET, só este
// caminho exato — foto, cadastro e edição continuam atrás do login. Rate limit segue valendo.
const FICHA_PUBLICA = /^\/api\/produtos\/[^/]+\/ficha$/;
const leituraPublica = (req: NextRequest) => req.method === "GET" && FICHA_PUBLICA.test(req.nextUrl.pathname);

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

// Convenção `middleware` (suportada pela Vercel). Faz rate limit + auth.
// Obs.: o Next 16 sugere migrar para `proxy`, mas o builder da Vercel ainda
// não roteia essa convenção corretamente — manter `middleware` aqui.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ehApi = pathname.startsWith("/api/");

  // 1) Rate limit em TODA rota de API. Baldes separados: login/cadastro têm
  // limite próprio (brute force) e NÃO são bloqueados pelo uso normal do app.
  if (ehApi) {
    const balde = API_PUBLICAS.includes(pathname) ? "auth" : "api";
    if (!(await rateLimitOk(ipDe(req), balde))) {
      return NextResponse.json({ erro: "Muitas requisições. Aguarde alguns segundos." }, { status: 429 });
    }
  }

  // 2) Auth — só quando há usuários configurados (em local fica aberto).
  if (!authAtiva()) return NextResponse.next();

  // Login/logout não exigem sessão (senão não há como autenticar).
  if (API_PUBLICAS.includes(pathname) || leituraPublica(req)) return NextResponse.next();

  const usuario = await validarSessao(req.cookies.get("sessao")?.value);
  if (usuario) return NextResponse.next();

  if (ehApi) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

// Matcher abrangente: TODA rota de API + a home passam pelo middleware. Evita o
// gap de listar paths um a um (subrotas como /api/cobranca/disparar ou
// /api/propostas/[id] ficavam de fora). Públicas são liberadas no corpo, não aqui.
export const config = {
  // /gerador-contratos é HTML estático em public/: sem esta entrada qualquer um com o
  // link abriria o gerador sem login (LEIA-ME do pacote, seção 4).
  matcher: ["/", "/api/:path*", "/gerador-contratos", "/gerador-contratos/:path*", "/gerador-certificados", "/gerador-certificados/:path*"],
};
