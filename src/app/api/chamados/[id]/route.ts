import { NextRequest, NextResponse } from "next/server";
import { ChamadoUpdate } from "@/lib/contracts";
import { usuarioAtual, atualizarChamado } from "@/lib/chamados";
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
    // update num id inexistente → Prisma lança; tratamos como 404.
    return respostaErro(e, "Falha ao atualizar o chamado.", 404);
  }
}
