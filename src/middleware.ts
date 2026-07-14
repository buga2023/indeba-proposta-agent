import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authAtiva, validarSessao } from "@/lib/auth";
import { rateLimitOk } from "@/lib/ratelimit";

// Rotas de API públicas: a própria autenticação. Tudo o mais exige sessão.
const API_PUBLICAS = ["/api/login", "/api/logout", "/api/cadastro"];

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

// Convenção `middleware` (suportada pela Vercel). Faz rate limit + auth.
// Obs.: o Next 16 sugere migrar para `proxy`, mas o builder da Vercel ainda
// não roteia essa convenção corretamente — manter `middleware` aqui.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ehApi = pathname.startsWith("/api/");

  // 1) Rate limit em TODA rota de API (inclui /api/login → trava brute force).
  if (ehApi && !(await rateLimitOk(ipDe(req)))) {
    return NextResponse.json({ erro: "Muitas requisições. Aguarde alguns segundos." }, { status: 429 });
  }

  // 2) Auth — só quando há usuários configurados (em local fica aberto).
  if (!authAtiva()) return NextResponse.next();

  // Login/logout não exigem sessão (senão não há como autenticar).
  if (API_PUBLICAS.includes(pathname)) return NextResponse.next();

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
  matcher: ["/", "/api/:path*"],
};
