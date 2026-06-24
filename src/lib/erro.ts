import { NextResponse } from "next/server";

// Resposta de erro segura para route handlers: loga o detalhe REAL no servidor
// (stack/Prisma/infra) e devolve ao cliente APENAS a mensagem pública curada.
// Evita vazar internals em produção (OWASP A05 — Security Misconfiguration / A09).
export function respostaErro(e: unknown, mensagem: string, status = 500) {
  console.error(`[api] ${mensagem}`, e);
  return NextResponse.json({ erro: mensagem }, { status });
}
