import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/chamados";
import { listarContatos, salvarContato, removerContato } from "@/lib/contatos";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Cadastro de e-mails dos clientes (painel de admin) — só o gestor.
async function exigirGestor(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return { erro: NextResponse.json({ erro: "Não autenticado." }, { status: 401 }) };
  if (u.papel !== "admin") return { erro: NextResponse.json({ erro: "Só o gestor acessa o cadastro." }, { status: 403 }) };
  return { erro: null };
}

export async function GET(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;
  return NextResponse.json({ contatos: await listarContatos() });
}

export async function POST(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;
  // req.json() lança em body vazio/malformado; sem o catch virava 500 opaco em vez
  // da validação de campo logo abaixo (mesmo idioma de cobranca/disparar).
  const { cliente, email } = (await req.json().catch(() => ({}))) as { cliente?: string; email?: string };
  if (!cliente?.trim() || !email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ erro: "Informe cliente e um e-mail válido." }, { status: 400 });
  }
  return NextResponse.json(await salvarContato(cliente.trim(), email.trim()));
}

export async function DELETE(req: NextRequest) {
  const { erro } = await exigirGestor(req);
  if (erro) return erro;
  const cliente = req.nextUrl.searchParams.get("cliente");
  if (!cliente) return NextResponse.json({ erro: "Falta o cliente." }, { status: 400 });
  await removerContato(cliente);
  return NextResponse.json({ ok: true });
}
