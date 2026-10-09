import { NextResponse } from "next/server";

// Resposta de erro segura para route handlers: loga o detalhe REAL no servidor
// (stack/Prisma/infra) e devolve ao cliente APENAS a mensagem pública curada.
// Evita vazar internals em produção (OWASP A05 — Security Misconfiguration / A09).
//
// O log sai em UMA linha JSON (revisão de ops, 08/10/2026, item #7): nos logs da Vercel um
// `console.error(msg, e)` virava várias linhas soltas, impossíveis de filtrar por rota ou
// de agrupar por tipo. Com `{nivel, mensagem, status, erro, stack, commit}` dá para buscar
// `"status":500` ou `"erro":"PrismaClientKnownRequestError"` e para ligar um drain depois.
export function respostaErro(e: unknown, mensagem: string, status = 500) {
  console.error(JSON.stringify(registroDeErro(e, mensagem, status)));
  return NextResponse.json({ erro: mensagem }, { status });
}

export function registroDeErro(e: unknown, mensagem: string, status: number) {
  const err = e instanceof Error ? e : null;
  return {
    nivel: status >= 500 ? "error" : "warn",
    origem: "api",
    mensagem,
    status,
    erro: err ? err.name : typeof e,
    detalhe: err ? err.message : String(e).slice(0, 500),
    // Três quadros bastam para achar o arquivo; a stack inteira só enche o log.
    stack: err?.stack?.split("\n").slice(1, 4).map((l) => l.trim()) ?? [],
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    ts: new Date().toISOString(),
  };
}
