import { NextRequest, NextResponse } from "next/server";
import { EntradaEstruturada } from "@/lib/contracts";
import { montarPropostaEstruturada } from "@/lib/montar";
import { validarSessao } from "@/lib/auth";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Infos já estruturadas (sem briefing/IA) → PropostaScope (mesmo objeto canônico).
export async function POST(req: NextRequest) {
  const parsed = EntradaEstruturada.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const usuario = await validarSessao(req.cookies.get("sessao")?.value);
    const scope = await montarPropostaEstruturada(
      parsed.data,
      usuario ? { nome: usuario.nome, email: usuario.email } : null,
    );
    return NextResponse.json(scope);
  } catch (e) {
    return respostaErro(e, "Erro", 400);
  }
}
