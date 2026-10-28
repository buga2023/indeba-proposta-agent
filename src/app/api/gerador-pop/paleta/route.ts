import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { PopPaleta, salvarPopPaleta } from "@/lib/gerador-pop";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// Cores salvas da paleta do Gerador POP (lista inteira a cada gravação, até 40).
export async function PUT(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const parsed = PopPaleta.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ erro: "Paleta inválida." }, { status: 400 });
  try {
    await salvarPopPaleta(parsed.data.cores);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return respostaErro(e, "Falha ao salvar a paleta.", 500);
  }
}
