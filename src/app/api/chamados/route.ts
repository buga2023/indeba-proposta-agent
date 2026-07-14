import { NextRequest, NextResponse } from "next/server";
import { ChamadoCreate } from "@/lib/contracts";
import { usuarioAtual, criarChamado, listarChamados } from "@/lib/chamados";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Lista: gestor vê todos, colaborador vê os seus. `souGestor` diz à UI se mostra os controles.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    const chamados = await listarChamados(usuario);
    return NextResponse.json({ chamados, souGestor: usuario.papel === "admin" });
  } catch (e) {
    return respostaErro(e, "Falha ao listar os chamados.", 500);
  }
}

// Abrir chamado. O autor vem da sessão (constituição: dado crítico não vem do cliente).
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = ChamadoCreate.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const chamado = await criarChamado(usuario.email, parsed.data);
    return NextResponse.json(chamado, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao abrir o chamado.", 500);
  }
}
