import { NextRequest, NextResponse } from "next/server";
import { EntradaEstruturada } from "@/lib/contracts";
import { montarPropostaEstruturada } from "@/lib/montar";

export const runtime = "nodejs";

// Infos já estruturadas (sem briefing/IA) → PropostaScope (mesmo objeto canônico).
export async function POST(req: NextRequest) {
  const parsed = EntradaEstruturada.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const scope = await montarPropostaEstruturada(parsed.data);
    return NextResponse.json(scope);
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Erro" }, { status: 400 });
  }
}
