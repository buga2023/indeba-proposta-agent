import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { listarPop } from "@/lib/gerador-pop";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Catálogo compartilhado do Gerador POP (produtos + cores salvas). Qualquer usuário logado lê.
export async function GET(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    return NextResponse.json(await listarPop());
  } catch (e) {
    return respostaErro(e, "Falha ao carregar o catálogo do Gerador POP.", 500);
  }
}
