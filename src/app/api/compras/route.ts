import { NextRequest, NextResponse } from "next/server";
import { ComprasRequest } from "@/lib/contracts";
import { usuarioAtual } from "@/lib/auth-db";
import { processarCompras } from "@/lib/compras/processar";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";
export const maxDuration = 60;

// Só o gestor. Compara cotações de fornecedores da empresa — dado de compras interno, mesma
// classe de `/api/cobranca`. O middleware garante login; aqui vai o gate de papel.
export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (usuario.papel !== "admin") {
    return NextResponse.json({ erro: "Só o gestor acessa o módulo de compras." }, { status: 403 });
  }

  const parsed = ComprasRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ erro: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await processarCompras(parsed.data));
  } catch (e) {
    return respostaErro(e, "Falha ao comparar as cotações.", 500);
  }
}
