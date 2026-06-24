import { NextRequest, NextResponse } from "next/server";
import { FinanceiroRequest } from "@/lib/contracts";
import { perguntar, IaIndisponivelError } from "@/lib/financeiro/agente";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = FinanceiroRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const res = await perguntar(parsed.data);
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof IaIndisponivelError) {
      return NextResponse.json({ erro: e.message }, { status: 503 });
    }
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao processar a pergunta." },
      { status: 500 },
    );
  }
}
