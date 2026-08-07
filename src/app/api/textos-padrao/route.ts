import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/chamados";
import { TextosPadrao, carregarTextosPadrao, salvarTextosPadrao, textosPadraoFabrica } from "@/lib/textos-padrao";

export const runtime = "nodejs";

// Textos padrão da proposta (condições comerciais etc.). Leitura é de qualquer
// usuário logado — o botão "restaurar padrão" da Revisão precisa do texto vigente,
// não do de fábrica. Escrita é só do gestor.
export async function GET(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  return NextResponse.json({ textos: await carregarTextosPadrao(), fabrica: textosPadraoFabrica() });
}

export async function PUT(req: NextRequest) {
  const u = await usuarioAtual(req);
  if (!u) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  if (u.papel !== "admin") return NextResponse.json({ erro: "Só o gestor." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const parsed = TextosPadrao.safeParse(body?.textos ?? body);
  if (!parsed.success) return NextResponse.json({ erro: "Textos inválidos." }, { status: 400 });
  await salvarTextosPadrao(parsed.data);
  return NextResponse.json({ ok: true, textos: parsed.data });
}
