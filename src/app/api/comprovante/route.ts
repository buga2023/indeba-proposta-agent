import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { TipoComprovante, montarComprovante, nomeDoArquivo } from "@/lib/comprovantes";
import { comprovanteHtml } from "@/lib/pdf/template-comprovante";
import { dataUri, htmlParaPdf } from "@/lib/pdf/render";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60; // render do Chromium serverless (Vercel), igual a /api/pdf

const FOOTER = `
<div style="width:100%;font-family:Arial,sans-serif;font-size:7px;color:#9aa7b8;padding:0 14mm;display:flex;justify-content:space-between;">
  <span>Indeba — comprovante de registro</span>
  <span>Página <span class="pageNumber"></span>/<span class="totalPages"></span></span>
</div>`;

/**
 * Comprovante em PDF de um registro (áudio do Mateus, 31/08/2026). GET porque é uma
 * leitura: o link abre direto e o navegador baixa, sem a tela precisar montar um POST.
 * O escopo por autor é decidido em lib/comprovantes.ts — registro alheio responde 404.
 */
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const tipo = TipoComprovante.safeParse(req.nextUrl.searchParams.get("tipo"));
  const id = req.nextUrl.searchParams.get("id");
  if (!tipo.success || !id) return NextResponse.json({ erro: "Registro não informado." }, { status: 400 });

  try {
    const doc = await montarComprovante(usuario, tipo.data, id);
    if (!doc) return NextResponse.json({ erro: "Registro não encontrado." }, { status: 404 });

    const pdf = await htmlParaPdf(comprovanteHtml(doc, dataUri("/marca/indeba-logo.png")), {
      footer: FOOTER,
      marginTop: "12mm",
      marginBottom: "14mm",
    });

    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        // Nome só com ASCII por construção (tipo + 6 chars do cuid), então não precisa do
        // filename* da rota de proposta — ali o nome é a razão social do cliente.
        "Content-Disposition": `attachment; filename="${nomeDoArquivo(tipo.data, id)}"`,
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao gerar o comprovante em PDF.", 500);
  }
}
