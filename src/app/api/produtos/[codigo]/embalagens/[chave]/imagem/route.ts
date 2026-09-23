import { NextRequest, NextResponse } from "next/server";
import { imagemDaEmbalagemDoProduto } from "@/lib/produto-custom";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Foto de UMA embalagem do produto, cadastrada pela tela (áudio do Mateus, 22/09/2026). Mesma
// postura da rota irmã /api/produtos/<codigo>/imagem: bytes no Postgres, leitura autenticada
// pelo middleware, sem cache compartilhado — a foto troca por dentro da mesma URL.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string; chave: string }> }) {
  const { codigo, chave } = await params;
  try {
    const img = await imagemDaEmbalagemDoProduto(decodeURIComponent(codigo), decodeURIComponent(chave));
    if (!img) return NextResponse.json({ erro: "Imagem não encontrada." }, { status: 404 });
    return new NextResponse(new Uint8Array(img.bytes), {
      headers: { "Content-Type": img.mime, "Cache-Control": "private, max-age=0, must-revalidate" },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar a imagem", 500);
  }
}
