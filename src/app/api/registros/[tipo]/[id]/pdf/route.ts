import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { fichaDaVisita } from "@/lib/ferramentas-tecnicas";
import { fichaDaProspeccao, fichaDaSolicitacao } from "@/lib/ferramentas-comerciais";
import { dataUri } from "@/lib/pdf/render";
import { nomeArquivo, pdfDaFicha, type Ficha } from "@/lib/pdf/registro";
import { respostaErro } from "@/lib/erro";
import type { SessaoUsuario } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Ficha do registro em PDF (áudio do Mateus, 10/09/2026: "extrair isso aí como PDF pra
 * mandar pro cliente").
 *
 * UMA rota com `[tipo]` no caminho, e não três rotas irmãs, por um motivo concreto: cada
 * rota do Next vira uma função serverless PRÓPRIA, e esta puxa o Chromium
 * (@sparticuz/chromium, via lib/pdf/render). Três cópias do navegador estouraram o tamanho
 * do deploy — o build passou e o "Deploying outputs" morreu sem mensagem (10/09/2026). Com
 * o tipo como segmento dinâmico, as três fichas dividem a mesma função e o mesmo Chromium.
 *
 * O recorte por autor mora em cada `ficha*` (mesma regra da listagem): o id é cuid não
 * adivinhável, mas a rota não pode ser a fresta por onde um vendedor lê o registro do colega.
 */
const FICHAS: Record<string, { buscar: (u: SessaoUsuario, id: string) => Promise<Ficha | null>; prefixo: string; oQue: string }> = {
  visita: { buscar: fichaDaVisita, prefixo: "visita", oQue: "Visita" },
  prospeccao: { buscar: fichaDaProspeccao, prefixo: "prospeccao", oQue: "Prospecção" },
  solicitacao: { buscar: fichaDaSolicitacao, prefixo: "solicitacao", oQue: "Solicitação" },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { tipo, id } = await params;
  const ficha = FICHAS[tipo];
  if (!ficha) return NextResponse.json({ erro: "Tipo de registro desconhecido." }, { status: 404 });

  try {
    const dados = await ficha.buscar(usuario, id);
    if (!dados) return NextResponse.json({ erro: `${ficha.oQue} não encontrada.` }, { status: 404 });
    const pdf = await pdfDaFicha(dados, dataUri("/marca/indeba-logo.png"));
    // `inline` para abrir no visualizador do navegador, de onde a pessoa salva ou manda
    // pelo WhatsApp — mesmo desenho de /api/comodatos/<id>/pdf.
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${nomeArquivo(ficha.prefixo, dados.cliente)}"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (e) {
    return respostaErro(e, "Falha ao gerar o PDF.", 500);
  }
}
