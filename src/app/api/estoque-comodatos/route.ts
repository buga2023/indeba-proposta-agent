import { NextRequest, NextResponse } from "next/server";
import { EstoqueComodatoCreate, EstoqueComodatoUpdate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import {
  criarEstoqueComodato,
  listarEstoqueComodato,
  editarEstoqueComodato,
  excluirEstoqueComodato,
  restaurarEstoqueComodato,
  excluirEstoqueComodatoDefinitivo,
} from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Estoque de Comodatos (Ferramentas Técnicas): código, peça, quantidade e observação.
// Cada lançamento é uma linha; a exportação para Excel é feita na tela, sobre esta lista.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const excluidas = req.nextUrl.searchParams.get("excluidas") === "1";
  try {
    const itens = await listarEstoqueComodato(usuario, excluidas);
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

// Editar lançamento (áudio do Mateus, 25/08/2026). `?acao=restaurar` tira o item da aba
// Excluídos (só gestor).
export async function PATCH(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Item não informado." }, { status: 400 });

  if (req.nextUrl.searchParams.get("acao") === "restaurar") {
    if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode restaurar itens." }, { status: 403 });
    try {
      const ok = await restaurarEstoqueComodato(usuario, id);
      if (!ok) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (e) {
      return respostaErro(e, "Falha ao restaurar o item.", 500);
    }
  }

  const parsed = EstoqueComodatoUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const ok = await editarEstoqueComodato(usuario, id, parsed.data);
    if (!ok) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao editar o item.", 500);
  }
}

// Excluir é SÓ do gestor (áudio do Mateus, 25/08/2026). Sem `?definitivo=1` vira lápide;
// com, some de vez — e só de lá.
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") return NextResponse.json({ erro: "Apenas o gestor pode excluir itens." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Item não informado." }, { status: 400 });
  const definitivo = req.nextUrl.searchParams.get("definitivo") === "1";
  try {
    const ok = definitivo ? await excluirEstoqueComodatoDefinitivo(usuario, id) : await excluirEstoqueComodato(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Item não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir o item.", 500);
  }
}
