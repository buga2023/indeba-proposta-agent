import { NextRequest, NextResponse } from "next/server";
import { FiscalRequest } from "@/lib/contracts";
import { processarFiscal } from "@/lib/fiscal/processar";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = FiscalRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await processarFiscal(parsed.data));
  } catch (e) {
    return respostaErro(e, "Falha ao ler a NF-e.", 500);
  }
}
