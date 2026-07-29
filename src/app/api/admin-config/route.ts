import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/chamados";
import { getGestorEmail, setGestorEmail } from "@/lib/contatos";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Configurações do painel de admin (e-mail do gestor que recebe o resumo) — só o gestor.
export async function GET(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (u.papel !== "admin") return NextResponse.json({ erro: "Só o gestor." }, { status: 403 });
  return NextResponse.json({ gestorEmail: await getGestorEmail() });
}

export async function PUT(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (u.papel !== "admin") return NextResponse.json({ erro: "Só o gestor." }, { status: 403 });
  // req.json() lança em body vazio/malformado; sem o catch virava 500 opaco em vez
  // da validação de campo logo abaixo (mesmo idioma de cobranca/disparar).
  const { gestorEmail } = (await req.json().catch(() => ({}))) as { gestorEmail?: string };
  if (!gestorEmail || !EMAIL_RE.test(gestorEmail)) {
    return NextResponse.json({ erro: "E-mail do gestor inválido." }, { status: 400 });
  }
  await setGestorEmail(gestorEmail.trim());
  return NextResponse.json({ ok: true, gestorEmail: gestorEmail.trim() });
}
