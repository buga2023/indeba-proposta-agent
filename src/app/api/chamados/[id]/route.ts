import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ChamadoUpdate } from "@/lib/contracts";
import { usuarioAtual, atualizarChamado, excluirChamado } from "@/lib/chamados";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Resolver/responder um chamado — SÓ o gestor (autorização no servidor).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") {
    return NextResponse.json({ erro: "Só o gestor pode resolver chamados." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = ChamadoUpdate.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  try {
    const chamado = await atualizarChamado(id, parsed.data);
    return NextResponse.json(chamado);
  } catch (e) {
    // Só P2025 (id inexistente) é 404; falha transitória (banco fora) vira 500, não um
    // "chamado não encontrado" enganoso no meio de um outage.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ erro: "Chamado não encontrado." }, { status: 404 });
    }
    return respostaErro(e, "Falha ao atualizar o chamado.", 500);
  }
}

// Excluir um chamado — SÓ o gestor. Exclusão definitiva: serve para limpar chamados de
// teste/QA; chamado real resolvido fica na lista como histórico.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") {
    return NextResponse.json({ erro: "Só o gestor pode excluir chamados." }, { status: 403 });
  }
  const { id } = await params;
  try {
    const ok = await excluirChamado(id);
    if (!ok) return NextResponse.json({ erro: "Chamado não encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir o chamado.", 500);
  }
}
