import { NextResponse } from "next/server";
import { lerPropostas } from "@/lib/log";

export const runtime = "nodejs";

// Histórico real = log append-only de propostas geradas (constituição §1.8).
// Só leitura; cada registro é um PDF efetivamente emitido.
export async function GET() {
  try {
    const propostas = await lerPropostas();
    return NextResponse.json({ propostas });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Falha ao ler propostas" },
      { status: 500 },
    );
  }
}
