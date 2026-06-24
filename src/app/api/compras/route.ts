import { NextRequest, NextResponse } from "next/server";
import { ComprasRequest } from "@/lib/contracts";
import { processarCompras } from "@/lib/compras/processar";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = ComprasRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await processarCompras(parsed.data));
  } catch (e) {
    return respostaErro(e, "Falha ao comparar as cotações.", 500);
  }
}
