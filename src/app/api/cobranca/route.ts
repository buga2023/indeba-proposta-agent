import { NextRequest, NextResponse } from "next/server";
import { CobrancaRequest } from "@/lib/contracts";
import { processarCobranca } from "@/lib/cobranca/processar";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = CobrancaRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    return NextResponse.json(await processarCobranca(parsed.data, hoje));
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao processar a cobrança." },
      { status: 500 },
    );
  }
}
