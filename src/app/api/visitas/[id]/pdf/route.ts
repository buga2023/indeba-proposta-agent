import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { fichaDaVisita } from "@/lib/ferramentas-tecnicas";
import { dataUri } from "@/lib/pdf/render";
import { nomeArquivo, pdfDaFicha } from "@/lib/pdf/registro";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Ficha do registro em PDF (áudio do Mateus, 10/09/2026: "extrair isso aí como PDF pra
// mandar pro cliente"). Mesmo desenho de /api/comodatos/<id>/pdf: `inline` para abrir na
// aba, cache privado revalidável, e o recorte por autor aplicado na busca — vendedor só
// extrai o que é dele.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  try {
    const ficha = await fichaDaVisita(usuario, id);
    if (!ficha) return NextResponse.json({ erro: "Visita não encontrado(a)." }, { status: 404 });
    const pdf = await pdfDaFicha(ficha, dataUri("/marca/indeba-logo.png"));
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nomeArquivo("visita", ficha.cliente)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao gerar o PDF.", 500);
  }
}
