import { NextRequest, NextResponse } from "next/server";
import { imagemDoProduto } from "@/lib/produto-custom";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Foto do produto cadastrado pela tela. Ela vive em bytes no Postgres (a função da Vercel é
// somente-leitura, então não há `public/` onde gravar) e é ESTA rota que o `imagemPath` do
// produto aponta — por isso o `<img src>` da vitrine e o PDF funcionam sem arquivo em disco.
//
// Leitura autenticada: o middleware já exige sessão em /api/**. Não é admin-only — todo
// vendedor precisa ver a foto do produto para montar proposta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  try {
    const img = await imagemDoProduto(decodeURIComponent(codigo));
    if (!img) return NextResponse.json({ erro: "Imagem não encontrada." }, { status: 404 });
    return new NextResponse(new Uint8Array(img.bytes), {
      headers: {
        "Content-Type": img.mime,
        // `private`: passa pelo middleware de auth e não pode parar em cache de CDN
        // compartilhado. `immutable` porque trocar a foto significa novo cadastro.
        "Cache-Control": "private, max-age=3600, immutable",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar a imagem", 500);
  }
}
