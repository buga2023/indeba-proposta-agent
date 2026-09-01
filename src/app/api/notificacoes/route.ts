import { NextRequest, NextResponse } from "next/server";
import { usuarioAtual } from "@/lib/auth-db";
import { contarNovasSolicitacoes, marcarSolicitacoesVistas } from "@/lib/notificacoes";
import { respostaErro } from "@/lib/erro";

export const runtime = "nodejs";

// O íconezinho do gestor (áudio do Mateus, 31/08/2026). GET conta o que ele ainda não
// viu; POST carimba "vi" quando ele abre a aba de solicitações. Para quem não é admin o
// contador é sempre 0 — a tela nem mostra o selo.
export async function GET(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    return NextResponse.json({ novasSolicitacoes: await contarNovasSolicitacoes(usuario) });
  } catch (e) {
    return respostaErro(e, "Falha ao consultar notificações.", 500);
  }
}

export async function POST(req: NextRequest) {
  const usuario = await usuarioAtual(req);
  if (!usuario) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  try {
    await marcarSolicitacoesVistas(usuario);
    return NextResponse.json({ ok: true, novasSolicitacoes: 0 });
  } catch (e) {
    return respostaErro(e, "Falha ao marcar as notificações como vistas.", 500);
  }
}
