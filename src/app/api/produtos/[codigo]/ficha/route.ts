import { NextRequest, NextResponse } from "next/server";
import { fichaDoProduto } from "@/lib/produto-custom";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Ficha técnica (PDF) do produto cadastrado pela tela — mesmo raciocínio da rota de imagem.
// É para onde o `fichaTecnicaPath` aponta, então o link "ficha técnica" do Catálogo abre
// normalmente. `inline` para o PDF abrir na aba, como os arquivos de public/fichas-tecnicas.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const limpo = decodeURIComponent(codigo);
  try {
    const f = await fichaDoProduto(limpo);
    if (!f) return NextResponse.json({ erro: "Ficha não encontrada." }, { status: 404 });
    return new NextResponse(new Uint8Array(f.bytes), {
      headers: {
        "Content-Type": f.mime,
        // Nome do arquivo entre aspas e sem o que possa quebrar o header — o código é
        // [A-Z0-9-] na entrada, mas o header não é lugar de confiar em validação distante.
        "Content-Disposition": `inline; filename="${limpo.replace(/[^A-Za-z0-9._-]/g, "")}.pdf"`,
        // Sem `immutable`: a ficha pode ser trocada ou removida na edição do produto, e a
        // URL continua a mesma — cache imutável entregaria o PDF antigo depois da troca.
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar a ficha técnica", 500);
  }
}
