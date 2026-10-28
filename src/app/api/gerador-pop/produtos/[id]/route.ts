import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { POP_ID, PopProduto, excluirPopProduto, salvarPopProduto } from "@/lib/gerador-pop";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Gravar/excluir um produto do Gerador POP. O catálogo é do time: qualquer usuário logado
// edita (como no HTML original, em que o catálogo compartilhado era aberto a todos).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  if (!POP_ID.safeParse(id).success) return NextResponse.json({ erro: "Id inválido." }, { status: 400 });
  const parsed = PopProduto.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: "Produto inválido." }, { status: 400 });
  try {
    await salvarPopProduto(id, parsed.data, u.email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao salvar o produto.", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  if (!POP_ID.safeParse(id).success) return NextResponse.json({ erro: "Id inválido." }, { status: 400 });
  try {
    await excluirPopProduto(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir o produto.", 500);
  }
}
