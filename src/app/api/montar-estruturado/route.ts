import { NextRequest, NextResponse } from "next/server";
import { EntradaEstruturada } from "@/lib/contracts";
import { montarPropostaEstruturada } from "@/lib/montar";
import { validarSessao, nomeExibicao } from "@/lib/auth";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Infos já estruturadas (sem briefing/IA) → PropostaScope (mesmo objeto canônico).
export async function POST(req: NextRequest) {
  const parsed = EntradaEstruturada.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const login = (await validarSessao(req.cookies.get("sessao")?.value))?.login;
    const scope = await montarPropostaEstruturada(parsed.data, login ? nomeExibicao(login) : null);
    return NextResponse.json(scope);
  } catch (e) {
    return respostaErro(e, "Erro", 400);
  }
}
