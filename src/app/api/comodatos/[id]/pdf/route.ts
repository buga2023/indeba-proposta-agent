import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { pdfDoContrato } from "@/lib/ferramentas-tecnicas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Cópia do contrato de comodato (PDF) — mesmo desenho de /api/produtos/<codigo>/ficha:
// `inline` para abrir na aba, cache privado revalidável. A busca aplica o recorte por
// autor: vendedor só abre o PDF dos próprios contratos.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  try {
    const f = await pdfDoContrato(usuario, id);
    if (!f) return NextResponse.json({ erro: "Contrato não encontrado." }, { status: 404 });
    const nome = f.cliente.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 60) || "contrato";
    return new NextResponse(new Uint8Array(f.bytes), {
      headers: {
        "Content-Type": f.mime,
        "Content-Disposition": `inline; filename="contrato-${nome}.pdf"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao carregar o contrato.", 500);
  }
}
