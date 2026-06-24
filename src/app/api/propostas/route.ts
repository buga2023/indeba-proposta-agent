import { NextRequest, NextResponse } from "next/server";
import { PropostaScope } from "@/lib/contracts";
import { validarSessao } from "@/lib/auth";
import { listarPropostas, salvarProposta } from "@/lib/propostas";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Histórico = propostas persistidas (store de trabalho, com status comercial mutável).
export async function GET() {
  try {
    return NextResponse.json({ propostas: await listarPropostas() });
  } catch (e) {
    return respostaErro(e, "Falha ao listar propostas", 500);
  }
}

// Auto-save da proposta gerada/editada (constituição: informação gerada é persistida).
// `autor` vem da sessão — dado crítico não vem do cliente.
export async function POST(req: NextRequest) {
  const parsed = PropostaScope.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const autor = (await validarSessao(req.cookies.get("sessao")?.value))?.login ?? "local";
    const registro = await salvarProposta(parsed.data, autor);
    return NextResponse.json(registro, { status: 201 });
  } catch (e) {
    return respostaErro(e, "Falha ao salvar a proposta", 500);
  }
}
