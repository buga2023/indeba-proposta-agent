import { NextRequest, NextResponse } from "next/server";
import { arquivarPropostasDeDiasAnteriores } from "@/lib/manutencao";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Faxina do dashboard no fim do expediente (Vercel Cron, 20:00 UTC = 17h de Brasília):
// arquiva toda proposta de dias anteriores. Ver vercel.json.
//
// Esta rota NÃO tem sessão (o cron não manda cookie), então ela se autentica sozinha pelo
// CRON_SECRET e por isso está na lista de rotas públicas do middleware. Sem a variável
// configurada a rota se recusa a rodar — nunca fica aberta por omissão.
export async function GET(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) {
    return NextResponse.json({ erro: "CRON_SECRET não configurado." }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  try {
    const resultado = await arquivarPropostasDeDiasAnteriores();
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return respostaErro(e, "Falha ao arquivar propostas antigas", 500);
  }
}
