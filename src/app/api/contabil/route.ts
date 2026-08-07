import { NextRequest, NextResponse } from "next/server";
import { ContabilRequest } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import { processarContabil } from "@/lib/contabil/processar";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

// Só o gestor. Apuração contábil da empresa — dado interno, mesma classe de `/api/cobranca`.
// O middleware garante login; aqui vai o gate de papel que faltava.
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") {
    return NextResponse.json({ erro: "Só o gestor acessa a apuração contábil." }, { status: 403 });
  }

  const parsed = ContabilRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await processarContabil(parsed.data));
  } catch (e) {
    return respostaErro(e, "Falha na apuração contábil.", 500);
  }
}
