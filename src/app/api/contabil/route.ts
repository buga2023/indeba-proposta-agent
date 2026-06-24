import { NextRequest, NextResponse } from "next/server";
import { ContabilRequest } from "@/lib/contracts";
import { processarContabil } from "@/lib/contabil/processar";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const parsed = ContabilRequest.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await processarContabil(parsed.data));
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha na apuração contábil." },
      { status: 500 },
    );
  }
}
