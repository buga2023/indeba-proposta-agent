import { NextRequest, NextResponse } from "next/server";
import { EstoqueComodatoCreate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import { criarEstoqueComodato, listarEstoqueComodato, excluirEstoqueComodato } from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Estoque de Comodatos (Ferramentas Técnicas): código, peça, quantidade e observação.
// Cada lançamento é uma linha; a exportação para Excel é feita na tela, sobre esta lista.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    const itens = await listarEstoqueComodato(usuario);
    return NextResponse.json({ itens, souGestor: usuario.papel === "admin" });
  } catch (e) {
    return respostaErro(e, "Falha ao listar o estoque.", 500);
  }
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = EstoqueComodatoCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const item = await criarEstoqueComodato(usuario.email, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao lançar o item.", 500);
  }
}

// Excluir um lançamento próprio (gestor exclui qualquer um); alheio responde 404.
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Item não informado." }, { status: 400 });
  try {
    const ok = await excluirEstoqueComodato(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir o item.", 500);
  }
}
