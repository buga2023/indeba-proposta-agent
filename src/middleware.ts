import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authAtiva, validarSessao } from "@/lib/auth";
import { rateLimitOk } from "@/lib/ratelimit";

const ROTAS_API = ["/api/montar", "/api/pdf", "/api/montar-estruturado", "/api/catalogo", "/api/propostas", "/api/prospectar", "/api/financeiro"];

function ipDe(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
}

// Convenção `middleware` (suportada pela Vercel). Faz rate limit + auth.
// Obs.: o Next 16 sugere migrar para `proxy`, mas o builder da Vercel ainda
// não roteia essa convenção corretamente — manter `middleware` aqui.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ehApi = ROTAS_API.some((p) => pathname.startsWith(p));

  // 1) Rate limit nas rotas custosas (IA/PDF) — antes de qualquer trabalho.
  if (ehApi && !(await rateLimitOk(ipDe(req)))) {
    return NextResponse.json({ erro: "Muitas requisições. Aguarde alguns segundos." }, { status: 429 });
  }

  // 2) Auth — só quando há usuários configurados (em local fica aberto).
  if (!authAtiva()) return NextResponse.next();

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

export const config = {
  matcher: ["/", "/api/montar", "/api/pdf", "/api/montar-estruturado", "/api/catalogo", "/api/propostas", "/api/prospectar", "/api/financeiro"],
};
