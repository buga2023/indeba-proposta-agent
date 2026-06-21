import { NextRequest, NextResponse } from "next/server";
import { ProspeccaoRequest } from "@/lib/contracts";
import { IaIndisponivelError, prospectar } from "@/lib/prospeccao/prospectar";

export const runtime = "nodejs";
export const maxDuration = 60; // a IA pode levar alguns segundos

// req do vendedor → 10 prospects + 3 abordagens (IA-gerados, revisáveis na UI).
export async function POST(req: NextRequest) {
  const parsed = ProspeccaoRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  try {
    return NextResponse.json(await prospectar(parsed.data));
  } catch (e) {
    if (e instanceof IaIndisponivelError) {
      return NextResponse.json(
        { erro: "IA indisponível. Verifique se o Ollama está rodando." },
        { status: 503 },
      );
    }
    console.error("falha na prospecção:", e);
    return NextResponse.json(
      { erro: "Falha ao gerar a prospecção.", detalhe: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
