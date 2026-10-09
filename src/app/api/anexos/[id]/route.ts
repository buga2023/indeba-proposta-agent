import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { abrirAnexo } from "@/lib/anexos";
import { respostaErro } from "@/lib/erro";
import { disposicaoDeEntrega } from "@/lib/arquivo-seguro";

export const runtime = "nodejs";

// Serve UM anexo, com o mesmo escopo por autor do registro dono (vendedor só abre os
// seus, o gestor todos) — mesmo desenho de /api/visitas/<id>/fotos/<fotoId>.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const anexo = await abrirAnexo(usuario, id);
    if (!anexo) return NextResponse.json({ erro: "Anexo não encontrado." }, { status: 404 });
    return new NextResponse(new Uint8Array(anexo.bytes), {
      headers: {
        // inline só para PNG/JPG/WebP/PDF; qualquer outro tipo gravado sai como download.
        ...disposicaoDeEntrega(anexo.mime, anexo.nome ?? "anexo"),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao abrir o anexo.", 500);
  }
}
