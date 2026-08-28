import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { fotoDaVisita, excluirFotoVisita } from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Serve UMA foto da visita, com o MESMO escopo da listagem (vendedor só vê as suas, o
// gestor todas) — mesmo desenho de /api/comodatos/<id>/pdf.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; fotoId: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id, fotoId } = await ctx.params;
  try {
    const foto = await fotoDaVisita(usuario, id, fotoId);
    if (!foto) return NextResponse.json({ erro: "Foto não encontrada." }, { status: 404 });
    return new NextResponse(new Uint8Array(foto.bytes), {
      headers: {
        "Content-Type": foto.mime,
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao abrir a foto.", 500);
  }
}

// Tirar foto anexada errado (áudio do Mateus, 27/08/2026) — mesmo escopo: o autor mexe
// nas suas visitas, o gestor em todas.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string; fotoId: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id, fotoId } = await ctx.params;
  try {
    const ok = await excluirFotoVisita(usuario, id, fotoId);
    if (!ok) return NextResponse.json({ erro: "Foto não encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao excluir a foto.", 500);
  }
}
