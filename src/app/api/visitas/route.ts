import { NextRequest, NextResponse } from "next/server";
import { VisitaCarteiraCreate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import { criarVisita, listarVisitas, excluirVisita } from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Registro de Visitas da Carteira (Ferramentas Técnicas). Gestor vê todos os registros,
// vendedor vê só os seus — mesmo recorte de /api/chamados.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    const visitas = await listarVisitas(usuario);
    return NextResponse.json({ visitas, souGestor: usuario.papel === "admin" });
  } catch (e) {
    return respostaErro(e, "Falha ao listar as visitas.", 500);
  }
}

// Lançar visita. O autor vem da sessão (dado crítico não vem do cliente).
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = VisitaCarteiraCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const visita = await criarVisita(usuario.email, parsed.data);
    return NextResponse.json(visita, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao registrar a visita.", 500);
  }
}

// Excluir um registro próprio (gestor exclui qualquer um). Registro alheio responde 404,
// não 403 — posse não se revela (mesmo desenho de /api/propostas).
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Registro não informado." }, { status: 400 });
  try {
    const ok = await excluirVisita(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir a visita.", 500);
  }
}
