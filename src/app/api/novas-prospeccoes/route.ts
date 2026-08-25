import { NextRequest, NextResponse } from "next/server";
import { RelatorioProspeccaoCreate } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import { criarRelatorioProspeccao, listarRelatoriosProspeccao, excluirRelatorioProspeccao } from "@/lib/ferramentas-comerciais";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Relatório de Novas Prospecções (Ferramentas Comerciais): anotação manual do vendedor.
// Gestor vê todos os registros, vendedor vê só os seus.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    const relatorios = await listarRelatoriosProspeccao(usuario);
    return NextResponse.json({ relatorios, souGestor: usuario.papel === "admin" });
  } catch (e) {
    return respostaErro(e, "Falha ao listar as prospecções.", 500);
  }
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = RelatorioProspeccaoCreate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const relatorio = await criarRelatorioProspeccao(usuario.email, parsed.data);
    return NextResponse.json(relatorio, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao registrar a prospecção.", 500);
  }
}

// Excluir registro próprio (gestor exclui qualquer um); alheio responde 404.
export async function DELETE(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ erro: "Registro não informado." }, { status: 400 });
  try {
    const ok = await excluirRelatorioProspeccao(usuario, id);
    if (!ok) return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir a prospecção.", 500);
  }
}
